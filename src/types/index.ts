export interface AgentInfo {
  id: string;
  name: string;
  icon: string;
  detected: boolean;
  enabled: boolean;
  skillsDir: string;
  ruleType: string;
  localRuleFilename: string;
  isCustom?: boolean;
}

export interface ProjectInfo {
  id: string;
  name: string;
  path: string;
  isGit: boolean;
  overrideEnabled: boolean;
  ruleMode: 'overwrite' | 'append';
  customRuleContent: string;
  originalRuleContent?: string;
  linkedAgents: string[];
  gitBranch?: string;
  hookInstalled?: boolean;
  preCommitGuard?: boolean;
}

export interface SkillMetadata {
  name: string;
  description?: string;
  version?: string;
  author?: string;
  tags?: string[];
  slash_commands?: string[];
}

export interface SkillItem {
  id: string;
  name: string;
  path: string;
  description: string;
  version: string;
  source: 'central' | 'npx' | 'manual' | 'imported';
  enabled: boolean;
  content: string;
  metadata?: SkillMetadata;
  mountedAgents: string[];
  isSymlinkMap: Record<string, boolean>; // agentId -> isSymlink
}

export interface UnmanagedSkill {
  agentId: string;
  agentName: string;
  skillName: string;
  path: string;
  hasConflict: boolean;
  centralContent?: string;
  localContent?: string;
}

export interface IgnoredSkill {
  agentId: string;
  agentName: string;
  skillName: string;
  path: string;
  ignoredAt: number;
}

export interface SkillsSyncConfig {
  remoteUrl: string;
  branch: string;
  autoPullOnStartup: boolean;
  lastSyncAt: number;
  lastSyncStatus: 'idle' | 'syncing' | 'success' | 'error';
  lastError?: string;
}

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

// ==================== DSH 插件中心 ====================

export type DshPluginKind = 'inbox' | 'bundle' | 'plain' | 'row';

export interface DshPluginEntry {
  key: string;              // 稳定键：`bundle:<pkg>` | `row:<id>` | `dep:<pkg>`
  profileName: string;
  name: string;             // 包名或行 id
  kind: DshPluginKind;      // inbox=内置 dsh-* / bundle=用户 bundle / plain=无 dsh.bundle 依赖 / row=patch 行
  spec?: string;            // 依赖规格（version / link: / file: / git+）
  installedVersion?: string;
  enabled: boolean;
  portability: 'portable' | 'unportable'; // link:/file:/git+ => unportable
  disabledBy?: 'bundles' | 'patch';
}

export interface DshPatchRow {
  id?: string;
  name?: string;
  disabled?: boolean;
  raw: unknown;
}

export interface DshProfileScan {
  name: string;
  dir: string;
  exists: boolean;
  bundles: string[];
  dependencies: Record<string, string>;
  plugins: DshPluginEntry[];
  patchRows: DshPatchRow[];
  patchFile: string;
}

export interface DshPluginScanResult {
  homeDir: string;
  dshCommand: string | null;
  pnpmCommand: string | null;
  profiles: DshProfileScan[];
}

export interface DshRecoveryAction {
  kind: 'remove-bundle' | 'disable-row' | 'remove-dependency';
  profileName: string;
  target: string;           // 包名或行 id
  description: string;
}

export interface DshDiagnoseResult {
  ok: boolean;              // 超时内未崩溃 = 健康
  exitCode: number | null;
  rawStderr: string;
  failedPlugins: string[];  // 解析出的失败插件名
  suggestedActions: DshRecoveryAction[];
  hint?: string;            // 如「端口占用」等非插件失败提示
}

export interface DshPluginDiffItem {
  kind: 'missing' | 'extra' | 'version' | 'patch';
  profileName: string;
  name: string;
  local?: string;
  remote?: string;
}

export interface DshPluginDiff {
  compatible: boolean;
  items: DshPluginDiffItem[];
  warnings: string[];       // 不可移植依赖等
}

export interface DshPluginsSyncConfig {
  remoteUrl: string;
  branch: string;
  autoPullOnStartup: boolean;
  lastSyncAt: number;
  lastSyncStatus: 'idle' | 'syncing' | 'success' | 'error';
  lastError?: string;
}

export interface DshPluginsConfig {
  dshCommand: string;       // 空 = 自动探测
  pnpmCommand: string;
  sync?: DshPluginsSyncConfig;
}

export interface AppConfig {
  auto_start: boolean;
  theme: 'dark' | 'light' | 'system';
  default_rule_mode: 'append' | 'overwrite';
  auto_capture_skills: boolean;
  toast_notifications: boolean;
  ignored_skills?: IgnoredSkill[];
  system_theme?: 'dark' | 'light';
  skills_sync?: SkillsSyncConfig;
  dsh_plugins?: DshPluginsConfig;
}

export interface ValidationResult {
  valid: boolean;
  message: string;
  supportsJunction: boolean;
}

export interface ToastMessage {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: number;
}
