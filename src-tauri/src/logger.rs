//! 统一应用日志系统（WI-007）：
//! 分级（debug/info/warn/error）+ 模块标签 + 时间戳，落盘到应用数据目录 `logs/` 下。
//!
//! 双端对齐：Node Web 模式对应 `src/server/logger.ts`，格式与路径完全一致：
//!   `<ISO 本地时间> [LEVEL] [module] message`
//! 轮转：单文件 ≥ 5MB 触发轮转为 `agenthub.log.N`，保留最近 5 份（按大小）。
//!
//! 采用自实现的最小 RollingFileAppender，避免引入额外框架复杂度，同时保证
//! Rust 与 Node 两端的轮转语义 100% 一致（5MB / 5 份），不依赖 tracing-appender
//! 的轮转策略（其按大小/日轮转的保留份数语义与 Node 侧不易对齐）。

use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;

use crate::storage::get_app_data_dir;

/// 日志目录名（位于应用数据目录下）。
pub const LOG_DIR_NAME: &str = "logs";
/// 当前活动日志文件名。
pub const LOG_FILE_NAME: &str = "agenthub.log";
/// 单个日志文件大小上限（字节），超过即轮转。
pub const MAX_LOG_BYTES: u64 = 5 * 1024 * 1024;
/// 保留的历史日志份数（不包含当前活动文件）。
pub const MAX_LOG_FILES: usize = 5;

/// 全局日志写入器（进程内单例）。用 Mutex 串行化跨命令/线程的追加写。
static WRITER: Mutex<Option<LogWriter>> = Mutex::new(None);

struct LogWriter {
    dir: PathBuf,
}

impl LogWriter {
    fn new() -> Self {
        let dir = get_app_data_dir().join(LOG_DIR_NAME);
        let _ = fs::create_dir_all(&dir);
        LogWriter { dir }
    }

    fn active_path(&self) -> PathBuf {
        self.dir.join(LOG_FILE_NAME)
    }

    fn rotated_path(&self, n: usize) -> PathBuf {
        self.dir.join(format!("{}.{}", LOG_FILE_NAME, n))
    }

    /// 若当前活动文件已超过大小上限，则滚动旧文件（.N -> .N+1，最多保留 MAX_LOG_FILES 份）。
    fn maybe_rotate(&self) {
        let active = self.active_path();
        let size = fs::metadata(&active).map(|m| m.len()).unwrap_or(0);
        if size < MAX_LOG_BYTES {
            return;
        }

        // 丢最老的一份，其余向后平移。
        let oldest = self.rotated_path(MAX_LOG_FILES);
        if oldest.exists() {
            let _ = fs::remove_file(&oldest);
        }
        for n in (1..MAX_LOG_FILES).rev() {
            let src = self.rotated_path(n);
            if src.exists() {
                let dst = self.rotated_path(n + 1);
                let _ = fs::rename(&src, &dst);
            }
        }
        let _ = fs::rename(&active, self.rotated_path(1));
    }

    fn write_line(&self, line: &str) {
        self.maybe_rotate();
        if let Ok(mut f) = OpenOptions::new()
            .create(true)
            .append(true)
            .open(self.active_path())
        {
            let _ = f.write_all(line.as_bytes());
            let _ = f.write_all(b"\n");
            let _ = f.flush();
        }
    }
}

/// 初始化全局日志写入器（幂等）。在 `lib.rs::run` 中启动时调用一次。
pub fn init_logger() {
    let mut guard = WRITER.lock().unwrap();
    if guard.is_none() {
        *guard = Some(LogWriter::new());
    }
}

/// 日志级别（与双端 / 前端一致）。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LogLevel {
    Debug,
    Info,
    Warn,
    Error,
}

impl LogLevel {
    pub fn as_str(&self) -> &'static str {
        match self {
            LogLevel::Debug => "DEBUG",
            LogLevel::Info => "INFO",
            LogLevel::Warn => "WARN",
            LogLevel::Error => "ERROR",
        }
    }

    pub fn from_str(s: &str) -> Option<LogLevel> {
        match s.to_ascii_uppercase().as_str() {
            "DEBUG" => Some(LogLevel::Debug),
            "INFO" => Some(LogLevel::Info),
            "WARN" => Some(LogLevel::Warn),
            "ERROR" => Some(LogLevel::Error),
            _ => None,
        }
    }
}

fn now_iso_local() -> String {
    chrono::Local::now().format("%Y-%m-%d %H:%M:%S%.3f").to_string()
}

/// 写一条日志（内部统一入口，输出格式固定）。
fn log_line(level: LogLevel, module: &str, message: &str) {
    let line = format!(
        "{} [{}] [{}] {}",
        now_iso_local(),
        level.as_str(),
        module,
        message
    );
    let mut guard = WRITER.lock().unwrap();
    if guard.is_none() {
        *guard = Some(LogWriter::new());
    }
    if let Some(w) = guard.as_ref() {
        w.write_line(&line);
    }
}

/// 模块级便捷宏：`log_info!("startup", "application started");`
#[macro_export]
macro_rules! log_info {
    ($module:expr, $($arg:tt)*) => {
        $crate::logger::log_info($module, &format!($($arg)*))
    };
}
#[macro_export]
macro_rules! log_warn {
    ($module:expr, $($arg:tt)*) => {
        $crate::logger::log_warn($module, &format!($($arg)*))
    };
}
#[macro_export]
macro_rules! log_error {
    ($module:expr, $($arg:tt)*) => {
        $crate::logger::log_error($module, &format!($($arg)*))
    };
}
#[macro_export]
macro_rules! log_debug {
    ($module:expr, $($arg:tt)*) => {
        $crate::logger::log_debug($module, &format!($($arg)*))
    };
}

pub fn log_debug(module: &str, message: &str) {
    log_line(LogLevel::Debug, module, message);
}
pub fn log_info(module: &str, message: &str) {
    log_line(LogLevel::Info, module, message);
}
pub fn log_warn(module: &str, message: &str) {
    log_line(LogLevel::Warn, module, message);
}
pub fn log_error(module: &str, message: &str) {
    log_line(LogLevel::Error, module, message);
}

/// 活动日志文件绝对路径（供 UI 一键复制）。
pub fn log_file_path() -> PathBuf {
    get_app_data_dir().join(LOG_DIR_NAME).join(LOG_FILE_NAME)
}

/// 读取最近日志（按时间正序）。`limit` 为返回最大条数，0/None = 默认 200；
/// `level` 过滤（None = 全部）。返回较新在前（供 UI 倒序展示）。
fn read_rotated_files() -> Vec<PathBuf> {
    let dir = get_app_data_dir().join(LOG_DIR_NAME);
    let mut files = Vec::new();
    // 历史份 + 当前活动文件，按文件名序号排序（.1 最旧 -> 活动最新）。
    let mut rotated: Vec<(usize, PathBuf)> = Vec::new();
    let mut active: Option<PathBuf> = None;
    if let Ok(entries) = fs::read_dir(&dir) {
        for e in entries.flatten() {
            let p = e.path();
            let fname = e.file_name().to_string_lossy().to_string();
            if fname == LOG_FILE_NAME {
                active = Some(p);
            } else if fname.starts_with(&format!("{}.", LOG_FILE_NAME)) {
                if let Some(num) = fname.rsplit('.').next().and_then(|s| s.parse::<usize>().ok()) {
                    rotated.push((num, p));
                }
            }
        }
    }
    rotated.sort_by_key(|(n, _)| *n);
    for (_, p) in rotated {
        files.push(p);
    }
    if let Some(p) = active {
        files.push(p);
    }
    files
}

/// 解析一条日志行（失败返回 None，跳过脏行）。
fn parse_line(line: &str) -> Option<(LogLevel, String)> {
    // 格式：`<timestamp> [LEVEL] [module] message`
    let lvl_start = line.find('[')?;
    let lvl_end = line[lvl_start + 1..].find(']')? + lvl_start + 1;
    let lvl_str = &line[lvl_start + 1..lvl_end];
    let level = LogLevel::from_str(lvl_str)?;
    Some((level, line.to_string()))
}

/// 读取日志内容，返回 `Option<(level, line)>` 列表（旧 -> 新），并按 limit/level 过滤。
pub fn read_logs(limit: Option<usize>, level: Option<String>) -> Vec<(String, String)> {
    let lvl_filter = level.and_then(|s| LogLevel::from_str(&s));
    let cap = limit.unwrap_or(200).min(5000).max(1);

    let mut all: Vec<(String, String)> = Vec::new();
    for file in read_rotated_files() {
        if let Ok(content) = fs::read_to_string(&file) {
            for line in content.lines() {
                if let Some((lvl, text)) = parse_line(line) {
                    if let Some(f) = lvl_filter {
                        if lvl != f {
                            continue;
                        }
                    }
                    all.push((lvl.as_str().to_string(), text));
                }
            }
        }
    }

    // 取最近 cap 条，并反转为「新 -> 旧」便于前端展示。
    let start = all.len().saturating_sub(cap);
    let mut recent: Vec<(String, String)> = all.into_iter().skip(start).collect();
    recent.reverse();
    recent
}
