import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn, spawnSync, execFileSync } from 'child_process';
import jsyaml from 'js-yaml';
import { runGit } from './gitSyncUtil';
import type {
  DshDiagnoseResult,
  DshPatchRow,
  DshPluginDiff,
  DshPluginDiffItem,
  DshPluginEntry,
  DshPluginScanResult,
  DshProfileScan,
  DshRecoveryAction,
  SkillsSyncStatus,
} from '../types';

// ==================== 路径与命令解析 ====================

export function resolveDshHome(): string {
  if (process.env.DSH_HOME && process.env.DSH_HOME.trim()) {
    return process.env.DSH_HOME.trim();
  }
  return path.join(os.homedir(), '.dsh');
}

function appDataDir(): string {
  const appdata = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  return path.join(appdata, 'AgentHub');
}

function readConfigFile(): any {
  const configFile = path.join(appDataDir(), 'config.json');
  if (fs.existsSync(configFile)) {
    try {
      return JSON.parse(fs.readFileSync(configFile, 'utf-8'));
    } catch {}
  }
  return {};
}

function whichCmd(name: string): string | null {
  try {
    const cmd = process.platform === 'win32' ? 'where' : 'which';
    const out = execFileSync(cmd, [name], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const first = out.split(/\r?\n/).map(s => s.trim()).find(Boolean);
    return first || null;
  } catch {
    return null;
  }
}

function npmDirCmd(name: string): string | null {
  if (process.platform !== 'win32') return null;
  const candidates = [
    path.join(os.homedir(), 'AppData', 'Roaming', 'npm', `${name}.cmd`),
    path.join(os.homedir(), 'AppData', 'Roaming', 'npm', name),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

export function resolveDshCommand(cfg?: any): string | null {
  const c = cfg || readConfigFile();
  const configured = c?.dsh_plugins?.dshCommand;
  if (configured && configured.trim()) return configured.trim();
  return whichCmd('dsh') || npmDirCmd('dsh');
}

export function resolvePnpmCommand(cfg?: any): string | null {
  const c = cfg || readConfigFile();
  const configured = c?.dsh_plugins?.pnpmCommand;
  if (configured && configured.trim()) return configured.trim();
  return whichCmd('pnpm') || npmDirCmd('pnpm');
}

// ==================== 扫描 ====================

const BUILTIN_BUNDLE_PREFIX = '@deepseek-ai/dsh-';

// 不可移植 = 本机/本地路径（link:/file:）、workspace 内部协议（workspace:/portal:/catalog:）、SSH 鉴权 git（git+ssh:/ssh:/git@）。
// 可移植 = 版本号 / npm: / github: / gitlab: / git+https: / git+http: 等与机器无关的规格。
const UNPORTABLE_SPEC_PREFIXES = ['link:', 'file:', 'workspace:', 'portal:', 'catalog:', 'git+ssh:', 'ssh:', 'git@'];

function isPortableSpec(spec?: string): boolean {
  if (!spec) return true;
  const s = spec.trim();
  return !UNPORTABLE_SPEC_PREFIXES.some(p => s.startsWith(p));
}

function readInstalledVersion(profileDir: string, pkgName: string): string | undefined {
  const parts = pkgName.split('/');
  const p = path.join(profileDir, 'node_modules', ...parts, 'package.json');
  try {
    const pkg = JSON.parse(fs.readFileSync(p, 'utf-8'));
    if (typeof pkg.version === 'string') return pkg.version;
  } catch {}
  return undefined;
}

function readTextSafe(file: string): string | null {
  try {
    if (fs.existsSync(file)) return fs.readFileSync(file, 'utf-8');
  } catch {}
  return null;
}

function listProfileDirs(profilesDir: string): string[] {
  if (!fs.existsSync(profilesDir)) return [];
  try {
    return fs.readdirSync(profilesDir, { withFileTypes: true })
      .filter(e => e.isDirectory() && e.name !== 'node_modules' && !e.name.startsWith('.'))
      .map(e => e.name);
  } catch {
    return [];
  }
}

function parsePatchRows(patchFile: string): DshPatchRow[] {
  const rows: DshPatchRow[] = [];
  const text = readTextSafe(patchFile);
  if (!text) return rows;
  try {
    const parsed = jsyaml.load(text);
    if (Array.isArray(parsed)) {
      for (const row of parsed) {
        if (row && typeof row === 'object') {
          rows.push({
            id: typeof (row as any).id === 'string' ? (row as any).id : undefined,
            name: typeof (row as any).name === 'string' ? (row as any).name : undefined,
            disabled: typeof (row as any).disabled === 'boolean' ? (row as any).disabled : undefined,
            raw: row,
          });
        }
      }
    }
  } catch {}
  return rows;
}

function scanProfile(profilesDir: string, name: string): DshProfileScan {
  const dir = path.join(profilesDir, name);
  const pkgFile = path.join(dir, 'package.json');
  const patchFile = path.join(dir, 'cordis.patch.yml');

  let bundles: string[] = [];
  let dependencies: Record<string, string> = {};

  const pkgText = readTextSafe(pkgFile);
  if (pkgText) {
    try {
      const pkg = JSON.parse(pkgText);
      if (Array.isArray(pkg?.dsh?.profile?.bundles)) {
        bundles = pkg.dsh.profile.bundles.filter((b: unknown): b is string => typeof b === 'string');
      }
      if (pkg?.dependencies && typeof pkg.dependencies === 'object') {
        for (const [k, v] of Object.entries(pkg.dependencies)) {
          if (typeof v === 'string') dependencies[k] = v;
        }
      }
    } catch {}
  }

  const patchRows = parsePatchRows(patchFile);
  const plugins: DshPluginEntry[] = [];

  const patchDisabledIds = new Set<string>();
  for (const row of patchRows) {
    if (row.disabled) {
      const id = row.id || row.name;
      if (id) patchDisabledIds.add(id);
    }
  }

  // bundles -> inbox | bundle
  for (const b of bundles) {
    const isInbox = b.startsWith(BUILTIN_BUNDLE_PREFIX);
    const spec = dependencies[b];
    const patchDisabled = patchDisabledIds.has(b);
    plugins.push({
      key: `bundle:${b}`,
      profileName: name,
      name: b,
      kind: isInbox ? 'inbox' : 'bundle',
      spec,
      installedVersion: readInstalledVersion(dir, b),
      enabled: !patchDisabled,
      portability: isPortableSpec(spec) ? 'portable' : 'unportable',
      disabledBy: patchDisabled ? 'patch' : undefined,
    });
  }

  // dependencies not in bundles -> plain
  for (const [dep, spec] of Object.entries(dependencies)) {
    if (bundles.includes(dep)) continue;
    plugins.push({
      key: `dep:${dep}`,
      profileName: name,
      name: dep,
      kind: 'plain',
      spec,
      installedVersion: readInstalledVersion(dir, dep),
      enabled: false, // 已安装但未作为 bundle 激活
      portability: isPortableSpec(spec) ? 'portable' : 'unportable',
      disabledBy: undefined,
    });
  }

  // patch rows -> row
  let rowIdx = 0;
  for (const row of patchRows) {
    const rowName = row.id || row.name || `row-${rowIdx}`;
    plugins.push({
      key: `row:${rowName}`,
      profileName: name,
      name: rowName,
      kind: 'row',
      enabled: !row.disabled,
      portability: 'portable',
      disabledBy: row.disabled ? 'patch' : undefined,
    });
    rowIdx += 1;
  }

  return {
    name,
    dir,
    exists: fs.existsSync(dir),
    bundles,
    dependencies,
    plugins,
    patchRows,
    patchFile,
  };
}

export function scanDshPlugins(): DshPluginScanResult {
  const homeDir = resolveDshHome();
  const profilesDir = path.join(homeDir, 'profiles');
  const cfg = readConfigFile();

  const profiles = listProfileDirs(profilesDir).map(name => scanProfile(profilesDir, name));

  return {
    homeDir,
    dshCommand: resolveDshCommand(cfg),
    pnpmCommand: resolvePnpmCommand(cfg),
    profiles,
  };
}

// ==================== cordis.patch.yml 文本级操作 ====================

interface SplitResult {
  header: string;
  items: string[];
}

function splitTopLevelItems(text: string): SplitResult {
  const lines = text.split(/\r?\n/);
  const headerLines: string[] = [];
  const items: string[] = [];
  let current: string[] | null = null;

  for (const line of lines) {
    if (/^-(\s|$)/.test(line)) {
      if (current) items.push(current.join('\n'));
      current = [line];
    } else if (current) {
      current.push(line);
    } else {
      headerLines.push(line);
    }
  }
  if (current) items.push(current.join('\n'));

  return { header: headerLines.join('\n'), items };
}

function itemIdOf(item: string): string | null {
  const m = item.match(/^\s*-\s+id:\s*(.+)$/m) || item.match(/^\s*-\s+name:\s*(.+)$/m);
  if (!m) return null;
  return m[1].trim().replace(/^['"]|['"]$/g, '');
}

function hasTopLevelItemWithId(text: string, id: string): boolean {
  const { items } = splitTopLevelItems(text);
  return items.some(item => itemIdOf(item) === id);
}

/** 追加 `{id, disabled: true}` 条目；已存在同 id 顶层条目时幂等 no-op。返回是否发生写入。 */
function addDisabledRow(patchFile: string, id: string): boolean {
  let text = readTextSafe(patchFile) ?? '';
  if (!text.trim()) text = '[]\n';

  if (hasTopLevelItemWithId(text, id)) return false;

  const block = `- id: ${id}\n  disabled: true`;
  const { items } = splitTopLevelItems(text);

  if (items.length === 0) {
    // 空数组：替换 `[]` 行为条目
    const replaced = text.replace(/^\[\s*\]\s*(?:#.*)?$/m, block);
    if (replaced !== text) {
      fs.writeFileSync(patchFile, replaced, 'utf-8');
      return true;
    }
    fs.writeFileSync(patchFile, text.replace(/\s*$/, '') + '\n' + block + '\n', 'utf-8');
    return true;
  }

  fs.writeFileSync(patchFile, text.replace(/\s*$/, '') + '\n' + block + '\n', 'utf-8');
  return true;
}

/** 按 id/name 删除顶层条目；删除后若为空则回写 `[]`。返回是否发生写入。 */
function removeRowById(patchFile: string, id: string): boolean {
  const text = readTextSafe(patchFile);
  if (!text) return false;

  const { header, items } = splitTopLevelItems(text);
  const idx = items.findIndex(item => itemIdOf(item) === id);
  if (idx < 0) return false;

  items.splice(idx, 1);

  let newText: string;
  if (items.length === 0) {
    const headerTrim = header.replace(/\s*$/, '');
    newText = (headerTrim ? headerTrim + '\n' : '') + '[]\n';
  } else {
    newText = [...(header ? [header] : []), ...items].join('\n') + '\n';
  }

  fs.writeFileSync(patchFile, newText, 'utf-8');
  return true;
}

// ==================== package.json 写盘 ====================

function readPkg(profileDir: string): any | null {
  const pkgFile = path.join(profileDir, 'package.json');
  const text = readTextSafe(pkgFile);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function writePkg(profileDir: string, pkg: any): void {
  const pkgFile = path.join(profileDir, 'package.json');
  fs.writeFileSync(pkgFile, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
}

function ensureProfileDir(profile: string): string {
  const profileDir = path.join(resolveDshHome(), 'profiles', profile);
  if (!fs.existsSync(profileDir)) {
    throw new Error(`profile 目录不存在: ${profileDir}`);
  }
  return profileDir;
}

function removeFromBundles(profileDir: string, pkgName: string): boolean {
  const pkg = readPkg(profileDir);
  if (!pkg) return false;
  const bundles = pkg?.dsh?.profile?.bundles;
  if (!Array.isArray(bundles) || !bundles.includes(pkgName)) return false;
  pkg.dsh.profile.bundles = bundles.filter((b: string) => b !== pkgName);
  writePkg(profileDir, pkg);
  return true;
}

function addToBundles(profileDir: string, pkgName: string): boolean {
  const pkg = readPkg(profileDir);
  if (!pkg) return false;
  if (!pkg.dsh) pkg.dsh = {};
  if (!pkg.dsh.profile) pkg.dsh.profile = {};
  if (!Array.isArray(pkg.dsh.profile.bundles)) pkg.dsh.profile.bundles = [];
  if (pkg.dsh.profile.bundles.includes(pkgName)) return false;
  pkg.dsh.profile.bundles.push(pkgName);
  writePkg(profileDir, pkg);
  return true;
}

function removeDependency(profileDir: string, pkgName: string): boolean {
  const pkg = readPkg(profileDir);
  if (!pkg) return false;
  let changed = false;
  if (pkg?.dependencies && pkg.dependencies[pkgName] !== undefined) {
    delete pkg.dependencies[pkgName];
    changed = true;
  }
  if (Array.isArray(pkg?.dsh?.profile?.bundles) && pkg.dsh.profile.bundles.includes(pkgName)) {
    pkg.dsh.profile.bundles = pkg.dsh.profile.bundles.filter((b: string) => b !== pkgName);
    changed = true;
  }
  if (changed) writePkg(profileDir, pkg);
  return changed;
}

// ==================== 诊断 ====================

function killProcessTree(pid: number | undefined): void {
  if (!pid) return;
  if (process.platform === 'win32') {
    try {
      spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
    } catch {}
  } else {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {}
  }
}

/** 从崩溃 stderr 中抽取失败插件名（优先级 1/2）。 */
function extractFailedNames(raw: string): string[] {
  const markerIdx = raw.indexOf('did not activate');
  if (markerIdx >= 0) {
    const rest = raw.slice(markerIdx);
    const names: string[] = [];
    for (const line of rest.split(/\r?\n/).slice(1)) {
      if (/^\s/.test(line)) continue; // 缩进的行是堆栈
      const t = line.trim();
      if (!t) continue;
      const colon = t.indexOf(':');
      if (colon > 0) {
        const nm = t.slice(0, colon).trim();
        if (nm) names.push(nm);
      }
    }
    if (names.length) return names;
  }

  const m2 = raw.match(/plugin\(s\) failed to load:\s*(.+)/);
  if (m2) {
    const parts = m2[1].split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length) return parts;
  }

  return [];
}

function scanProfileForDiagnose(profileName: string): DshProfileScan {
  const profilesDir = path.join(resolveDshHome(), 'profiles');
  return scanProfile(profilesDir, profileName);
}

function buildActions(profileName: string, names: string[]): DshRecoveryAction[] {
  const scan = scanProfileForDiagnose(profileName);
  const actions: DshRecoveryAction[] = [];

  for (const name of names) {
    if (scan.bundles.includes(name) && !name.startsWith(BUILTIN_BUNDLE_PREFIX)) {
      actions.push({
        kind: 'remove-bundle',
        profileName,
        target: name,
        description: `从 dsh.profile.bundles 中移除 ${name}`,
      });
    } else if (scan.dependencies[name] !== undefined) {
      actions.push({
        kind: 'remove-dependency',
        profileName,
        target: name,
        description: `从 dependencies 中移除 ${name}`,
      });
    } else {
      const row = scan.patchRows.find(r => (r.id || r.name) === name);
      const target = row?.id || row?.name || name;
      actions.push({
        kind: 'disable-row',
        profileName,
        target,
        description: `在 cordis.patch.yml 中停用 ${target}`,
      });
    }
  }

  return actions;
}

export function diagnoseDshWeb(profile?: string): Promise<DshDiagnoseResult> {
  const cfg = readConfigFile();
  const dshCmd = resolveDshCommand(cfg);
  if (!dshCmd) {
    return Promise.resolve({
      ok: false,
      exitCode: null,
      rawStderr: '',
      failedPlugins: [],
      suggestedActions: [],
      hint: '未找到 dsh 命令，请在「设置」中配置 dshCommand，或先安装 DeepSeek Harness',
    });
  }

  const profileName = (profile || '').trim() || 'web';
  const args = profileName === 'web' ? ['web'] : ['--profile', profileName];
  const cwd = path.join(resolveDshHome(), 'profiles', profileName);

  return new Promise<DshDiagnoseResult>(resolve => {
    let settled = false;

    let child;
    try {
      child = spawn(dshCmd, args, {
        cwd: fs.existsSync(cwd) ? cwd : undefined,
        shell: process.platform === 'win32',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env },
      });
    } catch (e: any) {
      resolve({
        ok: false,
        exitCode: null,
        rawStderr: e?.message || String(e),
        failedPlugins: [],
        suggestedActions: [],
        hint: `无法启动 dsh: ${e?.message || String(e)}`,
      });
      return;
    }

    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (d: Buffer) => { stdout += d.toString(); });
    child.stderr?.on('data', (d: Buffer) => { stderr += d.toString(); });

    const finish = (result: DshDiagnoseResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    const timer = setTimeout(() => {
      // 超时未退出 => 判定健康，杀掉诊断实例
      killProcessTree(child.pid);
      finish({
        ok: true,
        exitCode: null,
        rawStderr: stderr || stdout,
        failedPlugins: [],
        suggestedActions: [],
      });
    }, 15000);

    child.on('error', (err: Error) => {
      finish({
        ok: false,
        exitCode: null,
        rawStderr: err.message,
        failedPlugins: [],
        suggestedActions: [],
        hint: `无法启动 dsh: ${err.message}`,
      });
    });

    child.on('exit', (code: number | null) => {
      const raw = stderr || stdout;
      if (code === 0) {
        finish({
          ok: true,
          exitCode: code,
          rawStderr: raw,
          failedPlugins: [],
          suggestedActions: [],
        });
        return;
      }

      if (/EADDRINUSE/i.test(raw)) {
        finish({
          ok: false,
          exitCode: code,
          rawStderr: raw,
          failedPlugins: [],
          suggestedActions: [],
          hint: '端口已被占用（可能是另一个 DSH 实例正在运行），这通常不是插件故障。请先关闭现有实例后重试。',
        });
        return;
      }

      const names = extractFailedNames(raw);
      if (names.length === 0) {
        // 优先级 3：用 profile 声明的包名回扫堆栈
        const scan = scanProfileForDiagnose(profileName);
        const known = [...scan.bundles, ...Object.keys(scan.dependencies)];
        const hits = known.filter(n => n && n.length > 2 && raw.includes(n));
        if (hits.length) {
          names.push(...hits);
        }
      }

      finish({
        ok: false,
        exitCode: code,
        rawStderr: raw,
        failedPlugins: names,
        suggestedActions: buildActions(profileName, names),
        hint: names.length === 0
          ? '未能自动定位失败插件，请在「插件面板」手动停用相关插件，或查看下方原始日志'
          : undefined,
      });
    });
  });
}

// ==================== 开关 / 恢复 / 安装 ====================

export function toggleDshPlugin(profile: string, key: string, enabled: boolean): void {
  const profileDir = ensureProfileDir(profile);

  if (key.startsWith('bundle:')) {
    const pkgName = key.slice('bundle:'.length);
    if (enabled) {
      addToBundles(profileDir, pkgName);
    } else {
      removeFromBundles(profileDir, pkgName);
    }
    return;
  }

  if (key.startsWith('dep:')) {
    const pkgName = key.slice('dep:'.length);
    if (enabled) {
      // 作为 bundle 激活（依赖已存在）
      addToBundles(profileDir, pkgName);
    } else {
      removeDependency(profileDir, pkgName);
    }
    return;
  }

  if (key.startsWith('row:')) {
    const rowId = key.slice('row:'.length);
    const patchFile = path.join(profileDir, 'cordis.patch.yml');
    if (enabled) {
      removeRowById(patchFile, rowId);
    } else {
      addDisabledRow(patchFile, rowId);
    }
    return;
  }

  throw new Error(`无法识别的插件 key: ${key}`);
}

/** 卸载：从配置中彻底移除（bundle/dep 同时移出 dependencies + bundles，row 从 patch 删除），并尽力清理 node_modules。 */
export function removeDshPlugin(profile: string, key: string): void {
  const profileDir = ensureProfileDir(profile);

  if (key.startsWith('bundle:') || key.startsWith('dep:')) {
    const pkgName = key.slice(key.indexOf(':') + 1);
    removeDependency(profileDir, pkgName);
    // 尽力清理 node_modules + 更新 lock（pnpm 不可用/失败不影响配置已移除）
    try {
      installDshPlugins(profile);
    } catch {
      /* best-effort prune */
    }
    return;
  }

  if (key.startsWith('row:')) {
    const rowId = key.slice('row:'.length);
    removeRowById(path.join(profileDir, 'cordis.patch.yml'), rowId);
    return;
  }

  throw new Error(`无法识别的插件 key: ${key}`);
}

export function applyDshRecovery(action: DshRecoveryAction): void {
  const profileDir = ensureProfileDir(action.profileName);

  if (action.kind === 'remove-bundle') {
    removeFromBundles(profileDir, action.target);
    return;
  }

  if (action.kind === 'remove-dependency') {
    removeDependency(profileDir, action.target);
    return;
  }

  if (action.kind === 'disable-row') {
    const patchFile = path.join(profileDir, 'cordis.patch.yml');
    addDisabledRow(patchFile, action.target);
    return;
  }

  throw new Error(`未知的恢复动作: ${action.kind}`);
}

export function installDshPlugins(profile: string): string {
  const cfg = readConfigFile();
  const pnpmCmd = resolvePnpmCommand(cfg);
  if (!pnpmCmd) {
    throw new Error('未找到 pnpm 命令，请在「设置」中配置 pnpmCommand');
  }
  const profileDir = ensureProfileDir(profile);

  const res = spawnSync(pnpmCmd, ['install'], {
    cwd: profileDir,
    shell: process.platform === 'win32',
    encoding: 'utf-8',
    timeout: 300000,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const out = [res.stdout, res.stderr].filter(Boolean).join('\n');
  if (res.status !== 0) {
    throw new Error(`pnpm install 失败 (exit ${res.status ?? 'signal'}):\n${out}`);
  }
  return out;
}

// ==================== 同步 / 对账 ====================

const SYNC_GITIGNORE_CONTENT = `# AgentHub sync repo local-only files
config.json
agents.json
projects.json
backups/
*.log
.DS_Store
Thumbs.db
`;

function syncRoot(): string {
  return appDataDir();
}

function dshMirrorDir(): string {
  return path.join(appDataDir(), 'dsh');
}

function mirrorProfileDir(profile: string): string {
  return path.join(dshMirrorDir(), 'profiles', profile);
}

function ensureSyncGitignore(root: string): void {
  const gitignore = path.join(root, '.gitignore');
  if (!fs.existsSync(gitignore)) {
    fs.writeFileSync(gitignore, SYNC_GITIGNORE_CONTENT, 'utf-8');
  }
}

function readDshSyncConfig(): any {
  const cfg = readConfigFile();
  return cfg.dsh_plugins?.sync || {
    remoteUrl: '',
    branch: 'main',
    autoPullOnStartup: false,
    lastSyncAt: 0,
    lastSyncStatus: 'idle',
    lastError: undefined,
  };
}

function saveDshSyncConfig(syncCfg: any): void {
  const cfg = readConfigFile();
  if (!cfg.dsh_plugins) cfg.dsh_plugins = { dshCommand: '', pnpmCommand: '' };
  cfg.dsh_plugins.sync = syncCfg;
  const configFile = path.join(appDataDir(), 'config.json');
  fs.writeFileSync(configFile, JSON.stringify(cfg, null, 2), 'utf-8');
}

function gitExec(cwd: string, args: string[]): string {
  return runGit(cwd, args);
}

function gitTry(cwd: string, args: string[]): string {
  try {
    return gitExec(cwd, args);
  } catch {
    return '';
  }
}

function gitOk(cwd: string, args: string[]): boolean {
  try {
    gitExec(cwd, args);
    return true;
  } catch {
    return false;
  }
}

function gitDirtyCount(cwd: string): number {
  const out = gitTry(cwd, ['status', '--porcelain']);
  return out ? out.split(/\r?\n/).filter(l => l.trim()).length : 0;
}

function parseAheadBehind(statusSb: string): { ahead: number; behind: number } {
  const first = statusSb.split(/\r?\n/)[0] || '';
  if (!first.startsWith('## ')) return { ahead: 0, behind: 0 };
  let ahead = 0;
  let behind = 0;
  const idx = first.indexOf('[');
  if (idx >= 0) {
    const bracket = first.slice(idx);
    const aheadMatch = bracket.match(/ahead (\d+)/);
    const behindMatch = bracket.match(/behind (\d+)/);
    if (aheadMatch) ahead = parseInt(aheadMatch[1], 10) || 0;
    if (behindMatch) behind = parseInt(behindMatch[1], 10) || 0;
  }
  return { ahead, behind };
}

export function getDshPluginsSyncStatus(): SkillsSyncStatus {
  const root = syncRoot();
  const syncCfg = readDshSyncConfig();
  const initialized = fs.existsSync(path.join(root, '.git'));

  const status: SkillsSyncStatus = {
    initialized,
    remoteUrl: syncCfg.remoteUrl || undefined,
    branch: undefined,
    ahead: 0,
    behind: 0,
    dirtyCount: 0,
    lastSyncAt: syncCfg.lastSyncAt > 0 ? syncCfg.lastSyncAt : undefined,
    lastSyncStatus: syncCfg.lastSyncStatus || 'idle',
    lastError: syncCfg.lastError || undefined,
  };

  if (initialized) {
    const branch = gitTry(root, ['rev-parse', '--abbrev-ref', 'HEAD']);
    if (branch) status.branch = branch;
    const sb = gitTry(root, ['status', '-sb', '--porcelain=v1']);
    if (sb) {
      const { ahead, behind } = parseAheadBehind(sb);
      status.ahead = ahead;
      status.behind = behind;
      const lines = sb.split(/\r?\n/).filter(l => l.trim());
      status.dirtyCount = sb.startsWith('## ') ? Math.max(0, lines.length - 1) : lines.length;
    }
  }

  return status;
}

function updateLastSync(status: string, error?: string): void {
  const syncCfg = readDshSyncConfig();
  syncCfg.lastSyncStatus = status;
  syncCfg.lastSyncAt = Date.now();
  syncCfg.lastError = error;
  saveDshSyncConfig(syncCfg);
}

export function initDshPluginsSync(remoteUrl: string, branch?: string): SkillsSyncStatus {
  const root = syncRoot();
  fs.mkdirSync(root, { recursive: true });
  ensureSyncGitignore(root);

  const targetBranch = (branch || 'main').trim() || 'main';

  // 幂等：与 skills sync 共用同一 .git，无 .git 才 init
  if (!fs.existsSync(path.join(root, '.git'))) {
    try {
      gitExec(root, ['init', '-b', targetBranch]);
    } catch {
      gitExec(root, ['init']);
      gitTry(root, ['symbolic-ref', 'HEAD', `refs/heads/${targetBranch}`]);
    }
    gitTry(root, ['remote', 'remove', 'origin']);
    gitExec(root, ['remote', 'add', 'origin', remoteUrl]);
  } else if (remoteUrl) {
    // 已初始化：保持与 skills sync 同一远端（覆盖 origin 与 skills 一致）
    gitTry(root, ['remote', 'remove', 'origin']);
    gitExec(root, ['remote', 'add', 'origin', remoteUrl]);
  }

  if (gitOk(root, ['fetch', 'origin'])) {
    const remoteRef = `origin/${targetBranch}`;
    if (gitOk(root, ['rev-parse', '--verify', remoteRef])) {
      const head = gitTry(root, ['rev-parse', '--verify', 'HEAD']);
      if (!head) {
        gitTry(root, ['symbolic-ref', 'HEAD', `refs/heads/${targetBranch}`]);
        gitTry(root, ['reset', '--mixed', remoteRef]);
      }
    }
  }

  const syncCfg = readDshSyncConfig();
  syncCfg.remoteUrl = remoteUrl;
  syncCfg.branch = targetBranch;
  syncCfg.lastSyncStatus = 'idle';
  syncCfg.lastError = undefined;
  saveDshSyncConfig(syncCfg);

  return getDshPluginsSyncStatus();
}

export function pullDshPluginsSync(): SkillsSyncStatus {
  const root = syncRoot();
  const syncCfg = readDshSyncConfig();

  if (!fs.existsSync(path.join(root, '.git'))) {
    throw new Error('尚未初始化同步仓库，请先在插件同步中初始化');
  }
  if (!syncCfg.remoteUrl) {
    throw new Error('尚未配置远端仓库地址');
  }

  const dirty = gitDirtyCount(root);
  if (dirty > 0) {
    const msg = `本地有 ${dirty} 个未提交修改，已跳过拉取；请先推送或手动处理`;
    updateLastSync('error', msg);
    throw new Error(msg);
  }

  const branch = syncCfg.branch || 'main';
  try {
    gitExec(root, ['pull', '--ff-only', 'origin', branch]);
    updateLastSync('success');
    return getDshPluginsSyncStatus();
  } catch (e: any) {
    const msg = `拉取失败: ${e.message}`;
    updateLastSync('error', msg);
    throw new Error(msg);
  }
}

/** 本地 ~/.dsh → 镜像（剔除内置 bundle 与不可移植依赖）。返回警告列表。 */
export function snapshotLocalToMirror(): string[] {
  const warnings: string[] = [];
  const profilesDir = path.join(resolveDshHome(), 'profiles');

  for (const name of listProfileDirs(profilesDir)) {
    const localDir = path.join(profilesDir, name);
    const pkg = readPkg(localDir);
    if (!pkg) continue;

    const mirrorDir = mirrorProfileDir(name);
    fs.mkdirSync(mirrorDir, { recursive: true });

    // 生成可移植 package.json
    const portPkg: any = { ...pkg };
    if (pkg?.dependencies && typeof pkg.dependencies === 'object') {
      const deps: Record<string, string> = {};
      for (const [dep, spec] of Object.entries(pkg.dependencies)) {
        if (typeof spec !== 'string') continue;
        if (!isPortableSpec(spec)) {
          warnings.push(`${name}: 依赖 ${dep} 使用不可移植规格 ${spec}，已从镜像中剔除`);
          continue;
        }
        deps[dep] = spec;
      }
      portPkg.dependencies = deps;
    }
    if (Array.isArray(pkg?.dsh?.profile?.bundles)) {
      const userBundles = pkg.dsh.profile.bundles.filter(
        (b: string) => !b.startsWith(BUILTIN_BUNDLE_PREFIX) && isPortableSpec(pkg?.dependencies?.[b]),
      );
      portPkg.dsh = { ...(pkg.dsh || {}), profile: { ...(pkg.dsh?.profile || {}), bundles: userBundles } };
    }

    fs.writeFileSync(path.join(mirrorDir, 'package.json'), JSON.stringify(portPkg, null, 2) + '\n', 'utf-8');

    for (const f of ['cordis.patch.yml', 'pnpm-lock.yaml']) {
      const src = path.join(localDir, f);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(mirrorDir, f));
      }
    }
  }

  return warnings;
}

export function pushDshPluginsSync(message?: string): SkillsSyncStatus {
  const root = syncRoot();
  const syncCfg = readDshSyncConfig();

  if (!fs.existsSync(path.join(root, '.git'))) {
    throw new Error('尚未初始化同步仓库，请先在插件同步中初始化');
  }
  if (!syncCfg.remoteUrl) {
    throw new Error('尚未配置远端仓库地址');
  }

  snapshotLocalToMirror();

  if (fs.existsSync(dshMirrorDir())) {
    gitExec(root, ['add', '-A', '--', 'dsh']);
  }

  const staged = gitTry(root, ['diff', '--cached', '--name-only']);
  if (staged && staged.trim()) {
    const msg = (message || '').trim() || `sync dsh plugins [${new Date().toLocaleString()}]`;
    gitExec(root, ['commit', '-m', msg]);
  }

  const branch = syncCfg.branch || 'main';
  try {
    gitExec(root, ['push', '-u', 'origin', branch]);
    updateLastSync('success');
    return getDshPluginsSyncStatus();
  } catch (e: any) {
    const msg = `推送失败: ${e.message}`;
    updateLastSync('error', msg);
    throw new Error(msg);
  }
}

export function setDshPluginsSyncAutoPull(enabled: boolean): void {
  const syncCfg = readDshSyncConfig();
  syncCfg.autoPullOnStartup = enabled;
  saveDshSyncConfig(syncCfg);
}

// ---- 对账 ----

function portableDeps(pkg: any | null): Record<string, string> {
  const deps: Record<string, string> = {};
  if (pkg?.dependencies && typeof pkg.dependencies === 'object') {
    for (const [dep, spec] of Object.entries(pkg.dependencies)) {
      if (typeof spec === 'string' && isPortableSpec(spec)) deps[dep] = spec;
    }
  }
  return deps;
}

function allDeps(pkg: any | null): Record<string, string> {
  const deps: Record<string, string> = {};
  if (pkg?.dependencies && typeof pkg.dependencies === 'object') {
    for (const [dep, spec] of Object.entries(pkg.dependencies)) {
      if (typeof spec === 'string') deps[dep] = spec;
    }
  }
  return deps;
}

function userBundles(pkg: any | null): string[] {
  if (!Array.isArray(pkg?.dsh?.profile?.bundles)) return [];
  return pkg.dsh.profile.bundles.filter((b: string) => !b.startsWith(BUILTIN_BUNDLE_PREFIX));
}

export function reconcileDshPlugins(): DshPluginDiff {
  const items: DshPluginDiffItem[] = [];
  const warnings: string[] = [];
  const profilesDir = path.join(resolveDshHome(), 'profiles');
  const mirrorRoot = path.join(dshMirrorDir(), 'profiles');

  const profileNames = new Set<string>();
  for (const n of listProfileDirs(mirrorRoot)) profileNames.add(n);
  for (const n of listProfileDirs(profilesDir)) profileNames.add(n);

  for (const name of [...profileNames].sort()) {
    const localPkg = readPkg(path.join(profilesDir, name));
    const mirrorPkg = readPkg(path.join(mirrorRoot, name));
    if (!localPkg && !mirrorPkg) continue;

    // 不可移植本地依赖 → 警告
    for (const [dep, spec] of Object.entries(allDeps(localPkg))) {
      if (!isPortableSpec(spec)) {
        warnings.push(`${name}: ${dep} (${spec}) 不可移植，不会参与同步`);
      }
    }

    // 仅在存在镜像基线（已推送过）时进行差异对账
    if (mirrorPkg) {
      const localDeps = portableDeps(localPkg);
      const mirrorDeps = portableDeps(mirrorPkg);
      const depNames = new Set([...Object.keys(localDeps), ...Object.keys(mirrorDeps)]);
      for (const dep of [...depNames].sort()) {
        const l = localDeps[dep];
        const r = mirrorDeps[dep];
        if (l === undefined && r !== undefined) {
          items.push({ kind: 'missing', profileName: name, name: dep, remote: r });
        } else if (l !== undefined && r === undefined) {
          items.push({ kind: 'extra', profileName: name, name: dep, local: l });
        } else if (l !== undefined && r !== undefined && l !== r) {
          items.push({ kind: 'version', profileName: name, name: dep, local: l, remote: r });
        }
      }

      const lb = userBundles(localPkg);
      const rb = userBundles(mirrorPkg);
      for (const b of [...new Set([...lb, ...rb])].sort()) {
        const inL = lb.includes(b);
        const inR = rb.includes(b);
        if (inL && !inR) items.push({ kind: 'extra', profileName: name, name: `bundle:${b}`, local: 'bundles' });
        else if (!inL && inR) items.push({ kind: 'missing', profileName: name, name: `bundle:${b}`, remote: 'bundles' });
      }

      const localPatch = readTextSafe(path.join(profilesDir, name, 'cordis.patch.yml'));
      const mirrorPatch = readTextSafe(path.join(mirrorRoot, name, 'cordis.patch.yml'));
      if (localPatch !== mirrorPatch) {
        items.push({
          kind: 'patch',
          profileName: name,
          name: 'cordis.patch.yml',
          local: localPatch || '(空)',
          remote: mirrorPatch || '(空)',
        });
      }
    }
  }

  return { compatible: items.length === 0, items, warnings };
}

export function alignDshPlugins(profile?: string): void {
  const profilesDir = path.join(resolveDshHome(), 'profiles');
  const mirrorRoot = path.join(dshMirrorDir(), 'profiles');

  const targets = (profile && profile.trim())
    ? [profile.trim()]
    : listProfileDirs(mirrorRoot);

  for (const name of targets) {
    const localDir = path.join(profilesDir, name);
    const mirrorDir = path.join(mirrorRoot, name);
    const mirrorPkg = readPkg(mirrorDir);
    if (!mirrorPkg) continue;

    fs.mkdirSync(localDir, { recursive: true });

    const localPkg = readPkg(localDir) || {};

    // 内置 bundle 保留本地默认；本地不可移植依赖保留
    const builtinBundles = Array.isArray(localPkg?.dsh?.profile?.bundles)
      ? localPkg.dsh.profile.bundles.filter((b: string) => b.startsWith(BUILTIN_BUNDLE_PREFIX))
      : [];
    const localUnportableDeps: Record<string, string> = {};
    for (const [dep, spec] of Object.entries(allDeps(localPkg))) {
      if (!isPortableSpec(spec)) localUnportableDeps[dep] = spec;
    }

    const mergedDeps: Record<string, string> = {
      ...portableDeps(mirrorPkg),
      ...localUnportableDeps,
    };
    const mergedBundles = [...builtinBundles, ...userBundles(mirrorPkg)];

    const mergedPkg: any = {
      ...localPkg,
      name: localPkg.name || `dsh-profile-${name}`,
      private: true,
      dependencies: mergedDeps,
    };
    if (!mergedPkg.dsh) mergedPkg.dsh = {};
    if (!mergedPkg.dsh.profile) mergedPkg.dsh.profile = {};
    mergedPkg.dsh.profile.bundles = mergedBundles;

    writePkg(localDir, mergedPkg);

    for (const f of ['cordis.patch.yml', 'pnpm-lock.yaml']) {
      const src = path.join(mirrorDir, f);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(localDir, f));
      }
    }

    installDshPlugins(name);
  }
}
