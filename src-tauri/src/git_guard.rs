use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

pub struct GitStatus {
    pub is_git: bool,
    pub branch: Option<String>,
    pub hooks_active: bool,
}

pub fn check_git_status(project_path: &Path) -> GitStatus {
    let git_dir = project_path.join(".git");
    if !git_dir.exists() {
        return GitStatus {
            is_git: false,
            branch: None,
            hooks_active: false,
        };
    }

    let branch = {
        let output = Command::new("git")
            .args(&["rev-parse", "--abbrev-ref", "HEAD"])
            .current_dir(project_path)
            .output();
        if let Ok(out) = output {
            if out.status.success() {
                let name = String::from_utf8_lossy(&out.stdout).trim().to_string();
                if !name.is_empty() {
                    Some(name)
                } else {
                    None
                }
            } else {
                None
            }
        } else {
            None
        }
    };

    let hook_path = git_dir.join("hooks").join("pre-checkout");
    let hooks_active = hook_path.exists();

    GitStatus {
        is_git: true,
        branch,
        hooks_active,
    }
}

pub fn add_to_git_exclude(project_path: &Path, filenames: &[&str]) -> Result<(), String> {
    let git_dir = project_path.join(".git");
    if !git_dir.exists() {
        return Ok(());
    }

    let exclude_dir = git_dir.join("info");
    fs::create_dir_all(&exclude_dir).map_err(|e| format!("创建 .git/info 失败: {}", e))?;

    let exclude_file = exclude_dir.join("exclude");
    let current_content = if exclude_file.exists() {
        fs::read_to_string(&exclude_file).unwrap_or_default()
    } else {
        String::new()
    };

    let mut lines: Vec<String> = current_content.lines().map(|s| s.to_string()).collect();
    let mut modified = false;

    for fname in filenames {
        let trimmed = fname.trim();
        if !trimmed.is_empty() && !lines.iter().any(|l| l.trim() == trimmed) {
            lines.push(trimmed.to_string());
            modified = true;
        }
    }

    if modified {
        let new_content = lines.join("\n") + "\n";
        fs::write(&exclude_file, new_content).map_err(|e| format!("写入 .git/info/exclude 失败: {}", e))?;
    }

    Ok(())
}

pub fn install_git_hooks(project_path: &Path, backup_dir: &Path, custom_rule_path: &Path) -> Result<(), String> {
    let git_dir = project_path.join(".git");
    if !git_dir.exists() {
        return Ok(());
    }

    let hooks_dir = git_dir.join("hooks");
    fs::create_dir_all(&hooks_dir).map_err(|e| format!("创建 .git/hooks 失败: {}", e))?;

    let orig_backup = git_dir.join("info").join("AGENTS.orig");
    let agents_md = project_path.join("AGENTS.md");

    // Ensure initial orig backup exists if AGENTS.md exists
    if agents_md.exists() && !orig_backup.exists() {
        let _ = fs::copy(&agents_md, &orig_backup);
        let _ = fs::copy(&agents_md, backup_dir.join("AGENTS.md.orig"));
    }

    // Generate hook scripts (POSIX sh for Git on Windows/Linux/macOS)
    let pre_checkout_script = r#"#!/bin/sh
# AgentHub Git Hook Guard: Pre-Checkout
# Restore original AGENTS.md before git switches branch to avoid merge conflicts
ORIG=".git/info/AGENTS.orig"
if [ -f "$ORIG" ]; then
    cp "$ORIG" "AGENTS.md" 2>/dev/null || true
fi
exit 0
"#;

    let post_checkout_script = format!(
        r#"#!/bin/sh
# AgentHub Git Hook Guard: Post-Checkout
# Re-apply custom AGENTS.md after git switched branch
CUSTOM="{}"
if [ -f "$CUSTOM" ]; then
    cp "$CUSTOM" "AGENTS.md" 2>/dev/null || true
fi
exit 0
"#,
        custom_rule_path.to_string_lossy().replace('\\', "/")
    );

    let pre_checkout_path = hooks_dir.join("pre-checkout");
    let post_checkout_path = hooks_dir.join("post-checkout");

    fs::write(&pre_checkout_path, pre_checkout_script)
        .map_err(|e| format!("写入 pre-checkout hook 失败: {}", e))?;
    fs::write(&post_checkout_path, &post_checkout_script)
        .map_err(|e| format!("写入 post-checkout hook 失败: {}", e))?;

    Ok(())
}

pub fn uninstall_git_hooks(project_path: &Path) -> Result<(), String> {
    let git_dir = project_path.join(".git");
    if !git_dir.exists() {
        return Ok(());
    }

    let hooks_dir = git_dir.join("hooks");
    let pre_checkout = hooks_dir.join("pre-checkout");
    let post_checkout = hooks_dir.join("post-checkout");

    if pre_checkout.exists() {
        let _ = fs::remove_file(pre_checkout);
    }
    if post_checkout.exists() {
        let _ = fs::remove_file(post_checkout);
    }

    // Restore original AGENTS.md if orig exists
    let orig_backup = git_dir.join("info").join("AGENTS.orig");
    let agents_md = project_path.join("AGENTS.md");
    if orig_backup.exists() {
        let _ = fs::copy(&orig_backup, &agents_md);
        let _ = fs::remove_file(orig_backup);
    }

    Ok(())
}
