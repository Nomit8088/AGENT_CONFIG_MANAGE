use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use serde_json::Value as JsonValue;
use serde_yaml::Value as YamlValue;

use crate::models::*;
use crate::storage::load_config;

pub(crate) const BUILTIN_BUNDLE_PREFIX: &str = "@deepseek-ai/dsh-";

// ==================== 路径与命令解析 ====================

pub fn resolve_dsh_home() -> PathBuf {
    if let Ok(h) = std::env::var("DSH_HOME") {
        if !h.trim().is_empty() {
            return PathBuf::from(h.trim());
        }
    }
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".dsh")
}

fn which_cmd(name: &str) -> Option<String> {
    #[cfg(windows)]
    let finder = "where";
    #[cfg(not(windows))]
    let finder = "which";

    let out = Command::new(finder).arg(name).output().ok()?;
    if !out.status.success() {
        return None;
    }
    let s = String::from_utf8_lossy(&out.stdout);
    s.lines()
        .map(|l| l.trim())
        .find(|l| !l.is_empty())
        .map(|l| l.to_string())
}

fn npm_dir_cmd(name: &str) -> Option<String> {
    #[cfg(windows)]
    {
        let home = dirs::home_dir()?;
        let base = home.join("AppData").join("Roaming").join("npm");
        for c in [base.join(format!("{}.cmd", name)), base.join(name.to_string())] {
            if c.exists() {
                return Some(c.to_string_lossy().to_string());
            }
        }
    }
    #[cfg(not(windows))]
    {
        let _ = name;
    }
    None
}

pub fn resolve_dsh_command(cfg: &AppConfig) -> Option<String> {
    if let Some(p) = &cfg.dsh_plugins {
        if !p.dsh_command.trim().is_empty() {
            return Some(p.dsh_command.trim().to_string());
        }
    }
    which_cmd("dsh").or_else(|| npm_dir_cmd("dsh"))
}

pub fn resolve_pnpm_command(cfg: &AppConfig) -> Option<String> {
    if let Some(p) = &cfg.dsh_plugins {
        if !p.pnpm_command.trim().is_empty() {
            return Some(p.pnpm_command.trim().to_string());
        }
    }
    which_cmd("pnpm").or_else(|| npm_dir_cmd("pnpm"))
}

// ==================== 扫描 ====================

fn read_to_string_opt(p: &Path) -> Option<String> {
    fs::read_to_string(p).ok()
}

pub(crate) fn list_profile_dirs(dir: &Path) -> Vec<String> {
    let mut names = Vec::new();
    if let Ok(entries) = fs::read_dir(dir) {
        for e in entries.flatten() {
            let name = e.file_name().to_string_lossy().to_string();
            if name == "node_modules" || name.starts_with('.') {
                continue;
            }
            if e.path().is_dir() {
                names.push(name);
            }
        }
    }
    names.sort();
    names
}

// 不可移植 = 本机/本地路径（link:/file:）、workspace 内部协议（workspace:/portal:/catalog:）、SSH 鉴权 git（git+ssh:/ssh:/git@）。
// 可移植 = 版本号 / npm: / github: / gitlab: / git+https: / git+http: 等与机器无关的规格。
pub(crate) fn is_portable_spec(spec: Option<&str>) -> bool {
    match spec {
        None => true,
        Some(s) => {
            let s = s.trim();
            !(s.starts_with("link:")
                || s.starts_with("file:")
                || s.starts_with("workspace:")
                || s.starts_with("portal:")
                || s.starts_with("catalog:")
                || s.starts_with("git+ssh:")
                || s.starts_with("ssh:")
                || s.starts_with("git@"))
        }
    }
}

fn read_installed_version(profile_dir: &Path, pkg_name: &str) -> Option<String> {
    let mut p = profile_dir.join("node_modules");
    for part in pkg_name.split('/') {
        p = p.join(part);
    }
    p = p.join("package.json");
    let text = read_to_string_opt(&p)?;
    let v: JsonValue = serde_json::from_str(&text).ok()?;
    v.get("version")?.as_str().map(|s| s.to_string())
}

fn parse_patch_rows(patch_file: &Path) -> Vec<DshPatchRow> {
    let mut rows = Vec::new();
    let text = match read_to_string_opt(patch_file) {
        Some(t) => t,
        None => return rows,
    };
    let parsed: YamlValue = match serde_yaml::from_str(&text) {
        Ok(v) => v,
        Err(_) => return rows,
    };
    if let YamlValue::Sequence(seq) = parsed {
        for row in seq {
            let id = row.get("id").and_then(|v| v.as_str()).map(|s| s.to_string());
            let name = row.get("name").and_then(|v| v.as_str()).map(|s| s.to_string());
            let disabled = row.get("disabled").and_then(|v| v.as_bool());
            rows.push(DshPatchRow {
                id,
                name,
                disabled,
                raw: row,
            });
        }
    }
    rows
}

fn scan_profile(profiles_dir: &Path, name: &str) -> DshProfileScan {
    let dir = profiles_dir.join(name);
    let pkg_file = dir.join("package.json");
    let patch_file = dir.join("cordis.patch.yml");

    let mut bundles: Vec<String> = Vec::new();
    let mut dependencies: HashMap<String, String> = HashMap::new();

    if let Some(text) = read_to_string_opt(&pkg_file) {
        if let Ok(pkg) = serde_json::from_str::<JsonValue>(&text) {
            if let Some(arr) = pkg
                .get("dsh")
                .and_then(|d| d.get("profile"))
                .and_then(|p| p.get("bundles"))
                .and_then(|b| b.as_array())
            {
                bundles = arr
                    .iter()
                    .filter_map(|b| b.as_str())
                    .map(|s| s.to_string())
                    .collect();
            }
            if let Some(deps) = pkg.get("dependencies").and_then(|d| d.as_object()) {
                for (k, v) in deps {
                    if let Some(spec) = v.as_str() {
                        dependencies.insert(k.clone(), spec.to_string());
                    }
                }
            }
        }
    }

    let patch_rows = parse_patch_rows(&patch_file);
    let mut plugins: Vec<DshPluginEntry> = Vec::new();

    let mut patch_disabled: HashSet<String> = HashSet::new();
    for row in &patch_rows {
        if row.disabled == Some(true) {
            if let Some(id) = row.id.as_ref().or(row.name.as_ref()) {
                patch_disabled.insert(id.clone());
            }
        }
    }

    for b in &bundles {
        let is_inbox = b.starts_with(BUILTIN_BUNDLE_PREFIX);
        let spec = dependencies.get(b).cloned();
        let patch_disabled_hit = patch_disabled.contains(b);
        plugins.push(DshPluginEntry {
            key: format!("bundle:{}", b),
            profile_name: name.to_string(),
            name: b.clone(),
            kind: if is_inbox { "inbox".to_string() } else { "bundle".to_string() },
            spec: spec.clone(),
            installed_version: read_installed_version(&dir, b),
            enabled: !patch_disabled_hit,
            portability: if is_portable_spec(spec.as_deref()) {
                "portable".to_string()
            } else {
                "unportable".to_string()
            },
            disabled_by: if patch_disabled_hit { Some("patch".to_string()) } else { None },
        });
    }

    let mut dep_entries: Vec<(String, String)> = dependencies.clone().into_iter().collect();
    dep_entries.sort_by(|a, b| a.0.cmp(&b.0));
    for (dep, spec) in dep_entries {
        if bundles.contains(&dep) {
            continue;
        }
        plugins.push(DshPluginEntry {
            key: format!("dep:{}", dep),
            profile_name: name.to_string(),
            name: dep.clone(),
            kind: "plain".to_string(),
            spec: Some(spec.clone()),
            installed_version: read_installed_version(&dir, &dep),
            enabled: false,
            portability: if is_portable_spec(Some(&spec)) {
                "portable".to_string()
            } else {
                "unportable".to_string()
            },
            disabled_by: None,
        });
    }

    let mut row_idx = 0usize;
    for row in &patch_rows {
        let row_name = row
            .id
            .clone()
            .or_else(|| row.name.clone())
            .unwrap_or_else(|| format!("row-{}", row_idx));
        plugins.push(DshPluginEntry {
            key: format!("row:{}", row_name),
            profile_name: name.to_string(),
            name: row_name.clone(),
            kind: "row".to_string(),
            spec: None,
            installed_version: None,
            enabled: row.disabled != Some(true),
            portability: "portable".to_string(),
            disabled_by: if row.disabled == Some(true) { Some("patch".to_string()) } else { None },
        });
        row_idx += 1;
    }

    DshProfileScan {
        name: name.to_string(),
        dir: dir.to_string_lossy().to_string(),
        exists: dir.exists(),
        bundles,
        dependencies,
        plugins,
        patch_rows,
        patch_file: patch_file.to_string_lossy().to_string(),
    }
}

#[tauri::command]
pub fn scan_dsh_plugins() -> DshPluginScanResult {
    let home_dir = resolve_dsh_home();
    let profiles_dir = home_dir.join("profiles");
    let cfg = load_config();

    let profiles = list_profile_dirs(&profiles_dir)
        .iter()
        .map(|name| scan_profile(&profiles_dir, name))
        .collect();

    DshPluginScanResult {
        home_dir: home_dir.to_string_lossy().to_string(),
        dsh_command: resolve_dsh_command(&cfg),
        pnpm_command: resolve_pnpm_command(&cfg),
        profiles,
    }
}

// ==================== cordis.patch.yml 文本级操作 ====================

struct SplitItems {
    header: String,
    items: Vec<String>,
}

fn split_top_level_items(text: &str) -> SplitItems {
    let mut header_lines: Vec<&str> = Vec::new();
    let mut items: Vec<String> = Vec::new();
    let mut current: Option<Vec<&str>> = None;

    for line in text.split('\n') {
        if line.starts_with("- ") || line == "-" {
            if let Some(cur) = current.take() {
                items.push(cur.join("\n"));
            }
            current = Some(vec![line]);
        } else if let Some(cur) = current.as_mut() {
            cur.push(line);
        } else {
            header_lines.push(line);
        }
    }
    if let Some(cur) = current.take() {
        items.push(cur.join("\n"));
    }

    SplitItems {
        header: header_lines.join("\n"),
        items,
    }
}

fn item_id_of(item: &str) -> Option<String> {
    for line in item.lines() {
        let t = line.trim_start();
        if let Some(rest) = t.strip_prefix("- id:") {
            return Some(rest.trim().trim_matches('"').trim_matches('\'').to_string());
        }
        if let Some(rest) = t.strip_prefix("- name:") {
            return Some(rest.trim().trim_matches('"').trim_matches('\'').to_string());
        }
    }
    None
}

fn has_top_level_item_with_id(text: &str, id: &str) -> bool {
    let split = split_top_level_items(text);
    split.items.iter().any(|item| item_id_of(item).as_deref() == Some(id))
}

fn add_disabled_row(patch_file: &Path, id: &str) -> bool {
    let mut text = read_to_string_opt(patch_file).unwrap_or_default();
    if text.trim().is_empty() {
        text = "[]\n".to_string();
    }
    if has_top_level_item_with_id(&text, id) {
        return false;
    }

    let block = format!("- id: {}\n  disabled: true", id);
    let split = split_top_level_items(&text);

    if split.items.is_empty() {
        let re = regex::Regex::new(r"(?m)^\[\s*\]\s*(?:#.*)?$").unwrap();
        if re.is_match(&text) {
            let replaced = re.replace(&text, block.as_str()).to_string();
            if replaced != text {
                let _ = fs::write(patch_file, replaced);
                return true;
            }
        }
        let new_text = format!("{}\n{}\n", text.trim_end(), block);
        let _ = fs::write(patch_file, new_text);
        return true;
    }

    let new_text = format!("{}\n{}\n", text.trim_end(), block);
    let _ = fs::write(patch_file, new_text);
    true
}

fn remove_row_by_id(patch_file: &Path, id: &str) -> bool {
    let text = match read_to_string_opt(patch_file) {
        Some(t) => t,
        None => return false,
    };
    let mut split = split_top_level_items(&text);
    let idx = split
        .items
        .iter()
        .position(|item| item_id_of(item).as_deref() == Some(id));
    let idx = match idx {
        Some(i) => i,
        None => return false,
    };

    split.items.remove(idx);

    let new_text = if split.items.is_empty() {
        let header = split.header.trim_end();
        if header.is_empty() {
            "[]\n".to_string()
        } else {
            format!("{}\n[]\n", header)
        }
    } else {
        let mut parts: Vec<String> = Vec::new();
        if !split.header.is_empty() {
            parts.push(split.header);
        }
        parts.extend(split.items);
        format!("{}\n", parts.join("\n"))
    };

    let _ = fs::write(patch_file, new_text);
    true
}

// ==================== package.json 写盘 ====================

pub(crate) fn read_pkg(profile_dir: &Path) -> Option<JsonValue> {
    let text = read_to_string_opt(&profile_dir.join("package.json"))?;
    serde_json::from_str(&text).ok()
}

pub(crate) fn write_pkg(profile_dir: &Path, pkg: &JsonValue) {
    let pretty = serde_json::to_string_pretty(pkg).unwrap_or_else(|_| "{}".to_string());
    let _ = fs::write(profile_dir.join("package.json"), format!("{}\n", pretty));
}

fn ensure_profile_dir(profile: &str) -> Result<PathBuf, String> {
    let dir = resolve_dsh_home().join("profiles").join(profile);
    if !dir.exists() {
        return Err(format!("profile 目录不存在: {}", dir.to_string_lossy()));
    }
    Ok(dir)
}

fn remove_from_bundles(profile_dir: &Path, pkg_name: &str) -> bool {
    let mut pkg = match read_pkg(profile_dir) {
        Some(p) => p,
        None => return false,
    };
    let bundles = pkg
        .get_mut("dsh")
        .and_then(|d| d.get_mut("profile"))
        .and_then(|p| p.get_mut("bundles"));
    let arr = match bundles.and_then(|b| b.as_array_mut()) {
        Some(a) => a,
        None => return false,
    };
    let before = arr.len();
    arr.retain(|b| b.as_str() != Some(pkg_name));
    if arr.len() == before {
        return false;
    }
    write_pkg(profile_dir, &pkg);
    true
}

fn add_to_bundles(profile_dir: &Path, pkg_name: &str) -> bool {
    let mut pkg = match read_pkg(profile_dir) {
        Some(p) => p,
        None => return false,
    };
    if pkg.get("dsh").is_none() {
        pkg["dsh"] = JsonValue::Object(serde_json::Map::new());
    }
    if pkg["dsh"].get("profile").is_none() {
        pkg["dsh"]["profile"] = JsonValue::Object(serde_json::Map::new());
    }
    let profile = pkg["dsh"]["profile"]
        .as_object_mut()
        .expect("profile 为 object");
    let bundles = profile
        .entry("bundles")
        .or_insert_with(|| JsonValue::Array(Vec::new()));
    let arr = match bundles.as_array_mut() {
        Some(a) => a,
        None => return false,
    };
    if arr.iter().any(|b| b.as_str() == Some(pkg_name)) {
        return false;
    }
    arr.push(JsonValue::String(pkg_name.to_string()));
    write_pkg(profile_dir, &pkg);
    true
}

fn remove_dependency(profile_dir: &Path, pkg_name: &str) -> bool {
    let mut pkg = match read_pkg(profile_dir) {
        Some(p) => p,
        None => return false,
    };
    let mut changed = false;
    if let Some(deps) = pkg.get_mut("dependencies").and_then(|d| d.as_object_mut()) {
        if deps.remove(pkg_name).is_some() {
            changed = true;
        }
    }
    if let Some(arr) = pkg
        .get_mut("dsh")
        .and_then(|d| d.get_mut("profile"))
        .and_then(|p| p.get_mut("bundles"))
        .and_then(|b| b.as_array_mut())
    {
        let before = arr.len();
        arr.retain(|b| b.as_str() != Some(pkg_name));
        if arr.len() != before {
            changed = true;
        }
    }
    if changed {
        write_pkg(profile_dir, &pkg);
    }
    changed
}

// ==================== 诊断 ====================

fn kill_tree(pid: u32) {
    #[cfg(windows)]
    {
        let _ = Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/T", "/F"])
            .output();
    }
    #[cfg(not(windows))]
    {
        let _ = Command::new("kill").args(["-9", &pid.to_string()]).output();
    }
}

struct RunResult {
    exit_code: Option<i32>,
    output: String,
    timed_out: bool,
}

fn run_with_timeout(
    cmd: &str,
    args: &[String],
    cwd: Option<&Path>,
    timeout_ms: u64,
) -> RunResult {
    let mut command = Command::new(cmd);
    command.args(args).stdout(Stdio::piped()).stderr(Stdio::piped());
    if let Some(dir) = cwd {
        command.current_dir(dir);
    }

    let mut child = match command.spawn() {
        Ok(c) => c,
        Err(e) => {
            return RunResult {
                exit_code: None,
                output: format!("无法启动 {}: {}", cmd, e),
                timed_out: false,
            };
        }
    };

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    let captured_out = Arc::new(Mutex::new(String::new()));
    let captured_err = Arc::new(Mutex::new(String::new()));
    let mut readers = Vec::new();

    if let Some(mut s) = stdout {
        let c = captured_out.clone();
        readers.push(std::thread::spawn(move || {
            let mut buf = String::new();
            let _ = s.read_to_string(&mut buf);
            if let Ok(mut g) = c.lock() {
                g.push_str(&buf);
            }
        }));
    }
    if let Some(mut s) = stderr {
        let c = captured_err.clone();
        readers.push(std::thread::spawn(move || {
            let mut buf = String::new();
            let _ = s.read_to_string(&mut buf);
            if let Ok(mut g) = c.lock() {
                g.push_str(&buf);
            }
        }));
    }

    let start = Instant::now();
    let (exit_code, timed_out) = loop {
        match child.try_wait() {
            Ok(Some(status)) => break (status.code(), false),
            Ok(None) => {
                if start.elapsed() >= Duration::from_millis(timeout_ms) {
                    kill_tree(child.id());
                    let _ = child.kill();
                    break (None, true);
                }
                std::thread::sleep(Duration::from_millis(100));
            }
            Err(_) => break (None, false),
        }
    };

    for r in readers {
        let _ = r.join();
    }

    let out = captured_out.lock().unwrap().clone();
    let err = captured_err.lock().unwrap().clone();
    let output = if err.is_empty() { out } else { err };

    RunResult {
        exit_code,
        output,
        timed_out,
    }
}

fn extract_failed_names(raw: &str) -> Vec<String> {
    let mut names = Vec::new();
    if let Some(marker) = raw.find("did not activate") {
        let rest = &raw[marker..];
        for line in rest.lines().skip(1) {
            let indented = line.chars().next().map(|c| c.is_whitespace()).unwrap_or(false);
            if indented {
                continue;
            }
            let t = line.trim();
            if t.is_empty() {
                continue;
            }
            if let Some(colon) = t.find(':') {
                let nm = t[..colon].trim();
                if !nm.is_empty() {
                    names.push(nm.to_string());
                }
            }
        }
        if !names.is_empty() {
            return names;
        }
    }

    if let Some(pos) = raw.find("plugin(s) failed to load:") {
        let rest = &raw[pos + "plugin(s) failed to load:".len()..];
        if let Some(line) = rest.lines().next() {
            let parts: Vec<String> = line
                .split(',')
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect();
            if !parts.is_empty() {
                return parts;
            }
        }
    }

    names
}

fn build_actions(profile_name: &str, names: &[String]) -> Vec<DshRecoveryAction> {
    let profiles_dir = resolve_dsh_home().join("profiles");
    let scan = scan_profile(&profiles_dir, profile_name);
    let mut actions = Vec::new();

    for name in names {
        if scan.bundles.contains(name) && !name.starts_with(BUILTIN_BUNDLE_PREFIX) {
            actions.push(DshRecoveryAction {
                kind: "remove-bundle".to_string(),
                profile_name: profile_name.to_string(),
                target: name.clone(),
                description: format!("从 dsh.profile.bundles 中移除 {}", name),
            });
        } else if scan.dependencies.contains_key(name) {
            actions.push(DshRecoveryAction {
                kind: "remove-dependency".to_string(),
                profile_name: profile_name.to_string(),
                target: name.clone(),
                description: format!("从 dependencies 中移除 {}", name),
            });
        } else {
            let target = scan
                .patch_rows
                .iter()
                .find(|r| r.id.as_deref() == Some(name.as_str()) || r.name.as_deref() == Some(name.as_str()))
                .and_then(|r| r.id.clone().or_else(|| r.name.clone()))
                .unwrap_or_else(|| name.clone());
            actions.push(DshRecoveryAction {
                kind: "disable-row".to_string(),
                profile_name: profile_name.to_string(),
                target: target.clone(),
                description: format!("在 cordis.patch.yml 中停用 {}", target),
            });
        }
    }

    actions
}

fn diagnose_inner(profile: Option<String>) -> DshDiagnoseResult {
    let cfg = load_config();
    let dsh_cmd = match resolve_dsh_command(&cfg) {
        Some(c) => c,
        None => {
            return DshDiagnoseResult {
                ok: false,
                exit_code: None,
                raw_stderr: String::new(),
                failed_plugins: Vec::new(),
                suggested_actions: Vec::new(),
                hint: Some("未找到 dsh 命令，请在「设置」中配置 dshCommand，或先安装 DeepSeek Harness".to_string()),
            };
        }
    };

    let profile_name = profile
        .filter(|p| !p.trim().is_empty())
        .unwrap_or_else(|| "web".to_string());

    let mut args: Vec<String> = Vec::new();
    if profile_name == "web" {
        args.push("web".to_string());
    } else {
        args.push("--profile".to_string());
        args.push(profile_name.clone());
    }

    let cwd = resolve_dsh_home().join("profiles").join(&profile_name);
    let run = run_with_timeout(
        &dsh_cmd,
        &args,
        if cwd.exists() { Some(cwd.as_path()) } else { None },
        15000,
    );

    if run.timed_out {
        return DshDiagnoseResult {
            ok: true,
            exit_code: None,
            raw_stderr: run.output,
            failed_plugins: Vec::new(),
            suggested_actions: Vec::new(),
            hint: None,
        };
    }

    if run.exit_code == Some(0) {
        return DshDiagnoseResult {
            ok: true,
            exit_code: run.exit_code,
            raw_stderr: run.output,
            failed_plugins: Vec::new(),
            suggested_actions: Vec::new(),
            hint: None,
        };
    }

    let raw = run.output;

    if raw.to_lowercase().contains("eaddrinuse") {
        return DshDiagnoseResult {
            ok: false,
            exit_code: run.exit_code,
            raw_stderr: raw,
            failed_plugins: Vec::new(),
            suggested_actions: Vec::new(),
            hint: Some("端口已被占用（可能是另一个 DSH 实例正在运行），这通常不是插件故障。请先关闭现有实例后重试。".to_string()),
        };
    }

    let mut names = extract_failed_names(&raw);
    if names.is_empty() {
        let profiles_dir = resolve_dsh_home().join("profiles");
        let scan = scan_profile(&profiles_dir, &profile_name);
        let mut known: Vec<String> = scan.bundles.clone();
        known.extend(scan.dependencies.keys().cloned());
        for n in known {
            if n.len() > 2 && raw.contains(&n) {
                names.push(n);
            }
        }
    }

    let actions = build_actions(&profile_name, &names);
    let hint = if names.is_empty() {
        Some("未能自动定位失败插件，请在「插件面板」手动停用相关插件，或查看下方原始日志".to_string())
    } else {
        None
    };

    DshDiagnoseResult {
        ok: false,
        exit_code: run.exit_code,
        raw_stderr: raw,
        failed_plugins: names,
        suggested_actions: actions,
        hint,
    }
}

#[tauri::command]
pub async fn diagnose_dsh_web(profile: Option<String>) -> Result<DshDiagnoseResult, String> {
    tauri::async_runtime::spawn_blocking(move || diagnose_inner(profile))
        .await
        .map_err(|e| format!("诊断执行失败: {}", e))
}

// ==================== 开关 / 恢复 / 安装 ====================

#[tauri::command]
pub fn toggle_dsh_plugin(profile: String, key: String, enabled: bool) -> Result<(), String> {
    let profile_dir = ensure_profile_dir(&profile)?;

    if let Some(pkg_name) = key.strip_prefix("bundle:") {
        if enabled {
            add_to_bundles(&profile_dir, pkg_name);
        } else {
            remove_from_bundles(&profile_dir, pkg_name);
        }
        return Ok(());
    }

    if let Some(pkg_name) = key.strip_prefix("dep:") {
        if enabled {
            add_to_bundles(&profile_dir, pkg_name);
        } else {
            remove_dependency(&profile_dir, pkg_name);
        }
        return Ok(());
    }

    if let Some(row_id) = key.strip_prefix("row:") {
        let patch_file = profile_dir.join("cordis.patch.yml");
        if enabled {
            remove_row_by_id(&patch_file, row_id);
        } else {
            add_disabled_row(&patch_file, row_id);
        }
        return Ok(());
    }

    Err(format!("无法识别的插件 key: {}", key))
}

/// 卸载：从配置中彻底移除（bundle/dep 同时移出 dependencies + bundles，row 从 patch 删除），并尽力清理 node_modules。
#[tauri::command]
pub fn remove_dsh_plugin(profile: String, key: String) -> Result<(), String> {
    let profile_dir = ensure_profile_dir(&profile)?;

    if let Some(pkg_name) = key.strip_prefix("bundle:").or_else(|| key.strip_prefix("dep:")) {
        remove_dependency(&profile_dir, pkg_name);
        // 尽力清理 node_modules + 更新 lock（pnpm 不可用/失败不影响配置已移除）
        let _ = install_dsh_plugins(profile.clone());
        return Ok(());
    }

    if let Some(row_id) = key.strip_prefix("row:") {
        let patch_file = profile_dir.join("cordis.patch.yml");
        remove_row_by_id(&patch_file, row_id);
        return Ok(());
    }

    Err(format!("无法识别的插件 key: {}", key))
}

#[tauri::command]
pub fn apply_dsh_recovery(action: DshRecoveryAction) -> Result<(), String> {
    let profile_dir = ensure_profile_dir(&action.profile_name)?;

    match action.kind.as_str() {
        "remove-bundle" => {
            remove_from_bundles(&profile_dir, &action.target);
            Ok(())
        }
        "remove-dependency" => {
            remove_dependency(&profile_dir, &action.target);
            Ok(())
        }
        "disable-row" => {
            let patch_file = profile_dir.join("cordis.patch.yml");
            add_disabled_row(&patch_file, &action.target);
            Ok(())
        }
        other => Err(format!("未知的恢复动作: {}", other)),
    }
}

#[tauri::command]
pub fn install_dsh_plugins(profile: String) -> Result<String, String> {
    let cfg = load_config();
    let pnpm_cmd = resolve_pnpm_command(&cfg)
        .ok_or_else(|| "未找到 pnpm 命令，请在「设置」中配置 pnpmCommand".to_string())?;
    let profile_dir = ensure_profile_dir(&profile)?;

    let output = Command::new(&pnpm_cmd)
        .arg("install")
        .current_dir(&profile_dir)
        .output()
        .map_err(|e| format!("无法执行 pnpm install: {}", e))?;

    let out = format!(
        "{}{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );

    if !output.status.success() {
        return Err(format!("pnpm install 失败:\n{}", out));
    }
    Ok(out)
}
