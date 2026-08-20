use std::fs;
use std::path::Path;
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

pub const BASELINE_RULE_FILES: &[&str] = &[
    "AGENTS.md",
    "CLAUDE.md",
    ".cursorrules",
    ".windsurfrules",
    "GEMINI.md",
];

pub const PRIVATE_RULE_FILES: &[&str] = &[
    "CLAUDE.local.md",
    ".agents/rules/local-override.md",
    "AGENTS.override.md",
    "ZCODE.local.md",
    "AGENTS.local.md",
    ".cursor/rules/local-override.mdc",
    "WINDSURF.local.md",
    ".omo/rules/local.md",
    ".github/copilot-instructions.local.md",
    "GEMINI.local.md",
];

pub fn clean_all_private_rules(project_path: &Path) {
    for rel_path in PRIVATE_RULE_FILES {
        let full_path = project_path.join(rel_path);
        if full_path.exists() {
            let _ = fs::remove_file(&full_path);
            if let Some(parent) = full_path.parent() {
                if parent != project_path {
                    if let Ok(entries) = fs::read_dir(parent) {
                        if entries.count() == 0 {
                            let _ = fs::remove_dir(parent);
                        }
                    }
                }
            }
        }
    }
}

pub fn restore_all_baselines(project_path: &Path, backup_dir: Option<&Path>) {
    let git_dir = project_path.join(".git");
    let has_git = git_dir.exists();

    for baseline in BASELINE_RULE_FILES {
        let target_file = project_path.join(baseline);
        let git_orig = if has_git {
            Some(git_dir.join("info").join(format!("{}.orig", baseline)))
        } else {
            None
        };
        let backup_orig = backup_dir.map(|b| b.join(format!("{}.orig", baseline)));

        let mut restored = false;
        if let Some(ref go) = git_orig {
            if go.exists() {
                if fs::copy(go, &target_file).is_ok() {
                    let _ = fs::remove_file(go);
                    restored = true;
                }
            }
        }

        if !restored {
            if let Some(ref bo) = backup_orig {
                if bo.exists() {
                    let _ = fs::copy(bo, &target_file);
                    restored = true;
                }
            }
        }

        if !restored {
            if let Some(bd) = backup_dir {
                let marker_no_orig = bd.join(format!("{}.no_orig", baseline));
                if marker_no_orig.exists() && target_file.exists() {
                    let _ = fs::remove_file(&target_file);
                }
            }
        }
    }
}

pub fn install_git_hooks(
    project_path: &Path,
    backup_dir: &Path,
    custom_rule_path: &Path,
    enable_pre_commit: bool,
    targets_to_protect: &[&str],
) -> Result<(), String> {
    let git_dir = project_path.join(".git");
    if !git_dir.exists() {
        return Ok(());
    }

    let hooks_dir = git_dir.join("hooks");
    fs::create_dir_all(&hooks_dir).map_err(|e| format!("创建 .git/hooks 失败: {}", e))?;

    let info_dir = git_dir.join("info");
    fs::create_dir_all(&info_dir).map_err(|e| format!("创建 .git/info 失败: {}", e))?;

    // Backup baselines
    for target in targets_to_protect {
        let file = project_path.join(target);
        let orig_git = info_dir.join(format!("{}.orig", target));
        let orig_backup = backup_dir.join(format!("{}.orig", target));
        let no_orig_marker = backup_dir.join(format!("{}.no_orig", target));

        if file.exists() {
            if !orig_git.exists() {
                let _ = fs::copy(&file, &orig_git);
            }
            if !orig_backup.exists() {
                let _ = fs::copy(&file, &orig_backup);
            }
        } else if !orig_backup.exists() {
            let _ = fs::write(&no_orig_marker, "no_original");
        }
    }

    let targets_list_str = targets_to_protect
        .iter()
        .map(|t| format!("\"{}\"", t))
        .collect::<Vec<_>>()
        .join(" ");

    let pre_checkout_script = format!(
        r#"#!/bin/sh
# AgentHub Git Hook Guard: Pre-Checkout (Multi-Baseline)
# Restore all original baseline files before git switches branch to avoid merge conflicts
for f in {}; do
    ORIG=".git/info/${{f}}.orig"
    if [ -f "$ORIG" ]; then
        cp "$ORIG" "$f" 2>/dev/null || true
    fi
done
exit 0
"#,
        targets_list_str
    );

    let post_checkout_script = format!(
        r#"#!/bin/sh
# AgentHub Git Hook Guard: Post-Checkout (Multi-Baseline)
# Re-apply custom rules to overwritten baselines after git switched branch
CUSTOM="{}"
if [ -f "$CUSTOM" ]; then
    for f in {}; do
        ORIG=".git/info/${{f}}.orig"
        if [ -f "$ORIG" ] || [ -f ".git/info/${{f}}.no_orig" ]; then
            cp "$CUSTOM" "$f" 2>/dev/null || true
        fi
    done
fi
exit 0
"#,
        custom_rule_path.to_string_lossy().replace('\\', "/"),
        targets_list_str
    );

    let pre_commit_script = format!(
        r#"#!/bin/sh
# AgentHub Git Hook Guard: Pre-Commit Protection (Multi-Baseline)
# Prevents accidentally committing any overwritten baseline files to team git repo
for f in {}; do
    ORIG=".git/info/${{f}}.orig"
    if [ -f "$ORIG" ] || [ -f ".git/info/${{f}}.no_orig" ]; then
        if git diff --cached --name-only | grep -q "^${{f}}$"; then
            printf "\033[1;33m[AgentHub 守卫提示]\033[0m 检测到处于【覆盖模式】，已自动拦截对本地 %s 的提交。\n" "$f"
            printf "\033[1;33m[AgentHub 守卫提示]\033[0m 为防止本地个性化规则污染团队仓库，请在 AgentHub 中切换为「追加模式」或暂时关闭定制后再提交。\n"
            exit 1
        fi
    fi
done
exit 0
"#,
        targets_list_str
    );

    let pre_checkout_path = hooks_dir.join("pre-checkout");
    let post_checkout_path = hooks_dir.join("post-checkout");
    let pre_commit_path = hooks_dir.join("pre-commit");

    fs::write(&pre_checkout_path, pre_checkout_script)
        .map_err(|e| format!("写入 pre-checkout hook 失败: {}", e))?;
    fs::write(&post_checkout_path, &post_checkout_script)
        .map_err(|e| format!("写入 post-checkout hook 失败: {}", e))?;

    if enable_pre_commit {
        fs::write(&pre_commit_path, pre_commit_script)
            .map_err(|e| format!("写入 pre-commit hook 失败: {}", e))?;
    } else if pre_commit_path.exists() {
        let _ = fs::remove_file(pre_commit_path);
    }

    Ok(())
}

pub fn uninstall_git_hooks(project_path: &Path, backup_dir: Option<&Path>) -> Result<(), String> {
    let git_dir = project_path.join(".git");
    if !git_dir.exists() {
        restore_all_baselines(project_path, backup_dir);
        return Ok(());
    }

    let hooks_dir = git_dir.join("hooks");
    let pre_checkout = hooks_dir.join("pre-checkout");
    let post_checkout = hooks_dir.join("post-checkout");
    let pre_commit = hooks_dir.join("pre-commit");

    if pre_checkout.exists() {
        let _ = fs::remove_file(pre_checkout);
    }
    if post_checkout.exists() {
        let _ = fs::remove_file(post_checkout);
    }
    if pre_commit.exists() {
        let _ = fs::remove_file(pre_commit);
    }

    restore_all_baselines(project_path, backup_dir);

    Ok(())
}
