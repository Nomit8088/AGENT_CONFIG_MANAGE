//! 统一的子进程构造入口。
//!
//! Tauri 应用是 GUI 程序（无控制台），若直接用 `std::process::Command` 拉起
//! `git` / `reg` / `cmd` / `pnpm` / `dsh` 等控制台程序，Windows 会为每个子进程
//! 新建一个控制台窗口（表现为桌面频繁闪烁 cmd 窗口）。这里统一在 Windows 下
//! 设置 `CREATE_NO_WINDOW`，其余平台原样返回。
//!
//! 此外提供 `run_captured`：带超时的「执行 + 捕获输出」。超时后强制结束进程树，
//! 避免网络类命令（git fetch/pull/push/ls-remote/clone）在代理失效或远端不可达时
//! 无限期阻塞，导致同步页「同步中…」转圈卡死。

use std::ffi::OsStr;
use std::io::Read;
use std::path::Path;
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

/// 本地只读命令超时（status/diff/rev-parse/remote get-url 等，通常在毫秒级完成）。
pub const LOCAL_CMD_TIMEOUT: Duration = Duration::from_secs(15);
/// 网络类命令超时（fetch/pull/push/ls-remote/clone）。
pub const NETWORK_CMD_TIMEOUT: Duration = Duration::from_secs(120);

/// 构造一个不会弹出控制台窗口的 `Command`（Windows 下追加 CREATE_NO_WINDOW）。
pub fn spawn_cmd<S: AsRef<OsStr>>(program: S) -> Command {
    let mut cmd = Command::new(program);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd
}

/// 结束整个进程树（Windows 用 taskkill /T /F；其他平台 kill -9 单个进程）。
pub fn kill_tree(pid: u32) {
    #[cfg(windows)]
    {
        let _ = spawn_cmd("taskkill")
            .args(["/PID", &pid.to_string(), "/T", "/F"])
            .output();
    }
    #[cfg(not(windows))]
    {
        let _ = spawn_cmd("kill").args(["-9", &pid.to_string()]).output();
    }
}

/// 执行控制台命令并捕获输出。
///
/// - 成功：返回裁剪后的 stdout。
/// - 非零退出：返回裁剪后的 stderr（stderr 为空则回退 stdout）。
/// - 超时：强制结束进程树并返回 `Err`（含超时秒数）。
pub fn run_captured<I, S>(
    program: &str,
    args: I,
    cwd: Option<&Path>,
    envs: &[(&str, &str)],
    timeout: Duration,
) -> Result<String, String>
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    let mut command = spawn_cmd(program);
    command
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if let Some(dir) = cwd {
        command.current_dir(dir);
    }
    for &(k, v) in envs {
        command.env(k, v);
    }

    let mut child = command
        .spawn()
        .map_err(|e| format!("无法执行 {}: {}", program, e))?;

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    let captured_out = Arc::new(Mutex::new(Vec::<u8>::new()));
    let captured_err = Arc::new(Mutex::new(Vec::<u8>::new()));
    let mut readers = Vec::new();

    if let Some(mut s) = stdout {
        let c = captured_out.clone();
        readers.push(std::thread::spawn(move || {
            let mut buf = Vec::new();
            let _ = s.read_to_end(&mut buf);
            if let Ok(mut g) = c.lock() {
                g.extend_from_slice(&buf);
            }
        }));
    }
    if let Some(mut s) = stderr {
        let c = captured_err.clone();
        readers.push(std::thread::spawn(move || {
            let mut buf = Vec::new();
            let _ = s.read_to_end(&mut buf);
            if let Ok(mut g) = c.lock() {
                g.extend_from_slice(&buf);
            }
        }));
    }

    let start = Instant::now();
    let mut timed_out = false;
    let mut exit_success = false;
    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                exit_success = status.success();
                break;
            }
            Ok(None) => {
                if start.elapsed() >= timeout {
                    kill_tree(child.id());
                    let _ = child.kill();
                    timed_out = true;
                    break;
                }
                std::thread::sleep(Duration::from_millis(100));
            }
            Err(_) => break,
        }
    }

    for r in readers {
        let _ = r.join();
    }

    let out_bytes = captured_out.lock().unwrap().clone();
    let err_bytes = captured_err.lock().unwrap().clone();
    let out = String::from_utf8_lossy(&out_bytes).trim().to_string();
    let err = String::from_utf8_lossy(&err_bytes).trim().to_string();

    if timed_out {
        return Err(format!(
            "{} 执行超时（{} 秒），已终止进程",
            program,
            timeout.as_secs()
        ));
    }
    if !exit_success {
        let msg = if err.is_empty() { out } else { err };
        return Err(if msg.is_empty() {
            format!("{} 执行失败", program)
        } else {
            msg
        });
    }
    Ok(out)
}
