pub mod models;
pub mod fs_junction;
pub mod git_guard;
pub mod agent_detector;
pub mod storage;
pub mod watcher;

use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use models::*;
use fs_junction::*;
use git_guard::*;
use storage::*;
use agent_detector::*;

#[tauri::command]
fn get_config() -> AppConfig {
    load_config()
}

#[tauri::command]
fn update_config(config: AppConfig) -> Result<(), String> {
    save_config(&config)
}

#[tauri::command]
fn get_agents() -> Vec<AgentInfo> {
    load_agents()
}

#[tauri::command]
fn scan_agents() -> Vec<AgentInfo> {
    let mut agents = load_agents();
    for a in agents.iter_mut() {
        detect_agent(a);
    }
    let _ = save_agents(&agents);
    agents
}

#[tauri::command]
fn save_agents_list(agents: Vec<AgentInfo>) -> Result<(), String> {
    save_agents(&agents)
}

#[tauri::command]
fn validate_agent_path(skills_dir: String, rule_filename: String) -> ValidationResult {
    validate_custom_agent(&skills_dir, &rule_filename)
}

#[tauri::command]
fn get_central_skills() -> Result<Vec<SkillItem>, String> {
    let central_dir = get_central_skills_dir();
    let mut skills = Vec::new();
    let agents = load_agents();

    if !central_dir.exists() {
        let _ = fs::create_dir_all(&central_dir);
        return Ok(skills);
    }

    if let Ok(entries) = fs::read_dir(&central_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                let folder_name = entry.file_name().to_string_lossy().to_string();
                let skill_md = path.join("SKILL.md");
                let content = if skill_md.exists() {
                    fs::read_to_string(&skill_md).unwrap_or_default()
                } else {
                    String::new()
                };

                let (name, desc, meta) = parse_skill_md(&content, &folder_name);

                // Check which agents have this skill mounted
                let mut mounted_agents = Vec::new();
                let mut is_symlink_map = HashMap::new();

                for agent in &agents {
                    let agent_skills_dir = expand_tilde(&agent.skills_dir);
                    let target_skill_dir = agent_skills_dir.join(&folder_name);
                    if target_skill_dir.exists() {
                        let is_link = is_junction_or_symlink(&target_skill_dir);
                        is_symlink_map.insert(agent.id.clone(), is_link || agent.id == "antigravity");
                        mounted_agents.push(agent.id.clone());
                    }
                }

                skills.push(SkillItem {
                    id: folder_name.clone(),
                    name,
                    path: path.to_string_lossy().to_string(),
                    description: desc,
                    version: meta.as_ref().and_then(|m| m.version.clone()).unwrap_or_else(|| "1.0.0".to_string()),
                    source: if folder_name == "agenthub-sync" { "builtin".to_string() } else { "central".to_string() },
                    enabled: !mounted_agents.is_empty(),
                    content,
                    metadata: meta,
                    mounted_agents,
                    is_symlink_map,
                });
            }
        }
    }

    Ok(skills)
}

#[tauri::command]
fn scan_unmanaged_skills() -> Result<Vec<UnmanagedSkill>, String> {
    let agents = load_agents();
    let central_dir = get_central_skills_dir();
    let config = load_config();
    let ignored = config.ignored_skills.unwrap_or_default();
    let mut unmanaged = Vec::new();

    for agent in agents {
        let skills_dir = expand_tilde(&agent.skills_dir);
        if !skills_dir.exists() {
            continue;
        }

        if let Ok(entries) = fs::read_dir(&skills_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    let skill_name = entry.file_name().to_string_lossy().to_string();
                    if ignored.iter().any(|ig| ig.agent_id == agent.id && ig.skill_name == skill_name) {
                        continue;
                    }

                    let is_link = is_junction_or_symlink(&path);
                    if !is_link {
                        if agent.id == "antigravity" && central_dir.join(&skill_name).exists() {
                            continue;
                        }

                        let central_skill_path = central_dir.join(&skill_name);
                        let has_conflict = central_skill_path.exists();

                        let local_content = {
                            let smd = path.join("SKILL.md");
                            if smd.exists() {
                                fs::read_to_string(smd).ok()
                            } else {
                                None
                            }
                        };

                        let central_content = if has_conflict {
                            let smd = central_skill_path.join("SKILL.md");
                            if smd.exists() {
                                fs::read_to_string(smd).ok()
                            } else {
                                None
                            }
                        } else {
                            None
                        };

                        unmanaged.push(UnmanagedSkill {
                            agent_id: agent.id.clone(),
                            agent_name: agent.name.clone(),
                            skill_name,
                            path: path.to_string_lossy().to_string(),
                            has_conflict,
                            central_content,
                            local_content,
                        });
                    }
                }
            }
        }
    }

    Ok(unmanaged)
}

#[tauri::command]
fn save_skill(skill_name: String, content: String) -> Result<(), String> {
    let central_dir = get_central_skills_dir();
    let skill_folder = central_dir.join(&skill_name);
    fs::create_dir_all(&skill_folder).map_err(|e| e.to_string())?;

    let skill_file = skill_folder.join("SKILL.md");
    fs::write(&skill_file, &content).map_err(|e| e.to_string())?;

    // If Antigravity has this skill mounted as physical/hardlink dir, keep SKILL.md in sync
    let agents = load_agents();
    if let Some(ag) = agents.iter().find(|a| a.id == "antigravity") {
        let target_dir = expand_tilde(&ag.skills_dir).join(&skill_name);
        if target_dir.exists() && !is_junction_or_symlink(&target_dir) {
            let target_file = target_dir.join("SKILL.md");
            let _ = fs::remove_file(&target_file);
            if fs::hard_link(&skill_file, &target_file).is_err() {
                let _ = fs::copy(&skill_file, &target_file);
            }
        }
    }

    Ok(())
}

#[tauri::command]
fn delete_skill(skill_name: String) -> Result<(), String> {
    let central_dir = get_central_skills_dir();
    let skill_folder = central_dir.join(&skill_name);

    // Unlink from all agents first
    let agents = load_agents();
    for a in agents {
        let target = expand_tilde(&a.skills_dir).join(&skill_name);
        if target.exists() || is_junction_or_symlink(&target) {
            let _ = remove_junction(&target);
        }
    }

    if skill_folder.exists() {
        fs::remove_dir_all(skill_folder).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn toggle_skill_for_agent(skill_name: String, agent_id: String, enable: bool) -> Result<(), String> {
    let agents = load_agents();
    let agent = agents.into_iter().find(|a| a.id == agent_id)
        .ok_or_else(|| format!("未找到 Agent: {}", agent_id))?;

    let central_skill = get_central_skills_dir().join(&skill_name);
    if !central_skill.exists() {
        return Err(format!("中央技能库中不存在技能: {}", skill_name));
    }

    let agent_skills_dir = expand_tilde(&agent.skills_dir);
    let target_link = agent_skills_dir.join(&skill_name);

    if enable {
        if agent.id == "antigravity" {
            let _ = remove_junction(&target_link);
            create_hardlink_dir_all(&central_skill, &target_link).map_err(|e| e.to_string())?;
        } else {
            create_junction(&target_link, &central_skill)?;
        }
    } else {
        remove_junction(&target_link)?;
    }

    Ok(())
}

#[tauri::command]
fn takeover_unmanaged_skill(
    agent_id: String,
    skill_name: String,
    resolution: String, // "overwrite", "rename", "skip"
) -> Result<(), String> {
    let agents = load_agents();
    let agent = agents.into_iter().find(|a| a.id == agent_id)
        .ok_or_else(|| format!("未找到 Agent: {}", agent_id))?;

    let local_dir = expand_tilde(&agent.skills_dir).join(&skill_name);
    if !local_dir.exists() {
        return Err("物理目录不存在".to_string());
    }

    let central_dir = get_central_skills_dir();
    let target_central = central_dir.join(&skill_name);

    match resolution.as_str() {
        "overwrite" | "create" => {
            if target_central.exists() {
                let _ = fs::remove_dir_all(&target_central);
            }
            copy_dir_all(&local_dir, &target_central).map_err(|e| e.to_string())?;
            fs::remove_dir_all(&local_dir).map_err(|e| e.to_string())?;
            create_junction(&local_dir, &target_central)?;
        }
        "rename" => {
            let new_name = format!("{}-{}", skill_name, agent_id);
            let rename_central = central_dir.join(&new_name);
            copy_dir_all(&local_dir, &rename_central).map_err(|e| e.to_string())?;
            fs::remove_dir_all(&local_dir).map_err(|e| e.to_string())?;
            create_junction(&local_dir, &rename_central)?;
        }
        "skip" => {
            // Do nothing
        }
        _ => return Err("未知的解决方案".to_string()),
    }

    Ok(())
}

#[tauri::command]
fn ignore_skill(
    agent_id: String,
    agent_name: String,
    skill_name: String,
    path: String,
) -> Result<(), String> {
    let mut cfg = load_config();
    let mut list = cfg.ignored_skills.unwrap_or_default();
    if !list.iter().any(|i| i.agent_id == agent_id && i.skill_name == skill_name) {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);
        list.push(IgnoredSkill {
            agent_id,
            agent_name,
            skill_name,
            path,
            ignored_at: now,
        });
    }
    cfg.ignored_skills = Some(list);
    save_config(&cfg)
}

#[tauri::command]
fn unignore_skill(agent_id: String, skill_name: String) -> Result<(), String> {
    let mut cfg = load_config();
    let mut list = cfg.ignored_skills.unwrap_or_default();
    list.retain(|i| !(i.agent_id == agent_id && i.skill_name == skill_name));
    cfg.ignored_skills = Some(list);
    save_config(&cfg)
}

#[tauri::command]
fn get_projects() -> Result<Vec<ProjectInfo>, String> {
    let mut projs = load_projects();
    for p in projs.iter_mut() {
        let st = check_git_status(Path::new(&p.path));
        p.is_git = st.is_git;
        p.git_branch = st.branch;
        p.hook_installed = Some(st.hooks_active);
    }
    Ok(projs)
}

#[tauri::command]
fn add_project(path: String, name: String) -> Result<ProjectInfo, String> {
    let p_path = PathBuf::from(&path);
    if !p_path.exists() {
        return Err("指定项目路径不存在".to_string());
    }

    let mut projs = load_projects();
    let id = format!("proj-{}", uuid::Uuid::new_v4().simple());
    let git_st = check_git_status(&p_path);

    let original_rule = {
        let am = p_path.join("AGENTS.md");
        if am.exists() {
            fs::read_to_string(am).ok()
        } else {
            None
        }
    };

    let proj = ProjectInfo {
        id,
        name: if name.is_empty() {
            p_path.file_name().map_or("project".to_string(), |n| n.to_string_lossy().to_string())
        } else {
            name
        },
        path,
        is_git: git_st.is_git,
        override_enabled: false,
        rule_mode: "append".to_string(),
        custom_rule_content: "# 本机定制规则\n- 所有输出与回复使用中文\n".to_string(),
        original_rule_content: original_rule,
        linked_agents: vec!["claude-code".to_string(), "antigravity".to_string(), "codex".to_string()],
        git_branch: git_st.branch,
        hook_installed: Some(git_st.hooks_active),
    };

    projs.push(proj.clone());
    save_projects(&projs)?;
    Ok(proj)
}

#[tauri::command]
fn update_project_rule(
    project_id: String,
    rule_mode: String,
    custom_content: String,
    enabled: bool,
    linked_agents: Vec<String>,
) -> Result<(), String> {
    let mut projs = load_projects();
    let proj = projs.iter_mut().find(|p| p.id == project_id)
        .ok_or_else(|| format!("未找到项目: {}", project_id))?;

    proj.rule_mode = rule_mode;
    proj.custom_rule_content = custom_content;
    proj.override_enabled = enabled;
    proj.linked_agents = linked_agents;

    let proj_clone = proj.clone();
    save_projects(&projs)?;

    apply_project_rules(&proj_clone)?;
    Ok(())
}

#[tauri::command]
fn delete_project(project_id: String) -> Result<(), String> {
    let mut projs = load_projects();
    if let Some(p) = projs.iter().find(|p| p.id == project_id) {
        // Rollback rules
        let p_path = Path::new(&p.path);
        let _ = uninstall_git_hooks(p_path);
    }
    projs.retain(|p| p.id != project_id);
    save_projects(&projs)
}

pub fn apply_project_rules(proj: &ProjectInfo) -> Result<(), String> {
    let p_path = Path::new(&proj.path);
    let all_agents = load_agents();
    let backup_dir = get_backups_dir().join(&proj.id);
    let _ = fs::create_dir_all(&backup_dir);

    let custom_file = backup_dir.join("CUSTOM_AGENTS.md");
    let _ = fs::write(&custom_file, &proj.custom_rule_content);

    if !proj.override_enabled {
        // Disabled: Rollback everything
        uninstall_git_hooks(p_path)?;
        // Clean local rules
        for a in &all_agents {
            let lrf = p_path.join(&a.local_rule_filename);
            if lrf.exists() {
                let _ = fs::remove_file(lrf);
            }
        }
        return Ok(());
    }

    // Enabled:
    // 1. Clean up rule files for unlinked agents
    for a in &all_agents {
        if !proj.linked_agents.contains(&a.id) {
            let lrf = p_path.join(&a.local_rule_filename);
            if lrf.exists() {
                let _ = fs::remove_file(lrf);
            }
        }
    }

    // 2. Always distribute to ALL linked agents' native rule files (CLAUDE.local.md, .agents/rules, ZCODE.local.md, etc.)
    let mut filenames_to_exclude = Vec::new();
    for a in &all_agents {
        if proj.linked_agents.contains(&a.id) {
            let lrf = p_path.join(&a.local_rule_filename);
            if let Some(parent) = lrf.parent() {
                let _ = fs::create_dir_all(parent);
            }
            fs::write(&lrf, &proj.custom_rule_content).map_err(|e| e.to_string())?;
            if a.local_rule_filename != "AGENTS.md" {
                filenames_to_exclude.push(a.local_rule_filename.as_str());
            }
        }
    }

    // 3. Mode specific handling for AGENTS.md
    if proj.rule_mode == "overwrite" {
        let agents_md = p_path.join("AGENTS.md");
        let orig_backup = p_path.join(".git").join("info").join("AGENTS.orig");

        if agents_md.exists() && !orig_backup.exists() {
            let _ = fs::copy(&agents_md, &orig_backup);
            let _ = fs::copy(&agents_md, backup_dir.join("AGENTS.md.orig"));
        }
        fs::write(&agents_md, &proj.custom_rule_content).map_err(|e| e.to_string())?;

        if proj.is_git {
            install_git_hooks(p_path, &backup_dir, &custom_file)?;
        }
    } else {
        // Append mode: restore original AGENTS.md if it was modified
        if proj.is_git {
            let _ = uninstall_git_hooks(p_path);
        }
    }

    // 4. Add private rule files to .git/info/exclude
    if proj.is_git && !filenames_to_exclude.is_empty() {
        add_to_git_exclude(p_path, &filenames_to_exclude)?;
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _ = init_storage();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            watcher::start_watcher(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_config,
            update_config,
            get_agents,
            scan_agents,
            save_agents_list,
            validate_agent_path,
            get_central_skills,
            scan_unmanaged_skills,
            save_skill,
            delete_skill,
            toggle_skill_for_agent,
            takeover_unmanaged_skill,
            ignore_skill,
            unignore_skill,
            get_projects,
            add_project,
            update_project_rule,
            delete_project,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
