//! 应用本体在线更新（cc-switch 风格）：
//! 检查 GitHub Releases 最新版本 → 下载安装包（实时进度）→ 启动安装程序并退出应用。
//!
//! 说明：采用「GitHub Releases API + 安装包直装」的轻量自更新方案，无需 Tauri Updater
//! 的签名私钥 / pubkey / latest.json 链路，安装包由 `release.yml`（tauri-action）在打 tag
//! 时自动产出 NSIS `.exe` 与 MSI `.msi`。
//!
//! 双端对齐：Web 开发模式对应 `src/server/appUpdate.ts`，路由 `/api/app/update/*`。

use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

use crate::models::{AppUpdateCheck, AppUpdateDownload};
use crate::storage::get_app_data_dir;

/// 更新源仓库（owner/repo），与 GitHub Release 工作流保持一致。
const UPDATE_REPO: &str = "Nomit8088/AGENT_CONFIG_MANAGE";
const USER_AGENT: &str = "AgentHub";

fn update_api_url() -> String {
    format!("https://api.github.com/repos/{}/releases/latest", UPDATE_REPO)
}

fn current_version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

fn build_agent() -> ureq::Agent {
    let builder = ureq::AgentBuilder::new()
        .timeout(std::time::Duration::from_secs(60))
        .redirects(5)
        .user_agent(USER_AGENT);

    if let Some(proxy) = crate::git_sync::system_proxy() {
        if let Ok(p) = ureq::Proxy::new(proxy) {
            return builder.proxy(p).build();
        }
    }
    builder.build()
}

fn fetch_latest_release(agent: &ureq::Agent) -> Result<serde_json::Value, String> {
    let resp = agent
        .get(&update_api_url())
        .set("Accept", "application/vnd.github+json")
        .call()
        .map_err(|e| format!("请求 GitHub Releases 失败: {}", e))?;

    if resp.status() != 200 {
        return Err(format!("GitHub Releases 返回 HTTP {}", resp.status()));
    }

    let body = resp.into_string().map_err(|e| format!("读取响应失败: {}", e))?;
    serde_json::from_str(&body).map_err(|e| format!("解析 GitHub 响应失败: {}", e))
}

fn release_tag(release: &serde_json::Value) -> String {
    release
        .get("tag_name")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .trim_start_matches('v')
        .to_string()
}

/// 候选安装包扩展名（Windows 优先 NSIS .exe，其次 .msi）。
fn candidate_extensions() -> Vec<&'static str> {
    if cfg!(windows) {
        vec![".exe", ".msi"]
    } else if cfg!(target_os = "macos") {
        vec![".dmg", ".app.tar.gz"]
    } else {
        vec![".deb", ".AppImage", ".rpm"]
    }
}

fn pick_asset(release: &serde_json::Value) -> Option<(String, String, u64)> {
    let assets = release.get("assets")?.as_array()?;
    for ext in candidate_extensions() {
        if let Some(a) = assets.iter().find(|a| {
            a.get("name")
                .and_then(|n| n.as_str())
                .map(|n| n.to_ascii_lowercase().ends_with(ext))
                .unwrap_or(false)
        }) {
            let name = a
                .get("name")
                .and_then(|n| n.as_str())
                .unwrap_or("")
                .to_string();
            let url = a
                .get("browser_download_url")
                .and_then(|u| u.as_str())
                .unwrap_or("")
                .to_string();
            let size = a.get("size").and_then(|s| s.as_u64()).unwrap_or(0);
            if !name.is_empty() && !url.is_empty() {
                return Some((name, url, size));
            }
        }
    }
    None
}

fn version_parts(v: &str) -> Vec<u64> {
    v.trim()
        .trim_start_matches('v')
        .split(|c: char| !c.is_ascii_digit())
        .filter(|p| !p.is_empty())
        .map(|p| p.parse::<u64>().unwrap_or(0))
        .collect()
}

fn version_newer(latest: &str, current: &str) -> bool {
    let a = version_parts(latest);
    let b = version_parts(current);
    for i in 0..a.len().max(b.len()) {
        let av = a.get(i).copied().unwrap_or(0);
        let bv = b.get(i).copied().unwrap_or(0);
        if av != bv {
            return av > bv;
        }
    }
    false
}

fn check_inner() -> AppUpdateCheck {
    let current = current_version().to_string();
    let agent = build_agent();
    match fetch_latest_release(&agent) {
        Ok(release) => {
            let latest = release_tag(&release);
            let asset = pick_asset(&release);
            let update_available = !latest.is_empty() && version_newer(&latest, &current);
            AppUpdateCheck {
                current_version: current.clone(),
                latest_version: if latest.is_empty() { current } else { latest },
                update_available,
                release_notes: release
                    .get("body")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string(),
                published_at: release
                    .get("published_at")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                download_url: asset.as_ref().map(|a| a.1.clone()),
                asset_name: asset.as_ref().map(|a| a.0.clone()),
                asset_size: asset.as_ref().map(|a| a.2).unwrap_or(0),
                error: None,
            }
        }
        Err(e) => AppUpdateCheck {
            current_version: current,
            latest_version: String::new(),
            update_available: false,
            release_notes: String::new(),
            published_at: None,
            download_url: None,
            asset_name: None,
            asset_size: 0,
            error: Some(e),
        },
    }
}

#[tauri::command]
pub async fn check_app_update() -> AppUpdateCheck {
    crate::log_info!("update", "检查应用更新…");
    let result = tauri::async_runtime::spawn_blocking(check_inner)
        .await
        .unwrap_or_else(|_| AppUpdateCheck {
            current_version: current_version().to_string(),
            latest_version: String::new(),
            update_available: false,
            release_notes: String::new(),
            published_at: None,
            download_url: None,
            asset_name: None,
            asset_size: 0,
            error: Some("检查更新执行失败".to_string()),
        });
    if result.update_available {
        crate::log_info!("update", "发现新版本: {} -> {}", result.current_version, result.latest_version);
    } else if result.error.is_some() {
        crate::log_warn!("update", "检查更新出错: {}", result.error.as_deref().unwrap_or(""));
    }
    result
}

fn download_to_file(
    agent: &ureq::Agent,
    url: &str,
    dest: &Path,
    on_progress: &mut dyn FnMut(u64, u64),
) -> Result<(), String> {
    let resp = agent
        .get(url)
        .call()
        .map_err(|e| format!("下载失败: {}", e))?;

    if resp.status() != 200 {
        return Err(format!("下载返回 HTTP {}", resp.status()));
    }

    let total = resp
        .header("Content-Length")
        .and_then(|v| v.parse::<u64>().ok())
        .unwrap_or(0);

    let mut reader = resp.into_reader();
    let mut file = fs::File::create(dest).map_err(|e| format!("创建下载文件失败: {}", e))?;
    let mut buf = [0u8; 64 * 1024];
    let mut downloaded = 0u64;

    loop {
        let n = reader.read(&mut buf).map_err(|e| format!("读取下载流失败: {}", e))?;
        if n == 0 {
            break;
        }
        file.write_all(&buf[..n]).map_err(|e| format!("写入下载文件失败: {}", e))?;
        downloaded += n as u64;
        on_progress(downloaded, total);
    }
    file.flush().map_err(|e| format!("刷新下载文件失败: {}", e))?;
    Ok(())
}

fn download_inner(on_progress: &mut dyn FnMut(u64, u64)) -> Result<AppUpdateDownload, String> {
    let agent = build_agent();
    let release = fetch_latest_release(&agent)?;
    let (name, url, size) = pick_asset(&release).ok_or("未找到可下载的安装包资产")?;

    let dir = get_app_data_dir().join("updates");
    fs::create_dir_all(&dir).map_err(|e| format!("创建更新目录失败: {}", e))?;
    let dest = dir.join(&name);

    download_to_file(&agent, &url, &dest, on_progress)?;

    Ok(AppUpdateDownload {
        ok: true,
        path: Some(dest.to_string_lossy().to_string()),
        file_name: Some(name),
        size,
        error: None,
    })
}

#[tauri::command]
pub async fn download_app_update(
    on_event: tauri::ipc::Channel<String>,
) -> Result<AppUpdateDownload, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut on_progress = |downloaded: u64, total: u64| {
            let percent = if total > 0 { (downloaded * 100 / total) as u64 } else { 0 };
            let line = serde_json::json!({
                "type": "progress",
                "downloaded": downloaded,
                "total": total,
                "percent": percent,
            })
            .to_string();
            let _ = on_event.send(line);
        };
        download_inner(&mut on_progress)
    })
    .await
    .map_err(|e| format!("下载执行失败: {}", e))?
}

#[cfg(windows)]
fn launch_installer(path: &Path) -> Result<(), String> {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();

    let path_str = path.to_string_lossy().to_string();
    if ext == "msi" {
        // MSI：静默安装 + 不自动重启
        std::process::Command::new("msiexec")
            .arg("/i")
            .arg(&path_str)
            .arg("/qn")
            .arg("/norestart")
            .spawn()
            .map_err(|e| format!("无法启动 MSI 安装: {}", e))?;
    } else {
        // NSIS 安装包：/S 静默安装（仍会触发 UAC 提权）
        std::process::Command::new(&path_str)
            .arg("/S")
            .spawn()
            .map_err(|e| format!("无法启动安装程序: {}", e))?;
    }
    Ok(())
}

#[cfg(target_os = "macos")]
fn launch_installer(path: &Path) -> Result<(), String> {
    use std::process::Command;

    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();

    // 得到待安装的 .app：dmg 挂载复制 / tar.gz 解压 / 直接 .app 目录
    let app = if ext == "dmg" {
        mount_and_copy_dmg(path)?
    } else if path.is_dir() {
        path.to_path_buf()
    } else {
        extract_app_archive(path)?
    };

    // 未签名产物去 quarantine（与 C2 一致）
    let _ = Command::new("xattr")
        .args(["-dr", "com.apple.quarantine"])
        .arg(&app)
        .status();

    // 运行于 .app bundle 内 → 后置替换脚本（app 退出后替换 + 重启）；否则（开发模式）直接 open。
    match current_app_bundle() {
        Some(current) => spawn_macos_replace_script(&current, &app)?,
        None => {
            let _ = Command::new("open").arg(&app).spawn();
        }
    }
    Ok(())
}

/// 运行中的 AgentHub.app 的 bundle 路径（从 current_exe 向上找 *.app）。
#[cfg(target_os = "macos")]
fn current_app_bundle() -> Option<PathBuf> {
    let exe = std::env::current_exe().ok()?;
    let mut p = exe.as_path();
    while let Some(parent) = p.parent() {
        if parent
            .file_name()
            .and_then(|n| n.to_str())
            .map_or(false, |n| n.ends_with(".app"))
        {
            return Some(parent.to_path_buf());
        }
        p = parent;
    }
    None
}

#[cfg(target_os = "macos")]
fn mount_and_copy_dmg(dmg: &Path) -> Result<PathBuf, String> {
    use std::process::Command;

    let out = Command::new("hdiutil")
        .args(["attach", "-nobrowse", "-readonly"])
        .arg(dmg)
        .output()
        .map_err(|e| format!("无法挂载 dmg: {}", e))?;
    let text = String::from_utf8_lossy(&out.stdout);
    let mount = text
        .lines()
        .filter_map(|l| l.split_whitespace().last())
        .find(|p| p.starts_with("/Volumes/"))
        .ok_or("无法解析 dmg 挂载点")?;
    let mount_path = PathBuf::from(mount);

    let app = fs::read_dir(&mount_path)
        .map_err(|e| format!("无法读取 dmg 挂载内容: {}", e))?
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .find(|p| p.extension().map_or(false, |e| e == "app"))
        .ok_or("dmg 内未找到 .app")?;

    let staged_root = get_app_data_dir().join("updates").join("staged");
    let _ = fs::remove_dir_all(&staged_root);
    fs::create_dir_all(&staged_root).map_err(|e| format!("创建暂存目录失败: {}", e))?;
    let dest = staged_root.join(app.file_name().unwrap_or_default());

    let status = Command::new("ditto")
        .arg(&app)
        .arg(&dest)
        .status()
        .map_err(|e| format!("复制 .app 失败: {}", e))?;
    if !status.success() {
        let _ = Command::new("hdiutil").args(["detach"]).arg(&mount_path).output();
        return Err("复制 .app 失败".to_string());
    }

    let _ = Command::new("hdiutil").args(["detach"]).arg(&mount_path).output();
    Ok(dest)
}

#[cfg(target_os = "macos")]
fn extract_app_archive(archive: &Path) -> Result<PathBuf, String> {
    use std::process::Command;

    let staged_root = get_app_data_dir().join("updates").join("staged");
    let _ = fs::remove_dir_all(&staged_root);
    fs::create_dir_all(&staged_root).map_err(|e| format!("创建暂存目录失败: {}", e))?;

    let status = Command::new("tar")
        .args(["-xzf"])
        .arg(archive)
        .arg("-C")
        .arg(&staged_root)
        .status()
        .map_err(|e| format!("解压 .app 失败: {}", e))?;
    if !status.success() {
        return Err("解压 .app 失败".to_string());
    }

    fs::read_dir(&staged_root)
        .map_err(|e| format!("读取暂存目录失败: {}", e))?
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .find(|p| p.extension().map_or(false, |e| e == "app"))
        .ok_or("归档内未找到 .app".to_string())
}

#[cfg(target_os = "macos")]
fn spawn_macos_replace_script(current_app: &Path, staged_app: &Path) -> Result<(), String> {
    use std::process::{Command, Stdio};

    let pid = std::process::id();
    let script = format!(
        "#!/bin/bash\nwhile kill -0 {pid} 2>/dev/null; do sleep 0.5; done\nsleep 1\nrm -rf \"{current}\"\nmv \"{staged}\" \"{current}\"\nxattr -dr com.apple.quarantine \"{current}\" 2>/dev/null || true\nopen \"{current}\"\n",
        pid = pid,
        current = current_app.to_string_lossy(),
        staged = staged_app.to_string_lossy(),
    );
    let script_path = get_app_data_dir().join("updates").join("postinstall.sh");
    fs::write(&script_path, script).map_err(|e| format!("写入后置脚本失败: {}", e))?;

    Command::new("/bin/bash")
        .arg(&script_path)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("启动后置脚本失败: {}", e))?;
    Ok(())
}

#[cfg(target_os = "linux")]
fn launch_installer(path: &Path) -> Result<(), String> {
    use std::process::{Command, Stdio};

    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    let path_str = path.to_string_lossy().to_string();

    if ext == "deb" {
        // 优先 pkexec（图形提权）→ sudo → 直跑 dpkg（无权限会失败）。
        let (prog, args): (&str, Vec<&str>) = if command_exists("pkexec") {
            ("pkexec", vec!["dpkg", "-i", &path_str])
        } else if command_exists("sudo") {
            ("sudo", vec!["dpkg", "-i", &path_str])
        } else {
            ("dpkg", vec!["-i", &path_str])
        };
        Command::new(prog)
            .args(args)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| format!("无法启动 deb 安装: {}", e))?;
    } else {
        // .AppImage（或其它可执行包）：chmod +x 后直接启动。
        let _ = Command::new("chmod").arg("+x").arg(&path_str).status();
        Command::new(&path_str)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| format!("无法启动安装程序: {}", e))?;
    }
    Ok(())
}

#[cfg(target_os = "linux")]
fn command_exists(name: &str) -> bool {
    std::process::Command::new("which")
        .arg(name)
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

/// 启动安装程序并退出当前应用。启动后稍作等待，让安装程序的 UAC 提权 / 进程先就位，
/// 再关闭 AgentHub 释放可执行文件锁，安装程序随后完成覆盖安装。
#[tauri::command]
pub fn install_app_update(path: String, app: tauri::AppHandle) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err("安装包不存在，请先重新下载".to_string());
    }

    crate::log_info!("update", "启动安装程序并退出应用: {}", path);
    launch_installer(&p)?;
    std::thread::sleep(std::time::Duration::from_millis(800));
    app.exit(0);
    Ok(())
}
