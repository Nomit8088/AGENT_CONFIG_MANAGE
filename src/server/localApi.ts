import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
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
    if (!fs.existsSync(p)) return false;
    const stat = fs.lstatSync(p);
    return stat.isSymbolicLink();
  } catch {
    return false;
  }
}

export function createJunction(linkPath: string, targetPath: string): void {
  if (fs.existsSync(linkPath)) {
    removeJunction(linkPath);
  }
  const parent = path.dirname(linkPath);
  fs.mkdirSync(parent, { recursive: true });

  if (process.platform === 'win32') {
    try {
      fs.symlinkSync(targetPath, linkPath, 'junction');
    } catch (e) {
      execSync(`cmd /c mklink /J "${linkPath}" "${targetPath}"`);
    }
  } else {
    fs.symlinkSync(targetPath, linkPath, 'dir');
  }
}

export function removeJunction(linkPath: string): void {
  if (!fs.existsSync(linkPath)) {
    try {
      const stat = fs.lstatSync(linkPath);
      if (stat.isSymbolicLink()) {
        fs.unlinkSync(linkPath);
      }
    } catch {}
    return;
  }

  const stat = fs.lstatSync(linkPath);
  if (stat.isSymbolicLink()) {
    if (process.platform === 'win32') {
      try {
        fs.rmdirSync(linkPath);
      } catch {
        execSync(`cmd /c rmdir "${linkPath}"`);
      }
    } else {
      fs.unlinkSync(linkPath);
    }
  } else {
    fs.rmSync(linkPath, { recursive: true, force: true });
  }
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
        // Fallback to copy if cross-device or hardlink unsupported
        fs.copyFileSync(srcPath, dstPath);
      }
    }
  }
}

export function removeSkillMount(linkOrDirPath: string): void {
  if (!fs.existsSync(linkOrDirPath)) {
    try {
      const stat = fs.lstatSync(linkOrDirPath);
      if (stat.isSymbolicLink()) fs.unlinkSync(linkOrDirPath);
    } catch {}
    return;
  }
  const stat = fs.lstatSync(linkOrDirPath);
  if (stat.isSymbolicLink()) {
    removeJunction(linkOrDirPath);
  } else {
    fs.rmSync(linkOrDirPath, { recursive: true, force: true });
  }
}

export function mountSkillForAgent(agentId: string, targetPath: string, centralSkillPath: string): void {
  removeSkillMount(targetPath);
  if (agentId === 'antigravity') {
    // For Antigravity, use physical directory + NTFS Hardlink tree
    // Antigravity's scanner requires a real directory (no ReparsePoint)
    // while Hardlinked files share the same Inode with Central Repo (0 latency auto-sync)
    createHardlinkDirRecursive(centralSkillPath, targetPath);
  } else {
    // For Claude Code, Codex, ZCode, Cursor, DSH, Windsurf:
    // Standard Windows NTFS Junction
    createJunction(targetPath, centralSkillPath);
  }
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

export function installGitHooks(projectPath: string, backupDir: string, customRulePath: string): void {
  const gitDir = path.join(projectPath, '.git');
  if (!fs.existsSync(gitDir)) return;

  const hooksDir = path.join(gitDir, 'hooks');
  fs.mkdirSync(hooksDir, { recursive: true });

  const origBackup = path.join(gitDir, 'info', 'AGENTS.orig');
  const agentsMd = path.join(projectPath, 'AGENTS.md');

  if (fs.existsSync(agentsMd) && !fs.existsSync(origBackup)) {
    try {
      fs.copyFileSync(agentsMd, origBackup);
      fs.copyFileSync(agentsMd, path.join(backupDir, 'AGENTS.md.orig'));
    } catch {}
  }

  const preCheckoutScript = `#!/bin/sh
# AgentHub Git Hook Guard: Pre-Checkout
# Restore original AGENTS.md before git switches branch to avoid merge conflicts
ORIG=".git/info/AGENTS.orig"
if [ -f "$ORIG" ]; then
    cp "$ORIG" "AGENTS.md" 2>/dev/null || true
fi
exit 0
`;

  const customPosix = customRulePath.replace(/\\/g, '/');
  const postCheckoutScript = `#!/bin/sh
# AgentHub Git Hook Guard: Post-Checkout
# Re-apply custom AGENTS.md after git switched branch
CUSTOM="${customPosix}"
if [ -f "$CUSTOM" ]; then
    cp "$CUSTOM" "AGENTS.md" 2>/dev/null || true
fi
exit 0
`;

  fs.writeFileSync(path.join(hooksDir, 'pre-checkout'), preCheckoutScript, 'utf-8');
  fs.writeFileSync(path.join(hooksDir, 'post-checkout'), postCheckoutScript, 'utf-8');
}

export function uninstallGitHooks(projectPath: string): void {
  const gitDir = path.join(projectPath, '.git');
  if (!fs.existsSync(gitDir)) return;

  const hooksDir = path.join(gitDir, 'hooks');
  const preCheckout = path.join(hooksDir, 'pre-checkout');
  const postCheckout = path.join(hooksDir, 'post-checkout');

  if (fs.existsSync(preCheckout)) {
    try { fs.unlinkSync(preCheckout); } catch {}
  }
  if (fs.existsSync(postCheckout)) {
    try { fs.unlinkSync(postCheckout); } catch {}
  }

  const origBackup = path.join(gitDir, 'info', 'AGENTS.orig');
  const agentsMd = path.join(projectPath, 'AGENTS.md');
  if (fs.existsSync(origBackup)) {
    try {
      fs.copyFileSync(origBackup, agentsMd);
      fs.unlinkSync(origBackup);
    } catch {}
  }
}

export function applyProjectRules(proj: any, allAgents: any[]): void {
  const pPath = proj.path;
  if (!fs.existsSync(pPath)) return;

  const backupDir = path.join(getBackupsDir(), proj.id);
  fs.mkdirSync(backupDir, { recursive: true });

  const customFile = path.join(backupDir, 'CUSTOM_AGENTS.md');
  fs.writeFileSync(customFile, proj.customRuleContent || '', 'utf-8');

  if (!proj.overrideEnabled) {
    // Disabled: Rollback everything
    uninstallGitHooks(pPath);
    for (const a of allAgents) {
      if (a.localRuleFilename) {
        const lrf = path.join(pPath, a.localRuleFilename);
        if (fs.existsSync(lrf)) {
          try { fs.unlinkSync(lrf); } catch {}
        }
      }
    }
    return;
  }

  // Enabled:
  // 1. Clean up rule files for unlinked agents
  for (const a of allAgents) {
    if (!proj.linkedAgents?.includes(a.id) && a.localRuleFilename) {
      const lrf = path.join(pPath, a.localRuleFilename);
      if (fs.existsSync(lrf)) {
        try { fs.unlinkSync(lrf); } catch {}
      }
    }
  }

  // 2. Always distribute to ALL linked agents' native rule files (CLAUDE.local.md, .agents/rules, ZCODE.local.md, etc.)
  const filenamesToExclude: string[] = [];
  for (const a of allAgents) {
    if (proj.linkedAgents?.includes(a.id) && a.localRuleFilename) {
      const lrf = path.join(pPath, a.localRuleFilename);
      fs.mkdirSync(path.dirname(lrf), { recursive: true });
      fs.writeFileSync(lrf, proj.customRuleContent || '', 'utf-8');
      if (a.localRuleFilename !== 'AGENTS.md') {
        filenamesToExclude.push(a.localRuleFilename);
      }
    }
  }

  // 3. Mode specific handling for AGENTS.md
  if (proj.ruleMode === 'overwrite') {
    const agentsMd = path.join(pPath, 'AGENTS.md');
    const origBackup = path.join(pPath, '.git', 'info', 'AGENTS.orig');

    if (fs.existsSync(agentsMd) && !fs.existsSync(origBackup)) {
      try {
        fs.copyFileSync(agentsMd, origBackup);
        fs.copyFileSync(agentsMd, path.join(backupDir, 'AGENTS.md.orig'));
      } catch {}
    }
    fs.writeFileSync(agentsMd, proj.customRuleContent || '', 'utf-8');

    if (proj.isGit) {
      installGitHooks(pPath, backupDir, customFile);
    }
  } else {
    // Append mode: restore original AGENTS.md if it was modified
    if (proj.isGit) {
      uninstallGitHooks(pPath);
    }
  }

  // 4. Add private rule files to .git/info/exclude
  if (proj.isGit && filenamesToExclude.length > 0) {
    addToGitExclude(pPath, filenamesToExclude);
  }
}
