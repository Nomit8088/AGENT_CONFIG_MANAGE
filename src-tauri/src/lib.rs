pub mod models;
pub mod logger;
pub mod process;
pub mod fs_junction;
pub mod git_guard;
pub mod agent_detector;
pub mod storage;
pub mod skills_sync;
pub mod git_sync;
pub mod dsh_plugins;
pub mod dsh_plugins_sync;
pub mod sync_repo;
pub mod app_update;
pub mod watcher;
pub mod error_codes;

use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use models::*;
use fs_junction::*;
use git_guard::*;
use storage::*;
use agent_detector::*;

/// DSH 的 skill-filesystem 会扫描多个用户级根目录（主目录 ~/.dsh/skills 与
/// 通用根 ~/.agents/skills）。首个元素必须是 AgentHub 的主挂载目录；停用/删除
/// 时再遍历全部根。其他 Agent 当前只使用单一 skillsDir。
fn agent_skill_dirs(agent: &AgentInfo) -> Vec<PathBuf> {
    let mut dirs = vec![expand_tilde(&agent.skills_dir)];
    if agent.id == "dsh" {
        dirs.push(expand_tilde("~/.dsh/skills"));
        dirs.push(expand_tilde("~/.agents/skills"));
    }
    // 保持主目录在最前，同时全局去重（顺序稳定，不排序，避免 ~/.agents 抢先）。
    let mut seen = HashSet::new();
    dirs.retain(|dir| seen.insert(dir.clone()));
    dirs
}

fn find_agent_skill_dir(agent: &AgentInfo, skill_name: &str) -> Option<PathBuf> {
    agent_skill_dirs(agent).into_iter().find(|dir| {
        let candidate = dir.join(skill_name);
        // 只返回真正的物理目录；Junction/Symlink 是 AgentHub 的受控挂载，不能当作“待纳管实体”处理。
        candidate.exists() && !is_junction_or_symlink(&candidate)
    })
}

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
                if folder_name.starts_with('.') {
                    continue;
                }
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
                    let skill_dirs = agent_skill_dirs(agent);
                    let mounted = skill_dirs.iter().any(|dir| dir.join(&folder_name).exists());
                    let is_link = skill_dirs.iter().any(|dir| is_junction_or_symlink(&dir.join(&folder_name)));
                    if mounted {
                        is_symlink_map.insert(agent.id.clone(), is_link || uses_hardlink_tree(&agent.id));
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

    // 存量“待纳管”只扫描各 Agent 的主 skillsDir（DSH 的主目录即 ~/.dsh/skills）。
    // ~/.agents/skills 是通用共享根，不把它当待纳管噪音展示；
    // 但停用/删除时仍会清理所有根目录，确保开关生效。
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
                        if uses_hardlink_tree(&agent.id) && central_dir.join(&skill_name).exists() {
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
    if let Some(ag) = agents.iter().find(|a| uses_hardlink_tree(&a.id)) {
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

    // Unlink from all agents first (DSH 需要清理所有 skill 根目录)
    let agents = load_agents();
    for a in agents {
        for dir in agent_skill_dirs(&a) {
            let target = dir.join(&skill_name);
            if target.exists() || is_junction_or_symlink(&target) {
                let _ = remove_junction(&target);
            }
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

    let skill_dirs = agent_skill_dirs(&agent);

    if enable {
        // 启用只挂载主目录，不清理其他根目录，避免误删公共/共享技能。
        let target_link = skill_dirs[0].join(&skill_name);
        mount_skill(&agent.id, &central_skill, &target_link)?;
    } else {
        // 停用必须清理该 Agent 所有 skill 根目录，否则 DSH 仍会从其他根读到同名技能。
        for dir in skill_dirs {
            remove_junction(&dir.join(&skill_name))?;
        }
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

    let local_dir = find_agent_skill_dir(&agent, &skill_name)
        .unwrap_or_else(|| expand_tilde(&agent.skills_dir).join(&skill_name));
    if !local_dir.exists() || is_junction_or_symlink(&local_dir) {
        return Err("物理目录不存在或已被 AgentHub 托管".to_string());
    }

    let central_dir = get_central_skills_dir();
    let target_central = central_dir.join(&skill_name);

    match resolution.as_str() {
        "overwrite" | "create" => {
            if target_central.exists() {
                let _ = fs::remove_dir_all(&target_central);
            }
            copy_dir_all(&local_dir, &target_central).map_err(|e| e.to_string())?;
            let _ = remove_junction(&local_dir);
            if local_dir.exists() {
                let _ = fs::remove_dir_all(&local_dir);
            }
            mount_skill(&agent.id, &target_central, &local_dir)?;
        }
        "rename" => {
            let new_name = format!("{}-{}", skill_name, agent_id);
            let rename_central = central_dir.join(&new_name);
            copy_dir_all(&local_dir, &rename_central).map_err(|e| e.to_string())?;
            let _ = remove_junction(&local_dir);
            if local_dir.exists() {
                let _ = fs::remove_dir_all(&local_dir);
            }
            mount_skill(&agent.id, &rename_central, &local_dir)?;
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
        pre_commit_guard: Some(true),
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
    pre_commit_guard: Option<bool>,
) -> Result<(), String> {
    let mut projs = load_projects();
    let proj = projs.iter_mut().find(|p| p.id == project_id)
        .ok_or_else(|| format!("未找到项目: {}", project_id))?;

    proj.rule_mode = rule_mode;
    proj.custom_rule_content = custom_content;
    proj.override_enabled = enabled;
    proj.linked_agents = linked_agents;
    if let Some(pcg) = pre_commit_guard {
        proj.pre_commit_guard = Some(pcg);
    }

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
        let backup_dir = get_backups_dir().join(&p.id);
        let _ = uninstall_git_hooks(p_path, Some(&backup_dir));
        clean_all_private_rules(p_path);
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

    // Case 1: Disabled -> Rollback everything and clean private files
    if !proj.override_enabled {
        uninstall_git_hooks(p_path, Some(&backup_dir))?;
        restore_all_baselines(p_path, Some(&backup_dir));
        clean_all_private_rules(p_path);
        return Ok(());
    }

    // Case 2: Overwrite Mode -> Overwrite target baselines (AGENTS.md, CLAUDE.md, etc.) & CLEAN ALL private rules
    if proj.rule_mode == "overwrite" {
        // 1. Clean all private rules so agents don't receive double custom rules
        clean_all_private_rules(p_path);

        // 2. Identify all baseline files to overwrite based on linked agents
        let mut targets_to_protect: Vec<&str> = vec!["AGENTS.md"];
        if proj.linked_agents.iter().any(|id| id == "claude-code" || id == "dsh" || id == "trae") {
            targets_to_protect.push("CLAUDE.md");
        }
        if proj.linked_agents.iter().any(|id| id == "cursor") {
            targets_to_protect.push(".cursorrules");
        }
        if proj.linked_agents.iter().any(|id| id == "windsurf") {
            targets_to_protect.push(".windsurfrules");
        }

        // 3. Backup and overwrite baselines
        for baseline in &targets_to_protect {
            let b_file = p_path.join(baseline);
            let orig_git = p_path.join(".git").join("info").join(format!("{}.orig", baseline));
            let orig_backup = backup_dir.join(format!("{}.orig", baseline));
            let no_orig_marker = backup_dir.join(format!("{}.no_orig", baseline));

            if b_file.exists() {
                if !orig_git.exists() && proj.is_git {
                    let _ = fs::copy(&b_file, &orig_git);
                }
                if !orig_backup.exists() {
                    let _ = fs::copy(&b_file, &orig_backup);
                }
            } else if !orig_backup.exists() {
                let _ = fs::write(&no_orig_marker, "no_original");
            }

            fs::write(&b_file, &proj.custom_rule_content).map_err(|e| e.to_string())?;
        }

        // 4. Install Git Guard hooks
        if proj.is_git {
            let enable_pc = proj.pre_commit_guard.unwrap_or(true);
            install_git_hooks(p_path, &backup_dir, &custom_file, enable_pc, &targets_to_protect)?;
        }
        return Ok(());
    }

    // Case 3: Append Mode -> 100% Restore baselines, uninstall hooks, and write ONLY to private local rule files
    if proj.rule_mode == "append" {
        // 1. 100% Restore team baselines
        if proj.is_git {
            uninstall_git_hooks(p_path, Some(&backup_dir))?;
        } else {
            restore_all_baselines(p_path, Some(&backup_dir));
        }

        // 2. Clean all private rules first
        clean_all_private_rules(p_path);

        // 3. Write ONLY to linked agents' private rule files
        let mut filenames_to_exclude = Vec::new();
        for a in &all_agents {
            if proj.linked_agents.contains(&a.id) && !a.local_rule_filename.is_empty() && a.local_rule_filename != "AGENTS.md" {
                let lrf = p_path.join(&a.local_rule_filename);
                if let Some(parent) = lrf.parent() {
                    let _ = fs::create_dir_all(parent);
                }
                fs::write(&lrf, &proj.custom_rule_content).map_err(|e| e.to_string())?;
                filenames_to_exclude.push(a.local_rule_filename.as_str());
            }
        }

        // 4. Add private rule files to .git/info/exclude
        if proj.is_git && !filenames_to_exclude.is_empty() {
            add_to_git_exclude(p_path, &filenames_to_exclude)?;
        }
    }

    Ok(())
}

#[tauri::command]
fn repair_git_hooks(project_id: String) -> Result<bool, String> {
    let projs = load_projects();
    let proj = projs.into_iter().find(|p| p.id == project_id)
        .ok_or_else(|| format!("未找到项目: {}", project_id))?;

    apply_project_rules(&proj)?;
    Ok(true)
}

// ==================== 应用日志系统 (WI-007) ====================

/// 读取最近应用日志（支持 limit / level 过滤）。level: debug|info|warn|error。
#[tauri::command]
fn get_app_logs(limit: Option<usize>, level: Option<String>) -> Result<AppLogsResult, String> {
    let entries = logger::read_logs(limit, level)
        .into_iter()
        .map(|(lvl, msg)| LogEntry { level: lvl, message: msg })
        .collect();
    Ok(AppLogsResult {
        log_path: logger::log_file_path().to_string_lossy().to_string(),
        entries,
    })
}

/// 导出一份日志文件快照到应用数据目录（返回导出文件路径）。
#[tauri::command]
fn export_app_logs() -> Result<AppLogExportResult, String> {
    let src = logger::log_file_path();
    let export_path = get_logs_dir().join(format!(
        "agenthub-export-{}.log",
        chrono::Local::now().format("%Y%m%d-%H%M%S")
    ));
    std::fs::copy(&src, &export_path).map_err(|e| format!("导出日志失败: {}", e))?;
    let size = std::fs::metadata(&export_path).map(|m| m.len()).unwrap_or(0);
    crate::log_info!("startup", "用户导出日志快照: {}", export_path.to_string_lossy());
    Ok(AppLogExportResult {
        export_path: export_path.to_string_lossy().to_string(),
        size,
    })
}

/// 返回日志文件路径（UI 一键复制）。
#[tauri::command]
fn get_app_log_path() -> AppLogPathResult {
    AppLogPathResult {
        log_path: logger::log_file_path().to_string_lossy().to_string(),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _ = init_storage();
    logger::init_logger();
    logger::log_info("startup", "AgentHub 启动，初始化存储与日志系统完成");

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
            sync_repo::get_sync_repo_config,
            sync_repo::validate_sync_repo,
            sync_repo::save_sync_repo,
            sync_repo::unbind_sync_repo,
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
            repair_git_hooks,
            skills_sync::get_skills_sync_status,
            skills_sync::init_skills_sync,
            skills_sync::pull_skills_sync,
            skills_sync::push_skills_sync,
            skills_sync::set_skills_sync_auto_pull,
            skills_sync::test_skills_sync_connection,
            skills_sync::reset_skills_sync_to_remote,
            skills_sync::get_skills_sync_diff,
            dsh_plugins::scan_dsh_plugins,
            dsh_plugins::diagnose_dsh_web,
            dsh_plugins::toggle_dsh_plugin,
            dsh_plugins::remove_dsh_plugin,
            dsh_plugins::adopt_dsh_orphan,
            dsh_plugins::apply_dsh_recovery,
            dsh_plugins::install_dsh_plugins,
            dsh_plugins::reconcile_dsh_install,
            dsh_plugins::install_dsh_plugins_v2,
            dsh_plugins::install_dsh_plugins_streamed,
            dsh_plugins::clear_dsh_install_state,
            dsh_plugins::check_dsh_plugin_update,
            dsh_plugins::update_dsh_plugin,
            dsh_plugins::create_dsh_config_snapshot,
            dsh_plugins::list_dsh_config_snapshots,
            dsh_plugins::rollback_dsh_config_snapshot,
            dsh_plugins::set_dsh_config_snapshot_permanent,
            dsh_plugins::delete_dsh_config_snapshot,
            dsh_plugins::get_dsh_version_info,
            dsh_plugins::check_dsh_version_update,
            dsh_plugins::list_dsh_versions,
            dsh_plugins::list_dsh_available_versions,
            dsh_plugins::launch_dsh_web,
            dsh_plugins::upgrade_dsh_version,
            dsh_plugins::install_dsh_version,
            dsh_plugins::rollback_dsh_version,
            dsh_plugins::upgrade_dsh_version_streamed,
            dsh_plugins::install_dsh_version_streamed,
            dsh_plugins::rollback_dsh_version_streamed,
            dsh_plugins_sync::get_dsh_plugins_sync_status,
            dsh_plugins_sync::init_dsh_plugins_sync,
            dsh_plugins_sync::pull_dsh_plugins_sync,
            dsh_plugins_sync::push_dsh_plugins_sync,
            dsh_plugins_sync::set_dsh_plugins_sync_auto_pull,
            dsh_plugins_sync::reconcile_dsh_plugins,
            dsh_plugins_sync::align_dsh_plugins,
            dsh_plugins_sync::get_dsh_plugins_sync_diff,
            app_update::check_app_update,
            app_update::download_app_update,
            app_update::install_app_update,
            get_app_logs,
            export_app_logs,
            get_app_log_path,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
