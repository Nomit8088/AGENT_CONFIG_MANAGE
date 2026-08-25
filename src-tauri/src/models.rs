use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IgnoredSkill {
    #[serde(rename = "agentId")]
    pub agent_id: String,
    #[serde(rename = "agentName")]
    pub agent_name: String,
    #[serde(rename = "skillName")]
    pub skill_name: String,
    pub path: String,
    #[serde(rename = "ignoredAt")]
    pub ignored_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillsSyncConfig {
    #[serde(rename = "remoteUrl", default)]
    pub remote_url: String,
    #[serde(default)]
    pub branch: String,
    #[serde(rename = "autoPullOnStartup", default)]
    pub auto_pull_on_startup: bool,
    #[serde(rename = "lastSyncAt", default)]
    pub last_sync_at: u64,
    #[serde(rename = "lastSyncStatus", default)]
    pub last_sync_status: String, // "idle", "syncing", "success", "error"
    #[serde(rename = "lastError", default)]
    pub last_error: Option<String>,
}

impl Default for SkillsSyncConfig {
    fn default() -> Self {
        Self {
            remote_url: String::new(),
            branch: "main".to_string(),
            auto_pull_on_startup: false,
            last_sync_at: 0,
            last_sync_status: "idle".to_string(),
            last_error: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillsSyncStatus {
    pub initialized: bool,
    #[serde(rename = "remoteUrl", default)]
    pub remote_url: Option<String>,
    #[serde(default)]
    pub branch: Option<String>,
    pub ahead: i32,
    pub behind: i32,
    #[serde(rename = "dirtyCount")]
    pub dirty_count: i32,
    #[serde(rename = "lastSyncAt", default)]
    pub last_sync_at: Option<u64>,
    #[serde(rename = "lastSyncStatus", default)]
    pub last_sync_status: String,
    #[serde(rename = "lastError", default)]
    pub last_error: Option<String>,
}

/// 本地 vs 远端 文件级差异条目（按功能范围 skills/ 或 dsh/ 隔离）。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncDiffEntry {
    pub path: String,
    pub status: String, // "added" | "modified" | "deleted"
    pub side: String,   // "local" | "remote" | "both"
}

/// 逐文件同步决策（WI-013 延伸）：skills 文件级逐条方向。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillsSyncDecision {
    pub path: String,
    pub direction: String, // "remote" | "local"
}

/// 全局同步仓库配置（技能与 DSH 插件共用同一 remote/branch）。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncRepoConfig {
    #[serde(rename = "remoteUrl", default)]
    pub remote_url: String,
    #[serde(default)]
    pub branch: String,
    #[serde(rename = "validatedAt", default)]
    pub validated_at: u64,
    #[serde(rename = "lastError", default, skip_serializing_if = "Option::is_none")]
    pub last_error: Option<String>,
}

impl Default for SyncRepoConfig {
    fn default() -> Self {
        Self {
            remote_url: String::new(),
            branch: "main".to_string(),
            validated_at: 0,
            last_error: None,
        }
    }
}

/// 全局同步仓库校验结果。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncRepoValidation {
    pub ok: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    pub initialized: bool,
    #[serde(rename = "formatOk", default)]
    pub format_ok: bool,
    #[serde(rename = "resolvedBranch", default, skip_serializing_if = "Option::is_none")]
    pub resolved_branch: Option<String>,
}

// ==================== DSH 插件中心 ====================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DshPluginEntry {
    pub key: String,
    #[serde(rename = "profileName")]
    pub profile_name: String,
    pub name: String,
    pub kind: String, // "inbox" | "bundle" | "plain" | "row"
    #[serde(rename = "spec", default, skip_serializing_if = "Option::is_none")]
    pub spec: Option<String>,
    #[serde(rename = "installedVersion", default, skip_serializing_if = "Option::is_none")]
    pub installed_version: Option<String>,
    pub enabled: bool,
    pub portability: String, // "portable" | "unportable"
    #[serde(rename = "disabledBy", default, skip_serializing_if = "Option::is_none")]
    pub disabled_by: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DshPluginInstallEntry {
    pub key: String,
    #[serde(rename = "profileName")]
    pub profile_name: String,
    pub name: String,
    pub kind: String, // "inbox" | "bundle" | "plain" | "row"
    #[serde(rename = "spec", default, skip_serializing_if = "Option::is_none")]
    pub spec: Option<String>,
    #[serde(rename = "declaredInConfig")]
    pub declared_in_config: bool,
    pub installed: bool,
    #[serde(rename = "installedVersion", default, skip_serializing_if = "Option::is_none")]
    pub installed_version: Option<String>,
    #[serde(rename = "requiredVersion", default, skip_serializing_if = "Option::is_none")]
    pub required_version: Option<String>,
    pub status: String, // "ok" | "pending" | "orphan" | "version-mismatch" | "failed"
    #[serde(rename = "installError", default, skip_serializing_if = "Option::is_none")]
    pub install_error: Option<String>,
    pub portability: String,
    pub enabled: bool,
    #[serde(rename = "disabledBy", default, skip_serializing_if = "Option::is_none")]
    pub disabled_by: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DshInstallFailure {
    pub name: String,
    pub reason: String, // "non-zero-exit" | "missing-entry" | "resolve-error"
    pub stack: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DshInstallReport {
    pub profile: String,
    pub mode: String, // "incremental" | "update" | "reinstall-all" | "reinstall-failed"
    pub ok: bool,
    pub installed: Vec<String>,
    pub updated: Vec<String>,
    pub failed: Vec<DshInstallFailure>,
    pub warnings: Vec<String>,
    pub output: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DshPluginUpdateCheck {
    pub key: String,
    pub name: String,
    #[serde(rename = "checkedAt")]
    pub checked_at: u64,
    #[serde(rename = "updateAvailable")]
    pub update_available: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub current: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub latest: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub hint: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DshInstallStateItem {
    pub status: String,
    pub reason: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stack: Option<String>,
    #[serde(rename = "lastAttemptAt", default)]
    pub last_attempt_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DshPatchRow {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub disabled: Option<bool>,
    pub raw: serde_yaml::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DshProfileScan {
    pub name: String,
    pub dir: String,
    pub exists: bool,
    pub bundles: Vec<String>,
    pub dependencies: HashMap<String, String>,
    pub plugins: Vec<DshPluginEntry>,
    #[serde(rename = "patchRows")]
    pub patch_rows: Vec<DshPatchRow>,
    #[serde(rename = "patchFile")]
    pub patch_file: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DshPluginScanResult {
    #[serde(rename = "homeDir")]
    pub home_dir: String,
    #[serde(rename = "dshCommand")]
    pub dsh_command: Option<String>,
    #[serde(rename = "pnpmCommand")]
    pub pnpm_command: Option<String>,
    pub profiles: Vec<DshProfileScan>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DshRecoveryAction {
    pub kind: String, // "remove-bundle" | "disable-row" | "remove-dependency"
    #[serde(rename = "profileName")]
    pub profile_name: String,
    pub target: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DshDiagnoseResult {
    pub ok: bool,
    #[serde(rename = "exitCode")]
    pub exit_code: Option<i32>,
    #[serde(rename = "rawStderr")]
    pub raw_stderr: String,
    #[serde(rename = "failedPlugins")]
    pub failed_plugins: Vec<String>,
    #[serde(rename = "suggestedActions")]
    pub suggested_actions: Vec<DshRecoveryAction>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub hint: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DshPluginDiffItem {
    pub kind: String, // "missing" | "extra" | "version" | "patch"
    #[serde(rename = "profileName")]
    pub profile_name: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub local: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub remote: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DshPluginDiff {
    pub compatible: bool,
    pub items: Vec<DshPluginDiffItem>,
    pub warnings: Vec<String>,
}

/// 逐插件对齐决策（WI-013）：name = dep 名 / "bundle:<pkg>" / "cordis.patch.yml"；
/// direction = "remote"（采用仓库，默认）| "local"（保留本地）。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DshAlignDecision {
    #[serde(rename = "profileName")]
    pub profile_name: String,
    pub name: String,
    pub direction: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DshPluginsSyncConfig {
    #[serde(rename = "remoteUrl", default)]
    pub remote_url: String,
    #[serde(default)]
    pub branch: String,
    #[serde(rename = "autoPullOnStartup", default)]
    pub auto_pull_on_startup: bool,
    #[serde(rename = "lastSyncAt", default)]
    pub last_sync_at: u64,
    #[serde(rename = "lastSyncStatus", default)]
    pub last_sync_status: String,
    #[serde(rename = "lastError", default)]
    pub last_error: Option<String>,
}

impl Default for DshPluginsSyncConfig {
    fn default() -> Self {
        Self {
            remote_url: String::new(),
            branch: "main".to_string(),
            auto_pull_on_startup: false,
            last_sync_at: 0,
            last_sync_status: "idle".to_string(),
            last_error: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DshPluginsConfig {
    #[serde(rename = "dshCommand", default)]
    pub dsh_command: String,
    #[serde(rename = "pnpmCommand", default)]
    pub pnpm_command: String,
    /// 可选的 GitHub 镜像前缀（如 `https://gh-proxy.com/`）；空 = 直连 + 系统代理。
    #[serde(rename = "gitHubMirror", default)]
    pub git_hub_mirror: String,
    #[serde(default, rename = "sync")]
    pub sync: Option<DshPluginsSyncConfig>,
}

impl Default for DshPluginsConfig {
    fn default() -> Self {
        Self {
            dsh_command: String::new(),
            pnpm_command: String::new(),
            git_hub_mirror: String::new(),
            sync: None,
        }
    }
}

// ==================== DSH 配置快照与回滚 (WI-006) ====================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DshConfigSnapshot {
    pub id: String,
    #[serde(rename = "createdAt")]
    pub created_at: u64,
    pub trigger: String, // "manual" | "install" | "align" | "upgrade"
    #[serde(default, rename = "note", skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
    pub permanent: bool,
    #[serde(rename = "profileName")]
    pub profile_name: String,
    pub files: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DshSnapshotRollbackResult {
    pub profile: String,
    pub restored: Vec<String>,
    #[serde(rename = "needsInstall")]
    pub needs_install: bool,
}

// ==================== DSH 版本升级与版本管理 (WI-009) ====================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DshVersionInfo {
    #[serde(rename = "packageName")]
    pub package_name: String,
    #[serde(default)]
    pub current: Option<String>,
    #[serde(rename = "dshCommand", default)]
    pub dsh_command: Option<String>,
    #[serde(rename = "npmCommand", default)]
    pub npm_command: Option<String>,
    #[serde(rename = "checkedAt")]
    pub checked_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DshVersionCheck {
    #[serde(rename = "packageName")]
    pub package_name: String,
    #[serde(default)]
    pub current: Option<String>,
    #[serde(default)]
    pub latest: Option<String>,
    #[serde(rename = "updateAvailable")]
    pub update_available: bool,
    #[serde(rename = "checkedAt")]
    pub checked_at: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DshVersionHistoryEntry {
    pub version: String,
    pub action: String, // "upgrade" | "install" | "rollback"
    #[serde(rename = "installedAt")]
    pub installed_at: u64,
    #[serde(rename = "fromVersion", default, skip_serializing_if = "Option::is_none")]
    pub from_version: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DshVersionUpgradeResult {
    pub ok: bool,
    pub action: String, // "upgrade" | "install"
    #[serde(rename = "beforeVersion", default)]
    pub before_version: Option<String>,
    #[serde(rename = "afterVersion", default)]
    pub after_version: Option<String>,
    #[serde(rename = "targetVersion")]
    pub target_version: String,
    #[serde(rename = "snapshotIds")]
    pub snapshot_ids: Vec<String>,
    #[serde(rename = "diagnosisBefore")]
    pub diagnosis_before: u32,
    #[serde(rename = "diagnosisAfter")]
    pub diagnosis_after: u32,
    #[serde(rename = "massFailure")]
    pub mass_failure: bool,
    pub output: String,
    pub warnings: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DshVersionRollbackResult {
    pub ok: bool,
    #[serde(default)]
    pub version: Option<String>,
    #[serde(rename = "restoredSnapshots")]
    pub restored_snapshots: Vec<DshSnapshotRollbackResult>,
    pub output: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DshAvailableVersions {
    #[serde(rename = "packageName")]
    pub package_name: String,
    #[serde(default)]
    pub current: Option<String>,
    #[serde(default)]
    pub latest: Option<String>,
    #[serde(default)]
    pub versions: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DshLaunchResult {
    pub ok: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pid: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stderr: Option<String>,
}

// ==================== 应用本体在线更新 (cc-switch 风格) ====================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppUpdateCheck {
    #[serde(rename = "currentVersion")]
    pub current_version: String,
    #[serde(rename = "latestVersion")]
    pub latest_version: String,
    #[serde(rename = "updateAvailable")]
    pub update_available: bool,
    #[serde(rename = "releaseNotes")]
    pub release_notes: String,
    #[serde(rename = "publishedAt", default, skip_serializing_if = "Option::is_none")]
    pub published_at: Option<String>,
    #[serde(rename = "downloadUrl", default, skip_serializing_if = "Option::is_none")]
    pub download_url: Option<String>,
    #[serde(rename = "assetName", default, skip_serializing_if = "Option::is_none")]
    pub asset_name: Option<String>,
    #[serde(rename = "assetSize", default)]
    pub asset_size: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppUpdateDownload {
    pub ok: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    #[serde(rename = "fileName", default, skip_serializing_if = "Option::is_none")]
    pub file_name: Option<String>,
    #[serde(default)]
    pub size: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// ==================== 应用日志系统 (WI-007) ====================

/// 单条日志：级别 + 原始文本行（`<ts> [LEVEL] [module] message`）。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub level: String, // "DEBUG" | "INFO" | "WARN" | "ERROR"
    pub message: String,
}

/// 读取最近日志的结果：较新在前。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppLogsResult {
    #[serde(rename = "logPath")]
    pub log_path: String,
    pub entries: Vec<LogEntry>,
}

/// 导出日志的结果：返回导出文件路径（另存为当前活动日志文件快照）。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppLogExportResult {
    #[serde(rename = "exportPath")]
    pub export_path: String,
    #[serde(rename = "size")]
    pub size: u64,
}

/// 返回应用日志文件路径（UI 一键复制）。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppLogPathResult {
    #[serde(rename = "logPath")]
    pub log_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub auto_start: bool,
    pub theme: String,
    pub default_rule_mode: String, // "append" or "overwrite"
    pub auto_capture_skills: bool,
    pub toast_notifications: bool,
    #[serde(default, rename = "auto_check_update")]
    pub auto_check_update: bool,
    #[serde(default, rename = "ignored_skills")]
    pub ignored_skills: Option<Vec<IgnoredSkill>>,
    #[serde(default, rename = "system_theme")]
    pub system_theme: Option<String>,
    #[serde(default, rename = "skills_sync")]
    pub skills_sync: Option<SkillsSyncConfig>,
    #[serde(default, rename = "dsh_plugins")]
    pub dsh_plugins: Option<DshPluginsConfig>,
    #[serde(default, rename = "sync_repo")]
    pub sync_repo: Option<SyncRepoConfig>,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            auto_start: false,
            theme: "system".to_string(),
            default_rule_mode: "append".to_string(),
            auto_capture_skills: true,
            toast_notifications: true,
            auto_check_update: false,
            ignored_skills: Some(Vec::new()),
            system_theme: Some("light".to_string()),
            skills_sync: None,
            dsh_plugins: None,
            sync_repo: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentInfo {
    pub id: String,
    pub name: String,
    pub icon: String,
    pub detected: bool,
    pub enabled: bool,
    #[serde(rename = "skillsDir")]
    pub skills_dir: String,
    #[serde(rename = "ruleType")]
    pub rule_type: String, // "local_file", "global_file", etc.
    #[serde(rename = "localRuleFilename")]
    pub local_rule_filename: String,
    #[serde(rename = "isCustom")]
    pub is_custom: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectInfo {
    pub id: String,
    pub name: String,
    pub path: String,
    #[serde(rename = "isGit")]
    pub is_git: bool,
    #[serde(rename = "overrideEnabled")]
    pub override_enabled: bool,
    #[serde(rename = "ruleMode")]
    pub rule_mode: String, // "overwrite" or "append"
    #[serde(rename = "customRuleContent")]
    pub custom_rule_content: String,
    #[serde(rename = "originalRuleContent")]
    pub original_rule_content: Option<String>,
    #[serde(rename = "linkedAgents")]
    pub linked_agents: Vec<String>,
    #[serde(rename = "gitBranch")]
    pub git_branch: Option<String>,
    #[serde(rename = "hookInstalled")]
    pub hook_installed: Option<bool>,
    #[serde(rename = "preCommitGuard")]
    pub pre_commit_guard: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillMetadata {
    pub name: String,
    pub description: Option<String>,
    pub version: Option<String>,
    pub author: Option<String>,
    pub tags: Option<Vec<String>>,
    pub slash_commands: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillItem {
    pub id: String,
    pub name: String,
    pub path: String,
    pub description: String,
    pub version: String,
    pub source: String, // "central", "npx", "manual", "imported"
    pub enabled: bool,
    pub content: String,
    pub metadata: Option<SkillMetadata>,
    #[serde(rename = "mountedAgents")]
    pub mounted_agents: Vec<String>,
    #[serde(rename = "isSymlinkMap")]
    pub is_symlink_map: HashMap<String, bool>, // agent_id -> is_symlink
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnmanagedSkill {
    #[serde(rename = "agentId")]
    pub agent_id: String,
    #[serde(rename = "agentName")]
    pub agent_name: String,
    #[serde(rename = "skillName")]
    pub skill_name: String,
    pub path: String,
    #[serde(rename = "hasConflict")]
    pub has_conflict: bool,
    #[serde(rename = "centralContent")]
    pub central_content: Option<String>,
    #[serde(rename = "localContent")]
    pub local_content: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationResult {
    pub valid: bool,
    pub message: String,
}
