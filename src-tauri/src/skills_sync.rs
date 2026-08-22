use std::ffi::OsStr;
use std::fs;
use std::path::{Path, PathBuf};
use crate::process::spawn_cmd;

use crate::models::{SkillsSyncConfig, SkillsSyncStatus, SyncDiffEntry};
use crate::storage::{get_app_data_dir, load_config, save_config};

/// Git 仓库根目录：使用 %APPDATA%\AgentHub（而非 skills 子目录），
/// 未来可在此仓库下扩展 dsh/、mcp/ 等分类。
fn sync_root() -> PathBuf {
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
    // 已有 .gitignore 时补齐新增的私有文件条目（幂等）
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

fn run_git<I, S>(cwd: &Path, args: I) -> Result<String, String>
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    let output = spawn_cmd("git")
        .args(crate::git_sync::proxy_args())
        .args(args)
        .current_dir(cwd)
        .output()
        .map_err(|e| format!("无法执行 git 命令: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if stderr.is_empty() { stdout } else { stderr });
    }
    Ok(stdout)
}

/// 只统计指定路径范围内的未提交修改（含未跟踪文件），用于按功能隔离同步状态。
fn git_dirty_count_paths(cwd: &Path, paths: &[&str]) -> i32 {
    let mut args = vec!["status", "--porcelain", "--"];
    for p in paths {
        if cwd.join(p).exists() {
            args.push(p);
        }
    }
    if args.len() == 3 {
        return 0; // 范围内没有任何路径存在
    }
    let out = run_git(cwd, args).unwrap_or_default();
    out.lines().filter(|l| !l.trim().is_empty()).count() as i32
}

fn parse_ahead_behind(status_sb: &str) -> (i32, i32) {
    let first = status_sb.lines().next().unwrap_or("").to_string();
    if !first.starts_with("## ") {
        return (0, 0);
    }

    let mut ahead = 0;
    let mut behind = 0;
    if let Some(start) = first.find('[') {
        let bracket = &first[start..];
        if let Some(pos) = bracket.find("ahead ") {
            let rest = &bracket[pos + "ahead ".len()..];
            let num: String = rest.chars().take_while(|c| c.is_ascii_digit()).collect();
            ahead = num.parse().unwrap_or(0);
        }
        if let Some(pos) = bracket.find("behind ") {
            let rest = &bracket[pos + "behind ".len()..];
            let num: String = rest.chars().take_while(|c| c.is_ascii_digit()).collect();
            behind = num.parse().unwrap_or(0);
        }
    }

    (ahead, behind)
}

fn sync_config() -> SkillsSyncConfig {
    load_config().skills_sync.unwrap_or_default()
}

/// 与 DSH 插件同步共用同一 .git：本功能配置为空时，回退到共享仓库实际的 origin / 当前分支，
/// 再回退到另一功能的配置，避免同一仓库出现“一边已配置、一边未配置”的假象。
fn effective_remote_url(cfg: &SkillsSyncConfig) -> String {
    let global = crate::sync_repo::global_remote_url();
    if !global.is_empty() {
        return global;
    }
    if !cfg.remote_url.is_empty() {
        return cfg.remote_url.clone();
    }
    let root = sync_root();
    if root.join(".git").exists() {
        if let Ok(url) = run_git(&root, ["remote", "get-url", "origin"]) {
            let url = url.trim().to_string();
            if !url.is_empty() {
                return url;
            }
        }
    }
    load_config()
        .dsh_plugins
        .and_then(|p| p.sync)
        .map(|s| s.remote_url)
        .unwrap_or_default()
}

fn effective_branch(cfg: &SkillsSyncConfig) -> String {
    let global = crate::sync_repo::global_branch();
    if !global.is_empty() {
        return global;
    }
    if !cfg.branch.is_empty() {
        return cfg.branch.clone();
    }
    let root = sync_root();
    if root.join(".git").exists() {
        if let Ok(branch) = run_git(&root, ["rev-parse", "--abbrev-ref", "HEAD"]) {
            let branch = branch.trim().to_string();
            if !branch.is_empty() && branch != "HEAD" {
                return branch;
            }
        }
    }
    load_config()
        .dsh_plugins
        .and_then(|p| p.sync)
        .map(|s| s.branch)
        .filter(|b| !b.is_empty())
        .unwrap_or_else(|| "main".to_string())
}

fn save_sync_config(cfg: &SkillsSyncConfig) -> Result<(), String> {
    let mut app_cfg = load_config();
    app_cfg.skills_sync = Some(cfg.clone());
    save_config(&app_cfg)
}

fn update_last_sync(status: &str, error: Option<&str>) -> Result<(), String> {
    let mut cfg = sync_config();
    cfg.last_sync_status = status.to_string();
    cfg.last_sync_at = chrono::Utc::now().timestamp_millis() as u64;
    cfg.last_error = error.map(|s| s.to_string());
    save_sync_config(&cfg)
}

#[tauri::command]
pub fn get_skills_sync_status() -> SkillsSyncStatus {
    let root = sync_root();
    let cfg = sync_config();
    let initialized = root.join(".git").exists();

    let mut status = SkillsSyncStatus {
        initialized,
        remote_url: {
            let url = effective_remote_url(&cfg);
            if url.is_empty() {
                None
            } else {
                Some(url)
            }
        },
        branch: None,
        ahead: 0,
        behind: 0,
        dirty_count: 0,
        last_sync_at: if cfg.last_sync_at > 0 {
            Some(cfg.last_sync_at)
        } else {
            None
        },
        last_sync_status: cfg.last_sync_status.clone(),
        last_error: cfg.last_error.clone(),
    };

    if initialized {
        if let Ok(branch) = run_git(&root, ["rev-parse", "--abbrev-ref", "HEAD"]) {
            status.branch = Some(branch);
        }
        if let Ok(sb) = run_git(&root, ["status", "-sb", "--porcelain=v1"]) {
            let (ahead, behind) = parse_ahead_behind(&sb);
            status.ahead = ahead;
            status.behind = behind;
            // 按功能隔离：只统计技能范围内的未提交修改（与 DSH 插件同步分开）
            status.dirty_count = git_dirty_count_paths(&root, &["skills", ".gitignore"]);
        }
    }

    status
}

/// 技能范围的「本地 vs 远端」文件级差异（复用共享仓库 origin/<branch>）。
#[tauri::command]
pub fn get_skills_sync_diff() -> Vec<SyncDiffEntry> {
    let root = sync_root();
    if !root.join(".git").exists() {
        return Vec::new();
    }
    let cfg = sync_config();
    let branch = effective_branch(&cfg);
    crate::git_sync::sync_diff(&root, "skills", &branch)
}

#[tauri::command]
pub fn init_skills_sync(remote_url: String, branch: Option<String>) -> Result<SkillsSyncStatus, String> {
    let root = sync_root();
    fs::create_dir_all(&root).map_err(|e| format!("无法创建同步根目录: {}", e))?;
    ensure_gitignore(&root);

    let branch = branch
        .filter(|b| !b.trim().is_empty())
        .unwrap_or_else(|| "main".to_string());

    if !root.join(".git").exists() {
        // 优先使用 git init -b，老版本 git 不支持时回退到默认 init + symbolic-ref
        if run_git(&root, ["init", "-b", branch.as_str()]).is_err() {
            run_git(&root, ["init"]).map_err(|e| format!("初始化 Git 仓库失败: {}", e))?;
            let head_ref = format!("refs/heads/{}", branch);
            let _ = run_git(&root, ["symbolic-ref", "HEAD", head_ref.as_str()]);
        }
    }

    let _ = run_git(&root, ["remote", "remove", "origin"]);
    run_git(&root, ["remote", "add", "origin", remote_url.as_str()])
        .map_err(|e| format!("设置远端仓库失败: {}", e))?;

    // 远端已有内容且本地尚无提交时，安全地对齐到远端分支（不删除本地未跟踪文件）
    if run_git(&root, ["fetch", "origin"]).is_ok() {
        let remote_ref = format!("origin/{}", branch);
        if run_git(&root, ["rev-parse", "--verify", remote_ref.as_str()]).is_ok() {
            let head = run_git(&root, ["rev-parse", "--verify", "HEAD"]).unwrap_or_default();
            if head.is_empty() {
                let head_ref = format!("refs/heads/{}", branch);
                let _ = run_git(&root, ["symbolic-ref", "HEAD", head_ref.as_str()]);
                let _ = run_git(&root, ["reset", "--mixed", remote_ref.as_str()]);
            }
        }
    }

    let mut cfg = sync_config();
    cfg.remote_url = remote_url;
    cfg.branch = branch;
    cfg.last_sync_status = "idle".to_string();
    cfg.last_error = None;
    save_sync_config(&cfg)?;

    Ok(get_skills_sync_status())
}

#[tauri::command]
pub fn pull_skills_sync() -> Result<SkillsSyncStatus, String> {
    let root = sync_root();
    let cfg = sync_config();

    if !root.join(".git").exists() {
        return Err("尚未初始化同步仓库，请先在同步中心初始化".to_string());
    }
    if effective_remote_url(&cfg).is_empty() {
        return Err("尚未配置远端仓库地址".to_string());
    }

    let dirty = git_dirty_count_paths(&root, &["skills", ".gitignore"]);
    if dirty > 0 {
        let msg = format!("技能同步：本地有 {} 个未提交修改（skills/.gitignore），已跳过拉取；请先推送或手动处理", dirty);
        let _ = update_last_sync("error", Some(&msg));
        return Err(msg);
    }

    let branch = effective_branch(&cfg);
    match run_git(&root, ["pull", "--ff-only", "origin", branch.as_str()]) {
        Ok(_) => {
            update_last_sync("success", None)?;
            Ok(get_skills_sync_status())
        }
        Err(e) => {
            let msg = format!("拉取失败: {}", e);
            let _ = update_last_sync("error", Some(&msg));
            Err(msg)
        }
    }
}

#[tauri::command]
pub fn push_skills_sync(message: Option<String>) -> Result<SkillsSyncStatus, String> {
    let root = sync_root();
    let cfg = sync_config();

    if !root.join(".git").exists() {
        return Err("尚未初始化同步仓库，请先在同步中心初始化".to_string());
    }
    if effective_remote_url(&cfg).is_empty() {
        return Err("尚未配置远端仓库地址".to_string());
    }

    // 按功能隔离：只暂存技能相关路径（skills/ 与共享的 .gitignore），不把 dsh/ 等其他功能改动卷进技能提交
    let mut add_args: Vec<&str> = vec!["add", "-A", "--"];
    if root.join("skills").exists() {
        add_args.push("skills");
    }
    if root.join(".gitignore").exists() {
        add_args.push(".gitignore");
    }
    if add_args.len() > 3 {
        run_git(&root, add_args).map_err(|e| format!("暂存中央库改动失败: {}", e))?;
    }

    let staged = run_git(&root, ["diff", "--cached", "--name-only"]).unwrap_or_default();
    if !staged.trim().is_empty() {
        let msg = message
            .filter(|m| !m.trim().is_empty())
            .unwrap_or_else(|| {
                format!(
                    "sync central skills [{}]",
                    chrono::Local::now().format("%Y-%m-%d %H:%M:%S")
                )
            });
        run_git(&root, ["commit", "-m", msg.as_str()])
            .map_err(|e| format!("提交中央库改动失败: {}", e))?;
    }

    let branch = effective_branch(&cfg);
    if let Err(e) = run_git(&root, ["push", "-u", "origin", branch.as_str()]) {
        let msg = format!("推送失败: {}", e);
        let _ = update_last_sync("error", Some(&msg));
        return Err(msg);
    }

    update_last_sync("success", None)?;
    Ok(get_skills_sync_status())
}

#[tauri::command]
pub fn set_skills_sync_auto_pull(enabled: bool) -> Result<(), String> {
    let mut cfg = sync_config();
    cfg.auto_pull_on_startup = enabled;
    save_sync_config(&cfg)
}

#[tauri::command]
pub fn test_skills_sync_connection() -> Result<String, String> {
    let root = sync_root();
    let cfg = sync_config();

    if !root.join(".git").exists() {
        return Err("尚未初始化同步仓库，请先初始化".to_string());
    }
    if effective_remote_url(&cfg).is_empty() {
        return Err("尚未配置远端仓库地址".to_string());
    }

    let branch = effective_branch(&cfg);
    let refspec = format!("refs/heads/{}", branch);
    let out = run_git(&root, ["ls-remote", "origin", refspec.as_str()])
        .map_err(|e| format!("连接失败: {}", e))?;

    if out.trim().is_empty() {
        return Err(format!("远端分支 {} 不存在或仓库为空", branch));
    }
    let head = out
        .lines()
        .next()
        .and_then(|l| l.split_whitespace().next())
        .unwrap_or("");
    Ok(format!("连接成功，远端 {} 分支 HEAD: {}", branch, head))
}

#[tauri::command]
pub fn reset_skills_sync_to_remote() -> Result<SkillsSyncStatus, String> {
    let root = sync_root();
    let cfg = sync_config();

    if !root.join(".git").exists() {
        return Err("尚未初始化同步仓库，请先初始化".to_string());
    }
    if effective_remote_url(&cfg).is_empty() {
        return Err("尚未配置远端仓库地址".to_string());
    }

    let branch = effective_branch(&cfg);
    run_git(&root, ["fetch", "origin", branch.as_str()]).map_err(|e| format!("拉取远端失败: {}", e))?;

    let remote_ref = format!("origin/{}", branch);
    if run_git(&root, ["rev-parse", "--verify", remote_ref.as_str()]).is_err() {
        return Err(format!("远端分支 {} 不存在或仓库为空", branch));
    }

    // 以远端为准，但按功能隔离：仅移动 HEAD 并重置 skills/ 与 .gitignore，
    // 不碰 dsh/ 等同一仓库内其他功能的未提交修改（git reset --mixed 不动工作区）。
    run_git(&root, ["reset", "--mixed", remote_ref.as_str()])
        .map_err(|e| format!("重置本地失败: {}", e))?;

    let mut checkout_args = vec!["checkout", "--"];
    let skills_exists_in_remote = run_git(
        &root,
        ["ls-tree", "--name-only", remote_ref.as_str(), "skills"],
    )
    .map(|out| !out.trim().is_empty())
    .unwrap_or(false);
    if root.join("skills").exists() || skills_exists_in_remote {
        checkout_args.push("skills");
    }
    if root.join(".gitignore").exists() {
        checkout_args.push(".gitignore");
    }
    if checkout_args.len() > 2 {
        let _ = run_git(&root, checkout_args);
    }

    update_last_sync("success", None)?;
    Ok(get_skills_sync_status())
}
