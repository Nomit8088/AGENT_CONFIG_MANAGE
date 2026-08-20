use std::process::Command;
use std::sync::OnceLock;

/// 读取 Windows WinINET 注册表值（HKCU）。输出形如:
/// `    ProxyServer    REG_SZ    127.0.0.1:7897`
fn query_reg_value(name: &str) -> Option<String> {
    let out = Command::new("reg")
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
    if cfg!(windows) {
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
