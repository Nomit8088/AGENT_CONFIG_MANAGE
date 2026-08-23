use std::collections::BTreeMap;
use std::ffi::{OsStr, OsString};
use std::path::Path;
use crate::process::{run_captured, LOCAL_CMD_TIMEOUT, NETWORK_CMD_TIMEOUT};
#[cfg(windows)]
use crate::process::spawn_cmd;
use std::sync::OnceLock;

use crate::models::SyncDiffEntry;

/// 读取 Windows WinINET 注册表值（HKCU）。输出形如:
/// `    ProxyServer    REG_SZ    127.0.0.1:7897`
#[cfg(windows)]
fn query_reg_value(name: &str) -> Option<String> {
    let out = spawn_cmd("reg")
        .args([
            "query",
            r"HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings",
            "/v",
            name,
        ])
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    let text = String::from_utf8_lossy(&out.stdout);
    let line = text.lines().find(|l| l.contains(name))?;
    line.split_whitespace().last().map(|s| s.to_string())
}

fn normalize_proxy(v: &str) -> String {
    let v = v.trim();
    if v.is_empty() {
        return String::new();
    }
    if v.contains("://") {
        v.to_string()
    } else if v.contains(':') {
        format!("http://{}", v)
    } else {
        v.to_string()
    }
}

/// 支持 `https=host:port;http=host:port` 或纯 `host:port` 形式。
#[cfg(windows)]
fn pick_proxy(raw: &str) -> Option<String> {
    let parts: Vec<&str> = raw.split(';').map(|s| s.trim()).filter(|s| !s.is_empty()).collect();

    for proto in ["https=", "http=", "socks5=", "socks="] {
        for p in &parts {
            let lower = p.to_lowercase();
            if lower.starts_with(proto) {
                return Some(normalize_proxy(&p[proto.len()..]));
            }
        }
    }

    parts
        .iter()
        .find(|p| !p.contains('='))
        .map(|p| normalize_proxy(p))
}

fn detect_system_proxy() -> Option<String> {
    // 1) 环境变量优先
    for key in ["HTTPS_PROXY", "https_proxy", "HTTP_PROXY", "http_proxy"] {
        if let Ok(v) = std::env::var(key) {
            let v = v.trim().to_string();
            if !v.is_empty() {
                return Some(normalize_proxy(&v));
            }
        }
    }

    // 2) Windows WinINET 系统代理（git 默认不读取 WinINET）
    #[cfg(windows)]
    {
        if let Some(raw) = query_reg_value("ProxyServer") {
            let enabled = query_reg_value("ProxyEnable")
                .and_then(|v| {
                    u32::from_str_radix(v.trim_start_matches("0x"), 16).ok()
                })
                .map(|n| n != 0)
                .unwrap_or(true);
            if enabled {
                return pick_proxy(&raw);
            }
        }
    }

    None
}

static PROXY: OnceLock<Option<String>> = OnceLock::new();

fn git_proxy() -> Option<&'static str> {
    PROXY.get_or_init(detect_system_proxy).as_deref()
}

/// 供 pnpm 等子进程注入代理使用：返回探测到的系统代理（含 `http://` 前缀）。
pub fn system_proxy() -> Option<String> {
    git_proxy().map(|s| s.to_string())
}

/// 若探测到系统代理，返回注入给 git 的 `-c` 参数；否则返回空数组。
/// 统一注入到所有 git 命令是安全的：本地命令会忽略 http.proxy。
pub fn proxy_args() -> Vec<String> {
    match git_proxy() {
        Some(p) => vec![
            "-c".to_string(),
            format!("http.proxy={}", p),
            "-c".to_string(),
            format!("https.proxy={}", p),
        ],
        None => Vec::new(),
    }
}

/// 关闭 git 的交互式提示。控制台窗口已被 CREATE_NO_WINDOW 隐藏，任何 stdin 提示
/// （用户名/密码、SSH 主机密钥/口令）都会变成「看不见的挂起或失败」。让它们快速失败，
/// 具体错误由 `run_git` 的 `Err` 返回给前端展示。
const GIT_NO_PROMPT_ENV: &[(&str, &str)] = &[
    ("GIT_TERMINAL_PROMPT", "0"),
    (
        "GIT_SSH_COMMAND",
        "ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new",
    ),
];

/// 统一的 git 执行入口：自动注入系统代理与「禁止交互提示」环境变量。
/// 网络类命令（fetch/pull/push/ls-remote/clone）使用更长超时，其余本地只读命令用短超时。
/// 成功返回裁剪后的 stdout，失败返回 `Err`（stderr 或 stdout 或超时信息）。
pub fn run_git<I, S>(cwd: &Path, args: I) -> Result<String, String>
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    let user_args: Vec<OsString> = args
        .into_iter()
        .map(|a| a.as_ref().to_os_string())
        .collect();
    let is_network = user_args
        .first()
        .and_then(|a| a.to_str())
        .map(|s| matches!(s, "fetch" | "pull" | "push" | "ls-remote" | "clone"))
        .unwrap_or(false);

    let mut all: Vec<OsString> = proxy_args().into_iter().map(OsString::from).collect();
    all.extend(user_args);

    let timeout = if is_network {
        NETWORK_CMD_TIMEOUT
    } else {
        LOCAL_CMD_TIMEOUT
    };
    run_captured("git", all, Some(cwd), GIT_NO_PROMPT_ENV, timeout)
}

/// 非抛错的只读 git 输出（失败返回 None），用于本地差异计算，不做网络 fetch。
fn git_out_opt(cwd: &Path, args: &[&str]) -> Option<String> {
    run_git(cwd, args.iter().copied()).ok()
}

fn status_of_code(code: &str) -> &'static str {
    match code.chars().next().unwrap_or('M') {
        'A' => "added",
        'D' => "deleted",
        _ => "modified",
    }
}

fn merge_entry(map: &mut BTreeMap<String, SyncDiffEntry>, path: String, status: &str, side: &str) {
    if let Some(prev) = map.get(&path) {
        if prev.side != side {
            map.insert(
                path.clone(),
                SyncDiffEntry {
                    path,
                    status: "modified".to_string(),
                    side: "both".to_string(),
                },
            );
            return;
        }
    }
    map.insert(
        path.clone(),
        SyncDiffEntry {
            path,
            status: status.to_string(),
            side: side.to_string(),
        },
    );
}

fn collect_name_status(out: &str, side: &str, map: &mut BTreeMap<String, SyncDiffEntry>) {
    for line in out.lines() {
        if line.len() < 2 {
            continue;
        }
        let (code, rest) = match line.find('\t') {
            Some(i) => (&line[..i], &line[i + 1..]),
            None => (line, ""),
        };
        let path = if code.starts_with('R') {
            // 重命名：取最后一个 token 作为新路径
            rest.rsplit('\t').next().unwrap_or(rest).trim().to_string()
        } else {
            rest.trim().to_string()
        };
        if path.is_empty() {
            continue;
        }
        let status = status_of_code(code);
        merge_entry(map, path, status, side);
    }
}

fn collect_porcelain(out: &str, map: &mut BTreeMap<String, SyncDiffEntry>) {
    for line in out.lines() {
        if line.len() < 3 {
            continue;
        }
        let code = &line[..2];
        let raw = line[3..].trim();
        if raw.is_empty() {
            continue;
        }
        let path = raw.trim_matches('"').to_string();
        let status = if code.starts_with("??") || code.starts_with('A') {
            "added"
        } else if code.starts_with('D') {
            "deleted"
        } else {
            "modified"
        };
        merge_entry(map, path, status, "local");
    }
}

/// 计算某功能范围（`skills/` 或 `dsh/`）内，本地与「已知远端 origin/<branch>」的文件级差异。
pub fn sync_diff(cwd: &Path, scope: &str, branch: &str) -> Vec<SyncDiffEntry> {
    let mut map: BTreeMap<String, SyncDiffEntry> = BTreeMap::new();
    if !cwd.join(".git").exists() {
        return Vec::new();
    }

    let remote_ref = format!("origin/{}", branch);
    if git_out_opt(cwd, &["rev-parse", "--verify", remote_ref.as_str()]).is_some() {
        let ahead_ref = format!("{}...HEAD", remote_ref);
        if let Some(out) = git_out_opt(cwd, &["diff", "--name-status", ahead_ref.as_str(), "--", scope]) {
            collect_name_status(&out, "local", &mut map);
        }
        let behind_ref = format!("HEAD...{}", remote_ref);
        if let Some(out) = git_out_opt(cwd, &["diff", "--name-status", behind_ref.as_str(), "--", scope]) {
            collect_name_status(&out, "remote", &mut map);
        }
    }

    if let Some(out) = git_out_opt(cwd, &["status", "--porcelain", "--", scope]) {
        collect_porcelain(&out, &mut map);
    }

    map.into_values().collect()
}
