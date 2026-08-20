use std::ffi::OsStr;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use crate::models::{SkillsSyncConfig, SkillsSyncStatus};
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
backups/
*.log
.DS_Store
Thumbs.db
";

fn ensure_gitignore(root: &Path) {
    let gitignore = root.join(".gitignore");
    if !gitignore.exists() {
        let _ = fs::write(&gitignore, GITIGNORE_CONTENT);
    }
}

fn run_git<I, S>(cwd: &Path, args: I) -> Result<String, String>
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    let output = Command::new("git")
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

fn git_dirty_count(cwd: &Path) -> i32 {
    let out = run_git(cwd, ["status", "--porcelain"]).unwrap_or_default();
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
        remote_url: if cfg.remote_url.is_empty() {
            None
        } else {
            Some(cfg.remote_url.clone())
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
            let lines: Vec<&str> = sb.lines().filter(|l| !l.trim().is_empty()).collect();
            status.dirty_count = if sb.starts_with("## ") {
                lines.len().saturating_sub(1) as i32
            } else {
                lines.len() as i32
            };
        }
    }

    status
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
    if cfg.remote_url.is_empty() {
        return Err("尚未配置远端仓库地址".to_string());
    }

    let dirty = git_dirty_count(&root);
    if dirty > 0 {
        let msg = format!("本地有 {} 个未提交修改，已跳过拉取；请先推送或手动处理", dirty);
        let _ = update_last_sync("error", Some(&msg));
        return Err(msg);
    }

    let branch = if cfg.branch.is_empty() { "main" } else { cfg.branch.as_str() };
    match run_git(&root, ["pull", "--ff-only", "origin", branch]) {
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
    if cfg.remote_url.is_empty() {
        return Err("尚未配置远端仓库地址".to_string());
    }

    run_git(&root, ["add", "-A"]).map_err(|e| format!("暂存中央库改动失败: {}", e))?;

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

    let branch = if cfg.branch.is_empty() { "main" } else { cfg.branch.as_str() };
    if let Err(e) = run_git(&root, ["push", "-u", "origin", branch]) {
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
