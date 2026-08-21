import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn, spawnSync, execFileSync } from 'child_process';
import jsyaml from 'js-yaml';
import { gitProxyArgs, runGit } from './gitSyncUtil';
import { globalSyncRemoteUrl, globalSyncBranch } from './syncRepo';
import type {
  DshDiagnoseResult,
  DshInstallFailure,
  DshInstallMode,
  DshInstallReport,
  DshPatchRow,
  DshPluginDiff,
  DshPluginDiffItem,
  DshPluginEntry,
  DshPluginInstallEntry,
  DshPluginKind,
  DshPluginScanResult,
  DshPluginUpdateCheck,
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

// ==================== 安装状态持久化 ====================

interface DshInstallStateItem {
  status: 'failed';
  reason: string;
  stack?: string;
  lastAttemptAt: number;
}

type DshInstallState = Record<string, Record<string, DshInstallStateItem>>;

function installStateFile(): string {
  return path.join(appDataDir(), 'dsh_install_state.json');
}

function readInstallState(): DshInstallState {
  const f = installStateFile();
  if (fs.existsSync(f)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(f, 'utf-8'));
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as DshInstallState;
    } catch {}
  }
  return {};
}

function writeInstallState(state: DshInstallState): void {
  fs.mkdirSync(appDataDir(), { recursive: true });
  fs.writeFileSync(installStateFile(), JSON.stringify(state, null, 2) + '\n', 'utf-8');
}

export function clearDshInstallState(profile: string, pkg?: string): void {
  const state = readInstallState();
  if (!pkg) {
    delete state[profile];
  } else {
    const profileState = state[profile];
    if (profileState) {
      delete profileState[pkg];
      if (Object.keys(profileState).length === 0) delete state[profile];
    }
  }
  writeInstallState(state);
}

// ==================== 对账（配置 ∪ 本机磁盘） ====================

/** 语义化版本 spec 判定：`1.2.3` / `^1.0.0` / `~1.0.0` / `>=1 <2` 等参与版本对比。 */
function isSemverSpec(spec?: string): boolean {
  if (!spec) return false;
  const tokens = spec.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;
  const semverToken = /^(?:\^|~|>=|<=|>|<|=)?\s*v?\d+(?:\.\d+){0,2}(?:-[0-9A-Za-z.-]+)?$/;
  return tokens.every(t => semverToken.test(t));
}

/** 精确版本号 spec（无范围运算符，可用于 lock 缺失时的 requiredVersion）。 */
function isExactSemverSpec(spec?: string): boolean {
  if (!spec) return false;
  return /^v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(spec.trim());
}

function readPkgFromDir(pkgDir: string): any | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf-8'));
  } catch {}
  return null;
}

/** 只扫描 pnpm-lock.yaml 的 `packages:` 段，避免 importers 段的 URL/别名干扰。 */
function readLockResolvedVersion(profileDir: string, pkgName: string): string | undefined {
  const lockFile = path.join(profileDir, 'pnpm-lock.yaml');
  const text = readTextSafe(lockFile);
  if (!text) return undefined;

  const lines = text.split(/\r?\n/);
  let start = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (/^packages:\s*$/.test(lines[i])) {
      start = i + 1;
      break;
    }
  }
  if (start < 0) return undefined;

  // packages: 段持续到下一个顶层（无缩进）key
  let end = lines.length;
  for (let i = start; i < lines.length; i += 1) {
    if (lines[i].trim() !== '' && !/^\s/.test(lines[i])) {
      end = i;
      break;
    }
  }

  const parseKeyName = (rawKey: string): string | undefined => {
    const k = rawKey.trim().replace(/['"]/g, '').replace(/:$/, '').trim();
    if (!k) return undefined;
    if (k.startsWith('@')) {
      const parts = k.split('/');
      if (parts.length >= 2) return `${parts[0]}/${parts[1].split('@')[0]}`;
      return undefined;
    }
    return k.split('@')[0];
  };

  for (let i = start; i < end; i += 1) {
    const line = lines[i];
    // 包名 key：恰好 2 空格缩进，且不是子字段
    if (/^  [^ ].*:$/.test(line) && !/^  (version|resolution|dev|optional|dependencies|peerDependencies|engines|os|cpu|libc|hasBin|name):/.test(line.trim())) {
      const name = parseKeyName(line);
      if (name !== pkgName) continue;
      // 读取后续子字段中的 version:
      for (let j = i + 1; j < end; j += 1) {
        const sub = lines[j];
        if (/^  [^ ].*:$/.test(sub)) break; // 下一个包名 key
        const vm = sub.match(/^\s{4}version:\s*['"]?([^'"]+)['"]?\s*$/);
        if (vm) return vm[1].trim();
      }
      return undefined;
    }
  }
  return undefined;
}

/** 枚举 profile node_modules 顶层直接依赖（排除内置、.bin/.pnpm/隐藏目录）。 */
function listInstalledTopLevelPkgs(profileDir: string): string[] {
  const nm = path.join(profileDir, 'node_modules');
  if (!fs.existsSync(nm)) return [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(nm, { withFileTypes: true });
  } catch {
    return [];
  }

  const names: string[] = [];
  for (const ent of entries) {
    if (!ent.isDirectory() && !ent.isSymbolicLink()) continue;
    const n = ent.name;
    if (n === '.bin' || n === '.pnpm' || n.startsWith('.')) continue;
    if (n.startsWith('@')) {
      const scopeDir = path.join(nm, n);
      let subEntries: fs.Dirent[];
      try {
        subEntries = fs.readdirSync(scopeDir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const sub of subEntries) {
        if (!sub.isDirectory() && !sub.isSymbolicLink()) continue;
        const sn = sub.name;
        if (sn === '.bin' || sn.startsWith('.')) continue;
        names.push(`${n}/${sn}`);
      }
    } else {
      names.push(n);
    }
  }
  return names;
}

/** 读取 pnpm 的 .modules.yaml 中 hoistedLocations，返回被 pnpm 主动提升到顶层 node_modules 的包名集合。
 *  这些包是声明依赖的传递依赖（如 dsh-notification -> zod），不是孤儿，删除会破坏运行时。 */
function readHoistedPkgNames(profileDir: string): Set<string> {
  const hoisted = new Set<string>();
  const modulesYaml = path.join(profileDir, 'node_modules', '.modules.yaml');
  const text = readTextSafe(modulesYaml);
  if (!text) return hoisted;
  try {
    const parsed = JSON.parse(text);
    const locations = parsed?.hoistedLocations;
    if (locations && typeof locations === 'object') {
      for (const paths of Object.values(locations)) {
        if (!Array.isArray(paths)) continue;
        for (const p of paths) {
          if (typeof p !== 'string') continue;
          // 路径形如 `node_modules\zod` 或 `node_modules\@scope\pkg`
          const normalized = p.replace(/^node_modules[\\/]/, '').replace(/\\/g, '/');
          if (normalized) hoisted.add(normalized);
        }
      }
    }
  } catch {}
  return hoisted;
}

function trimStack(stack: string, max = 4096): string {
  if (stack.length <= max) return stack;
  return stack.slice(-max);
}

/** L3：读 node_modules/<pkg>/package.json，优先 main / exports，其次 dsh.bundle.patch。 */
function validateInstalledPkg(profileDir: string, pkgName: string): { ok: boolean; reason?: string } {
  const parts = pkgName.split('/');
  const pkgDir = path.join(profileDir, 'node_modules', ...parts);
  const pkg = readPkgFromDir(pkgDir);
  if (!pkg) {
    return { ok: false, reason: 'node_modules 中缺少该包' };
  }

  const checkFile = (rel: string | undefined): boolean => {
    if (!rel || typeof rel !== 'string') return false;
    return fs.existsSync(path.resolve(pkgDir, rel));
  };

  if (typeof pkg.main === 'string' && checkFile(pkg.main)) return { ok: true };

  const exportsVal = pkg.exports;
  if (typeof exportsVal === 'string' && checkFile(exportsVal)) return { ok: true };
  if (exportsVal && typeof exportsVal === 'object') {
    for (const k of ['.', 'import', 'require', 'default']) {
      const v = exportsVal[k];
      if (typeof v === 'string' && checkFile(v)) return { ok: true };
      if (v && typeof v === 'object') {
        for (const kk of ['import', 'require', 'default']) {
          if (typeof v[kk] === 'string' && checkFile(v[kk])) return { ok: true };
        }
      }
    }
  }

  const dshPatch = pkg?.dsh?.bundle?.patch;
  if (typeof dshPatch === 'string' && checkFile(dshPatch)) return { ok: true };

  return { ok: false, reason: '入口文件缺失（main / exports / dsh.bundle.patch 均不存在）' };
}

export function reconcileDshInstall(profile: string): DshPluginInstallEntry[] {
  const profileName = (profile || '').trim() || 'web';
  const profileDir = path.join(resolveDshHome(), 'profiles', profileName);
  if (!fs.existsSync(profileDir)) return [];

  const pkg = readPkg(profileDir) || {};
  const bundles: string[] = Array.isArray(pkg?.dsh?.profile?.bundles) ? pkg.dsh.profile.bundles.filter((b: unknown): b is string => typeof b === 'string') : [];
  const deps: Record<string, string> = {};
  for (const [k, v] of Object.entries(pkg?.dependencies || {})) {
    if (typeof v === 'string') deps[k] = v;
  }

  const patchFile = path.join(profileDir, 'cordis.patch.yml');
  const patchRows = parsePatchRows(patchFile);
  const patchDisabledIds = new Set<string>();
  for (const row of patchRows) {
    if (row.disabled) {
      const id = row.id || row.name;
      if (id) patchDisabledIds.add(id);
    }
  }

  const state = readInstallState();
  const profileState = state[profileName] || {};
  const installedSet = new Set(listInstalledTopLevelPkgs(profileDir));

  const entries: DshPluginInstallEntry[] = [];
  const declaredPkgNames = new Set<string>();

  const pushDeclaredPkg = (name: string, kind: DshPluginKind, spec: string | undefined, enabled: boolean, disabledBy: 'bundles' | 'patch' | undefined) => {
    declaredPkgNames.add(name);
    const isInbox = kind === 'inbox' || name.startsWith(BUILTIN_BUNDLE_PREFIX);
    const installed = installedSet.has(name);
    const installedVersion = installed ? readInstalledVersion(profileDir, name) : undefined;

    let requiredVersion: string | undefined;
    if (isSemverSpec(spec)) {
      requiredVersion = readLockResolvedVersion(profileDir, name);
      if (requiredVersion === undefined && isExactSemverSpec(spec)) {
        requiredVersion = (spec as string).trim().replace(/^v/, '');
      }
    }

    // 1) 内置 bundle 直接 ok（Harness 运行时解析，不在 profile node_modules 中）
    if (isInbox) {
      entries.push({
        key: `bundle:${name}`,
        profileName,
        name,
        kind: 'inbox',
        spec,
        declaredInConfig: true,
        installed: false,
        installedVersion: undefined,
        requiredVersion: undefined,
        status: 'ok',
        portability: 'portable',
        enabled,
        disabledBy,
      });
      return;
    }

    // 2) 先按磁盘重算状态（陈旧 failed 自愈）
    let diskStatus: DshPluginInstallEntry['status'];
    if (!installed) {
      diskStatus = 'pending';
    } else if (requiredVersion !== undefined && installedVersion !== requiredVersion) {
      diskStatus = 'version-mismatch';
    } else {
      diskStatus = 'ok';
    }

    // 3) 持久化失败仅在磁盘未自愈时展示
    let status: DshPluginInstallEntry['status'] = diskStatus;
    let installError: string | undefined;
    const persisted = profileState[name];
    if (persisted?.status === 'failed' && diskStatus !== 'ok') {
      status = 'failed';
      installError = [persisted.reason, persisted.stack].filter(Boolean).join('\n');
    }
    if (persisted?.status === 'failed' && diskStatus === 'ok') {
      // 用户手动 pnpm install 修复后，清除陈旧 failed
      delete profileState[name];
    }

    entries.push({
      key: `${kind === 'plain' ? 'dep' : 'bundle'}:${name}`,
      profileName,
      name,
      kind,
      spec,
      declaredInConfig: true,
      installed,
      installedVersion,
      requiredVersion,
      status,
      installError,
      portability: isPortableSpec(spec) ? 'portable' : 'unportable',
      enabled,
      disabledBy,
    });
  };

  for (const b of bundles) {
    const isInbox = b.startsWith(BUILTIN_BUNDLE_PREFIX);
    pushDeclaredPkg(
      b,
      isInbox ? 'inbox' : 'bundle',
      deps[b],
      !patchDisabledIds.has(b),
      patchDisabledIds.has(b) ? 'patch' : undefined,
    );
  }

  const depNames = Object.keys(deps).sort();
  for (const dep of depNames) {
    if (bundles.includes(dep)) continue;
    pushDeclaredPkg(dep, 'plain', deps[dep], false, undefined);
  }

  // patch rows：不可安装，视为 ok 配置行
  let rowIdx = 0;
  for (const row of patchRows) {
    const rowName = row.id || row.name || `row-${rowIdx}`;
    entries.push({
      key: `row:${rowName}`,
      profileName,
      name: rowName,
      kind: 'row',
      spec: undefined,
      declaredInConfig: true,
      installed: false,
      status: 'ok',
      portability: 'portable',
      enabled: !row.disabled,
      disabledBy: row.disabled ? 'patch' : undefined,
    });
    rowIdx += 1;
  }

  // 孤儿：本机已装、配置未声明、非内置、非 pnpm 主动提升的传递依赖（hoisted）。
  // 顶层 node_modules 中存在但不属于上述任何一类，才认为是真正多余的包，避免误删 zod 这类传递依赖。
  const hoistedPkgNames = readHoistedPkgNames(profileDir);
  const orphans = [...installedSet]
    .filter(n => !declaredPkgNames.has(n) && !n.startsWith(BUILTIN_BUNDLE_PREFIX) && !hoistedPkgNames.has(n))
    .sort();
  for (const o of orphans) {
    const installedVersion = readInstalledVersion(profileDir, o);
    entries.push({
      key: `orphan:${o}`,
      profileName,
      name: o,
      kind: 'plain',
      spec: undefined,
      declaredInConfig: false,
      installed: true,
      installedVersion,
      requiredVersion: undefined,
      status: 'orphan',
      portability: 'portable',
      enabled: false,
    });
  }

  // 若磁盘自愈清除了陈旧 failed，落盘
  if (Object.keys(profileState).length !== Object.keys(state[profileName] || {}).length) {
    if (Object.keys(profileState).length === 0) {
      delete state[profileName];
    } else {
      state[profileName] = profileState;
    }
    writeInstallState(state);
  }

  return entries;
}

// ==================== 安装器 ====================

const PNPM_INSTALL_ARGS: Record<DshInstallMode, string[]> = {
  'incremental': ['install'],
  'update': ['update'],
  'reinstall-all': ['install', '--force'],
  'reinstall-failed': ['install', '--force'],
};

interface RunPnpmStreamResult {
  exitCode: number | null;
  timedOut: boolean;
  output: string;
  lines: string[];
}

function runPnpmStream(
  pnpmCmd: string,
  args: string[],
  cwd: string,
  onLine: (line: string) => void,
  timeoutMs = 600000,
): Promise<RunPnpmStreamResult> {
  return new Promise(resolve => {
    let child;
    try {
      child = spawn(pnpmCmd, args, {
        cwd,
        shell: process.platform === 'win32',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env },
      });
    } catch (e: any) {
      resolve({
        exitCode: null,
        timedOut: false,
        output: `无法启动 pnpm: ${e?.message || String(e)}`,
        lines: [],
      });
      return;
    }

    const lines: string[] = [];
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      killProcessTree(child.pid);
      resolve({ exitCode: null, timedOut: true, output: lines.join('\n'), lines });
    }, timeoutMs);

    const consume = (stream: NodeJS.ReadableStream | null) => {
      if (!stream) return;
      stream.on('data', (d: Buffer) => {
        const text = d.toString();
        for (const line of text.split(/\r?\n/)) {
          if (line.length === 0) continue;
          lines.push(line);
          onLine(line);
        }
      });
    };
    consume(child.stdout);
    consume(child.stderr);

    child.on('error', (err: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ exitCode: null, timedOut: false, output: `无法启动 pnpm: ${err.message}`, lines });
    });

    child.on('exit', (code: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ exitCode: code, timedOut: false, output: lines.join('\n'), lines });
    });
  });
}

// ==================== 单包更新检查 / 更新 ====================

function gitUrlFromSpec(spec: string): string | null {
  const s = spec.trim();
  if (s.startsWith('git+https://') || s.startsWith('git+http://')) {
    return s.slice('git+'.length);
  }
  if (s.startsWith('github:')) {
    const repo = s.slice('github:'.length);
    return `https://github.com/${repo}.git`;
  }
  return null;
}

function gitLsRemote(url: string): string {
  // 先直连（gh-proxy 等代理域名直连通常可用）；失败再注入系统代理（GitHub 直连场景）
  try {
    return execFileSync('git', ['ls-remote', url, 'HEAD'], {
      encoding: 'utf-8',
      timeout: 20000,
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch {
    const args = [...gitProxyArgs(), 'ls-remote', url, 'HEAD'];
    return execFileSync('git', args, {
      encoding: 'utf-8',
      timeout: 20000,
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  }
}

function shortCommit(commit: string): string {
  return commit.slice(0, 7);
}

/** 解析 lockfile `importers:` 段中某包的 `version:` 值（git 依赖形如 git+...#<commit>）。 */
function readLockImporterVersion(profileDir: string, pkgName: string): string | undefined {
  const lockFile = path.join(profileDir, 'pnpm-lock.yaml');
  const text = readTextSafe(lockFile);
  if (!text) return undefined;

  const lines = text.split(/\r?\n/);
  let start = -1;
  let end = lines.length;
  for (let i = 0; i < lines.length; i += 1) {
    if (/^importers:\s*$/.test(lines[i])) {
      start = i + 1;
      break;
    }
  }
  if (start < 0) return undefined;
  for (let i = start; i < lines.length; i += 1) {
    if (/^packages:\s*$/.test(lines[i])) {
      end = i;
      break;
    }
  }

  // 在 importers 段内查找包名 key，然后读取紧随其后的 version:
  const keyRe = new RegExp(`^\\s{6}['"]?${pkgName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]?:\\s*$`);
  for (let i = start; i < end; i += 1) {
    if (keyRe.test(lines[i])) {
      for (let j = i + 1; j < end; j += 1) {
        const vm = lines[j].match(/^\s{8}version:\s*['"]?([^'"]+)['"]?\s*$/);
        if (vm) return vm[1].trim();
        // 遇到下一个 6 空格缩进的 key 停止
        if (/^\s{6}\S/.test(lines[j])) break;
      }
      return undefined;
    }
  }
  return undefined;
}

function extractCommitHash(value?: string): string | undefined {
  if (!value) return undefined;
  const m = value.match(/#([0-9a-fA-F]{7,40})/);
  return m ? m[1] : undefined;
}

export function checkDshPluginUpdate(profile: string, key: string): DshPluginUpdateCheck {
  const profileName = (profile || '').trim() || 'web';
  const profileDir = ensureProfileDir(profileName);
  const prefix = key.startsWith('bundle:') || key.startsWith('dep:')
    ? key.slice(0, key.indexOf(':'))
    : null;
  if (!prefix) {
    return {
      key,
      name: key,
      checkedAt: Date.now(),
      updateAvailable: false,
      hint: '仅支持 bundle / 依赖条目的更新检查',
    };
  }
  const pkgName = key.slice(prefix.length + 1);
  const pkg = readPkg(profileDir) || {};
  const spec = pkg?.dependencies?.[pkgName];
  if (!spec || typeof spec !== 'string') {
    return {
      key,
      name: pkgName,
      checkedAt: Date.now(),
      updateAvailable: false,
      hint: '配置中未找到该包的 spec',
    };
  }

  const gitUrl = gitUrlFromSpec(spec);
  if (!gitUrl) {
    return {
      key,
      name: pkgName,
      checkedAt: Date.now(),
      updateAvailable: false,
      hint: `当前 spec 类型不支持检查更新（仅 git+https / github: 可用）：${spec}`,
    };
  }

  try {
    const remoteHead = gitLsRemote(gitUrl).split(/\s+/)[0];
    const current = extractCommitHash(readLockImporterVersion(profileDir, pkgName));
    const latest = shortCommit(remoteHead);
    const currentShort = current ? shortCommit(current) : undefined;
    return {
      key,
      name: pkgName,
      checkedAt: Date.now(),
      updateAvailable: !current || current !== remoteHead,
      current: currentShort,
      latest,
    };
  } catch (e: any) {
    return {
      key,
      name: pkgName,
      checkedAt: Date.now(),
      updateAvailable: false,
      error: e?.message || '检查更新失败',
    };
  }
}

export async function updateDshPlugin(profile: string, key: string, onLine?: (line: string) => void): Promise<DshInstallReport> {
  const profileName = (profile || '').trim() || 'web';
  const profileDir = ensureProfileDir(profileName);
  const prefix = key.startsWith('bundle:') || key.startsWith('dep:')
    ? key.slice(0, key.indexOf(':'))
    : null;
  if (!prefix) {
    throw new Error(`无法识别的插件 key: ${key}`);
  }
  const pkgName = key.slice(prefix.length + 1);

  const cfg = readConfigFile();
  const pnpmCmd = resolvePnpmCommand(cfg);
  if (!pnpmCmd) {
    throw new Error('未找到 pnpm 命令，请在「设置」中配置 pnpmCommand');
  }

  const pkgFile = path.join(profileDir, 'package.json');
  const patchFile = path.join(profileDir, 'cordis.patch.yml');
  const snapshots: Record<string, string | null> = {
    'package.json': readTextSafe(pkgFile),
    'cordis.patch.yml': readTextSafe(patchFile),
  };

  const before = readInstalledVersion(profileDir, pkgName);
  const collect = onLine || (() => {});
  const result = await runPnpmStream(pnpmCmd, ['update', pkgName], profileDir, collect);

  const after = readInstalledVersion(profileDir, pkgName);
  const l3 = validateInstalledPkg(profileDir, pkgName);
  const ok = result.exitCode === 0 && !result.timedOut && l3.ok;

  const state = readInstallState();
  let profileState = { ...(state[profileName] || {}) };
  const report: DshInstallReport = {
    profile: profileName,
    mode: 'update',
    ok,
    installed: [],
    updated: [],
    failed: [],
    warnings: [],
    output: result.output,
  };

  if (result.timedOut) {
    report.warnings.push('pnpm update 执行超过 10 分钟，已强制终止（timeout）');
  }

  if (ok) {
    if (before !== after) report.updated.push(pkgName);
    report.installed.push(pkgName);
    if (profileState[pkgName]) delete profileState[pkgName];
  } else {
    const reason = result.exitCode !== 0 || result.timedOut ? 'non-zero-exit' : 'missing-entry';
    const stack = reason === 'non-zero-exit' ? result.output : (l3.reason || '入口校验失败');
    report.failed.push({
      name: pkgName,
      reason,
      stack: trimStack(stack),
    });
    profileState[pkgName] = {
      status: 'failed',
      reason,
      stack: trimStack(stack),
      lastAttemptAt: Date.now(),
    };
  }

  if (Object.keys(profileState).length === 0) {
    delete state[profileName];
  } else {
    state[profileName] = profileState;
  }
  writeInstallState(state);

  // update 失败仅回滚两个配置文件
  if (!ok) {
    for (const [f, content] of Object.entries(snapshots)) {
      const target = path.join(profileDir, f);
      if (content === null) {
        if (fs.existsSync(target)) {
          try { fs.unlinkSync(target); } catch {}
        }
      } else {
        try {
          fs.writeFileSync(target, content, 'utf-8');
        } catch {}
      }
    }
  }

  return report;
}

function declaredPkgEntries(profileDir: string): { name: string; kind: DshPluginKind; spec?: string }[] {
  const pkg = readPkg(profileDir) || {};
  const bundles: string[] = Array.isArray(pkg?.dsh?.profile?.bundles) ? pkg.dsh.profile.bundles.filter((b: unknown): b is string => typeof b === 'string') : [];
  const deps: Record<string, string> = {};
  for (const [k, v] of Object.entries(pkg?.dependencies || {})) {
    if (typeof v === 'string') deps[k] = v;
  }

  const list: { name: string; kind: DshPluginKind; spec?: string }[] = [];
  for (const b of bundles) {
    if (b.startsWith(BUILTIN_BUNDLE_PREFIX)) continue; // 内置不参与安装校验
    list.push({ name: b, kind: 'bundle', spec: deps[b] });
  }
  for (const dep of Object.keys(deps).sort()) {
    if (bundles.includes(dep)) continue;
    list.push({ name: dep, kind: 'plain', spec: deps[dep] });
  }
  return list;
}

/** 解析 pnpm 输出中的 `Ignored build scripts: pkg1, pkg2`（pnpm 10+ 构建脚本白名单拦截）。 */
function parseIgnoredBuilds(output: string): string[] {
  const m = output.match(/Ignored build scripts:\s*([^\n]+)/);
  if (!m) return [];
  return m[1]
    .split(',')
    .map(s => s.trim())
    .filter(s => s && !s.toLowerCase().includes('run "pnpm approve-builds"'));
}

export async function installDshPluginsV2(profile: string, mode: DshInstallMode, onLine?: (line: string) => void): Promise<DshInstallReport> {
  const profileName = (profile || '').trim() || 'web';
  const cfg = readConfigFile();
  const pnpmCmd = resolvePnpmCommand(cfg);
  if (!pnpmCmd) {
    throw new Error('未找到 pnpm 命令，请在「设置」中配置 pnpmCommand');
  }
  const profileDir = ensureProfileDir(profileName);
  const safeMode: DshInstallMode = ['incremental', 'update', 'reinstall-all', 'reinstall-failed'].includes(mode) ? mode : 'incremental';

  // 1. 快照备份：仅 package.json / cordis.patch.yml
  const pkgFile = path.join(profileDir, 'package.json');
  const patchFile = path.join(profileDir, 'cordis.patch.yml');
  const snapshots: Record<string, string | null> = {
    'package.json': readTextSafe(pkgFile),
    'cordis.patch.yml': readTextSafe(patchFile),
  };

  const beforeVersions = new Map<string, string | undefined>();
  for (const item of declaredPkgEntries(profileDir)) {
    beforeVersions.set(item.name, readInstalledVersion(profileDir, item.name));
  }

  const collect = onLine || (() => {});
  const result = await runPnpmStream(pnpmCmd, PNPM_INSTALL_ARGS[safeMode], profileDir, collect);

  const declared = declaredPkgEntries(profileDir);
  const installed: string[] = [];
  const updated: string[] = [];
  const failed: DshInstallFailure[] = [];
  const warnings: string[] = [];

  if (result.timedOut) {
    warnings.push(`pnpm 执行超过 10 分钟，已强制终止（timeout）`);
  }

  const state = readInstallState();
  let profileState = { ...(state[profileName] || {}) };

  const persistFailure = (name: string, reason: DshInstallFailure['reason'], stack: string) => {
    profileState[name] = {
      status: 'failed',
      reason,
      stack: trimStack(stack),
      lastAttemptAt: Date.now(),
    };
  };

  const ignoredBuilds = parseIgnoredBuilds(result.output);
  if (ignoredBuilds.length > 0) {
    warnings.push(`pnpm 忽略了以下依赖的构建脚本：${ignoredBuilds.join(', ')}；如为原生模块，请在 pnpm-workspace.yaml 的 allowBuilds 中放行后重试`);
  }

  for (const item of declared) {
    const before = beforeVersions.get(item.name);
    const after = readInstalledVersion(profileDir, item.name);

    const l3 = validateInstalledPkg(profileDir, item.name);
    const versionChanged = before !== undefined && after !== undefined && before !== after;

    // L3 是最终判定：磁盘上入口文件存在即视为该包安装成功。
    // pnpm 可能因「忽略构建脚本」等非致命原因返回非 0 退出码，但包实际已安装，
    // 此时不应把全部声明包都标记为失败。
    if (l3.ok) {
      installed.push(item.name);
      if (versionChanged) updated.push(item.name);
      if (profileState[item.name]) delete profileState[item.name];
      continue;
    }

    if (result.timedOut || result.exitCode !== 0) {
      failed.push({
        name: item.name,
        reason: 'non-zero-exit',
        stack: trimStack(result.output || `pnpm exit ${result.exitCode ?? 'timeout'}`),
      });
      persistFailure(item.name, 'non-zero-exit', result.output || `pnpm exit ${result.exitCode ?? 'timeout'}`);
    } else {
      failed.push({
        name: item.name,
        reason: 'missing-entry',
        stack: trimStack(l3.reason || '入口校验失败'),
      });
      persistFailure(item.name, 'missing-entry', l3.reason || '入口校验失败');
    }
  }

  if (result.exitCode !== 0 && !result.timedOut) {
    warnings.push(`pnpm 退出码为 ${result.exitCode}，但声明插件已按 L3 入口校验结果记录；请查看终端日志确认是否存在非致命错误`);
  }

  // 安装成功与否以 L3 校验结果为准；pnpm 非 0 退出但所有声明包入口校验通过时，
  // 仍视为成功，同时用 warnings 保留 pnpm 的原始退出信息。
  const ok = failed.length === 0 && !result.timedOut;

  // 状态回写（成功清除 failed；失败保留失败项）
  if (Object.keys(profileState).length === 0) {
    delete state[profileName];
  } else {
    state[profileName] = profileState;
  }
  writeInstallState(state);

  // 失败回滚：仅 incremental / update，且只回滚两个配置文件
  if (!ok && (safeMode === 'incremental' || safeMode === 'update')) {
    for (const [f, content] of Object.entries(snapshots)) {
      const target = path.join(profileDir, f);
      if (content === null) {
        if (fs.existsSync(target)) {
          try { fs.unlinkSync(target); } catch {}
        }
      } else {
        try {
          fs.writeFileSync(target, content, 'utf-8');
        } catch {}
      }
    }
  }

  return {
    profile: profileName,
    mode: safeMode,
    ok,
    installed: [...new Set(installed)].sort(),
    updated: [...new Set(updated)].sort(),
    failed,
    warnings,
    output: result.output,
  };
}

/** 兼容旧签名：增量安装并返回完整日志；失败抛错。 */
export async function installDshPlugins(profile: string): Promise<string> {
  const report = await installDshPluginsV2(profile, 'incremental');
  if (!report.ok) {
    const detail = report.failed.map(f => `${f.name}: ${f.reason}\n${f.stack}`).join('\n');
    throw new Error(`pnpm install 未完全成功:\n${detail || report.output}`);
  }
  return report.output;
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
export async function removeDshPlugin(profile: string, key: string): Promise<void> {
  const profileDir = ensureProfileDir(profile);

  if (key.startsWith('bundle:') || key.startsWith('dep:')) {
    const pkgName = key.slice(key.indexOf(':') + 1);
    removeDependency(profileDir, pkgName);
    // 尽力清理 node_modules + 更新 lock（pnpm 不可用/失败不影响配置已移除）
    try {
      await installDshPlugins(profile);
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

  if (key.startsWith('orphan:')) {
    const pkgName = key.slice('orphan:'.length);
    const parts = pkgName.split('/');
    const target = path.join(profileDir, 'node_modules', ...parts);
    try {
      fs.rmSync(target, { recursive: true, force: true });
    } catch {}
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

// ==================== 同步 / 对账 ====================

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
    return;
  }
  // 已有 .gitignore 时补齐新增的私有文件条目（幂等）
  const text = fs.readFileSync(gitignore, 'utf-8');
  const missing = SYNC_GITIGNORE_CONTENT.split(/\r?\n/)
    .filter(l => l.trim() && !text.includes(l.trim()));
  if (missing.length > 0) {
    fs.writeFileSync(gitignore, text.replace(/\s*$/, '') + '\n' + missing.join('\n') + '\n', 'utf-8');
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

/** 与 skills sync 共用同一 .git：优先全局 sync_repo，本功能配置为空时，回退到共享仓库实际的 origin / 当前分支，再回退到另一功能的配置。 */
function effectiveDshRemoteUrl(syncCfg: any): string {
  const global = globalSyncRemoteUrl();
  if (global) return global;
  if (syncCfg.remoteUrl) return syncCfg.remoteUrl;
  const root = syncRoot();
  if (fs.existsSync(path.join(root, '.git'))) {
    const url = gitTry(root, ['remote', 'get-url', 'origin']).trim();
    if (url) return url;
  }
  return readConfigFile().skills_sync?.remoteUrl || '';
}

function effectiveDshBranch(syncCfg: any): string {
  const global = globalSyncBranch();
  if (global) return global;
  if (syncCfg.branch) return syncCfg.branch;
  const root = syncRoot();
  if (fs.existsSync(path.join(root, '.git'))) {
    const branch = gitTry(root, ['rev-parse', '--abbrev-ref', 'HEAD']).trim();
    if (branch && branch !== 'HEAD') return branch;
  }
  return readConfigFile().skills_sync?.branch || 'main';
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

/** 只统计指定路径范围内的未提交修改（含未跟踪文件），用于按功能隔离同步状态。 */
function gitDirtyCountPaths(cwd: string, paths: string[]): number {
  const existing = paths.filter(p => fs.existsSync(path.join(cwd, p)));
  if (existing.length === 0) return 0;
  const out = gitTry(cwd, ['status', '--porcelain', '--', ...existing]);
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
    remoteUrl: effectiveDshRemoteUrl(syncCfg) || undefined,
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
      // 按功能隔离：只统计 DSH 插件范围内的未提交修改（与技能同步分开）
      status.dirtyCount = gitDirtyCountPaths(root, ['dsh', '.gitignore']);
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
  if (!effectiveDshRemoteUrl(syncCfg)) {
    throw new Error('尚未配置远端仓库地址');
  }

  const dirty = gitDirtyCountPaths(root, ['dsh', '.gitignore']);
  if (dirty > 0) {
    const msg = `DSH 插件同步：本地有 ${dirty} 个未提交修改（dsh/.gitignore），已跳过拉取；请先推送或手动处理`;
    updateLastSync('error', msg);
    throw new Error(msg);
  }

  const branch = effectiveDshBranch(syncCfg);
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

    for (const f of ['cordis.patch.yml', 'pnpm-lock.yaml', 'pnpm-workspace.yaml']) {
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
  if (!effectiveDshRemoteUrl(syncCfg)) {
    throw new Error('尚未配置远端仓库地址');
  }

  snapshotLocalToMirror();

  if (fs.existsSync(dshMirrorDir())) {
    gitExec(root, ['add', '-A', '--', 'dsh']);
  }
  // 共享的 .gitignore 有变更时也随插件同步提交，避免被遗漏
  if (fs.existsSync(path.join(root, '.gitignore'))) {
    gitExec(root, ['add', '-A', '--', '.gitignore']);
  }

  const staged = gitTry(root, ['diff', '--cached', '--name-only']);
  if (staged && staged.trim()) {
    const msg = (message || '').trim() || `sync dsh plugins [${new Date().toLocaleString()}]`;
    gitExec(root, ['commit', '-m', msg]);
  }

  const branch = effectiveDshBranch(syncCfg);
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

export async function alignDshPlugins(profile?: string): Promise<void> {
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

    // 对齐前快照：失败时回滚本地配置（package.json / cordis.patch.yml / pnpm-lock.yaml / pnpm-workspace.yaml）
    const snapFiles = ['package.json', 'cordis.patch.yml', 'pnpm-lock.yaml', 'pnpm-workspace.yaml'];
    const snapshots: Record<string, string | null> = {};
    for (const f of snapFiles) {
      snapshots[f] = readTextSafe(path.join(localDir, f));
    }

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

    for (const f of ['cordis.patch.yml', 'pnpm-lock.yaml', 'pnpm-workspace.yaml']) {
      const src = path.join(mirrorDir, f);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(localDir, f));
      }
    }

    try {
      const report = await installDshPluginsV2(name, 'incremental');
      if (!report.ok) {
        throw new Error(report.failed.map(f => `${f.name}: ${f.reason}`).join('\n'));
      }
    } catch (e) {
      // 安装失败：回滚对齐写盘前的本地配置
      for (const [f, content] of Object.entries(snapshots)) {
        const target = path.join(localDir, f);
        if (content === null) {
          if (fs.existsSync(target)) {
            try { fs.unlinkSync(target); } catch {}
          }
        } else {
          try {
            fs.writeFileSync(target, content, 'utf-8');
          } catch {}
        }
      }
      throw e;
    }
  }
}
