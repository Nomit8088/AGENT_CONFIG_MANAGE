// 同步历史（WI-008）：App 数据目录 sync_history.json，数组、最新在前，保留最近 100 条。
// 与 Rust `src-tauri/src/sync_history.rs` 字段/格式 100% 对齐。
import fs from 'fs';
import path from 'path';
import { getAppDataDir } from './appPaths';
import type { SyncHistoryEntry, SyncHistoryResult, SyncScope, SyncTrigger, SyncHistoryAction } from '../types';

export const MAX_SYNC_HISTORY = 100;
const DEFAULT_LIMIT = 50;

export function syncHistoryFilePath(): string {
  return path.join(getAppDataDir(), 'sync_history.json');
}

function nowMillis(): number {
  return Date.now();
}

export function generateHistoryId(): string {
  const millis = Date.now();
  const suffix = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
  return `sync-${millis}-${suffix}`;
}

export function loadSyncHistory(): SyncHistoryEntry[] {
  const file = syncHistoryFilePath();
  try {
    if (fs.existsSync(file)) {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
      if (Array.isArray(parsed)) return parsed as SyncHistoryEntry[];
    }
  } catch {}
  return [];
}

export function saveSyncHistory(entries: SyncHistoryEntry[]): void {
  const file = syncHistoryFilePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(entries, null, 2), 'utf-8');
}

/** 最新在前，超出保留上限自动裁剪。 */
export function appendSyncHistory(entry: SyncHistoryEntry): void {
  const list = loadSyncHistory();
  list.unshift(entry);
  if (list.length > MAX_SYNC_HISTORY) list.length = MAX_SYNC_HISTORY;
  saveSyncHistory(list);
}

export function clearSyncHistory(): void {
  saveSyncHistory([]);
}

/** 追加一条历史（失败静默降级，不阻塞同步主流程）。 */
export function recordSyncHistory(
  trigger: SyncTrigger,
  scope: SyncScope,
  action: SyncHistoryAction,
  result: SyncHistoryResult,
  summary?: string,
  error?: string,
): void {
  try {
    appendSyncHistory({
      id: generateHistoryId(),
      at: nowMillis(),
      trigger,
      scope,
      action,
      result,
      summary,
      error,
    });
  } catch {}
}

/** 读取最近同步历史（较新在前），默认 50 条。 */
export function getSyncHistory(limit?: number): SyncHistoryEntry[] {
  const list = loadSyncHistory();
  const n = limit ?? DEFAULT_LIMIT;
  return n < list.length ? list.slice(0, n) : list;
}
