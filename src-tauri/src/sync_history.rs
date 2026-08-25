//! 同步历史（WI-008）：App 数据目录 `sync_history.json`，数组、最新在前，保留最近 100 条。
//! 与 Node `src/server/syncHistory.ts` 字段/格式 100% 对齐。

use std::fs;
use std::path::PathBuf;

use crate::models::SyncHistoryEntry;
use crate::storage::get_app_data_dir;

pub const MAX_HISTORY: usize = 100;
const DEFAULT_LIMIT: usize = 50;

pub fn history_file_path() -> PathBuf {
    get_app_data_dir().join("sync_history.json")
}

fn now_millis() -> u64 {
    chrono::Utc::now().timestamp_millis() as u64
}

/// 唯一 id = 毫秒时间戳 + 随机后缀（进程内纳秒取模）。
pub fn generate_history_id() -> String {
    let millis = chrono::Utc::now().timestamp_millis();
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.subsec_nanos())
        .unwrap_or(0);
    format!("sync-{}-{:06}", millis, nanos % 1_000_000)
}

pub fn load_history() -> Vec<SyncHistoryEntry> {
    let file = history_file_path();
    if let Ok(content) = fs::read_to_string(&file) {
        if let Ok(list) = serde_json::from_str::<Vec<SyncHistoryEntry>>(&content) {
            return list;
        }
    }
    Vec::new()
}

pub fn save_history(entries: &[SyncHistoryEntry]) -> Result<(), String> {
    let file = history_file_path();
    if let Some(parent) = file.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let content = serde_json::to_string_pretty(entries).map_err(|e| e.to_string())?;
    fs::write(&file, content).map_err(|e| e.to_string())
}

/// 最新在前，超出保留上限自动裁剪。
pub fn append_history(entry: SyncHistoryEntry) -> Result<(), String> {
    let mut list = load_history();
    list.insert(0, entry);
    list.truncate(MAX_HISTORY);
    save_history(&list)
}

pub fn clear_history() -> Result<(), String> {
    save_history(&[])
}

/// 追加一条历史（失败静默降级，不阻塞同步主流程）。
pub fn record(
    trigger: &str,
    scope: &str,
    action: &str,
    result: &str,
    summary: Option<String>,
    error: Option<String>,
) {
    let _ = append_history(SyncHistoryEntry {
        id: generate_history_id(),
        at: now_millis(),
        trigger: trigger.to_string(),
        scope: scope.to_string(),
        action: action.to_string(),
        result: result.to_string(),
        summary,
        error,
    });
}

/// 读取最近同步历史（较新在前），默认 50 条。
#[tauri::command]
pub fn get_sync_history(limit: Option<usize>) -> Vec<SyncHistoryEntry> {
    let mut list = load_history();
    let n = limit.unwrap_or(DEFAULT_LIMIT);
    if n < list.len() {
        list.truncate(n);
    }
    list
}

/// 清空同步历史。
#[tauri::command]
pub fn clear_sync_history() -> Result<(), String> {
    clear_history()
}
