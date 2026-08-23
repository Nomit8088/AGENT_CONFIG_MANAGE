use std::path::PathBuf;
use crate::fs_junction::expand_tilde;
use crate::models::{AgentInfo, ValidationResult};

pub fn get_default_agents() -> Vec<AgentInfo> {
    vec![
        AgentInfo {
            id: "claude-code".to_string(),
            name: "Claude Code".to_string(),
            icon: "claude".to_string(),
            detected: false,
            enabled: true,
            skills_dir: "~/.claude/skills".to_string(),
            rule_type: "local_file".to_string(),
            local_rule_filename: "CLAUDE.local.md".to_string(),
            is_custom: Some(false),
        },
        AgentInfo {
            id: "cursor".to_string(),
            name: "Cursor".to_string(),
            icon: "cursor".to_string(),
            detected: false,
            enabled: true,
            skills_dir: "~/.cursor/skills".to_string(),
            rule_type: "local_file".to_string(),
            local_rule_filename: ".cursor/rules/local-override.mdc".to_string(),
            is_custom: Some(false),
        },
        AgentInfo {
            id: "windsurf".to_string(),
            name: "Windsurf".to_string(),
            icon: "windsurf".to_string(),
            detected: false,
            enabled: true,
            skills_dir: "~/.windsurf/skills".to_string(),
            rule_type: "local_file".to_string(),
            local_rule_filename: "WINDSURF.local.md".to_string(),
            is_custom: Some(false),
        },
        AgentInfo {
            id: "antigravity".to_string(),
            name: "Google Antigravity".to_string(),
            icon: "antigravity".to_string(),
            detected: false,
            enabled: true,
            skills_dir: "~/.gemini/config/skills".to_string(),
            rule_type: "local_file".to_string(),
            local_rule_filename: ".agents/rules/local-override.md".to_string(),
            is_custom: Some(false),
        },
        AgentInfo {
            id: "codex".to_string(),
            name: "OpenCode / Codex".to_string(),
            icon: "codex".to_string(),
            detected: false,
            enabled: true,
            skills_dir: "~/.codex/skills".to_string(),
            rule_type: "local_file".to_string(),
            local_rule_filename: "AGENTS.override.md".to_string(),
            is_custom: Some(false),
        },
        AgentInfo {
            id: "zcode".to_string(),
            name: "ZCode".to_string(),
            icon: "zcode".to_string(),
            detected: false,
            enabled: true,
            skills_dir: "~/.zcode/skills".to_string(),
            rule_type: "local_file".to_string(),
            local_rule_filename: "ZCODE.local.md".to_string(),
            is_custom: Some(false),
        },
        AgentInfo {
            id: "dsh".to_string(),
            name: "DeepSeek HARNESS".to_string(),
            icon: "deepseek".to_string(),
            detected: false,
            enabled: true,
            skills_dir: "~/.dsh/skills".to_string(),
            rule_type: "local_file".to_string(),
            local_rule_filename: "AGENTS.local.md".to_string(),
            is_custom: Some(false),
        },
        AgentInfo {
            id: "mimocode".to_string(),
            name: "MiMo Code".to_string(),
            icon: "mimocode".to_string(),
            detected: false,
            enabled: true,
            skills_dir: "~/.config/mimocode/skills".to_string(),
            rule_type: "local_file".to_string(),
            local_rule_filename: "AGENTS.md".to_string(),
            is_custom: Some(false),
        },
        AgentInfo {
            id: "openclaw".to_string(),
            name: "OpenClaw".to_string(),
            icon: "openclaw".to_string(),
            detected: false,
            enabled: true,
            skills_dir: "~/.openclaw/skills".to_string(),
            rule_type: "local_file".to_string(),
            local_rule_filename: "AGENTS.md".to_string(),
            is_custom: Some(false),
        },
        AgentInfo {
            id: "hermes".to_string(),
            name: "Hermes Agent".to_string(),
            icon: "hermes".to_string(),
            detected: false,
            enabled: true,
            skills_dir: "~/.hermes/skills".to_string(),
            rule_type: "local_file".to_string(),
            local_rule_filename: "AGENTS.override.md".to_string(),
            is_custom: Some(false),
        },
        AgentInfo {
            id: "copilot".to_string(),
            name: "GitHub Copilot".to_string(),
            icon: "copilot".to_string(),
            detected: false,
            enabled: true,
            skills_dir: "~/.copilot/skills".to_string(),
            rule_type: "local_file".to_string(),
            local_rule_filename: ".github/copilot-instructions.md".to_string(),
            is_custom: Some(false),
        },
        AgentInfo {
            id: "pi".to_string(),
            name: "Pi Coding Agent".to_string(),
            icon: "pi".to_string(),
            detected: false,
            enabled: true,
            skills_dir: "~/.pi/skills".to_string(),
            rule_type: "local_file".to_string(),
            local_rule_filename: ".omo/rules/local.md".to_string(),
            is_custom: Some(false),
        },
        AgentInfo {
            id: "kimi".to_string(),
            name: "Kimi Code CLI".to_string(),
            icon: "kimi".to_string(),
            detected: false,
            enabled: true,
            skills_dir: "~/.kimi/skills".to_string(),
            rule_type: "local_file".to_string(),
            local_rule_filename: "AGENTS.md".to_string(),
            is_custom: Some(false),
        },
        AgentInfo {
            id: "trae".to_string(),
            name: "Trae / TraeWork".to_string(),
            icon: "trae".to_string(),
            detected: false,
            enabled: true,
            skills_dir: "~/.trae/skills".to_string(),
            rule_type: "local_file".to_string(),
            local_rule_filename: "CLAUDE.local.md".to_string(),
            is_custom: Some(false),
        },
        AgentInfo {
            id: "workbuddy".to_string(),
            name: "WorkBuddy".to_string(),
            icon: "workbuddy".to_string(),
            detected: false,
            enabled: true,
            skills_dir: "~/.workbuddy/skills".to_string(),
            rule_type: "local_file".to_string(),
            local_rule_filename: "AGENTS.md".to_string(),
            is_custom: Some(false),
        },
        AgentInfo {
            id: "kiro".to_string(),
            name: "Kiro CLI".to_string(),
            icon: "kiro".to_string(),
            detected: false,
            enabled: true,
            skills_dir: "~/.kiro/skills".to_string(),
            rule_type: "local_file".to_string(),
            local_rule_filename: "AGENTS.md".to_string(),
            is_custom: Some(false),
        },
    ]
}

pub fn detect_agent(agent: &mut AgentInfo) {
    let probe_paths: Vec<PathBuf> = match agent.id.as_str() {
        "claude-code" => vec![
            expand_tilde("~/.claude"),
            expand_tilde("~/.claude/skills"),
        ],
        "antigravity" => vec![
            expand_tilde("~/.gemini"),
            expand_tilde("~/.gemini/config/skills"),
            expand_tilde("~/.gemini/antigravity"),
        ],
        "codex" => vec![
            expand_tilde("~/.codex"),
            expand_tilde("~/.opencode"),
            expand_tilde("~/.codex/skills"),
        ],
        "zcode" => vec![
            expand_tilde("~/.zcode"),
            expand_tilde("~/.zcode/skills"),
            expand_tilde("~/AppData/Roaming/ZCode"),
            expand_tilde("~/AppData/Roaming/zcode"),
            expand_tilde("~/Library/Application Support/ZCode"),
            expand_tilde("~/Library/Application Support/zcode"),
            expand_tilde("~/.config/ZCode"),
            expand_tilde("~/.config/zcode"),
        ],
        "cursor" => vec![
            expand_tilde("~/.cursor"),
            expand_tilde("~/AppData/Roaming/Cursor"),
            expand_tilde("~/Library/Application Support/Cursor"),
            expand_tilde("~/.config/Cursor"),
            expand_tilde("~/.cursor/skills"),
        ],
        "dsh" => vec![
            expand_tilde("~/.dsh"),
            expand_tilde("~/.dsh/skills"),
        ],
        "windsurf" => vec![
            expand_tilde("~/.windsurf"),
            expand_tilde("~/AppData/Roaming/Windsurf"),
            expand_tilde("~/Library/Application Support/Windsurf"),
            expand_tilde("~/.config/Windsurf"),
            expand_tilde("~/.windsurf/skills"),
        ],
        "mimocode" => vec![
            expand_tilde("~/.config/mimocode"),
            expand_tilde("~/.mimocode"),
            expand_tilde("~/.config/mimocode/skills"),
        ],
        "openclaw" => vec![
            expand_tilde("~/.openclaw"),
            expand_tilde("~/.agents"),
            expand_tilde("~/.openclaw/skills"),
        ],
        "hermes" => vec![
            expand_tilde("~/.hermes"),
            expand_tilde("~/.hermes/skills"),
        ],
        "copilot" => vec![
            expand_tilde("~/.copilot"),
            expand_tilde("~/.github"),
            expand_tilde("~/.copilot/skills"),
        ],
        "pi" => vec![
            expand_tilde("~/.pi"),
            expand_tilde("~/.omo"),
            expand_tilde("~/.opencode"),
            expand_tilde("~/.pi/skills"),
        ],
        "kimi" => vec![
            expand_tilde("~/.kimi"),
            expand_tilde("~/.kimi/skills"),
        ],
        "trae" => vec![
            expand_tilde("~/.trae"),
            expand_tilde("~/.trae-cn"),
            expand_tilde("~/AppData/Roaming/Trae"),
            expand_tilde("~/Library/Application Support/Trae"),
            expand_tilde("~/.config/Trae"),
            expand_tilde("~/.trae/skills"),
        ],
        "workbuddy" => vec![
            expand_tilde("~/.workbuddy"),
            expand_tilde("~/.workbuddy/skills"),
        ],
        "kiro" => vec![
            expand_tilde("~/.kiro"),
            expand_tilde("~/.amazonq"),
            expand_tilde("~/.kiro/skills"),
        ],
        _ => vec![expand_tilde(&agent.skills_dir)],
    };

    let found = probe_paths.iter().any(|p| p.exists());
    agent.detected = found;
}

pub fn validate_custom_agent(skills_dir: &str, rule_filename: &str) -> ValidationResult {
    let path = expand_tilde(skills_dir);
    if rule_filename.is_empty() || rule_filename.contains("..") || rule_filename.contains('/') || rule_filename.contains('\\') {
        return ValidationResult {
            valid: false,
            message: "规则文件名不合法，不能包含路径分隔符或 '..'".to_string(),
        };
    }

    let dir_exists = path.exists();
    ValidationResult {
        valid: true,
        message: if dir_exists { "路径有效且已存在" } else { "路径格式有效（将在首次挂载时自动创建）" }.to_string(),
    }
}
