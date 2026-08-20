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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub auto_start: bool,
    pub theme: String,
    pub default_rule_mode: String, // "append" or "overwrite"
    pub auto_capture_skills: bool,
    pub toast_notifications: bool,
    #[serde(default, rename = "ignored_skills")]
    pub ignored_skills: Option<Vec<IgnoredSkill>>,
    #[serde(default, rename = "system_theme")]
    pub system_theme: Option<String>,
    #[serde(default, rename = "skills_sync")]
    pub skills_sync: Option<SkillsSyncConfig>,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            auto_start: false,
            theme: "system".to_string(),
            default_rule_mode: "append".to_string(),
            auto_capture_skills: true,
            toast_notifications: true,
            ignored_skills: Some(Vec::new()),
            system_theme: Some("light".to_string()),
            skills_sync: None,
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
    #[serde(rename = "supportsJunction")]
    pub supports_junction: bool,
}
