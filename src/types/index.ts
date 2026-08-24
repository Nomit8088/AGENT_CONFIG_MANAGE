// 全局类型定义：Agent / 项目 / 技能 / 同步 / DSH 插件中心
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

/** 本地 vs 远端 文件级差异（按功能范围 skills/ 或 dsh/ 隔离）。 */
export interface SyncDiffEntry {
  path: string;                                 // 相对同步仓库根的路径
  status: 'added' | 'modified' | 'deleted';     // 相对远端的变更类型
  side: 'local' | 'remote' | 'both';            // local=本地领先/未提交；remote=远端领先；both=双方都改过
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

export type DshPluginInstallStatus =
  | 'ok'               // 本机已装 + 配置已声明 + 版本一致
  | 'pending'          // 配置已声明，本机未装
  | 'orphan'           // 本机已装，配置未声明（多余）
  | 'version-mismatch' // 本机已装，但版本与配置/lock 不一致
  | 'failed';          // 上次安装失败（来自持久化状态）

export type DshInstallMode = 'incremental' | 'update' | 'reinstall-all' | 'reinstall-failed';

export interface DshPluginInstallEntry {
  key: string;                 // bundle:<pkg> | dep:<pkg> | row:<id> | orphan:<pkg>
  profileName: string;
  name: string;                // 包名或 row id
  kind: DshPluginKind;
  spec?: string;               // 配置声明的规格
  declaredInConfig: boolean;   // 是否出现在 package.json / cordis.patch.yml
  installed: boolean;          // node_modules 是否存在
  installedVersion?: string;
  requiredVersion?: string;    // lock 解析版本（无 lock 时用精确 spec）
  status: DshPluginInstallStatus;
  installError?: string;       // 失败原因 + 堆栈（截断）
  portability: 'portable' | 'unportable';
  enabled: boolean;
  disabledBy?: 'bundles' | 'patch';
}

export interface DshInstallFailure {
  name: string;
  reason: 'non-zero-exit' | 'missing-entry' | 'resolve-error';
  stack: string;               // pnpm 相关错误片段
}

export interface DshInstallReport {
  profile: string;
  mode: DshInstallMode;
  ok: boolean;
  installed: string[];         // 校验通过的包
  updated: string[];           // 本次发生版本变化的包
  failed: DshInstallFailure[];
  warnings: string[];
  output: string;              // 完整日志（供终端回放）
}

export interface DshPluginUpdateCheck {
  key: string;
  name: string;
  checkedAt: number;
  updateAvailable: boolean;
  current?: string;            // 当前 commit / 版本
  latest?: string;             // 远端最新 commit / 版本
  error?: string;
  hint?: string;
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
  gitHubMirror?: string;    // 可选 GitHub 镜像前缀，如 https://gh-proxy.com/；空 = 直连 + 系统代理
  sync?: DshPluginsSyncConfig;
}

// ==================== DSH 配置快照与回滚 (WI-006) ====================

export type DshSnapshotTrigger = 'manual' | 'install' | 'align' | 'upgrade';

export interface DshConfigSnapshot {
  id: string;                 // dsh-snap-<ms>，全局唯一
  createdAt: number;          // ms 时间戳
  trigger: DshSnapshotTrigger; // manual=手动 / install=安装前自动 / align=对齐前自动 / upgrade=DSH 升级前自动
  note?: string;              // 备注（手动创建可填）
  permanent: boolean;         // 是否永久保留（不参与「最近 20 份」自动清理）
  profileName: string;
  files: string[];            // 快照时实际存在的配置文件名
}

export interface DshSnapshotRollbackResult {
  profile: string;
  restored: string[];         // 本次实际覆盖/删除的文件名
  needsInstall: boolean;      // 回滚只覆盖配置文件，不覆盖 node_modules
}

// ==================== DSH 版本升级与版本管理 (WI-009) ====================

export interface DshVersionInfo {
  packageName: string;        // @deepseek-ai/dsh
  current: string | null;     // 当前安装版本（dsh --version / npm 全局包实测）
  dshCommand: string | null;
  npmCommand: string | null;
  checkedAt: number;
}

export interface DshVersionCheck {
  packageName: string;
  current: string | null;
  latest: string | null;      // npm registry 最新版本
  updateAvailable: boolean;
  checkedAt: number;
  error?: string;
}

export type DshVersionAction = 'upgrade' | 'install' | 'rollback';

export interface DshVersionHistoryEntry {
  version: string;
  action: DshVersionAction;
  installedAt: number;        // ms 时间戳
  fromVersion?: string;       // 变更前版本
  note?: string;
}

export interface DshVersionUpgradeResult {
  ok: boolean;
  action: 'upgrade' | 'install';
  beforeVersion: string | null;
  afterVersion: string | null;
  targetVersion: string;      // 'latest' 或具体版本号
  snapshotIds: string[];      // 升级前自动创建的快照 id
  diagnosisBefore: number;    // 升级前诊断失败条目数
  diagnosisAfter: number;     // 升级后诊断失败条目数
  massFailure: boolean;       // 插件大面积失效判定（after > before）
  output: string;             // npm install -g 日志
  warnings: string[];
  error?: string;
}

export interface DshVersionRollbackResult {
  ok: boolean;
  version: string | null;     // 回滚后的版本
  restoredSnapshots: DshSnapshotRollbackResult[];
  output: string;
  error?: string;
}

export interface DshAvailableVersions {
  packageName: string;
  current: string | null;
  latest: string | null;
  versions: string[];         // npm registry 已发布版本（降序）
  error?: string;
}

export interface DshLaunchResult {
  ok: boolean;
  pid: number | null;
  message: string | null;
  error: string | null;
}

// ==================== 应用本体在线更新 (cc-switch 风格) ====================

export interface AppUpdateCheck {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  releaseNotes: string;
  publishedAt?: string;
  downloadUrl?: string;
  assetName?: string;
  assetSize?: number;
  error?: string;
}

export interface AppUpdateDownload {
  ok: boolean;
  path?: string;
  fileName?: string;
  size?: number;
  error?: string;
}

export interface AppConfig {
  auto_start: boolean;
  theme: 'dark' | 'light' | 'system';
  default_rule_mode: 'append' | 'overwrite';
  auto_capture_skills: boolean;
  toast_notifications: boolean;
  auto_check_update?: boolean;
  ignored_skills?: IgnoredSkill[];
  system_theme?: 'dark' | 'light';
  skills_sync?: SkillsSyncConfig;
  dsh_plugins?: DshPluginsConfig;
  sync_repo?: SyncRepoConfig;
}

/** 当前客户端版本，供前端展示使用（需与 package.json / Cargo.toml / tauri.conf.json 保持一致）。 */
export const APP_VERSION = '1.0.6';

export interface ValidationResult {
  valid: boolean;
  message: string;
}

export interface ToastMessage {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: number;
}
