use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

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
        let output = Command::new("cmd")
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
            let output = Command::new("cmd")
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
