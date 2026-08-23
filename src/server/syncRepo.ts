import fs from 'fs';
import os from 'os';
import path from 'path';
import { runGit } from './gitSyncUtil';
import { getAppDataDir } from './appPaths';

export interface SyncRepoConfig {
  remoteUrl: string;
  branch: string;
  validatedAt: number;
  lastError?: string;
}

export interface SyncRepoValidation {
  ok: boolean;
  error?: string;
  initialized: boolean;
  formatOk: boolean;
  resolvedBranch?: string;
}

export function syncRepoRoot(): string {
  return getAppDataDir();
}

const SYNC_GITIGNORE_CONTENT = `# AgentHub sync repo local-only files
config.json
agents.json
projects.json
dsh_install_state.json
backups/
*.log
.DS_Store
Thumbs.db
`;

function ensureSyncGitignore(root: string): void {
  const gitignore = path.join(root, '.gitignore');
  if (!fs.existsSync(gitignore)) {
    fs.writeFileSync(gitignore, SYNC_GITIGNORE_CONTENT, 'utf-8');
    return;
  }
  const text = fs.readFileSync(gitignore, 'utf-8');
  const missing = SYNC_GITIGNORE_CONTENT.split(/\r?\n/)
    .filter(l => l.trim() && !text.includes(l.trim()));
  if (missing.length > 0) {
    fs.writeFileSync(gitignore, text.replace(/\s*$/, '') + '\n' + missing.join('\n') + '\n', 'utf-8');
  }
}

function readConfigFile(): any {
  const configFile = path.join(syncRepoRoot(), 'config.json');
  if (fs.existsSync(configFile)) {
    try {
      return JSON.parse(fs.readFileSync(configFile, 'utf-8'));
    } catch {}
  }
  return {};
}

function writeConfigFile(cfg: any): void {
  const configFile = path.join(syncRepoRoot(), 'config.json');
  fs.writeFileSync(configFile, JSON.stringify(cfg, null, 2), 'utf-8');
}

export function getSyncRepoConfig(): SyncRepoConfig {
  const cfg = readConfigFile().sync_repo;
  if (!cfg) return { remoteUrl: '', branch: 'main', validatedAt: 0 };
  return {
    remoteUrl: cfg.remoteUrl || '',
    branch: cfg.branch || 'main',
    validatedAt: cfg.validatedAt || 0,
    lastError: cfg.lastError,
  };
}

function saveSyncRepoConfig(cfg: SyncRepoConfig): void {
  const appCfg = readConfigFile();
  appCfg.sync_repo = {
    remoteUrl: cfg.remoteUrl,
    branch: cfg.branch || 'main',
    validatedAt: cfg.validatedAt || 0,
    lastError: cfg.lastError,
  };
  writeConfigFile(appCfg);
}

export function globalSyncRemoteUrl(): string {
  return getSyncRepoConfig().remoteUrl;
}

export function globalSyncBranch(): string {
  return getSyncRepoConfig().branch;
}

function gitTry(cwd: string, args: string[]): string {
  try {
    return runGit(cwd, args);
  } catch {
    return '';
  }
}

function gitOk(cwd: string, args: string[]): boolean {
  try {
    runGit(cwd, args);
    return true;
  } catch {
    return false;
  }
}

function parseDefaultBranch(symrefOut: string): string | null {
  // git ls-remote --symref <url> HEAD 输出形如: ref: refs/heads/main\tHEAD
  const line = symrefOut.split(/\r?\n/).map(l => l.trim()).find(l => l.startsWith('ref: refs/heads/'));
  if (!line) return null;
  const branch = line.replace(/^ref:\s*refs\/heads\//, '').split(/\s+/)[0];
  return branch || null;
}

/** 校验远端仓库：连通性 + 分支存在（仓库已初始化） + 根目录格式（skills/ 与 dsh/）。 */
export async function validateSyncRepo(remoteUrl: string, branch?: string): Promise<SyncRepoValidation> {
  const url = (remoteUrl || '').trim();
  const target = (branch || '').trim() || 'main';
  if (!url) {
    return { ok: false, error: '仓库地址不能为空', initialized: false, formatOk: false, resolvedBranch: target };
  }

  const probe = os.tmpdir();

  // 1. 探测默认分支（失败不阻塞）
  let resolvedBranch = target;
  const symrefOut = gitTry(probe, ['ls-remote', '--symref', url, 'HEAD']);
  if (symrefOut) {
    const defaultBranch = parseDefaultBranch(symrefOut);
    if (defaultBranch && (target === 'main' || !target)) {
      resolvedBranch = defaultBranch;
    }
  }

  // 2. 连通性 + 分支存在 + 仓库非空
  const refspec = `refs/heads/${resolvedBranch}`;
  let lsOut = '';
  try {
    lsOut = runGit(probe, ['ls-remote', url, refspec]);
  } catch (e: any) {
    return {
      ok: false,
      error: `连通性校验失败: ${e?.message || e}`,
      initialized: false,
      formatOk: false,
      resolvedBranch,
    };
  }
  if (!lsOut.trim()) {
    return {
      ok: false,
      error: `远端分支 ${resolvedBranch} 不存在或仓库为空（仓库可能尚未初始化）`,
      initialized: false,
      formatOk: false,
      resolvedBranch,
    };
  }

  // 3. 浅克隆到临时目录，校验根目录格式
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agenthub-sync-check-'));
  let cloned = true;
  try {
    runGit(os.tmpdir(), ['clone', '--depth', '1', '--branch', resolvedBranch, url, tmpDir]);
  } catch (e: any) {
    cloned = false;
  }

  if (!cloned) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    return {
      ok: false,
      error: '无法浅克隆远端仓库进行格式校验',
      initialized: false,
      formatOk: false,
      resolvedBranch,
    };
  }

  const entries = fs.readdirSync(tmpDir);
  const hasSkills = (() => {
    try { return fs.statSync(path.join(tmpDir, 'skills')).isDirectory(); } catch { return false; }
  })();
  const hasDsh = (() => {
    try { return fs.statSync(path.join(tmpDir, 'dsh')).isDirectory(); } catch { return false; }
  })();
  fs.rmSync(tmpDir, { recursive: true, force: true });

  if (!hasSkills || !hasDsh) {
    return {
      ok: false,
      error: `仓库格式与预期不符：根目录应包含 skills/ 与 dsh/（当前: ${entries.length ? entries.join(', ') : '(空)'}）`,
      initialized: true,
      formatOk: false,
      resolvedBranch,
    };
  }

  return { ok: true, initialized: true, formatOk: true, resolvedBranch };
}

function ensureSyncRepoLocal(remoteUrl: string, branch: string): void {
  const root = syncRepoRoot();
  fs.mkdirSync(root, { recursive: true });
  ensureSyncGitignore(root);

  if (!fs.existsSync(path.join(root, '.git'))) {
    try {
      runGit(root, ['init', '-b', branch]);
    } catch {
      runGit(root, ['init']);
      gitTry(root, ['symbolic-ref', 'HEAD', `refs/heads/${branch}`]);
    }
  }

  gitTry(root, ['remote', 'remove', 'origin']);
  runGit(root, ['remote', 'add', 'origin', remoteUrl]);

  // 远端已有内容且本地尚无提交时，安全地对齐到远端分支
  if (gitOk(root, ['fetch', 'origin'])) {
    const remoteRef = `origin/${branch}`;
    if (gitTry(root, ['rev-parse', '--verify', remoteRef])) {
      const head = gitTry(root, ['rev-parse', '--verify', 'HEAD']);
      if (!head) {
        gitTry(root, ['symbolic-ref', 'HEAD', `refs/heads/${branch}`]);
        gitTry(root, ['reset', '--mixed', remoteRef]);
      }
    }
  }
}

/** 校验并保存全局仓库配置；校验失败不允许保存。 */
export async function saveSyncRepo(remoteUrl: string, branch?: string): Promise<SyncRepoConfig> {
  const url = (remoteUrl || '').trim();
  const target = (branch || '').trim() || 'main';

  const validation = await validateSyncRepo(url, target);
  if (!validation.ok) {
    throw new Error(validation.error || '仓库校验未通过');
  }

  ensureSyncRepoLocal(url, target);

  const cfg: SyncRepoConfig = {
    remoteUrl: url,
    branch: target,
    validatedAt: Date.now(),
    lastError: undefined,
  };
  saveSyncRepoConfig(cfg);

  // 保持旧配置块中的 remote/branch 与全局一致，避免旧代码路径读到过期值
  const appCfg = readConfigFile();
  if (appCfg.skills_sync) {
    appCfg.skills_sync.remoteUrl = url;
    appCfg.skills_sync.branch = target;
  }
  if (appCfg.dsh_plugins?.sync) {
    appCfg.dsh_plugins.sync.remoteUrl = url;
    appCfg.dsh_plugins.sync.branch = target;
  }
  writeConfigFile(appCfg);

  return getSyncRepoConfig();
}

/** 解绑全局同步仓库：清除配置与旧配置块中的远端信息，并移除本地 origin（保留 .git 与工作区）。 */
export function unbindSyncRepo(): { success: true } {
  const appCfg = readConfigFile();
  delete appCfg.sync_repo;
  if (appCfg.skills_sync) {
    appCfg.skills_sync.remoteUrl = '';
    appCfg.skills_sync.branch = 'main';
  }
  if (appCfg.dsh_plugins?.sync) {
    appCfg.dsh_plugins.sync.remoteUrl = '';
    appCfg.dsh_plugins.sync.branch = 'main';
  }
  writeConfigFile(appCfg);

  const root = syncRepoRoot();
  gitTry(root, ['remote', 'remove', 'origin']);
  return { success: true };
}
