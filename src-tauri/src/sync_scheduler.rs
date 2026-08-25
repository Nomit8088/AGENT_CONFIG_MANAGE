//! 定时同步调度器（WI-008）：应用运行期间按 interval 静默 fast-forward 拉取。
//! - 时间来源统一 `chrono`（间隔换算为秒），不依赖系统 cron / 任务计划程序。
//! - 单飞守卫由 `sync_guard` 提供：定时与手动共用，忙时跳过本次（下次触发补上）。
//! - 配置热生效：`set_sync_schedule` 保存后经 channel 唤醒线程重排，无需重启。
//! - 错过触发点不补跑（仅应用运行期间到点触发）。

use std::sync::mpsc::{self, Receiver, RecvTimeoutError, Sender};
use std::sync::{Mutex, OnceLock};
use std::thread;
use std::time::Duration;

use crate::models::SyncSchedule;
use crate::error_codes::{coded, E_SYNC_SCHEDULE_UNSUPPORTED};
use crate::storage::load_config;

const MIN_INTERVAL_MINUTES: u32 = 5;
const MAX_INTERVAL_MINUTES: u32 = 60 * 24;

enum SchedulerMsg {
    Reload,
}

static SCHEDULER_TX: OnceLock<Mutex<Option<Sender<SchedulerMsg>>>> = OnceLock::new();

fn scheduler_tx() -> &'static Mutex<Option<Sender<SchedulerMsg>>> {
    SCHEDULER_TX.get_or_init(|| Mutex::new(None))
}

fn current_schedule() -> SyncSchedule {
    load_config().sync_schedule.unwrap_or_default()
}

/// 读取定时同步配置（双端对齐 `GET /api/sync/schedule`）。
#[tauri::command]
pub fn get_sync_schedule() -> SyncSchedule {
    current_schedule()
}

fn normalized_interval(s: &SyncSchedule) -> u64 {
    s.interval_minutes
        .unwrap_or(30)
        .clamp(MIN_INTERVAL_MINUTES, MAX_INTERVAL_MINUTES) as u64
}

fn next_delay(s: &SyncSchedule) -> Option<Duration> {
    if !s.enabled || s.mode != "interval" {
        return None;
    }
    Some(Duration::from_secs(normalized_interval(s) * 60))
}

/// 保存定时同步配置并立即重排调度器（热生效）。MVP 仅支持 interval。
#[tauri::command]
pub fn set_sync_schedule(schedule: SyncSchedule) -> Result<SyncSchedule, String> {
    let mut s = schedule;
    if s.mode != "interval" {
        return Err(coded(E_SYNC_SCHEDULE_UNSUPPORTED, "cron"));
    }
    if s.enabled {
        let mins = s.interval_minutes.unwrap_or(0);
        if mins < MIN_INTERVAL_MINUTES {
            return Err(format!("定时间隔最小为 {} 分钟", MIN_INTERVAL_MINUTES));
        }
        s.interval_minutes = Some(mins.clamp(MIN_INTERVAL_MINUTES, MAX_INTERVAL_MINUTES));
    }
    if s.scopes.is_empty() {
        s.scopes = vec!["skills".to_string(), "dsh".to_string()];
    }
    s.scopes.retain(|x| x == "skills" || x == "dsh");

    let mut cfg = load_config();
    cfg.sync_schedule = Some(s.clone());
    crate::storage::save_config(&cfg)?;

    notify(SchedulerMsg::Reload);
    crate::log_info!("sync", "定时同步配置已保存: enabled={}, interval={}min, scopes={:?}", s.enabled, s.interval_minutes.unwrap_or(30), s.scopes);
    Ok(s)
}

fn notify(msg: SchedulerMsg) {
    if let Ok(guard) = scheduler_tx().lock() {
        if let Some(tx) = guard.as_ref() {
            let _ = tx.send(msg);
        }
    }
}

/// 启动后台调度线程（进程级 daemon，随进程退出）。幂等：重复调用只保留最新 channel。
pub fn start() {
    let (tx, rx) = mpsc::channel();
    if let Ok(mut guard) = scheduler_tx().lock() {
        *guard = Some(tx);
    }
    let _ = thread::Builder::new()
        .name("sync-scheduler".to_string())
        .spawn(move || scheduler_loop(rx));
    crate::log_info!("sync", "定时同步调度器已启动");
}

fn scheduler_loop(rx: Receiver<SchedulerMsg>) {
    loop {
        let schedule = current_schedule();
        match next_delay(&schedule) {
            None => {
                // 停用：等待重载信号，不触发同步。
                match rx.recv() {
                    Ok(SchedulerMsg::Reload) => continue,
                    Err(_) => break,
                }
            }
            Some(delay) => match rx.recv_timeout(delay) {
                Ok(SchedulerMsg::Reload) => continue,
                Err(RecvTimeoutError::Timeout) => {
                    run_scheduled(&schedule);
                }
                Err(RecvTimeoutError::Disconnected) => break,
            },
        }
    }
}

/// 一次调度：按 scopes 顺序执行 skills → dsh 的 fast-forward 拉取（禁止 push）。
fn run_scheduled(s: &SyncSchedule) {
    crate::log_info!("sync", "定时同步触发（interval）: scopes={:?}", s.scopes);
    for scope in &s.scopes {
        let result = match scope.as_str() {
            "skills" => crate::skills_sync::pull_skills_sync(Some("scheduled".to_string())),
            "dsh" => crate::dsh_plugins_sync::pull_dsh_plugins_sync(Some("scheduled".to_string())),
            _ => continue,
        };
        if let Err(e) = result {
            crate::log_warn!("sync", "定时同步 {} 结束（含跳过/失败）: {}", scope, e);
        }
    }
}
