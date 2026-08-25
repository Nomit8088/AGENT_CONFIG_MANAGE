// 定时同步调度器（WI-008，Node Web 端）：应用运行期间按 interval 静默 fast-forward 拉取。
// - 时间来源统一 `Date.now()`（间隔换算为毫秒），不依赖系统 cron / 任务计划程序。
// - 单飞守卫由 `syncFlight.ts` 提供：定时与手动共用，忙时跳过本次（下次触发补上）。
// - 配置热生效：`setSyncSchedule` 保存后立即 `rescheduleSyncScheduler()`，无需重启。
// - 错过触发点不补跑（仅应用运行期间到点触发）。
import fs from 'fs';
import path from 'path';
import { getAppDataDir } from './appPaths';
import { logInfo, logWarn } from './logger';
import type { SyncSchedule, SyncScope } from '../types';
import { pullSkillsSync } from './localApi';
import { pullDshPluginsSync } from './dshPlugins';

const MIN_INTERVAL_MINUTES = 5;
const MAX_INTERVAL_MINUTES = 60 * 24;
const DEFAULT_INTERVAL_MINUTES = 30;

let schedulerTimer: NodeJS.Timeout | null = null;

function readConfigFile(): any {
  const configFile = path.join(getAppDataDir(), 'config.json');
  try {
    if (fs.existsSync(configFile)) return JSON.parse(fs.readFileSync(configFile, 'utf-8'));
  } catch {}
  return {};
}

function writeConfigFile(cfg: any): void {
  const configFile = path.join(getAppDataDir(), 'config.json');
  fs.mkdirSync(path.dirname(configFile), { recursive: true });
  fs.writeFileSync(configFile, JSON.stringify(cfg, null, 2), 'utf-8');
}

export function defaultSyncSchedule(): SyncSchedule {
  return { enabled: false, mode: 'interval', intervalMinutes: DEFAULT_INTERVAL_MINUTES, scopes: ['skills', 'dsh'] };
}

export function getSyncSchedule(): SyncSchedule {
  const raw = readConfigFile().sync_schedule;
  if (!raw) return defaultSyncSchedule();
  return {
    enabled: !!raw.enabled,
    mode: raw.mode === 'cron' ? 'cron' : 'interval',
    intervalMinutes: typeof raw.intervalMinutes === 'number' ? raw.intervalMinutes : undefined,
    cron: typeof raw.cron === 'string' ? raw.cron : undefined,
    scopes: Array.isArray(raw.scopes) ? raw.scopes.filter((s: any): s is SyncScope => s === 'skills' || s === 'dsh') : ['skills', 'dsh'],
  };
}

function normalizedIntervalMinutes(s: SyncSchedule): number {
  const v = typeof s.intervalMinutes === 'number' && !Number.isNaN(s.intervalMinutes) ? s.intervalMinutes : DEFAULT_INTERVAL_MINUTES;
  return Math.min(MAX_INTERVAL_MINUTES, Math.max(MIN_INTERVAL_MINUTES, Math.round(v)));
}

/** 保存定时同步配置并立即重排调度器（热生效）。MVP 仅支持 interval。 */
export function setSyncSchedule(schedule: SyncSchedule): SyncSchedule {
  const s: SyncSchedule = { ...schedule };
  if (s.mode !== 'interval') {
    throw new Error('E_SYNC_SCHEDULE_UNSUPPORTED::cron');
  }
  if (s.enabled) {
    const mins = typeof s.intervalMinutes === 'number' ? s.intervalMinutes : DEFAULT_INTERVAL_MINUTES;
    if (mins < MIN_INTERVAL_MINUTES) {
      throw new Error(`定时间隔最小为 ${MIN_INTERVAL_MINUTES} 分钟`);
    }
    s.intervalMinutes = normalizedIntervalMinutes(s);
  }
  s.scopes = (Array.isArray(s.scopes) && s.scopes.length > 0)
    ? s.scopes.filter((x): x is SyncScope => x === 'skills' || x === 'dsh')
    : ['skills', 'dsh'];

  const cfg = readConfigFile();
  cfg.sync_schedule = s;
  writeConfigFile(cfg);

  rescheduleSyncScheduler();
  logInfo('sync', `定时同步配置已保存: enabled=${s.enabled}, interval=${s.intervalMinutes ?? DEFAULT_INTERVAL_MINUTES}min, scopes=${JSON.stringify(s.scopes)}`);
  return getSyncSchedule();
}

/** 按当前配置重排 Node 定时器（不 unref，随进程存活）。 */
export function rescheduleSyncScheduler(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
  const s = getSyncSchedule();
  if (!s.enabled || s.mode !== 'interval') {
    logInfo('sync', '定时同步已停用');
    return;
  }
  const ms = normalizedIntervalMinutes(s) * 60_000;
  schedulerTimer = setInterval(() => {
    runScheduledSync(s).catch(() => {});
  }, ms);
  logInfo('sync', `定时同步调度器已重排: 每 ${normalizedIntervalMinutes(s)} 分钟一次`);
}

/** 启动调度器（vite localApiPlugin configureServer 调用一次）。 */
export function startSyncScheduler(): void {
  rescheduleSyncScheduler();
}

/** 一次调度：按 scopes 顺序执行 skills → dsh 的 fast-forward 拉取（禁止 push）。 */
async function runScheduledSync(s: SyncSchedule): Promise<void> {
  logInfo('sync', `定时同步触发（interval）: scopes=${JSON.stringify(s.scopes)}`);
  for (const scope of s.scopes) {
    try {
      if (scope === 'skills') {
        pullSkillsSync('scheduled');
      } else if (scope === 'dsh') {
        pullDshPluginsSync('scheduled');
      }
    } catch (e: any) {
      logWarn('sync', `定时同步 ${scope} 结束（含跳过/失败）: ${e?.message || e}`);
    }
  }
}
