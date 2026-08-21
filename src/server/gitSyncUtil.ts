import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import type { SyncDiffEntry } from '../types';

const DEFAULT_GIT_TIMEOUT_MS = 120_000;

let cachedProxy: string | null | undefined;

/**
 * 探测当前系统代理。
 * 1) 环境变量（HTTPS_PROXY / HTTP_PROXY 等）
 * 2) Windows WinINET 系统代理（git 默认不会读取 WinINET，这是 GitHub 连不上的常见根因）
 */
export function detectSystemProxy(): string | null {
  if (cachedProxy !== undefined) return cachedProxy;

  for (const key of ['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy']) {
    const v = process.env[key];
    if (v && v.trim()) {
      cachedProxy = normalizeProxy(v.trim());
      return cachedProxy;
    }
  }

  if (process.platform === 'win32') {
    try {
      const raw = queryRegValue('ProxyServer');
      if (raw) {
        let enabled = true;
        const enableRaw = queryRegValue('ProxyEnable');
        if (enableRaw) {
          const hex = enableRaw.trim().replace(/^0x/i, '');
          const n = parseInt(hex, 16);
          if (!Number.isNaN(n)) enabled = n !== 0;
        }
        if (enabled) {
          const proxy = pickProxy(raw);
          if (proxy) {
            cachedProxy = proxy;
            return cachedProxy;
          }
        }
      }
    } catch {}
  }

  cachedProxy = null;
  return cachedProxy;
}

function queryRegValue(name: string): string | null {
  const out = execFileSync(
    'reg',
    ['query', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings', '/v', name],
    { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 },
  );
  // 输出形如: "    ProxyServer    REG_SZ    127.0.0.1:7897"
  const line = out.split(/\r?\n/).find(l => l.includes(name));
  if (!line) return null;
  const value = line.split(/\s+/).filter(Boolean).pop();
  return value || null;
}

function pickProxy(raw: string): string | null {
  const parts = raw.split(';').map(s => s.trim()).filter(Boolean);
  for (const proto of ['https=', 'http=', 'socks5=', 'socks=']) {
    for (const p of parts) {
      if (p.toLowerCase().startsWith(proto)) {
        return normalizeProxy(p.slice(proto.length));
      }
    }
  }
  // 纯 host:port
  for (const p of parts) {
    if (!p.includes('=') && /^[\w.-]+:\d+$/.test(p)) {
      return normalizeProxy(p);
    }
  }
  return null;
}

function normalizeProxy(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(v)) return v;
  if (/^[\w.-]+:\d+$/.test(v)) return `http://${v}`;
  return v;
}

/**
 * 若探测到系统代理，返回注入给 git 的 `-c` 参数；否则返回空数组。
 * 统一注入到所有 git 命令是安全的：本地命令（status/add/commit）会忽略 http.proxy。
 */
export function gitProxyArgs(): string[] {
  const proxy = detectSystemProxy();
  if (!proxy) return [];
  return ['-c', `http.proxy=${proxy}`, '-c', `https.proxy=${proxy}`];
}

/**
 * 执行 git 命令并返回 stdout。
 * - 捕获 stderr：失败时优先返回真实 git 报错（而非 "Command failed: git ..."）
 * - 注入系统代理
 * - 设置超时，避免凭据弹窗导致的永久挂起
 */
export function runGit(cwd: string, args: string[], timeoutMs: number = DEFAULT_GIT_TIMEOUT_MS): string {
  const fullArgs = [...gitProxyArgs(), ...args];
  try {
    return execFileSync('git', fullArgs, {
      cwd,
      encoding: 'utf-8',
      timeout: timeoutMs,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch (e: any) {
    if (e?.code === 'ENOENT') {
      throw new Error('未找到 git 命令，请先安装 Git 并加入 PATH');
    }
    if (e?.killed || e?.signal === 'SIGTERM') {
      throw new Error(`git 命令超时（${Math.round(timeoutMs / 1000)}s）：${args.join(' ')}`);
    }
    const stderr = (e?.stderr?.toString() || '').trim();
    const stdout = (e?.stdout?.toString() || '').trim();
    throw new Error(stderr || stdout || e?.message || 'git command failed');
  }
}

/** 非抛错的 runGit，失败返回空字符串（用于只读探测类命令）。 */
export function runGitTry(cwd: string, args: string[], timeoutMs?: number): string {
  try {
    return runGit(cwd, args, timeoutMs);
  } catch {
    return '';
  }
}

function statusOfCode(code: string): SyncDiffEntry['status'] {
  const c = (code[0] || 'M').toUpperCase();
  if (c === 'A') return 'added';
  if (c === 'D') return 'deleted';
  return 'modified';
}

/** 解析 `git diff --name-status` 输出（`M\tpath` / `A\tpath` / `D\tpath` / `R100\told\tnew`）。 */
function collectNameStatus(out: string, side: SyncDiffEntry['side'], acc: Map<string, SyncDiffEntry>): void {
  for (const raw of out.split(/\r?\n/)) {
    if (!raw) continue;
    let code = raw;
    let p = '';
    const tab = raw.indexOf('\t');
    if (tab >= 0) {
      code = raw.slice(0, tab);
      p = raw.slice(tab + 1);
    }
    if (code.startsWith('R')) {
      // 重命名：取最后一个 token 作为新路径
      const parts = p.split('\t');
      p = parts[parts.length - 1] || p;
    }
    p = p.trim();
    if (!p) continue;
    const status = statusOfCode(code);
    const prev = acc.get(p);
    if (prev && prev.side !== side) {
      acc.set(p, { path: p, status: 'modified', side: 'both' });
    } else {
      acc.set(p, { path: p, status, side });
    }
  }
}

/** 解析 `git status --porcelain` 输出（`XY path` / `XY "quoted path"`），作为本地未提交修改。 */
function collectPorcelain(out: string, acc: Map<string, SyncDiffEntry>): void {
  for (const raw of out.split(/\r?\n/)) {
    if (raw.length < 3) continue;
    const code = raw.slice(0, 2);
    let p = raw.slice(3).trim();
    if (!p) continue;
    if (p.length >= 2 && p.startsWith('"') && p.endsWith('"')) p = p.slice(1, -1);
    const status: SyncDiffEntry['status'] =
      code === '??' || code[0] === 'A' ? 'added' : code[0] === 'D' ? 'deleted' : 'modified';
    const prev = acc.get(p);
    if (prev && prev.side !== 'local') {
      acc.set(p, { path: p, status: 'modified', side: 'both' });
    } else {
      acc.set(p, { path: p, status, side: 'local' });
    }
  }
}

/**
 * 计算某个功能范围（`skills/` 或 `dsh/`）内，本地工作区/提交与「已知远端 origin/<branch>」的
 * 文件级差异（不做网络 fetch，使用最近一次 fetch/pull/push 后的远端引用）。
 */
export function computeGitSyncDiff(cwd: string, scope: string, branch: string): SyncDiffEntry[] {
  const acc = new Map<string, SyncDiffEntry>();
  if (!fs.existsSync(path.join(cwd, '.git'))) return [];

  const remoteRef = `origin/${branch}`;
  const hasRemote = runGitTry(cwd, ['rev-parse', '--verify', remoteRef]).trim().length > 0;
  if (hasRemote) {
    const ahead = runGitTry(cwd, ['diff', '--name-status', `${remoteRef}...HEAD`, '--', scope]);
    collectNameStatus(ahead, 'local', acc);
    const behind = runGitTry(cwd, ['diff', '--name-status', `HEAD...${remoteRef}`, '--', scope]);
    collectNameStatus(behind, 'remote', acc);
  }

  const dirty = runGitTry(cwd, ['status', '--porcelain', '--', scope]);
  collectPorcelain(dirty, acc);

  return [...acc.values()];
}
