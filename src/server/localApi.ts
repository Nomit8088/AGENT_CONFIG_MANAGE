import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync, execFileSync } from 'child_process';
import jsyaml from 'js-yaml';

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
  const appdata = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  return path.join(appdata, 'AgentHub');
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
    skillsDir: '~/.dsh/skills-personal',
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

export function detectAgentInstalled(agentId: string, skillsDir: string): boolean {
  const probes: Record<string, string[]> = {
    'claude-code': ['~/.claude', '~/.claude/skills'],
    'cursor': ['~/.cursor', '~/AppData/Roaming/Cursor', '~/.cursor/skills'],
    'windsurf': ['~/.windsurf', '~/AppData/Roaming/Windsurf', '~/.windsurf/skills'],
    'antigravity': ['~/.gemini', '~/.gemini/config/skills', '~/.gemini/antigravity'],
    'codex': ['~/.codex', '~/.opencode', '~/.codex/skills'],
    'zcode': ['~/.zcode', '~/AppData/Roaming/ZCode', '~/AppData/Roaming/zcode', '~/.zcode/skills'],
    'dsh': ['~/.dsh', '~/.dsh/skills-personal'],
    'mimocode': ['~/.config/mimocode', '~/.mimocode', '~/.config/mimocode/skills'],
    'openclaw': ['~/.openclaw', '~/.agents', '~/.openclaw/skills'],
    'hermes': ['~/.hermes', '~/.hermes/skills'],
    'copilot': ['~/.copilot', '~/.github', '~/.copilot/skills'],
    'pi': ['~/.pi', '~/.omo', '~/.opencode', '~/.pi/skills'],
    'kimi': ['~/.kimi', '~/.kimi/skills'],
    'trae': ['~/.trae', '~/.trae-cn', '~/AppData/Roaming/Trae', '~/.trae/skills'],
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
  if (agentId === 'antigravity') {
    // For Antigravity, use physical directory + NTFS Hardlink tree
    createHardlinkDirRecursive(centralSkillPath, targetPath);
  } else {
    // For Claude Code, Codex, ZCode, Cursor, DSH, Windsurf:
    // Standard Windows NTFS Junction with robust fallback
    createJunction(targetPath, centralSkillPath);
  }
}

/**
 * DSH 的 skill-filesystem 插件会同时扫描多个用户级根目录：
 *   - customSkillDirs: ~/.dsh/skills-personal（AgentHub 主管理目录）
 *   - user-dsh:        ~/.dsh/skills（公共 skills）
 *   - user-agents:     ~/.agents/skills（通用 agents skills）
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
backups/
*.log
.DS_Store
Thumbs.db
`;

function ensureSyncGitignore(root: string) {
  const gitignore = path.join(root, '.gitignore');
  if (!fs.existsSync(gitignore)) {
    fs.writeFileSync(gitignore, SYNC_GITIGNORE_CONTENT, 'utf-8');
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

function gitExec(cwd: string, args: string[]): string {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();
  } catch (e: any) {
    const stderr = e?.stderr?.toString().trim();
    const stdout = e?.stdout?.toString().trim();
    throw new Error(stderr || stdout || e?.message || 'git command failed');
  }
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

export function getSkillsSyncStatus(): SkillsSyncStatus {
  const root = getAppDataDir();
  const syncCfg = readSkillsSyncConfig();
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
    throw new Error('尚未初始化同步仓库，请先在同步中心初始化');
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
    return getSkillsSyncStatus();
  } catch (e: any) {
    const msg = `拉取失败: ${e.message}`;
    updateLastSync('error', msg);
    throw new Error(msg);
  }
}

export function pushSkillsSync(message?: string): SkillsSyncStatus {
  const root = getAppDataDir();
  const syncCfg = readSkillsSyncConfig();

  if (!fs.existsSync(path.join(root, '.git'))) {
    throw new Error('尚未初始化同步仓库，请先在同步中心初始化');
  }
  if (!syncCfg.remoteUrl) {
    throw new Error('尚未配置远端仓库地址');
  }

  gitExec(root, ['add', '-A']);

  const staged = gitTry(root, ['diff', '--cached', '--name-only']);
  if (staged && staged.trim()) {
    const msg = (message || '').trim() || `sync central skills [${new Date().toLocaleString()}]`;
    gitExec(root, ['commit', '-m', msg]);
  }

  const branch = syncCfg.branch || 'main';
  try {
    gitExec(root, ['push', '-u', 'origin', branch]);
    updateLastSync('success');
    return getSkillsSyncStatus();
  } catch (e: any) {
    const msg = `推送失败: ${e.message}`;
    updateLastSync('error', msg);
    throw new Error(msg);
  }
}

export function setSkillsSyncAutoPull(enabled: boolean): void {
  const syncCfg = readSkillsSyncConfig();
  syncCfg.autoPullOnStartup = enabled;
  saveSkillsSyncConfig(syncCfg);
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
