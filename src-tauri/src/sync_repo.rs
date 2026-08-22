use std::fs;
use std::path::{Path, PathBuf};
use crate::git_sync::run_git;

use crate::models::{SyncRepoConfig, SyncRepoValidation};
use crate::storage::{get_app_data_dir, load_config, save_config};

/// 与 skills_sync / dsh_plugins_sync 共用的 Git 仓库根目录。
pub fn sync_root() -> PathBuf {
    get_app_data_dir()
}

const GITIGNORE_CONTENT: &str = "# AgentHub sync repo local-only files
config.json
agents.json
projects.json
dsh_install_state.json
backups/
*.log
.DS_Store
Thumbs.db
";

fn ensure_gitignore(root: &Path) {
    let gitignore = root.join(".gitignore");
    if !gitignore.exists() {
        let _ = fs::write(&gitignore, GITIGNORE_CONTENT);
        return;
    }
    if let Ok(text) = fs::read_to_string(&gitignore) {
        let missing: Vec<&str> = GITIGNORE_CONTENT
            .lines()
            .filter(|l| !l.trim().is_empty() && !text.contains(l.trim()))
            .collect();
        if !missing.is_empty() {
            let mut new_text = text.trim_end().to_string();
            new_text.push('\n');
            new_text.push_str(&missing.join("\n"));
            new_text.push('\n');
            let _ = fs::write(&gitignore, new_text);
        }
    }
}

fn git_try(cwd: &Path, args: &[&str]) -> String {
    run_git(cwd, args.iter().copied()).unwrap_or_default()
}

/// 全局仓库配置：读取 `config.json` 中的 `sync_repo`。
#[tauri::command]
pub fn get_sync_repo_config() -> SyncRepoConfig {
    load_config().sync_repo.unwrap_or_default()
}

/// 全局 remoteUrl（优先）；未配置时返回空串，由调用方回退到旧配置。
pub fn global_remote_url() -> String {
    load_config()
        .sync_repo
        .map(|s| s.remote_url)
        .unwrap_or_default()
}

/// 全局 branch（优先）；未配置时返回空串，由调用方回退到旧配置。
pub fn global_branch() -> String {
    load_config()
        .sync_repo
        .map(|s| s.branch)
        .filter(|b| !b.is_empty())
        .unwrap_or_default()
}

fn parse_default_branch(symref_out: &str) -> Option<String> {
    // git ls-remote --symref <url> HEAD 输出形如: ref: refs/heads/main\tHEAD
    symref_out
        .lines()
        .find_map(|l| {
            let l = l.trim();
            if let Some(rest) = l.strip_prefix("ref: refs/heads/") {
                let branch = rest.split_whitespace().next().unwrap_or("").to_string();
                if !branch.is_empty() {
                    return Some(branch);
                }
            }
            None
        })
}

/// 校验远端仓库：连通性 + 分支存在（仓库已初始化） + 根目录格式（skills/ 与 dsh/）。
/// 返回 `SyncRepoValidation`，错误写进 `error`，不抛 Err。
#[tauri::command]
pub fn validate_sync_repo(remote_url: String, branch: Option<String>) -> SyncRepoValidation {
    let remote_url = remote_url.trim().to_string();
    let target = branch
        .filter(|b| !b.trim().is_empty())
        .unwrap_or_else(|| "main".to_string());

    if remote_url.is_empty() {
        return SyncRepoValidation {
            ok: false,
            error: Some("仓库地址不能为空".to_string()),
            initialized: false,
            format_ok: false,
            resolved_branch: Some(target),
        };
    }

    let probe = PathBuf::from(".");

    // 1. 探测默认分支（不阻塞：失败则用输入分支）
    let mut resolved_branch = target.clone();
    if let Ok(out) = run_git(&probe, ["ls-remote", "--symref", remote_url.as_str(), "HEAD"]) {
        if let Some(default_branch) = parse_default_branch(&out) {
            if target == "main" || target.is_empty() {
                resolved_branch = default_branch;
            }
        }
    }

    // 2. 连通性 + 分支存在 + 仓库非空（未初始化仓库没有 refs/heads/<branch>）
    let refspec = format!("refs/heads/{}", resolved_branch);
    match run_git(&probe, ["ls-remote", remote_url.as_str(), refspec.as_str()]) {
        Ok(out) if out.trim().is_empty() => {
            return SyncRepoValidation {
                ok: false,
                error: Some(format!(
                    "远端分支 {} 不存在或仓库为空（仓库可能尚未初始化）",
                    resolved_branch
                )),
                initialized: false,
                format_ok: false,
                resolved_branch: Some(resolved_branch),
            };
        }
        Err(e) => {
            return SyncRepoValidation {
                ok: false,
                error: Some(format!("连通性校验失败: {}", e)),
                initialized: false,
                format_ok: false,
                resolved_branch: Some(resolved_branch),
            };
        }
        _ => {}
    }

    // 3. 浅克隆到临时目录，校验根目录格式
    let tmp_root = std::env::temp_dir();
    let tmp_dir = tmp_root.join(format!(
        "agenthub-sync-check-{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0)
    ));

    let cloned = run_git(
        &tmp_root,
        [
            "clone",
            "--depth",
            "1",
            "--branch",
            resolved_branch.as_str(),
            remote_url.as_str(),
            tmp_dir.to_str().unwrap_or(""),
        ],
    );

    if let Err(e) = cloned {
        let _ = fs::remove_dir_all(&tmp_dir);
        return SyncRepoValidation {
            ok: false,
            error: Some(format!("无法浅克隆远端仓库进行格式校验: {}", e)),
            initialized: false,
            format_ok: false,
            resolved_branch: Some(resolved_branch),
        };
    }

    let entries: Vec<String> = fs::read_dir(&tmp_dir)
        .map(|rd| {
            rd.filter_map(|e| e.ok())
                .filter_map(|e| e.file_name().into_string().ok())
                .collect()
        })
        .unwrap_or_default();

    let has_skills = fs::metadata(tmp_dir.join("skills"))
        .map(|m| m.is_dir())
        .unwrap_or(false);
    let has_dsh = fs::metadata(tmp_dir.join("dsh"))
        .map(|m| m.is_dir())
        .unwrap_or(false);
    let _ = fs::remove_dir_all(&tmp_dir);

    if !has_skills || !has_dsh {
        return SyncRepoValidation {
            ok: false,
            error: Some(format!(
                "仓库格式与预期不符：根目录应包含 skills/ 与 dsh/（当前: {}）",
                if entries.is_empty() {
                    "(空)".to_string()
                } else {
                    entries.join(", ")
                }
            )),
            initialized: true,
            format_ok: false,
            resolved_branch: Some(resolved_branch),
        };
    }

    SyncRepoValidation {
        ok: true,
        error: None,
        initialized: true,
        format_ok: true,
        resolved_branch: Some(resolved_branch),
    }
}

/// 校验并保存全局仓库配置；校验失败不允许保存。
#[tauri::command]
pub fn save_sync_repo(remote_url: String, branch: Option<String>) -> Result<SyncRepoConfig, String> {
    let remote_url = remote_url.trim().to_string();
    let target = branch
        .filter(|b| !b.trim().is_empty())
        .unwrap_or_else(|| "main".to_string());

    let validation = validate_sync_repo(remote_url.clone(), Some(target.clone()));
    if !validation.ok {
        return Err(validation.error.unwrap_or_else(|| "仓库校验未通过".to_string()));
    }

    ensure_local_repo(&remote_url, &target)?;

    let mut app_cfg = load_config();
    app_cfg.sync_repo = Some(SyncRepoConfig {
        remote_url: remote_url.clone(),
        branch: target.clone(),
        validated_at: chrono::Utc::now().timestamp_millis() as u64,
        last_error: None,
    });
    // 保持旧配置块中的 remote/branch 与全局一致，避免旧代码路径读到过期值
    if let Some(ss) = app_cfg.skills_sync.as_mut() {
        ss.remote_url = remote_url.clone();
        ss.branch = target.clone();
    }
    if let Some(plugins) = app_cfg.dsh_plugins.as_mut() {
        if let Some(sync) = plugins.sync.as_mut() {
            sync.remote_url = remote_url.clone();
            sync.branch = target.clone();
        }
    }
    save_config(&app_cfg)?;

    Ok(get_sync_repo_config())
}

/// 解绑全局同步仓库：清除配置与旧配置块中的远端信息，并移除本地 origin（保留 .git 与工作区）。
#[tauri::command]
pub fn unbind_sync_repo() -> Result<(), String> {
    let mut app_cfg = load_config();
    app_cfg.sync_repo = None;
    if let Some(ss) = app_cfg.skills_sync.as_mut() {
        ss.remote_url = String::new();
        ss.branch = "main".to_string();
    }
    if let Some(plugins) = app_cfg.dsh_plugins.as_mut() {
        if let Some(sync) = plugins.sync.as_mut() {
            sync.remote_url = String::new();
            sync.branch = "main".to_string();
        }
    }
    save_config(&app_cfg)?;

    let root = sync_root();
    let _ = run_git(&root, ["remote", "remove", "origin"]);
    Ok(())
}

/// 初始化/校正本地共享仓库（`%APPDATA%\AgentHub\.git` + origin + fetch 基线）。
fn ensure_local_repo(remote_url: &str, branch: &str) -> Result<(), String> {
    let root = sync_root();
    fs::create_dir_all(&root).map_err(|e| format!("无法创建同步根目录: {}", e))?;
    ensure_gitignore(&root);

    if !root.join(".git").exists() {
        if run_git(&root, ["init", "-b", branch]).is_err() {
            run_git(&root, ["init"]).map_err(|e| format!("初始化 Git 仓库失败: {}", e))?;
            let head_ref = format!("refs/heads/{}", branch);
            let _ = run_git(&root, ["symbolic-ref", "HEAD", head_ref.as_str()]);
        }
    }

    let _ = run_git(&root, ["remote", "remove", "origin"]);
    run_git(&root, ["remote", "add", "origin", remote_url])
        .map_err(|e| format!("设置远端仓库失败: {}", e))?;

    // 远端已有内容且本地尚无提交时，安全地对齐到远端分支（不删除本地未跟踪文件）
    if run_git(&root, ["fetch", "origin"]).is_ok() {
        let remote_ref = format!("origin/{}", branch);
        if run_git(&root, ["rev-parse", "--verify", remote_ref.as_str()]).is_ok() {
            let head = git_try(&root, &["rev-parse", "--verify", "HEAD"]);
            if head.trim().is_empty() {
                let head_ref = format!("refs/heads/{}", branch);
                let _ = run_git(&root, ["symbolic-ref", "HEAD", head_ref.as_str()]);
                let _ = run_git(&root, ["reset", "--mixed", remote_ref.as_str()]);
            }
        }
    }

    Ok(())
}

/// 供旧 init 命令复用的本地仓库初始化入口。
pub fn ensure_local_repo_for(remote_url: &str, branch: &str) -> Result<(), String> {
    ensure_local_repo(remote_url, branch)
}
