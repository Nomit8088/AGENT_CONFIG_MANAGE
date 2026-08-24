use std::fs;
use std::path::PathBuf;
use crate::models::{AgentInfo, AppConfig, ProjectInfo, SkillMetadata};
use regex::Regex;

pub fn get_app_data_dir() -> PathBuf {
    #[cfg(windows)]
    {
        if let Ok(appdata) = std::env::var("APPDATA") {
            return PathBuf::from(appdata).join("AgentHub");
        }
    }
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("AgentHub")
}

pub fn get_central_skills_dir() -> PathBuf {
    get_app_data_dir().join("skills")
}

pub fn get_backups_dir() -> PathBuf {
    get_app_data_dir().join("backups")
}

pub fn init_storage() -> Result<(), String> {
    let base = get_app_data_dir();
    fs::create_dir_all(&base).map_err(|e| format!("无法创建存储目录: {}", e))?;
    fs::create_dir_all(get_central_skills_dir()).map_err(|e| format!("无法创建技能库目录: {}", e))?;
    fs::create_dir_all(get_backups_dir()).map_err(|e| format!("无法创建备份目录: {}", e))?;

    let config_file = base.join("config.json");
    if !config_file.exists() {
        let def_config = AppConfig::default();
        let s = serde_json::to_string_pretty(&def_config).unwrap();
        let _ = fs::write(&config_file, s);
    }

    Ok(())
}

pub fn load_config() -> AppConfig {
    let file = get_app_data_dir().join("config.json");
    if let Ok(content) = fs::read_to_string(&file) {
        if let Ok(cfg) = serde_json::from_str(&content) {
            return cfg;
        }
    }
    AppConfig::default()
}

pub fn save_config(cfg: &AppConfig) -> Result<(), String> {
    let file = get_app_data_dir().join("config.json");
    let content = serde_json::to_string_pretty(cfg).map_err(|e| e.to_string())?;
    fs::write(&file, content).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn load_agents() -> Vec<AgentInfo> {
    let file = get_app_data_dir().join("agents.json");
    let defaults = crate::agent_detector::get_default_agents();
    if let Ok(content) = fs::read_to_string(&file) {
        if let Ok(saved) = serde_json::from_str::<Vec<AgentInfo>>(&content) {
            let mut list = Vec::new();
            for mut sa in saved {
                if let Some(def_a) = defaults.iter().find(|d| d.id == sa.id) {
                    if sa.is_custom != Some(true) {
                        sa.name = def_a.name.clone();
                        sa.icon = def_a.icon.clone();
                        sa.skills_dir = def_a.skills_dir.clone();
                        sa.local_rule_filename = def_a.local_rule_filename.clone();
                    }
                }
                list.push(sa);
            }
            for def_a in &defaults {
                if !list.iter().any(|a| a.id == def_a.id) {
                    list.push(def_a.clone());
                }
            }
            for a in list.iter_mut() {
                crate::agent_detector::detect_agent(a);
            }
            return list;
        }
    }
    let mut agents = defaults;
    for a in agents.iter_mut() {
        crate::agent_detector::detect_agent(a);
    }
    let _ = save_agents(&agents);
    agents
}

pub fn save_agents(agents: &[AgentInfo]) -> Result<(), String> {
    let file = get_app_data_dir().join("agents.json");
    let content = serde_json::to_string_pretty(agents).map_err(|e| e.to_string())?;
    fs::write(&file, content).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn load_projects() -> Vec<ProjectInfo> {
    let file = get_app_data_dir().join("projects.json");
    if let Ok(content) = fs::read_to_string(&file) {
        if let Ok(projs) = serde_json::from_str(&content) {
            return projs;
        }
    }
    Vec::new()
}

pub fn save_projects(projects: &[ProjectInfo]) -> Result<(), String> {
    let file = get_app_data_dir().join("projects.json");
    let content = serde_json::to_string_pretty(projects).map_err(|e| e.to_string())?;
    fs::write(&file, content).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn parse_skill_md(content: &str, folder_name: &str) -> (String, String, Option<SkillMetadata>) {
    let frontmatter_re = Regex::new(r"(?s)^---\r?\n(.*?)\r?\n---\r?\n?(.*)$").unwrap();
    if let Some(caps) = frontmatter_re.captures(content) {
        let yaml_str = caps.get(1).map_or("", |m| m.as_str());
        let _body = caps.get(2).map_or("", |m| m.as_str()).to_string();

        if let Ok(val) = serde_yaml::from_str::<serde_yaml::Value>(yaml_str) {
            let name = val.get("name")
                .and_then(|v| v.as_str())
                .unwrap_or(folder_name)
                .to_string();
            let desc = val.get("description")
                .and_then(|v| v.as_str())
                .unwrap_or("未提供描述")
                .to_string();
            let version = val.get("version")
                .and_then(|v| v.as_str())
                .unwrap_or("1.0.0")
                .to_string();

            let metadata = SkillMetadata {
                name: name.clone(),
                description: Some(desc.clone()),
                version: Some(version),
                author: val.get("author").and_then(|v| v.as_str()).map(|s| s.to_string()),
                tags: None,
                slash_commands: None,
            };
            return (name, desc, Some(metadata));
        }
        return (folder_name.to_string(), "无描述信息".to_string(), None);
    }
    (folder_name.to_string(), "无描述信息".to_string(), None)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn app_data_dir_platform_consistent() {
        // B-M9.1：应用数据目录 = <平台基目录>/AgentHub。
        let dir = get_app_data_dir();
        assert_eq!(dir.file_name().and_then(|n| n.to_str()), Some("AgentHub"));

        #[cfg(windows)]
        {
            if let Ok(appdata) = std::env::var("APPDATA") {
                assert!(dir.starts_with(&appdata), "Windows 应位于 %APPDATA% 下: {dir:?}");
            }
        }
        #[cfg(target_os = "macos")]
        {
            let home = dirs::home_dir().unwrap();
            assert!(dir.starts_with(home.join("Library").join("Application Support")));
        }
        #[cfg(target_os = "linux")]
        {
            let base = std::env::var("XDG_CONFIG_HOME")
                .map(std::path::PathBuf::from)
                .unwrap_or_else(|_| dirs::home_dir().unwrap().join(".config"));
            assert!(dir.starts_with(&base), "Linux 应位于 XDG/.config 下: {dir:?}");
        }
    }
}
