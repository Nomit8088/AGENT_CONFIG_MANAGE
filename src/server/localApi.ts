import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import jsyaml from 'js-yaml';
import { runGit, computeGitSyncDiff } from './gitSyncUtil';
import { globalSyncRemoteUrl, globalSyncBranch } from './syncRepo';
import { getAppDataDir as resolveAppDataDir } from './appPaths';
import { linkStrategyFor } from '../shared/linkStrategy';
import type { SkillsSyncDecision } from '../types';
export { linkStrategyFor };

export function expandTilde(p: string): string {
  if (p.startsWith('~/') || p.startsWith('~\\') || p === '~') {
    const home = os.homedir();
    return path.join(home, p.slice(1));
  }
  if (p.includes('%APPDATA%')) {
    const appdata = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    return p.replace(/%APPDATA%/g, appdata);
  }
  return p;
}

export function getAppDataDir(): string {
  return resolveAppDataDir();
}

export function getCentralSkillsDir(): string {
  return path.join(getAppDataDir(), 'skills');
}

export function getBackupsDir(): string {
  return path.join(getAppDataDir(), 'backups');
}

export const DEFAULT_PRESET_AGENTS = [
  {
    id: 'claude-code',
    name: 'Claude Code',
    icon: 'claude',
    detected: false,
    enabled: true,
    skillsDir: '~/.claude/skills',
    ruleType: 'local_file',
    localRuleFilename: 'CLAUDE.local.md',
    isCustom: false,
  },
  {
    id: 'cursor',
    name: 'Cursor',
    icon: 'cursor',
    detected: false,
    enabled: true,
    skillsDir: '~/.cursor/skills',
    ruleType: 'local_file',
    localRuleFilename: '.cursor/rules/local-override.mdc',
    isCustom: false,
  },
  {
    id: 'windsurf',
    name: 'Windsurf',
    icon: 'windsurf',
    detected: false,
    enabled: true,
    skillsDir: '~/.windsurf/skills',
    ruleType: 'local_file',
    localRuleFilename: 'WINDSURF.local.md',
    isCustom: false,
  },
  {
    id: 'antigravity',
    name: 'Google Antigravity',
    icon: 'antigravity',
    detected: false,
    enabled: true,
    skillsDir: '~/.gemini/config/skills',
    ruleType: 'local_file',
    localRuleFilename: '.agents/rules/local-override.md',
    isCustom: false,
  },
  {
    id: 'codex',
    name: 'OpenCode / Codex',
    icon: 'codex',
    detected: false,
    enabled: true,
    skillsDir: '~/.codex/skills',
    ruleType: 'local_file',
    localRuleFilename: 'AGENTS.override.md',
    isCustom: false,
  },
  {
    id: 'zcode',
    name: 'ZCode',
    icon: 'zcode',
    detected: false,
    enabled: true,
    skillsDir: '~/.zcode/skills',
    ruleType: 'local_file',
    localRuleFilename: 'ZCODE.local.md',
    isCustom: false,
  },
  {
    id: 'dsh',
    name: 'DeepSeek HARNESS',
    icon: 'deepseek',
    detected: false,
    enabled: true,
    skillsDir: '~/.dsh/skills',
    ruleType: 'local_file',
    localRuleFilename: 'AGENTS.local.md',
    isCustom: false,
  },
  {
    id: 'mimocode',
    name: 'MiMo Code',
    icon: 'mimocode',
    detected: false,
    enabled: true,
    skillsDir: '~/.config/mimocode/skills',
    ruleType: 'local_file',
    localRuleFilename: 'AGENTS.md',
    isCustom: false,
  },
  {
    id: 'openclaw',
    name: 'OpenClaw',
    icon: 'openclaw',
    detected: false,
    enabled: true,
    skillsDir: '~/.openclaw/skills',
    ruleType: 'local_file',
    localRuleFilename: 'AGENTS.md',
    isCustom: false,
  },
  {
    id: 'hermes',
    name: 'Hermes Agent',
    icon: 'hermes',
    detected: false,
    enabled: true,
    skillsDir: '~/.hermes/skills',
    ruleType: 'local_file',
    localRuleFilename: 'AGENTS.override.md',
    isCustom: false,
  },
  {
    id: 'copilot',
    name: 'GitHub Copilot',
    icon: 'copilot',
    detected: false,
    enabled: true,
    skillsDir: '~/.copilot/skills',
    ruleType: 'local_file',
    localRuleFilename: '.github/copilot-instructions.md',
    isCustom: false,
  },
  {
    id: 'pi',
    name: 'Pi Coding Agent',
    icon: 'pi',
    detected: false,
    enabled: true,
    skillsDir: '~/.pi/skills',
    ruleType: 'local_file',
    localRuleFilename: '.omo/rules/local.md',
    isCustom: false,
  },
  {
    id: 'kimi',
    name: 'Kimi Code CLI',
    icon: 'kimi',
    detected: false,
    enabled: true,
    skillsDir: '~/.kimi/skills',
    ruleType: 'local_file',
    localRuleFilename: 'AGENTS.md',
    isCustom: false,
  },
  {
    id: 'trae',
    name: 'Trae / TraeWork',
    icon: 'trae',
    detected: false,
    enabled: true,
    skillsDir: '~/.trae/skills',
    ruleType: 'local_file',
    localRuleFilename: 'CLAUDE.local.md',
    isCustom: false,
  },
  {
    id: 'workbuddy',
    name: 'WorkBuddy',
    icon: 'workbuddy',
    detected: false,
    enabled: true,
    skillsDir: '~/.workbuddy/skills',
    ruleType: 'local_file',
    localRuleFilename: 'AGENTS.md',
    isCustom: false,
  },
  {
    id: 'kiro',
    name: 'Kiro CLI',
    icon: 'kiro',
    detected: false,
    enabled: true,
    skillsDir: '~/.kiro/skills',
    ruleType: 'local_file',
    localRuleFilename: 'AGENTS.md',
    isCustom: false,
  },
];

/**
 * D4 查证结论（web 实证，未真机验证）：
 * 4 个 Electron 系 Agent（cursor/windsurf/zcode/trae）的 skills 读取目录均为
 * `~/.xxx/skills` HOME 点目录（三平台统一，见官方文档 Cursor/ZCode/Trae 与
 * vercel-labs/skills 的 Supported Agents 表），不随平台落到 `~/Library/Application Support/*`。
 * 因此 skillsDir（挂载目标）保持 `~/.xxx/skills` 不变；下方 `~/Library/Application Support/X`
 * 与 `~/.config/X` 仅作「已安装」探测启发（best-known，未真机验证）。
 */
export function detectAgentInstalled(agentId: string, skillsDir: string): boolean {
  const probes: Record<string, string[]> = {
    'claude-code': ['~/.claude', '~/.claude/skills'],
    'cursor': ['~/.cursor', '~/AppData/Roaming/Cursor', '~/Library/Application Support/Cursor', '~/.config/Cursor', '~/.cursor/skills'],
    'windsurf': ['~/.windsurf', '~/AppData/Roaming/Windsurf', '~/Library/Application Support/Windsurf', '~/.config/Windsurf', '~/.windsurf/skills'],
    'antigravity': ['~/.gemini', '~/.gemini/config/skills', '~/.gemini/antigravity'],
    'codex': ['~/.codex', '~/.opencode', '~/.codex/skills'],
    'zcode': ['~/.zcode', '~/AppData/Roaming/ZCode', '~/AppData/Roaming/zcode', '~/Library/Application Support/ZCode', '~/Library/Application Support/zcode', '~/.config/ZCode', '~/.config/zcode', '~/.zcode/skills'],
    'dsh': ['~/.dsh', '~/.dsh/skills'],
    'mimocode': ['~/.config/mimocode', '~/.mimocode', '~/.config/mimocode/skills'],
    'openclaw': ['~/.openclaw', '~/.agents', '~/.openclaw/skills'],
    'hermes': ['~/.hermes', '~/.hermes/skills'],
    'copilot': ['~/.copilot', '~/.github', '~/.copilot/skills'],
    'pi': ['~/.pi', '~/.omo', '~/.opencode', '~/.pi/skills'],
    'kimi': ['~/.kimi', '~/.kimi/skills'],
    'trae': ['~/.trae', '~/.trae-cn', '~/AppData/Roaming/Trae', '~/Library/Application Support/Trae', '~/.config/Trae', '~/.trae/skills'],
    'workbuddy': ['~/.workbuddy', '~/.workbuddy/skills'],
    'kiro': ['~/.kiro', '~/.amazonq', '~/.kiro/skills'],
  };

  const list = probes[agentId] || [skillsDir];
  return list.some(p => fs.existsSync(expandTilde(p)));
}

export function detectSystemTheme(): 'dark' | 'light' {
  if (process.platform === 'win32') {
    try {
      const output = execSync(
        'reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize" /v AppsUseLightTheme',
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
      );
      if (output.includes('0x1')) {
        return 'light';
      }
      if (output.includes('0x0')) {
        return 'dark';
      }
    } catch {}
  } else if (process.platform === 'darwin') {
    // macOS：`defaults read -g AppleInterfaceStyle` 输出 "Dark" 即为深色；无输出为浅色。
    try {
      const output = execSync('defaults read -g AppleInterfaceStyle', {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      if (output.trim().toLowerCase() === 'dark') {
        return 'dark';
      }
    } catch {}
    return 'light';
  } else {
    // Linux：优先 `gsettings` 的 color-scheme，其次 gtk-theme 名；无 GUI 会话回退浅色（前端 matchMedia 兜底）。
    try {
      const scheme = execSync('gsettings get org.gnome.desktop.interface color-scheme', {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      if (scheme.toLowerCase().includes('dark')) return 'dark';
      if (scheme.toLowerCase().includes('light')) return 'light';
    } catch {}
    try {
      const theme = execSync('gsettings get org.gnome.desktop.interface gtk-theme', {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      if (theme.toLowerCase().includes('dark')) return 'dark';
    } catch {}
  }
  return 'light';
}

export function initStorage() {
  const base = getAppDataDir();
  const central = getCentralSkillsDir();
  const backups = getBackupsDir();

  fs.mkdirSync(base, { recursive: true });
  fs.mkdirSync(central, { recursive: true });
  fs.mkdirSync(backups, { recursive: true });

  const configFile = path.join(base, 'config.json');
  if (!fs.existsSync(configFile)) {
    fs.writeFileSync(configFile, JSON.stringify({
      auto_start: false,
      theme: 'system',
      default_rule_mode: 'append',
      auto_capture_skills: true,
      toast_notifications: true,
      ignored_skills: [],
      dsh_plugins: {
        dshCommand: '',
        pnpmCommand: '',
        sync: {
          remoteUrl: '',
          branch: 'main',
          autoPullOnStartup: false,
          lastSyncAt: 0,
          lastSyncStatus: 'idle',
        },
      },
    }, null, 2), 'utf-8');
  }

  seedInitialSkills();
}

function seedInitialSkills() {
  const central = getCentralSkillsDir();
  const geminiArchify = expandTilde('~/.gemini/config/skills/archify');
  const targetArchify = path.join(central, 'archify');
  if (fs.existsSync(geminiArchify) && !fs.existsSync(targetArchify)) {
    try {
      copyDirRecursive(geminiArchify, targetArchify);
    } catch (e) {
      console.error('Failed to seed archify:', e);
    }
  }

  const geminiObsidian = expandTilde('~/.gemini/config/skills/obsidian-sync');
  const targetObsidian = path.join(central, 'obsidian-sync');
  if (fs.existsSync(geminiObsidian) && !fs.existsSync(targetObsidian)) {
    try {
      copyDirRecursive(geminiObsidian, targetObsidian);
    } catch (e) {
      console.error('Failed to seed obsidian-sync:', e);
    }
  }

  const targetAgentHub = path.join(central, 'agenthub-sync');
  if (!fs.existsSync(targetAgentHub)) {
    fs.mkdirSync(targetAgentHub, { recursive: true });
    fs.writeFileSync(path.join(targetAgentHub, 'SKILL.md'), `---
name: agenthub-sync
description: 反向同步当前 Agent 编写的新 Skill 至 AgentHub 中央库并秒级广播至所有 Agent。
version: 1.0.0
slash_commands:
  - /agenthub-sync
---

# AgentHub Sync Skill
调用 /agenthub-sync 即可自动收录当前 Skill。`, 'utf-8');
  }
}

export function copyDirRecursive(src: string, dst: string) {
  fs.mkdirSync(dst, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const dstPath = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, dstPath);
    } else {
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}

export function isJunctionOrSymlink(p: string): boolean {
  try {
    const stat = fs.lstatSync(p);
    return stat.isSymbolicLink();
  } catch {
    return false;
  }
}

export function createJunction(linkPath: string, targetPath: string): void {
  removeSkillMount(linkPath);
  const parent = path.dirname(linkPath);
  fs.mkdirSync(parent, { recursive: true });

  if (process.platform === 'win32') {
    try {
      fs.symlinkSync(targetPath, linkPath, 'junction');
    } catch (e) {
      try {
        execSync(`cmd /c mklink /J "${linkPath}" "${targetPath}"`);
      } catch (err) {
        // Fallback to hardlink tree or directory copy if junction creation is restricted
        createHardlinkDirRecursive(targetPath, linkPath);
      }
    }
  } else {
    try {
      fs.symlinkSync(targetPath, linkPath, 'dir');
    } catch {
      createHardlinkDirRecursive(targetPath, linkPath);
    }
  }
}

export function removeJunction(linkPath: string): void {
  removeSkillMount(linkPath);
}

export function createHardlinkDirRecursive(src: string, dst: string): void {
  fs.mkdirSync(dst, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const dstPath = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      createHardlinkDirRecursive(srcPath, dstPath);
    } else {
      if (fs.existsSync(dstPath)) {
        try { fs.unlinkSync(dstPath); } catch {}
      }
      try {
        fs.linkSync(srcPath, dstPath);
      } catch (e) {
        fs.copyFileSync(srcPath, dstPath);
      }
    }
  }
}

export function removeSkillMount(linkOrDirPath: string): void {
  try {
    const stat = fs.lstatSync(linkOrDirPath);
    if (stat.isSymbolicLink()) {
      try {
        fs.rmdirSync(linkOrDirPath);
      } catch {
        fs.unlinkSync(linkOrDirPath);
      }
    } else if (stat.isDirectory()) {
      fs.rmSync(linkOrDirPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(linkOrDirPath);
    }
  } catch {}
}

export function mountSkillForAgent(agentId: string, targetPath: string, centralSkillPath: string): void {
  removeSkillMount(targetPath);
  if (linkStrategyFor(agentId) === 'hardlinkTree') {
    // Antigravity：物理目录 + 文件级 Hardlink tree（三平台终态）
    createHardlinkDirRecursive(centralSkillPath, targetPath);
  } else {
    // 默认：Windows NTFS Junction / Unix symlink，带 robust fallback
    createJunction(targetPath, centralSkillPath);
  }
}

/**
 * DSH 的 skill-filesystem 插件默认扫描以下用户级根目录：
 *   - user-dsh:    ~/.dsh/skills（AgentHub 主管理目录）
 *   - user-agents: ~/.agents/skills（通用 agents skills 根）
 * 注意：DSH 并不扫描 ~/.dsh/skills-personal，该目录系历史误判，已弃用。
 *
 * 其他 Agent 目前只使用单一 skillsDir，因此返回单元素数组。
 */
export function getAgentSkillDirs(agent: { id: string; skillsDir: string }): string[] {
  const primary = expandTilde(agent.skillsDir);
  if (agent.id === 'dsh') {
    const dirs = [
      primary,
      expandTilde('~/.dsh/skills'),
      expandTilde('~/.agents/skills'),
    ];
    return Array.from(new Set(dirs.map(d => path.resolve(d))));
  }
  return [primary];
}

export function findAgentSkillDir(agent: { id: string; skillsDir: string }, skillName: string): string | null {
  for (const dir of getAgentSkillDirs(agent)) {
    const candidate = path.join(dir, skillName);
    // 只返回真正的物理目录；Junction/Symlink 是 AgentHub 的受控挂载，不能当作“待纳管实体”处理，
    // 否则纳管时可能误删中央库目标。
    if (fs.existsSync(candidate) && !isJunctionOrSymlink(candidate)) {
      return candidate;
    }
  }
  return null;
}

export function parseSkillMd(content: string, folderName: string) {
  let name = folderName;
  let description = '未提供描述';
  let version = '1.0.0';
  let metadata: any = null;

  try {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (match) {
      metadata = jsyaml.load(match[1]) as any;
      if (metadata?.name) name = metadata.name;
      if (metadata?.description) description = metadata.description;
      if (metadata?.version) version = metadata.version;
    }
  } catch {}

  return { name, description, version, metadata };
}

// ==================== Skills Sync (中央库多端同步) ====================

export interface SkillsSyncStatus {
  initialized: boolean;
  remoteUrl?: string;
  branch?: string;
  ahead: number;
  behind: number;
  dirtyCount: number;
  lastSyncAt?: number;
  lastSyncStatus: string;
  lastError?: string;
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

function ensureSyncGitignore(root: string) {
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

function readConfigFile(): any {
  const configFile = path.join(getAppDataDir(), 'config.json');
  if (fs.existsSync(configFile)) {
    try {
      return JSON.parse(fs.readFileSync(configFile, 'utf-8'));
    } catch {}
  }
  return {};
}

function writeConfigFile(cfg: any) {
  const configFile = path.join(getAppDataDir(), 'config.json');
  fs.writeFileSync(configFile, JSON.stringify(cfg, null, 2), 'utf-8');
}

function readSkillsSyncConfig(): any {
  const cfg = readConfigFile();
  return cfg.skills_sync || {
    remoteUrl: '',
    branch: 'main',
    autoPullOnStartup: false,
    lastSyncAt: 0,
    lastSyncStatus: 'idle',
    lastError: undefined,
  };
}

function saveSkillsSyncConfig(syncCfg: any) {
  const cfg = readConfigFile();
  cfg.skills_sync = syncCfg;
  writeConfigFile(cfg);
}

/** 与 DSH 插件同步共用同一 .git：优先全局 sync_repo，本功能配置为空时，回退到共享仓库实际的 origin / 当前分支，再回退到另一功能的配置。 */
function effectiveSkillsRemoteUrl(syncCfg: any): string {
  const global = globalSyncRemoteUrl();
  if (global) return global;
  if (syncCfg.remoteUrl) return syncCfg.remoteUrl;
  const root = getAppDataDir();
  if (fs.existsSync(path.join(root, '.git'))) {
    const url = gitTry(root, ['remote', 'get-url', 'origin']).trim();
    if (url) return url;
  }
  return readConfigFile().dsh_plugins?.sync?.remoteUrl || '';
}

function effectiveSkillsBranch(syncCfg: any): string {
  const global = globalSyncBranch();
  if (global) return global;
  if (syncCfg.branch) return syncCfg.branch;
  const root = getAppDataDir();
  if (fs.existsSync(path.join(root, '.git'))) {
    const branch = gitTry(root, ['rev-parse', '--abbrev-ref', 'HEAD']).trim();
    if (branch && branch !== 'HEAD') return branch;
  }
  return readConfigFile().dsh_plugins?.sync?.branch || 'main';
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

export function getSkillsSyncStatus(): SkillsSyncStatus {
  const root = getAppDataDir();
  const syncCfg = readSkillsSyncConfig();
  const initialized = fs.existsSync(path.join(root, '.git'));

  const status: SkillsSyncStatus = {
    initialized,
    remoteUrl: effectiveSkillsRemoteUrl(syncCfg) || undefined,
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
      // 按功能隔离：只统计技能范围内的未提交修改（与 DSH 插件同步分开）
      status.dirtyCount = gitDirtyCountPaths(root, ['skills', '.gitignore']);
    }
  }

  return status;
}

/** 技能范围的「本地 vs 远端」文件级差异（复用共享仓库 origin/<branch>）。 */
export function getSkillsSyncDiff() {
  const root = getAppDataDir();
  if (!fs.existsSync(path.join(root, '.git'))) return [];
  const syncCfg = readSkillsSyncConfig();
  const branch = effectiveSkillsBranch(syncCfg);
  return computeGitSyncDiff(root, 'skills', branch);
}

export function initSkillsSync(remoteUrl: string, branch?: string): SkillsSyncStatus {
  const root = getAppDataDir();
  fs.mkdirSync(root, { recursive: true });
  ensureSyncGitignore(root);

  const targetBranch = (branch || 'main').trim() || 'main';
  if (!fs.existsSync(path.join(root, '.git'))) {
    try {
      gitExec(root, ['init', '-b', targetBranch]);
    } catch {
      gitExec(root, ['init']);
      gitTry(root, ['symbolic-ref', 'HEAD', `refs/heads/${targetBranch}`]);
    }
  }

  gitTry(root, ['remote', 'remove', 'origin']);
  gitExec(root, ['remote', 'add', 'origin', remoteUrl]);

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

  const syncCfg = readSkillsSyncConfig();
  syncCfg.remoteUrl = remoteUrl;
  syncCfg.branch = targetBranch;
  syncCfg.lastSyncStatus = 'idle';
  syncCfg.lastError = undefined;
  saveSkillsSyncConfig(syncCfg);

  return getSkillsSyncStatus();
}

function updateLastSync(status: string, error?: string) {
  const syncCfg = readSkillsSyncConfig();
  syncCfg.lastSyncStatus = status;
  syncCfg.lastSyncAt = Date.now();
  syncCfg.lastError = error;
  saveSkillsSyncConfig(syncCfg);
}

export function pullSkillsSync(): SkillsSyncStatus {
  const root = getAppDataDir();
  const syncCfg = readSkillsSyncConfig();

  if (!fs.existsSync(path.join(root, '.git'))) {
    throw new Error('E_SYNC_NOT_INITIALIZED');
  }
  if (!effectiveSkillsRemoteUrl(syncCfg)) {
    throw new Error('E_SYNC_NO_REMOTE');
  }

  const dirty = gitDirtyCountPaths(root, ['skills', '.gitignore']);
  if (dirty > 0) {
    const msg = `E_SYNC_DIRTY::${dirty}`;
    updateLastSync('error', msg);
    throw new Error(msg);
  }

  const branch = effectiveSkillsBranch(syncCfg);
  try {
    gitExec(root, ['pull', '--ff-only', 'origin', branch]);
    updateLastSync('success');
    return getSkillsSyncStatus();
  } catch (e: any) {
    const msg = `E_SYNC_PULL_FAILED::${e.message}`;
    updateLastSync('error', msg);
    throw new Error(msg);
  }
}

export function pushSkillsSync(message?: string, paths?: string[]): SkillsSyncStatus {
  const root = getAppDataDir();
  const syncCfg = readSkillsSyncConfig();

  if (!fs.existsSync(path.join(root, '.git'))) {
    throw new Error('E_SYNC_NOT_INITIALIZED');
  }
  if (!effectiveSkillsRemoteUrl(syncCfg)) {
    throw new Error('E_SYNC_NO_REMOTE');
  }

  // 按功能隔离：只暂存技能相关路径；传 paths 时按逐文件勾选，否则全量 skills/ + .gitignore
  const stagePaths = (paths && paths.length > 0)
    ? paths
    : ['skills', '.gitignore'].filter(p => fs.existsSync(path.join(root, p)));
  if (stagePaths.length > 0) {
    gitExec(root, ['add', '-A', '--', ...stagePaths]);
  }

  const staged = gitTry(root, ['diff', '--cached', '--name-only']);
  if (staged && staged.trim()) {
    const msg = (message || '').trim() || `sync central skills [${new Date().toLocaleString()}]`;
    gitExec(root, ['commit', '-m', msg]);
  }

  const branch = effectiveSkillsBranch(syncCfg);
  try {
    gitExec(root, ['push', '-u', 'origin', branch]);
    updateLastSync('success');
    return getSkillsSyncStatus();
  } catch (e: any) {
    const msg = `E_SYNC_PUSH_FAILED::${e.message}`;
    updateLastSync('error', msg);
    throw new Error(msg);
  }
}

export function setSkillsSyncAutoPull(enabled: boolean): void {
  const syncCfg = readSkillsSyncConfig();
  syncCfg.autoPullOnStartup = enabled;
  saveSkillsSyncConfig(syncCfg);
}

export function testSkillsSyncConnection(): string {
  const root = getAppDataDir();
  const syncCfg = readSkillsSyncConfig();

  if (!fs.existsSync(path.join(root, '.git'))) {
    throw new Error('E_SYNC_NOT_INITIALIZED');
  }
  if (!effectiveSkillsRemoteUrl(syncCfg)) {
    throw new Error('E_SYNC_NO_REMOTE');
  }

  const branch = effectiveSkillsBranch(syncCfg);
  const out = gitExec(root, ['ls-remote', 'origin', `refs/heads/${branch}`]);
  if (!out.trim()) {
    throw new Error(`E_SYNC_BRANCH_MISSING::${branch}`);
  }
  const head = out.trim().split(/\s+/)[0];
  return `连接成功，远端 ${branch} 分支 HEAD: ${head}`;
}

export function resetSkillsSyncToRemote(): SkillsSyncStatus {
  const root = getAppDataDir();
  const syncCfg = readSkillsSyncConfig();

  if (!fs.existsSync(path.join(root, '.git'))) {
    throw new Error('E_SYNC_NOT_INITIALIZED');
  }
  if (!effectiveSkillsRemoteUrl(syncCfg)) {
    throw new Error('E_SYNC_NO_REMOTE');
  }

  const branch = effectiveSkillsBranch(syncCfg);
  gitExec(root, ['fetch', 'origin', branch]);

  const remoteRef = `origin/${branch}`;
  const head = gitTry(root, ['rev-parse', '--verify', remoteRef]);
  if (!head) {
    throw new Error(`E_SYNC_BRANCH_MISSING::${branch}`);
  }

  // 以远端为准，但按功能隔离：仅移动 HEAD 并重置 skills/ 与 .gitignore，
  // 不碰 dsh/ 等同一仓库内其他功能的未提交修改（git reset --mixed 不动工作区）。
  gitExec(root, ['reset', '--mixed', remoteRef]);

  const checkoutPaths = ['skills', '.gitignore'].filter(p => {
    if (fs.existsSync(path.join(root, p))) return true;
    if (p === 'skills') {
      const out = gitTry(root, ['ls-tree', '--name-only', remoteRef, 'skills']);
      return !!out && out.trim().length > 0;
    }
    return false;
  });
  if (checkoutPaths.length > 0) {
    gitTry(root, ['checkout', '--', ...checkoutPaths]);
  }
  updateLastSync('success');
  return getSkillsSyncStatus();
}

/** 仅 fetch 远端（不合并、不改工作区），用于弹窗前刷新 origin/<branch> 引用。 */
export function fetchSkillsSync(): void {
  const root = getAppDataDir();
  const syncCfg = readSkillsSyncConfig();

  if (!fs.existsSync(path.join(root, '.git'))) {
    throw new Error('E_SYNC_NOT_INITIALIZED');
  }
  if (!effectiveSkillsRemoteUrl(syncCfg)) {
    throw new Error('E_SYNC_NO_REMOTE');
  }

  const branch = effectiveSkillsBranch(syncCfg);
  gitExec(root, ['fetch', 'origin', branch]);
}

/** 「从仓库应用」逐文件：fetch 远端后，对 direction=remote 的文件 checkout 远端版本（远端已删除则删除本地）。 */
export function applySkillsFromRemote(decisions: SkillsSyncDecision[]): SkillsSyncStatus {
  const root = getAppDataDir();
  const syncCfg = readSkillsSyncConfig();

  if (!fs.existsSync(path.join(root, '.git'))) {
    throw new Error('E_SYNC_NOT_INITIALIZED');
  }
  if (!effectiveSkillsRemoteUrl(syncCfg)) {
    throw new Error('E_SYNC_NO_REMOTE');
  }

  const branch = effectiveSkillsBranch(syncCfg);
  gitExec(root, ['fetch', 'origin', branch]);

  const remoteRef = `origin/${branch}`;
  const head = gitTry(root, ['rev-parse', '--verify', remoteRef]);
  if (!head) {
    throw new Error(`E_SYNC_BRANCH_MISSING::${branch}`);
  }

  for (const d of (Array.isArray(decisions) ? decisions : [])) {
    if (d.direction !== 'remote') continue;
    const p = (d.path || '').trim();
    if (!p) continue;
    const existsInRemote = gitOk(root, ['cat-file', '-e', `${remoteRef}:${p}`]);
    if (existsInRemote) {
      gitTry(root, ['checkout', remoteRef, '--', p]);
    } else {
      // 远端已删除：删除本地文件（工作区 + index）
      gitTry(root, ['rm', '--force', '--', p]);
      const abs = path.join(root, p);
      if (fs.existsSync(abs)) {
        try { fs.unlinkSync(abs); } catch {}
      }
    }
  }

  updateLastSync('success');
  return getSkillsSyncStatus();
}

export interface GitStatus {
  isGit: boolean;
  branch?: string;
  hooksActive: boolean;
}

export function checkGitStatus(projectPath: string): GitStatus {
  const gitDir = path.join(projectPath, '.git');
  if (!fs.existsSync(gitDir)) {
    return { isGit: false, hooksActive: false };
  }

  let branch: string | undefined = undefined;
  try {
    const out = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: projectPath,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();
    if (out) branch = out;
  } catch {}

  const hookPath = path.join(gitDir, 'hooks', 'pre-checkout');
  const hooksActive = fs.existsSync(hookPath);

  return {
    isGit: true,
    branch,
    hooksActive,
  };
}

export function addToGitExclude(projectPath: string, filenames: string[]): void {
  const gitDir = path.join(projectPath, '.git');
  if (!fs.existsSync(gitDir)) return;

  const excludeDir = path.join(gitDir, 'info');
  fs.mkdirSync(excludeDir, { recursive: true });

  const excludeFile = path.join(excludeDir, 'exclude');
  const currentContent = fs.existsSync(excludeFile) ? fs.readFileSync(excludeFile, 'utf-8') : '';
  const lines = currentContent.split(/\r?\n/).map(s => s.trim());
  let modified = false;

  for (const fname of filenames) {
    const trimmed = fname.trim();
    if (trimmed && !lines.includes(trimmed)) {
      lines.push(trimmed);
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(excludeFile, lines.filter(Boolean).join('\n') + '\n', 'utf-8');
  }
}

export const BASELINE_RULE_FILES = [
  'AGENTS.md',
  'CLAUDE.md',
  '.cursorrules',
  '.windsurfrules',
  'GEMINI.md',
];

export const PRIVATE_RULE_FILES = [
  'CLAUDE.local.md',
  '.agents/rules/local-override.md',
  'AGENTS.override.md',
  'ZCODE.local.md',
  'AGENTS.local.md',
  '.cursor/rules/local-override.mdc',
  'WINDSURF.local.md',
  '.omo/rules/local.md',
  '.github/copilot-instructions.local.md',
  'GEMINI.local.md',
];

export function cleanAllPrivateRules(projectPath: string): void {
  for (const relPath of PRIVATE_RULE_FILES) {
    const fullPath = path.join(projectPath, relPath);
    if (fs.existsSync(fullPath)) {
      try {
        fs.unlinkSync(fullPath);
      } catch {}
      // Clean empty parent directory if nested
      const parent = path.dirname(fullPath);
      if (parent !== projectPath) {
        try {
          const files = fs.readdirSync(parent);
          if (files.length === 0) {
            fs.rmdirSync(parent);
          }
        } catch {}
      }
    }
  }
}

export function restoreAllBaselines(projectPath: string, backupDir?: string): void {
  const gitDir = path.join(projectPath, '.git');
  const hasGit = fs.existsSync(gitDir);

  for (const baseline of BASELINE_RULE_FILES) {
    const targetFile = path.join(projectPath, baseline);
    const gitOrig = hasGit ? path.join(gitDir, 'info', `${baseline}.orig`) : null;
    const backupOrig = backupDir ? path.join(backupDir, `${baseline}.orig`) : null;

    let restored = false;
    if (gitOrig && fs.existsSync(gitOrig)) {
      try {
        fs.copyFileSync(gitOrig, targetFile);
        fs.unlinkSync(gitOrig);
        restored = true;
      } catch {}
    } else if (backupOrig && fs.existsSync(backupOrig)) {
      try {
        fs.copyFileSync(backupOrig, targetFile);
        restored = true;
      } catch {}
    }

    // If there was no original file backed up and this baseline was created purely by AgentHub custom rules, remove it
    if (!restored && backupOrig && !fs.existsSync(backupOrig)) {
      const markerNoOrig = backupDir ? path.join(backupDir, `${baseline}.no_orig`) : null;
      if (markerNoOrig && fs.existsSync(markerNoOrig) && fs.existsSync(targetFile)) {
        try { fs.unlinkSync(targetFile); } catch {}
      }
    }
  }
}

export function installGitHooks(
  projectPath: string,
  backupDir: string,
  customRulePath: string,
  enablePreCommit: boolean = true,
  targetsToProtect: string[] = ['AGENTS.md', 'CLAUDE.md']
): void {
  const gitDir = path.join(projectPath, '.git');
  if (!fs.existsSync(gitDir)) return;

  const hooksDir = path.join(gitDir, 'hooks');
  fs.mkdirSync(hooksDir, { recursive: true });

  const infoDir = path.join(gitDir, 'info');
  fs.mkdirSync(infoDir, { recursive: true });

  // Backup baselines
  for (const target of targetsToProtect) {
    const file = path.join(projectPath, target);
    const origGit = path.join(infoDir, `${target}.orig`);
    const origBackup = path.join(backupDir, `${target}.orig`);
    const noOrigMarker = path.join(backupDir, `${target}.no_orig`);

    if (fs.existsSync(file)) {
      if (!fs.existsSync(origGit)) {
        try { fs.copyFileSync(file, origGit); } catch {}
      }
      if (!fs.existsSync(origBackup)) {
        try { fs.copyFileSync(file, origBackup); } catch {}
      }
    } else {
      try { fs.writeFileSync(noOrigMarker, 'no_original', 'utf-8'); } catch {}
    }
  }

  const targetsListStr = targetsToProtect.map(t => `"${t}"`).join(' ');

  const preCheckoutScript = `#!/bin/sh
# AgentHub Git Hook Guard: Pre-Checkout (Multi-Baseline)
# Restore all original baseline files before git switches branch to avoid merge conflicts
for f in ${targetsListStr}; do
    ORIG=".git/info/\${f}.orig"
    if [ -f "$ORIG" ]; then
        cp "$ORIG" "$f" 2>/dev/null || true
    fi
done
exit 0
`;

  const customPosix = customRulePath.replace(/\\/g, '/');
  const postCheckoutScript = `#!/bin/sh
# AgentHub Git Hook Guard: Post-Checkout (Multi-Baseline)
# Re-apply custom rules to overwritten baselines after git switched branch
CUSTOM="${customPosix}"
if [ -f "$CUSTOM" ]; then
    for f in ${targetsListStr}; do
        ORIG=".git/info/\${f}.orig"
        if [ -f "$ORIG" ] || [ -f ".git/info/\${f}.no_orig" ]; then
            cp "$CUSTOM" "$f" 2>/dev/null || true
        fi
    done
fi
exit 0
`;

  const preCommitScript = `#!/bin/sh
# AgentHub Git Hook Guard: Pre-Commit Protection (Multi-Baseline)
# Prevents accidentally committing any overwritten baseline files to team git repo
for f in ${targetsListStr}; do
    ORIG=".git/info/\${f}.orig"
    if [ -f "$ORIG" ] || [ -f ".git/info/\${f}.no_orig" ]; then
        if git diff --cached --name-only | grep -q "^\${f}$"; then
            printf "\\033[1;33m[AgentHub 守卫提示]\\033[0m 检测到处于【覆盖模式】，已自动拦截对本地 %s 的提交。\\n" "$f"
            printf "\\033[1;33m[AgentHub 守卫提示]\\033[0m 为防止本地个性化规则污染团队仓库，请在 AgentHub 中切换为「追加模式」或暂时关闭定制后再提交。\\n"
            exit 1
        fi
    fi
done
exit 0
`;

  fs.writeFileSync(path.join(hooksDir, 'pre-checkout'), preCheckoutScript, 'utf-8');
  fs.writeFileSync(path.join(hooksDir, 'post-checkout'), postCheckoutScript, 'utf-8');
  if (enablePreCommit) {
    fs.writeFileSync(path.join(hooksDir, 'pre-commit'), preCommitScript, 'utf-8');
  } else {
    const preCommit = path.join(hooksDir, 'pre-commit');
    if (fs.existsSync(preCommit)) {
      try { fs.unlinkSync(preCommit); } catch {}
    }
  }
}

export function uninstallGitHooks(projectPath: string, backupDir?: string): void {
  const gitDir = path.join(projectPath, '.git');
  if (!fs.existsSync(gitDir)) {
    if (backupDir) restoreAllBaselines(projectPath, backupDir);
    return;
  }

  const hooksDir = path.join(gitDir, 'hooks');
  const preCheckout = path.join(hooksDir, 'pre-checkout');
  const postCheckout = path.join(hooksDir, 'post-checkout');
  const preCommit = path.join(hooksDir, 'pre-commit');

  if (fs.existsSync(preCheckout)) {
    try { fs.unlinkSync(preCheckout); } catch {}
  }
  if (fs.existsSync(postCheckout)) {
    try { fs.unlinkSync(postCheckout); } catch {}
  }
  if (fs.existsSync(preCommit)) {
    try { fs.unlinkSync(preCommit); } catch {}
  }

  restoreAllBaselines(projectPath, backupDir);
}

// DSH 插件中心（web 模式后端，与 src-tauri 侧行为对齐）
export * from './dshPlugins';
export * from './syncRepo';

export function applyProjectRules(proj: any, allAgents: any[]): void {
  const pPath = proj.path;
  if (!fs.existsSync(pPath)) return;

  const backupDir = path.join(getBackupsDir(), proj.id);
  fs.mkdirSync(backupDir, { recursive: true });

  const customFile = path.join(backupDir, 'CUSTOM_AGENTS.md');
  fs.writeFileSync(customFile, proj.customRuleContent || '', 'utf-8');

  // Case 1: Disabled -> Rollback everything and clean private files
  if (!proj.overrideEnabled) {
    uninstallGitHooks(pPath, backupDir);
    restoreAllBaselines(pPath, backupDir);
    cleanAllPrivateRules(pPath);
    return;
  }

  // Case 2: Overwrite Mode -> Overwrite target baselines (AGENTS.md, CLAUDE.md, etc.) & CLEAN ALL private rules
  if (proj.ruleMode === 'overwrite') {
    // 1. Clean all private rules so agents don't receive double custom rules
    cleanAllPrivateRules(pPath);

    // 2. Identify all baseline files to overwrite based on linked agents
    const targetsToProtect: string[] = ['AGENTS.md'];
    const linked = proj.linkedAgents || [];

    if (linked.some((id: string) => id === 'claude-code' || id === 'dsh' || id === 'trae')) {
      targetsToProtect.push('CLAUDE.md');
    }
    if (linked.some((id: string) => id === 'cursor')) {
      targetsToProtect.push('.cursorrules');
    }
    if (linked.some((id: string) => id === 'windsurf')) {
      targetsToProtect.push('.windsurfrules');
    }

    // 3. Backup and overwrite baselines
    for (const baseline of targetsToProtect) {
      const bFile = path.join(pPath, baseline);
      const origGit = path.join(pPath, '.git', 'info', `${baseline}.orig`);
      const origBackup = path.join(backupDir, `${baseline}.orig`);
      const noOrigMarker = path.join(backupDir, `${baseline}.no_orig`);

      if (fs.existsSync(bFile)) {
        if (!fs.existsSync(origGit) && proj.isGit) {
          try { fs.copyFileSync(bFile, origGit); } catch {}
        }
        if (!fs.existsSync(origBackup)) {
          try { fs.copyFileSync(bFile, origBackup); } catch {}
        }
      } else {
        if (!fs.existsSync(origBackup)) {
          try { fs.writeFileSync(noOrigMarker, 'no_original', 'utf-8'); } catch {}
        }
      }

      fs.writeFileSync(bFile, proj.customRuleContent || '', 'utf-8');
    }

    // 4. Install Git Guard hooks
    if (proj.isGit) {
      const enablePreCommit = proj.preCommitGuard ?? true;
      installGitHooks(pPath, backupDir, customFile, enablePreCommit, targetsToProtect);
    }
    return;
  }

  // Case 3: Append Mode -> 100% Restore baselines, uninstall hooks, and write ONLY to private local rule files
  if (proj.ruleMode === 'append') {
    // 1. 100% Restore team baselines
    if (proj.isGit) {
      uninstallGitHooks(pPath, backupDir);
    } else {
      restoreAllBaselines(pPath, backupDir);
    }

    // 2. Clean all private rules first
    cleanAllPrivateRules(pPath);

    // 3. Write ONLY to linked agents' private rule files
    const filenamesToExclude: string[] = [];
    const linked = proj.linkedAgents || [];

    for (const a of allAgents) {
      if (linked.includes(a.id) && a.localRuleFilename && a.localRuleFilename !== 'AGENTS.md') {
        const lrf = path.join(pPath, a.localRuleFilename);
        fs.mkdirSync(path.dirname(lrf), { recursive: true });
        fs.writeFileSync(lrf, proj.customRuleContent || '', 'utf-8');
        filenamesToExclude.push(a.localRuleFilename);
      }
    }

    // 4. Add private rule filenames to .git/info/exclude
    if (proj.isGit && filenamesToExclude.length > 0) {
      addToGitExclude(pPath, filenamesToExclude);
    }
  }
}
