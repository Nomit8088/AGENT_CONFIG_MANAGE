// 应用日志系统（WI-007）—— Node Web 端，与 Rust src-tauri/src/logger.rs 双端对齐。
//
// 格式：`<ISO 本地时间> [LEVEL] [module] message`，级别 DEBUG/INFO/WARN/ERROR。
// 落盘：<appDataDir>/logs/agenthub.log（单一事实源走 appPaths.ts）。
// 轮转：单文件 ≥ 5MB 触发 agenthub.log.N，保留最近 5 份（与 Rust 端语义一致）。
import fs from 'fs';
import path from 'path';
import { getLogsDir } from './appPaths';

const LOG_FILE_NAME = 'agenthub.log';
const MAX_LOG_BYTES = 5 * 1024 * 1024;
const MAX_LOG_FILES = 5;

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

const LEVEL_ORDER: LogLevel[] = ['DEBUG', 'INFO', 'WARN', 'ERROR'];

function activePath(): string {
  return path.join(getLogsDir(), LOG_FILE_NAME);
}

function rotatedPath(n: number): string {
  return path.join(getLogsDir(), `${LOG_FILE_NAME}.${n}`);
}

function nowIsoLocal(): string {
  const d = new Date();
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${ms}`
  );
}

function maybeRotate(): void {
  const active = activePath();
  let size = 0;
  try {
    size = fs.statSync(active).size;
  } catch {}
  if (size < MAX_LOG_BYTES) return;

  const oldest = rotatedPath(MAX_LOG_FILES);
  if (fs.existsSync(oldest)) {
    try { fs.unlinkSync(oldest); } catch {}
  }
  for (let n = MAX_LOG_FILES - 1; n >= 1; n--) {
    const src = rotatedPath(n);
    if (fs.existsSync(src)) {
      try { fs.renameSync(src, rotatedPath(n + 1)); } catch {}
    }
  }
  try { fs.renameSync(active, rotatedPath(1)); } catch {}
}

/** 启动时初始化日志目录（幂等）；由 initStorage 调用。 */
export function initLogger(): void {
  fs.mkdirSync(getLogsDir(), { recursive: true });
  logLine('INFO', 'startup', 'AgentHub Web 模式启动，初始化日志系统完成');
}

function normalizeLevel(level: string): LogLevel {
  const up = (level || '').toUpperCase();
  return (LEVEL_ORDER as string[]).includes(up) ? (up as LogLevel) : 'INFO';
}

function logLine(level: LogLevel, module: string, message: string): void {
  try {
    maybeRotate();
    const line = `${nowIsoLocal()} [${level}] [${module}] ${message}`;
    fs.appendFileSync(activePath(), line + '\n', 'utf-8');
  } catch {
    // 日志写入失败不阻塞主流程（磁盘只读/权限等场景静默降级）。
  }
}

export function logDebug(module: string, message: string): void {
  logLine('DEBUG', module, message);
}
export function logInfo(module: string, message: string): void {
  logLine('INFO', module, message);
}
export function logWarn(module: string, message: string): void {
  logLine('WARN', module, message);
}
export function logError(module: string, message: string): void {
  logLine('ERROR', module, message);
}

export interface LogEntry {
  level: string;
  message: string;
}

export interface AppLogsResult {
  logPath: string;
  entries: LogEntry[];
}

/** 活动日志文件绝对路径（UI 一键复制）。 */
export function logFilePath(): string {
  return activePath();
}

/** 解析一行（失败返回 null，跳过脏行）。 */
function parseLine(line: string): { level: LogLevel; text: string } | null {
  const lvlStart = line.indexOf('[');
  if (lvlStart < 0) return null;
  const lvlEnd = line.indexOf(']', lvlStart + 1);
  if (lvlEnd < 0) return null;
  const lvlStr = line.slice(lvlStart + 1, lvlEnd);
  const up = lvlStr.toUpperCase();
  if (!(LEVEL_ORDER as string[]).includes(up)) return null;
  return { level: up as LogLevel, text: line };
}

function readRotatedFiles(): string[] {
  const dir = getLogsDir();
  if (!fs.existsSync(dir)) return [];
  const rotated: { n: number; p: string }[] = [];
  let active: string | null = null;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (name === LOG_FILE_NAME) {
      active = p;
    } else if (name.startsWith(`${LOG_FILE_NAME}.`)) {
      const num = parseInt(name.slice(LOG_FILE_NAME.length + 1), 10);
      if (!Number.isNaN(num)) rotated.push({ n: num, p });
    }
  }
  rotated.sort((a, b) => a.n - b.n);
  const files = rotated.map(r => r.p);
  if (active) files.push(active);
  return files;
}

/** 读取最近日志（旧 → 新），按 limit/level 过滤，返回较新在前。 */
export function getAppLogs(limit?: number, level?: string): AppLogsResult {
  const lvlFilter = level ? normalizeLevel(level) : undefined;
  const cap = Math.min(Math.max(limit ?? 200, 1), 5000);

  const all: { level: LogLevel; text: string }[] = [];
  for (const file of readRotatedFiles()) {
    let content = '';
    try {
      content = fs.readFileSync(file, 'utf-8');
    } catch {}
    for (const line of content.split(/\r?\n/)) {
      if (!line) continue;
      const parsed = parseLine(line);
      if (!parsed) continue;
      if (lvlFilter && parsed.level !== lvlFilter) continue;
      all.push(parsed);
    }
  }

  const start = Math.max(0, all.length - cap);
  const recent = all.slice(start).reverse();
  return {
    logPath: logFilePath(),
    entries: recent.map(e => ({ level: e.level, message: e.text })),
  };
}

/** 导出一份日志文件快照，返回导出文件绝对路径。 */
export function exportAppLogs(): { exportPath: string; size: number } {
  const src = activePath();
  const stamp = nowIsoLocal().replace(/[-: .]/g, '');
  const exportPath = path.join(getLogsDir(), `agenthub-export-${stamp}.log`);
  fs.copyFileSync(src, exportPath);
  const size = fs.statSync(exportPath).size;
  logInfo('startup', `用户导出日志快照: ${exportPath}`);
  return { exportPath, size };
}

/** 返回日志文件路径（UI 一键复制）。 */
export function getAppLogPath(): { logPath: string } {
  return { logPath: logFilePath() };
}
