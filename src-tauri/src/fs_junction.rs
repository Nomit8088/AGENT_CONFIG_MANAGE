use std::fs;
use std::path::{Path, PathBuf};
use crate::process::spawn_cmd;

pub fn expand_tilde(path_str: &str) -> PathBuf {
    if path_str.starts_with("~/") || path_str.starts_with("~\\") || path_str == "~" {
        if let Some(home) = dirs::home_dir() {
            if path_str.len() > 2 {
                return home.join(&path_str[2..]);
            }
            return home;
        }
    }
    PathBuf::from(path_str)
}

pub fn is_junction_or_symlink(path: &Path) -> bool {
    if let Ok(meta) = fs::symlink_metadata(path) {
        if meta.file_type().is_symlink() {
            return true;
        }
        #[cfg(windows)]
        {
            use std::os::windows::fs::MetadataExt;
            const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x400;
            if (meta.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT) != 0 {
                return true;
            }
        }
    }
    false
}

pub fn create_junction(link_path: &Path, target_path: &Path) -> Result<(), String> {
    let _ = remove_junction(link_path);

    if let Some(parent) = link_path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("无法创建父目录 {:?}: {}", parent, e))?;
    }

    #[cfg(windows)]
    {
        // On Windows, mklink /J creates NTFS Junction point without requiring elevation/Developer Mode
        let output = spawn_cmd("cmd")
            .args(&[
                "/c",
                "mklink",
                "/J",
                &link_path.to_string_lossy(),
                &target_path.to_string_lossy(),
            ])
            .output()
            .map_err(|e| format!("执行 mklink /J 失败: {}", e))?;

        if !output.status.success() {
            // Fallback to hardlink tree if mklink fails
            if let Err(e) = create_hardlink_dir_all(target_path, link_path) {
                let stderr = String::from_utf8_lossy(&output.stderr);
                let stdout = String::from_utf8_lossy(&output.stdout);
                return Err(format!("创建软链失败: {} {} (硬链回退失败: {})", stdout, stderr, e));
            }
        }
        Ok(())
    }

    #[cfg(not(windows))]
    {
        use std::os::unix::fs::symlink;
        if symlink(target_path, link_path).is_err() {
            create_hardlink_dir_all(target_path, link_path).map_err(|e| e.to_string())?;
        }
        Ok(())
    }
}

pub fn remove_junction(link_path: &Path) -> Result<(), String> {
    let meta = match fs::symlink_metadata(link_path) {
        Ok(m) => m,
        Err(_) => return Ok(()),
    };

    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x400;
        if meta.file_type().is_symlink() || (meta.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT) != 0 {
            let output = spawn_cmd("cmd")
                .args(&["/c", "rmdir", &link_path.to_string_lossy()])
                .output();

            if output.is_err() || !output.as_ref().unwrap().status.success() {
                let _ = fs::remove_dir(link_path);
            }
            return Ok(());
        }
        if meta.is_dir() {
            fs::remove_dir_all(link_path).map_err(|e| format!("删除目录失败: {}", e))?;
        } else {
            fs::remove_file(link_path).map_err(|e| format!("删除文件失败: {}", e))?;
        }
        Ok(())
    }

    #[cfg(not(windows))]
    {
        if meta.is_dir() && !meta.file_type().is_symlink() {
            fs::remove_dir_all(link_path).map_err(|e| format!("删除目录失败: {}", e))
        } else {
            fs::remove_file(link_path).map_err(|e| format!("删除软链失败: {}", e))
        }
    }
}

pub fn copy_dir_all(src: &Path, dst: &Path) -> std::io::Result<()> {
    fs::create_dir_all(dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        if ty.is_dir() {
            copy_dir_all(&entry.path(), &dst.join(entry.file_name()))?;
        } else {
            fs::copy(entry.path(), dst.join(entry.file_name()))?;
        }
    }
    Ok(())
}

pub fn create_hardlink_dir_all(src: &Path, dst: &Path) -> std::io::Result<()> {
    fs::create_dir_all(dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());
        if ty.is_dir() {
            create_hardlink_dir_all(&src_path, &dst_path)?;
        } else {
            if dst_path.exists() {
                let _ = fs::remove_file(&dst_path);
            }
            if fs::hard_link(&src_path, &dst_path).is_err() {
                // Fallback to copy if hardlink fails
                fs::copy(&src_path, &dst_path)?;
            }
        }
    }
    Ok(())
}

/// 链接策略（能力枚举 × 平台 → 具体操作 + fallback 链）。见 PLAN_WI011_MULTI_PLATFORM.md §4.2.2。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LinkStrategy {
    /// 默认：Windows junction / Unix symlink → 回退 hardlink-tree → 回退 copy。
    Default,
    /// antigravity：三平台 hardlink-tree（物理目录 + 文件硬链）→ 回退 copy。
    HardlinkTree,
    /// 预留：copy（当前无 Agent 使用）。
    Copy,
}

/// Agent 能力枚举 → 链接策略（当前唯一特例：antigravity 走 hardlink-tree）。
pub fn link_strategy_for(agent_id: &str) -> LinkStrategy {
    match agent_id {
        "antigravity" => LinkStrategy::HardlinkTree,
        _ => LinkStrategy::Default,
    }
}

/// 是否走 hardlink-tree（不产生 junction/symlink）。
pub fn uses_hardlink_tree(agent_id: &str) -> bool {
    matches!(link_strategy_for(agent_id), LinkStrategy::HardlinkTree)
}

/// 按 Agent 链接策略把中央技能挂载到目标目录（双端对齐的挂载入口）。
pub fn mount_skill(agent_id: &str, central: &Path, target: &Path) -> Result<(), String> {
    let _ = remove_junction(target);
    match link_strategy_for(agent_id) {
        LinkStrategy::HardlinkTree => create_hardlink_dir_all(central, target).map_err(|e| e.to_string()),
        LinkStrategy::Copy => copy_dir_all(central, target).map_err(|e| e.to_string()),
        LinkStrategy::Default => create_junction(target, central),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn link_strategy_matrix() {
        // B-M2.2 对拍锚点：策略矩阵决策必须与 Node 端 src/shared/linkStrategy.ts 完全一致。
        assert_eq!(link_strategy_for("antigravity"), LinkStrategy::HardlinkTree);
        assert_eq!(link_strategy_for("claude-code"), LinkStrategy::Default);
        assert_eq!(link_strategy_for("cursor"), LinkStrategy::Default);
        assert_eq!(link_strategy_for("windsurf"), LinkStrategy::Default);
        assert_eq!(link_strategy_for("zcode"), LinkStrategy::Default);
        assert_eq!(link_strategy_for("trae"), LinkStrategy::Default);
        assert_eq!(link_strategy_for(""), LinkStrategy::Default);

        assert!(uses_hardlink_tree("antigravity"));
        assert!(!uses_hardlink_tree("cursor"));
        assert!(!uses_hardlink_tree(""));
    }
}
