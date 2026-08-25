use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use crate::process::{kill_tree, spawn_cmd};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use serde_json::Value as JsonValue;
use serde_yaml::Value as YamlValue;

use crate::models::*;
use crate::storage::{get_backups_dir, load_config};
use crate::error_codes::*;

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

    let out = spawn_cmd(finder).arg(name).output().ok()?;
    if !out.status.success() {
        return None;
    }
    let s = String::from_utf8_lossy(&out.stdout);
    s.lines()
        .map(|l| l.trim())
        .find(|l| !l.is_empty())
        .map(|l| l.to_string())
}

/// 取 `npm prefix -g` 的全局 bin 目录（仅 Unix；Windows 的 npm 是 npm.cmd，Command 直跑不可靠）。
#[cfg(not(windows))]
fn npm_global_bin_dir() -> Option<PathBuf> {
    let out = spawn_cmd("npm").args(["prefix", "-g"]).output().ok()?;
    if !out.status.success() {
        return None;
    }
    let s = String::from_utf8_lossy(&out.stdout);
    let prefix = s.lines().map(|l| l.trim()).find(|l| !l.is_empty())?;
    Some(PathBuf::from(prefix).join("bin"))
}

/// 全局 npm 安装的 CLI 兜底（`resolve_global_bin` 语义）：
/// Windows 走 `~/AppData/Roaming/npm`（含 .cmd shim）；Unix 走 `which` 失效后的 `npm prefix -g`。
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
        if let Some(dir) = npm_global_bin_dir() {
            let c = dir.join(name);
            if c.exists() {
                return Some(c.to_string_lossy().to_string());
            }
        }
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

/// npm 命令探测（DSH 本体是全局 npm 包，升级/版本管理走 npm，与 pnpm 的插件安装分属两条链）。
pub fn resolve_npm_command(_cfg: &AppConfig) -> Option<String> {
    which_cmd("npm").or_else(|| npm_dir_cmd("npm"))
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

// ==================== 安装状态持久化 ====================

type InstallStateMap = HashMap<String, HashMap<String, DshInstallStateItem>>;

fn install_state_file() -> PathBuf {
    crate::storage::get_app_data_dir().join("dsh_install_state.json")
}

fn read_install_state() -> InstallStateMap {
    let f = install_state_file();
    if !f.exists() {
        return HashMap::new();
    }
    if let Ok(text) = fs::read_to_string(&f) {
        if let Ok(v) = serde_json::from_str::<JsonValue>(&text) {
            if let Some(obj) = v.as_object() {
                let mut out = HashMap::new();
                for (profile, pkg_map) in obj {
                    if let Some(pkgs) = pkg_map.as_object() {
                        let mut pm = HashMap::new();
                        for (pkg, item) in pkgs {
                            if let Ok(s) = serde_json::from_value::<DshInstallStateItem>(item.clone()) {
                                pm.insert(pkg.clone(), s);
                            }
                        }
                        out.insert(profile.clone(), pm);
                    }
                }
                return out;
            }
        }
    }
    HashMap::new()
}

fn write_install_state(state: &InstallStateMap) {
    let dir = crate::storage::get_app_data_dir();
    let _ = fs::create_dir_all(&dir);
    let pretty = serde_json::to_string_pretty(state).unwrap_or_else(|_| "{}".to_string());
    let _ = fs::write(dir.join("dsh_install_state.json"), format!("{}\n", pretty));
}

// ==================== 对账（配置 ∪ 本机磁盘） ====================

fn is_semver_spec(spec: Option<&str>) -> bool {
    let spec = match spec {
        Some(s) => s.trim(),
        None => return false,
    };
    if spec.is_empty() {
        return false;
    }
    let re = regex::Regex::new(r"^(?:\^|~|>=|<=|>|<|=)?\s*v?\d+(?:\.\d+){0,2}(?:-[0-9A-Za-z.-]+)?$").unwrap();
    spec.split_whitespace().all(|t| re.is_match(t))
}

fn is_exact_semver_spec(spec: Option<&str>) -> bool {
    let spec = match spec {
        Some(s) => s.trim(),
        None => return false,
    };
    let re = regex::Regex::new(r"^v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$").unwrap();
    re.is_match(spec)
}

fn read_lock_resolved_version(profile_dir: &Path, pkg_name: &str) -> Option<String> {
    let lock_file = profile_dir.join("pnpm-lock.yaml");
    let text = read_to_string_opt(&lock_file)?;
    let lines: Vec<&str> = text.lines().collect();

    let mut start = None;
    for (i, line) in lines.iter().enumerate() {
        if line.trim_end() == "packages:" {
            start = Some(i + 1);
            break;
        }
    }
    let start = start?;

    let mut end = lines.len();
    for (i, line) in lines.iter().enumerate().skip(start) {
        if !line.trim().is_empty() && !line.starts_with(' ') {
            end = i;
            break;
        }
    }

    let parse_key_name = |raw: &str| -> Option<String> {
        let k = raw.trim().trim_matches(|c| c == '\'' || c == '"').trim_end_matches(':').trim();
        if k.is_empty() {
            return None;
        }
        if let Some(rest) = k.strip_prefix('@') {
            let mut parts = rest.splitn(2, '/');
            let scope = parts.next()?;
            let pkg = parts.next()?;
            let pkg_name = pkg.split('@').next().unwrap_or(pkg);
            return Some(format!("@{}/{}", scope, pkg_name));
        }
        Some(k.split('@').next().unwrap_or(k).to_string())
    };

    let mut i = start;
    while i < end {
        let line = lines[i];
        let trimmed = line.trim();
        let is_pkg_key = line.starts_with("  ")
            && line.as_bytes().get(2).map(|b| *b != b' ').unwrap_or(false)
            && trimmed.ends_with(':')
            && !trimmed.starts_with("version:")
            && !trimmed.starts_with("resolution:")
            && !trimmed.starts_with("dev:")
            && !trimmed.starts_with("optional:")
            && !trimmed.starts_with("dependencies:")
            && !trimmed.starts_with("peerDependencies:")
            && !trimmed.starts_with("engines:")
            && !trimmed.starts_with("os:")
            && !trimmed.starts_with("cpu:")
            && !trimmed.starts_with("libc:")
            && !trimmed.starts_with("hasBin:")
            && !trimmed.starts_with("name:");
        if is_pkg_key {
            if parse_key_name(line).as_deref() == Some(pkg_name) {
                let mut j = i + 1;
                while j < end {
                    let sub = lines[j];
                    if sub.starts_with("  ")
                        && sub.as_bytes().get(2).map(|b| *b != b' ').unwrap_or(false)
                        && sub.trim().ends_with(':')
                    {
                        break;
                    }
                    if let Some(v) = sub.trim().strip_prefix("version:") {
                        let v = v.trim().trim_matches(|c| c == '\'' || c == '"');
                        return Some(v.to_string());
                    }
                    j += 1;
                }
                return None;
            }
        }
        i += 1;
    }

    None
}

fn list_installed_top_level_pkgs(profile_dir: &Path) -> Vec<String> {
    let nm = profile_dir.join("node_modules");
    if !nm.exists() {
        return Vec::new();
    }
    let entries = match fs::read_dir(&nm) {
        Ok(e) => e,
        Err(_) => return Vec::new(),
    };

    let mut names = Vec::new();
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if name == ".bin" || name == ".pnpm" || name.starts_with('.') {
            continue;
        }
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        if name.starts_with('@') {
            if let Ok(subs) = fs::read_dir(&path) {
                for sub in subs.flatten() {
                    let sn = sub.file_name().to_string_lossy().to_string();
                    if sn == ".bin" || sn.starts_with('.') || !sub.path().is_dir() {
                        continue;
                    }
                    names.push(format!("{}/{}", name, sn));
                }
            }
        } else {
            names.push(name);
        }
    }
    names.sort();
    names
}

/// 读取 pnpm 的 .modules.yaml 中 hoistedLocations，返回被 pnpm 主动提升到顶层 node_modules 的包名集合。
/// 这些包是声明依赖的传递依赖（如 dsh-notification -> zod），不是孤儿，删除会破坏运行时。
fn read_hoisted_pkg_names(profile_dir: &Path) -> HashSet<String> {
    let mut hoisted = HashSet::new();
    let modules_yaml = profile_dir.join("node_modules").join(".modules.yaml");
    let text = match read_to_string_opt(&modules_yaml) {
        Some(t) => t,
        None => return hoisted,
    };
    let parsed: JsonValue = match serde_json::from_str(&text) {
        Ok(v) => v,
        Err(_) => return hoisted,
    };
    if let Some(locations) = parsed.get("hoistedLocations").and_then(|v| v.as_object()) {
        for paths in locations.values() {
            if let Some(arr) = paths.as_array() {
                for p in arr {
                    if let Some(s) = p.as_str() {
                        // 路径形如 `node_modules\zod` 或 `node_modules\@scope\pkg`
                        let normalized = s
                            .strip_prefix("node_modules\\")
                            .or_else(|| s.strip_prefix("node_modules/"))
                            .unwrap_or(s)
                            .replace('\\', "/");
                        if !normalized.is_empty() {
                            hoisted.insert(normalized);
                        }
                    }
                }
            }
        }
    }
    hoisted
}

fn read_pkg_from_dir(pkg_dir: &Path) -> Option<JsonValue> {
    let text = read_to_string_opt(&pkg_dir.join("package.json"))?;
    serde_json::from_str(&text).ok()
}

fn trim_stack(s: &str, max: usize) -> String {
    if s.len() <= max {
        s.to_string()
    } else {
        s.chars().rev().take(max).collect::<Vec<_>>().into_iter().rev().collect()
    }
}

fn validate_installed_pkg(profile_dir: &Path, pkg_name: &str) -> Result<(), String> {
    let mut pkg_dir = profile_dir.join("node_modules");
    for part in pkg_name.split('/') {
        pkg_dir = pkg_dir.join(part);
    }
    let pkg = read_pkg_from_dir(&pkg_dir)
        .ok_or_else(|| "node_modules 中缺少该包".to_string())?;

    let check_file = |rel: &str| -> bool {
        let p = if std::path::Path::new(rel).is_absolute() {
            std::path::PathBuf::from(rel)
        } else {
            pkg_dir.join(rel)
        };
        p.exists()
    };

    if let Some(main) = pkg.get("main").and_then(|v| v.as_str()) {
        if check_file(main) {
            return Ok(());
        }
    }

    if let Some(exports) = pkg.get("exports") {
        if let Some(s) = exports.as_str() {
            if check_file(s) {
                return Ok(());
            }
        } else if let Some(obj) = exports.as_object() {
            for key in [".", "import", "require", "default"] {
                if let Some(v) = obj.get(key).and_then(|v| v.as_str()) {
                    if check_file(v) {
                        return Ok(());
                    }
                }
                if let Some(inner) = obj.get(key).and_then(|v| v.as_object()) {
                    for kk in ["import", "require", "default"] {
                        if let Some(v) = inner.get(kk).and_then(|v| v.as_str()) {
                            if check_file(v) {
                                return Ok(());
                            }
                        }
                    }
                }
            }
        }
    }

    if let Some(patch) = pkg
        .get("dsh")
        .and_then(|d| d.get("bundle"))
        .and_then(|b| b.get("patch"))
        .and_then(|v| v.as_str())
    {
        if check_file(patch) {
            return Ok(());
        }
    }

    Err("入口文件缺失（main / exports / dsh.bundle.patch 均不存在）".to_string())
}

fn scan_patch_disabled(profile_dir: &Path) -> HashSet<String> {
    let patch_file = profile_dir.join("cordis.patch.yml");
    let mut disabled = HashSet::new();
    for row in parse_patch_rows(&patch_file) {
        if row.disabled == Some(true) {
            if let Some(id) = row.id.as_ref().or(row.name.as_ref()) {
                disabled.insert(id.clone());
            }
        }
    }
    disabled
}

#[tauri::command]
pub fn reconcile_dsh_install(profile: String) -> Result<Vec<DshPluginInstallEntry>, String> {
    let profile_name = if profile.trim().is_empty() {
        "web".to_string()
    } else {
        profile.trim().to_string()
    };
    let profile_dir = resolve_dsh_home().join("profiles").join(&profile_name);
    if !profile_dir.exists() {
        return Ok(Vec::new());
    }

    let pkg = read_pkg(&profile_dir).unwrap_or_else(|| JsonValue::Object(serde_json::Map::new()));
    let mut bundles: Vec<String> = Vec::new();
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

    let mut deps: HashMap<String, String> = HashMap::new();
    if let Some(obj) = pkg.get("dependencies").and_then(|d| d.as_object()) {
        for (k, v) in obj {
            if let Some(s) = v.as_str() {
                deps.insert(k.clone(), s.to_string());
            }
        }
    }

    let patch_rows = parse_patch_rows(&profile_dir.join("cordis.patch.yml"));
    let patch_disabled = scan_patch_disabled(&profile_dir);

    let state = read_install_state();
    let mut profile_state = state.get(&profile_name).cloned().unwrap_or_default();
    let installed_set: HashSet<String> = list_installed_top_level_pkgs(&profile_dir)
        .into_iter()
        .collect();

    let mut entries: Vec<DshPluginInstallEntry> = Vec::new();
    let mut declared: HashSet<String> = HashSet::new();

    let mut push_declared = |name: String,
                             kind: &str,
                             spec: Option<String>,
                             enabled: bool,
                             disabled_by: Option<String>|
     -> () {
        declared.insert(name.clone());
        let is_inbox = kind == "inbox" || name.starts_with(BUILTIN_BUNDLE_PREFIX);
        let installed = installed_set.contains(&name);
        let installed_version = if installed {
            read_installed_version(&profile_dir, &name)
        } else {
            None
        };

        let mut required_version: Option<String> = None;
        if is_semver_spec(spec.as_deref()) {
            required_version = read_lock_resolved_version(&profile_dir, &name);
            if required_version.is_none() && is_exact_semver_spec(spec.as_deref()) {
                required_version = spec
                    .as_deref()
                    .map(|s| s.trim().trim_start_matches('v').to_string());
            }
        }

        if is_inbox {
            entries.push(DshPluginInstallEntry {
                key: format!("bundle:{}", name),
                profile_name: profile_name.clone(),
                name,
                kind: "inbox".to_string(),
                spec,
                declared_in_config: true,
                installed: false,
                installed_version: None,
                required_version: None,
                status: "ok".to_string(),
                install_error: None,
                portability: "portable".to_string(),
                enabled,
                disabled_by,
            });
            return;
        }

        let disk_status: &str = if !installed {
            "pending"
        } else if let (Some(req), Some(inst)) = (required_version.as_ref(), installed_version.as_ref()) {
            if req != inst {
                "version-mismatch"
            } else {
                "ok"
            }
        } else {
            "ok"
        };

        let portability = if is_portable_spec(spec.as_deref()) {
            "portable".to_string()
        } else {
            "unportable".to_string()
        };

        let persisted = profile_state.get(&name);
        let (status, install_error) = if persisted.map(|p| p.status.as_str()) == Some("failed")
            && disk_status != "ok"
        {
            let err = format!(
                "{}{}",
                persisted.map(|p| p.reason.clone()).unwrap_or_default(),
                persisted
                    .and_then(|p| p.stack.clone())
                    .map(|s| format!("\n{}", s))
                    .unwrap_or_default()
            );
            ("failed".to_string(), Some(err))
        } else {
            (disk_status.to_string(), None)
        };

        if persisted.map(|p| p.status.as_str()) == Some("failed") && disk_status == "ok" {
            profile_state.remove(&name);
        }

        entries.push(DshPluginInstallEntry {
            key: format!("{}:{}", if kind == "plain" { "dep" } else { "bundle" }, name),
            profile_name: profile_name.clone(),
            name,
            kind: kind.to_string(),
            spec: spec.clone(),
            declared_in_config: true,
            installed,
            installed_version,
            required_version,
            status,
            install_error,
            portability,
            enabled,
            disabled_by,
        });
    };

    // bundles -> inbox | bundle
    for b in &bundles {
        let is_inbox = b.starts_with(BUILTIN_BUNDLE_PREFIX);
        push_declared(
            b.clone(),
            if is_inbox { "inbox" } else { "bundle" },
            deps.get(b).cloned(),
            !patch_disabled.contains(b),
            if patch_disabled.contains(b) {
                Some("patch".to_string())
            } else {
                None
            },
        );
    }

    // deps not in bundles -> plain
    let mut dep_names: Vec<String> = deps.keys().cloned().collect();
    dep_names.sort();
    for dep in dep_names {
        if bundles.contains(&dep) {
            continue;
        }
        push_declared(
            dep.clone(),
            "plain",
            deps.get(&dep).cloned(),
            false,
            None,
        );
    }

    // patch rows -> row（不可安装，视为 ok 配置行）
    let mut row_idx = 0usize;
    for row in &patch_rows {
        let row_name = row
            .id
            .clone()
            .or_else(|| row.name.clone())
            .unwrap_or_else(|| format!("row-{}", row_idx));
        entries.push(DshPluginInstallEntry {
            key: format!("row:{}", row_name),
            profile_name: profile_name.clone(),
            name: row_name.clone(),
            kind: "row".to_string(),
            spec: None,
            declared_in_config: true,
            installed: false,
            installed_version: None,
            required_version: None,
            status: "ok".to_string(),
            install_error: None,
            portability: "portable".to_string(),
            enabled: row.disabled != Some(true),
            disabled_by: if row.disabled == Some(true) {
                Some("patch".to_string())
            } else {
                None
            },
        });
        row_idx += 1;
    }

    // 孤儿：本机已装、配置未声明、非内置、非 pnpm 主动提升的传递依赖（hoisted）。
    // 顶层 node_modules 中存在但不属于上述任何一类，才认为是真正多余的包，避免误删 zod 这类传递依赖。
    let hoisted_pkg_names = read_hoisted_pkg_names(&profile_dir);
    let mut orphans: Vec<String> = installed_set
        .iter()
        .filter(|n| {
            !declared.contains(*n)
                && !n.starts_with(BUILTIN_BUNDLE_PREFIX)
                && !hoisted_pkg_names.contains(*n)
        })
        .cloned()
        .collect();
    orphans.sort();
    for o in orphans {
        let installed_version = read_installed_version(&profile_dir, &o);
        entries.push(DshPluginInstallEntry {
            key: format!("orphan:{}", o),
            profile_name: profile_name.clone(),
            name: o.clone(),
            kind: "plain".to_string(),
            spec: None,
            declared_in_config: false,
            installed: true,
            installed_version,
            required_version: None,
            status: "orphan".to_string(),
            install_error: None,
            portability: "portable".to_string(),
            enabled: false,
            disabled_by: None,
        });
    }

    // 自愈清理落盘
    if profile_state.len() != state.get(&profile_name).map(|m| m.len()).unwrap_or(0) {
        let mut new_state = state;
        if profile_state.is_empty() {
            new_state.remove(&profile_name);
        } else {
            new_state.insert(profile_name, profile_state);
        }
        write_install_state(&new_state);
    }

    Ok(entries)
}

#[tauri::command]
pub fn clear_dsh_install_state(profile: String, pkg: Option<String>) -> Result<(), String> {
    let profile_name = if profile.trim().is_empty() {
        "web".to_string()
    } else {
        profile.trim().to_string()
    };
    let mut state = read_install_state();
    match pkg {
        Some(p) if !p.trim().is_empty() => {
            if let Some(profile_state) = state.get_mut(&profile_name) {
                profile_state.remove(&p);
                if profile_state.is_empty() {
                    state.remove(&profile_name);
                }
            }
        }
        _ => {
            state.remove(&profile_name);
        }
    }
    write_install_state(&state);
    Ok(())
}

// ==================== 单包更新检查 / 更新 ====================

fn now_millis() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn git_url_from_spec(spec: &str) -> Option<String> {
    let s = spec.trim();
    // 只剥掉 pnpm 的 git+ 前缀，保留 https:// 或 http:// scheme。
    // （原实现 strip_prefix("git+https://") 会连 scheme 一起丢掉，导致 git ls-remote 报
    //  "protocol 'gitee.com' is not supported" 之类错误，gitee/gitlab/gh-proxy 全部检查失败。）
    if let Some(url) = s.strip_prefix("git+") {
        if url.starts_with("https://") || url.starts_with("http://") {
            return Some(url.to_string());
        }
    }
    if let Some(repo) = s.strip_prefix("github:") {
        return Some(format!("https://github.com/{}.git", repo));
    }
    None
}

fn git_ls_remote(url: &str) -> Result<String, String> {
    // 1) 用户配置了 GitHub 镜像前缀时，对 github.com 原始地址镜像优先（用户显式选择）。
    if let Some(mirrored) = github_mirror_url(url) {
        let args = vec!["ls-remote".to_string(), mirrored, "HEAD".to_string()];
        let r = run_with_timeout("git", &args, None, 20000);
        if r.exit_code == Some(0) {
            if let Some(line) = r.output.lines().next() {
                if !line.trim().is_empty() {
                    return Ok(line.trim().to_string());
                }
            }
        }
    }

    let args = vec!["ls-remote".to_string(), url.to_string(), "HEAD".to_string()];

    // 2) 直连；3) 失败再注入系统代理（GitHub 直连场景）
    let direct = run_with_timeout("git", &args, None, 20000);
    if direct.exit_code == Some(0) {
        if let Some(line) = direct.output.lines().next() {
            if !line.trim().is_empty() {
                return Ok(line.trim().to_string());
            }
        }
    }

    let mut proxy_args = crate::git_sync::proxy_args();
    proxy_args.extend(args);
    let fallback = run_with_timeout("git", &proxy_args, None, 20000);
    if fallback.exit_code == Some(0) {
        if let Some(line) = fallback.output.lines().next() {
            if !line.trim().is_empty() {
                return Ok(line.trim().to_string());
            }
        }
    }

    let detail = if fallback.output.is_empty() {
        direct.output.clone()
    } else {
        fallback.output.clone()
    };
    Err(if detail.is_empty() {
        "git ls-remote 失败".to_string()
    } else {
        detail
    })
}

/// 读取 `dsh_plugins.gitHubMirror`，仅对指向原始 github.com 的 URL 返回镜像化地址，
/// 避免对已带 gh-proxy 等前缀的地址二次嵌套。
fn github_mirror_url(url: &str) -> Option<String> {
    let mirror = load_config()
        .dsh_plugins
        .map(|p| p.git_hub_mirror.trim().to_string())
        .unwrap_or_default();
    if mirror.is_empty() {
        return None;
    }
    let u = url.trim();
    let is_github = u.starts_with("https://github.com/") || u.starts_with("http://github.com/");
    if !is_github {
        return None;
    }
    let prefix = if mirror.ends_with('/') {
        mirror
    } else {
        format!("{}/", mirror)
    };
    Some(format!("{}{}", prefix, u))
}

fn extract_commit_hash(value: Option<&str>) -> Option<String> {
    let v = value?;

    // 1) `#` 形式：git+https://...git#<commit>（gh-proxy / git+https 依赖）
    if let Some(pos) = v.find('#') {
        let hash: String = v[pos + 1..]
            .chars()
            .take_while(|c| c.is_ascii_hexdigit())
            .collect();
        if hash.len() >= 7 {
            return Some(hash);
        }
        return None;
    }

    // 2) codeload tarball 形式：https://codeload.github.com/<owner>/<repo>/tar.gz/<commit>[ (...)]
    //    （pnpm 对 github: 依赖的解析结果；末尾可能带 peer 上下文如 (dsh-better-sidebar@0.14.0)）
    if let Some(pos) = v.find("/tar.gz/") {
        let rest = &v[pos + "/tar.gz/".len()..];
        let hash: String = rest
            .chars()
            .take_while(|c| c.is_ascii_hexdigit())
            .collect();
        if hash.len() >= 7 {
            return Some(hash);
        }
        return None;
    }

    // 3) GitHub archive 形式：https://github.com/<owner>/<repo>/archive/<commit>.tar.gz|.zip
    if let Some(pos) = v.find("/archive/") {
        let rest = &v[pos + "/archive/".len()..];
        let hash: String = rest
            .chars()
            .take_while(|c| c.is_ascii_hexdigit())
            .collect();
        if hash.len() >= 7 {
            return Some(hash);
        }
        return None;
    }

    None
}

fn read_lock_importer_version(profile_dir: &Path, pkg_name: &str) -> Option<String> {
    let lock_file = profile_dir.join("pnpm-lock.yaml");
    let text = read_to_string_opt(&lock_file)?;
    let lines: Vec<&str> = text.lines().collect();

    let mut start = None;
    let mut end = lines.len();
    for (i, line) in lines.iter().enumerate() {
        if line.trim_end() == "importers:" {
            start = Some(i + 1);
            break;
        }
    }
    let start = start?;
    for (i, line) in lines.iter().enumerate().skip(start) {
        if line.trim_end() == "packages:" {
            end = i;
            break;
        }
    }

    let key_re = regex::Regex::new(&format!(r#"^\s{{6}}['"]?{}['"]?:\s*$"#, regex::escape(pkg_name)))
        .ok()?;
    let mut i = start;
    while i < end {
        if key_re.is_match(lines[i]) {
            let mut j = i + 1;
            while j < end {
                if let Some(v) = lines[j].trim().strip_prefix("version:") {
                    let v = v.trim().trim_matches(|c| c == '\'' || c == '"');
                    return Some(v.to_string());
                }
                if !lines[j].is_empty() && !lines[j].starts_with(' ') {
                    break;
                }
                j += 1;
            }
            return None;
        }
        i += 1;
    }
    None
}

#[tauri::command]
pub fn check_dsh_plugin_update(profile: String, key: String) -> DshPluginUpdateCheck {
    let now = now_millis();
    let profile_name = if profile.trim().is_empty() {
        "web".to_string()
    } else {
        profile.trim().to_string()
    };

    let (_prefix, pkg_name) = if let Some(p) = key.strip_prefix("bundle:") {
        ("bundle", p.to_string())
    } else if let Some(p) = key.strip_prefix("dep:") {
        ("dep", p.to_string())
    } else {
        return DshPluginUpdateCheck {
            key: key.clone(),
            name: key,
            checked_at: now,
            update_available: false,
            current: None,
            latest: None,
            error: None,
            hint: Some("仅支持 bundle / 依赖条目的更新检查".to_string()),
        };
    };

    let profile_dir = match ensure_profile_dir(&profile_name) {
        Ok(d) => d,
        Err(e) => {
            return DshPluginUpdateCheck {
                key: key.clone(),
                name: pkg_name,
                checked_at: now,
                update_available: false,
                current: None,
                latest: None,
                error: Some(e),
                hint: None,
            };
        }
    };

    let pkg = match read_pkg(&profile_dir) {
        Some(p) => p,
        None => {
            return DshPluginUpdateCheck {
                key: key.clone(),
                name: pkg_name,
                checked_at: now,
                update_available: false,
                current: None,
                latest: None,
                error: Some("无法读取 profile package.json".to_string()),
                hint: None,
            };
        }
    };
    let spec = match pkg
        .get("dependencies")
        .and_then(|d| d.get(&pkg_name))
        .and_then(|v| v.as_str())
    {
        Some(s) => s.to_string(),
        None => {
            return DshPluginUpdateCheck {
                key: key.clone(),
                name: pkg_name,
                checked_at: now,
                update_available: false,
                current: None,
                latest: None,
                error: None,
                hint: Some("配置中未找到该包的 spec".to_string()),
            };
        }
    };

    // 1) npm semver 依赖：查 registry latest。
    if is_semver_spec(Some(&spec)) {
        return check_npm_update(&key, &pkg_name, &profile_dir, &spec, now);
    }

    // 2) GitHub Release 固定 URL（tgz 资产）：查 releases/latest 的 tag。
    if let Some((owner, repo, tag)) = parse_github_release_spec(&spec) {
        return check_release_update(&key, &pkg_name, &owner, &repo, &tag, now);
    }

    let git_url = match git_url_from_spec(&spec) {
        Some(u) => u,
        None => {
            return DshPluginUpdateCheck {
                key: key.clone(),
                name: pkg_name,
                checked_at: now,
                update_available: false,
                current: None,
                latest: None,
                error: None,
                hint: Some(format!("当前 spec 类型不支持检查更新（支持 git+https / github: / npm 版本 / GitHub Release URL）：{}", spec)),
            };
        }
    };

    match git_ls_remote(&git_url) {
        Ok(line) => {
            let remote_head = line.split_whitespace().next().unwrap_or("").to_string();
            let current = extract_commit_hash(
                read_lock_importer_version(&profile_dir, &pkg_name).as_deref(),
            );
            let latest = remote_head.chars().take(7).collect::<String>();
            let current_short = current.as_ref().map(|c| c.chars().take(7).collect::<String>());
            DshPluginUpdateCheck {
                key: key.clone(),
                name: pkg_name,
                checked_at: now,
                update_available: current.as_deref() != Some(remote_head.as_str()),
                current: current_short,
                latest: Some(latest),
                error: None,
                hint: None,
            }
        }
        Err(e) => DshPluginUpdateCheck {
            key: key.clone(),
            name: pkg_name,
            checked_at: now,
            update_available: false,
            current: None,
            latest: None,
            error: Some(e),
            hint: None,
        },
    }
}

// ---- 检查更新辅助：npm registry / GitHub Release ----

/// 轻量 HTTP agent：注入系统代理，供 npm registry / GitHub API 查询使用。
fn build_http_agent() -> ureq::Agent {
    let builder = ureq::AgentBuilder::new()
        .timeout(std::time::Duration::from_secs(20))
        .redirects(5)
        .user_agent("AgentHub");
    if let Some(proxy) = crate::git_sync::system_proxy() {
        if let Ok(p) = ureq::Proxy::new(proxy) {
            return builder.proxy(p).build();
        }
    }
    builder.build()
}

/// 把版本号拆成数字序列，用于比较（"v0.2.7" / "0.2.7" → [0,2,7]）。
fn semver_parts(v: &str) -> Vec<u64> {
    v.trim()
        .trim_start_matches('v')
        .split(|c: char| !c.is_ascii_digit())
        .filter(|p| !p.is_empty())
        .map(|p| p.parse::<u64>().unwrap_or(0))
        .collect()
}

fn semver_newer(latest: &str, current: &str) -> bool {
    let a = semver_parts(latest);
    let b = semver_parts(current);
    for i in 0..a.len().max(b.len()) {
        let av = a.get(i).copied().unwrap_or(0);
        let bv = b.get(i).copied().unwrap_or(0);
        if av != bv {
            return av > bv;
        }
    }
    false
}

/// 判断某个版本是否落在 spec 允许的范围内。支持 `^`/`~`/精确版本；
/// 其余复杂范围（`>=`、`<`、`||` 等）保守返回 true，避免漏报。
fn spec_range_allows(spec: &str, version: &str) -> bool {
    let s = spec.trim();
    let v = semver_parts(version);
    let (major, minor, patch) = (
        v.get(0).copied().unwrap_or(0),
        v.get(1).copied().unwrap_or(0),
        v.get(2).copied().unwrap_or(0),
    );

    if let Some(rest) = s.strip_prefix('^') {
        let b = semver_parts(rest);
        let (bm, bmin, bp) = (
            b.get(0).copied().unwrap_or(0),
            b.get(1).copied().unwrap_or(0),
            b.get(2).copied().unwrap_or(0),
        );
        if bm > 0 {
            return major == bm && (minor > bmin || (minor == bmin && patch >= bp));
        }
        if bmin > 0 {
            return major == 0 && minor == bmin && patch >= bp;
        }
        return major == 0 && minor == 0 && patch == bp;
    }

    if let Some(rest) = s.strip_prefix('~') {
        let b = semver_parts(rest);
        let (bm, bmin, bp) = (
            b.get(0).copied().unwrap_or(0),
            b.get(1).copied().unwrap_or(0),
            b.get(2).copied().unwrap_or(0),
        );
        // ~x.y.z := >=x.y.z <x.(y+1).0
        return major == bm && minor == bmin && patch >= bp;
    }

    if is_exact_semver_spec(Some(s)) {
        return version.trim().trim_start_matches('v') == s.trim().trim_start_matches('v');
    }

    true
}

/// 查询 npm registry 的 latest 版本（scoped 包名需把 `/` 编码为 `%2F`）。
fn query_npm_latest(pkg_name: &str) -> Result<String, String> {
    let encoded = pkg_name.replace('/', "%2F");
    let url = format!("https://registry.npmjs.org/{}/latest", encoded);
    let resp = build_http_agent()
        .get(&url)
        .call()
        .map_err(|e| format!("请求 npm registry 失败: {}", e))?;
    if resp.status() != 200 {
        return Err(format!("npm registry 返回 HTTP {}", resp.status()));
    }
    let body = resp.into_string().map_err(|e| format!("读取响应失败: {}", e))?;
    let v: JsonValue = serde_json::from_str(&body).map_err(|e| format!("解析响应失败: {}", e))?;
    v.get("version")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| "npm registry 响应缺少 version".to_string())
}

/// 查询 npm registry 的全量版本列表（packument 的 versions 键），返回 (latest, 按版本号降序排列的版本列表)。
fn query_npm_versions(pkg_name: &str) -> Result<(Option<String>, Vec<String>), String> {
    let encoded = pkg_name.replace('/', "%2F");
    let url = format!("https://registry.npmjs.org/{}", encoded);
    let resp = build_http_agent()
        .get(&url)
        .call()
        .map_err(|e| format!("请求 npm registry 失败: {}", e))?;
    if resp.status() != 200 {
        return Err(format!("npm registry 返回 HTTP {}", resp.status()));
    }
    let body = resp.into_string().map_err(|e| format!("读取响应失败: {}", e))?;
    let v: JsonValue = serde_json::from_str(&body).map_err(|e| format!("解析响应失败: {}", e))?;

    let latest = v
        .get("dist-tags")
        .and_then(|d| d.get("latest"))
        .and_then(|s| s.as_str())
        .map(|s| s.to_string());

    let mut versions: Vec<String> = v
        .get("versions")
        .and_then(|o| o.as_object())
        .map(|o| o.keys().cloned().collect())
        .unwrap_or_default();
    versions.sort_by(|a, b| semver_parts(b).cmp(&semver_parts(a)));

    Ok((latest, versions))
}

/// 从 spec 中解析 GitHub Release 资产 URL 的 owner/repo/tag（可带 gh-proxy 等镜像前缀）。
fn parse_github_release_spec(spec: &str) -> Option<(String, String, String)> {
    let re = regex::Regex::new(r"github\.com/([^/]+)/([^/]+)/releases/download/([^/]+)/").unwrap();
    let caps = re.captures(spec)?;
    let owner = caps.get(1)?.as_str().to_string();
    let repo = caps.get(2)?.as_str().to_string();
    let tag = caps.get(3)?.as_str().to_string();
    Some((owner, repo, tag))
}

fn query_github_latest_release(owner: &str, repo: &str) -> Result<String, String> {
    let url = format!("https://api.github.com/repos/{}/{}/releases/latest", owner, repo);
    let resp = build_http_agent()
        .get(&url)
        .set("Accept", "application/vnd.github+json")
        .call()
        .map_err(|e| format!("请求 GitHub Releases 失败: {}", e))?;
    if resp.status() != 200 {
        return Err(format!("GitHub Releases 返回 HTTP {}", resp.status()));
    }
    let body = resp.into_string().map_err(|e| format!("读取响应失败: {}", e))?;
    let v: JsonValue = serde_json::from_str(&body).map_err(|e| format!("解析响应失败: {}", e))?;
    v.get("tag_name")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| "GitHub 响应缺少 tag_name".to_string())
}

fn check_npm_update(
    key: &str,
    pkg_name: &str,
    profile_dir: &Path,
    spec: &str,
    now: u64,
) -> DshPluginUpdateCheck {
    let current = read_lock_importer_version(profile_dir, pkg_name)
        .or_else(|| read_installed_version(profile_dir, pkg_name));
    match query_npm_latest(pkg_name) {
        Ok(latest) => {
            let newer = current
                .as_deref()
                .map(|c| semver_newer(&latest, c))
                .unwrap_or(true);
            let in_range = spec_range_allows(spec, &latest);
            let update_available = newer && in_range;
            let hint = if newer && !in_range {
                Some(format!(
                    "registry 有 {}，但超出当前 spec {} 范围，需先改 spec 才能升级",
                    latest, spec
                ))
            } else {
                None
            };
            DshPluginUpdateCheck {
                key: key.to_string(),
                name: pkg_name.to_string(),
                checked_at: now,
                update_available,
                current,
                latest: Some(latest),
                error: None,
                hint,
            }
        }
        Err(e) => DshPluginUpdateCheck {
            key: key.to_string(),
            name: pkg_name.to_string(),
            checked_at: now,
            update_available: false,
            current,
            latest: None,
            error: Some(e),
            hint: None,
        },
    }
}

fn check_release_update(
    key: &str,
    pkg_name: &str,
    owner: &str,
    repo: &str,
    tag: &str,
    now: u64,
) -> DshPluginUpdateCheck {
    let current = tag.trim_start_matches('v').to_string();
    match query_github_latest_release(owner, repo) {
        Ok(latest) => {
            let latest = latest.trim_start_matches('v').to_string();
            let update_available = !latest.is_empty() && semver_newer(&latest, &current);
            DshPluginUpdateCheck {
                key: key.to_string(),
                name: pkg_name.to_string(),
                checked_at: now,
                update_available,
                current: Some(current),
                latest: Some(latest),
                error: None,
                hint: None,
            }
        }
        Err(e) => DshPluginUpdateCheck {
            key: key.to_string(),
            name: pkg_name.to_string(),
            checked_at: now,
            update_available: false,
            current: Some(current),
            latest: None,
            error: Some(e),
            hint: None,
        },
    }
}

fn update_one_inner(profile: String, key: String) -> Result<DshInstallReport, String> {
    let profile_name = if profile.trim().is_empty() {
        "web".to_string()
    } else {
        profile.trim().to_string()
    };
    let profile_dir = ensure_profile_dir(&profile_name)?;

    let pkg_name = if let Some(p) = key.strip_prefix("bundle:") {
        p.to_string()
    } else if let Some(p) = key.strip_prefix("dep:") {
        p.to_string()
    } else {
        return Err(coded(E_PLUGIN_KEY_UNKNOWN, key));
    };

    let cfg = load_config();
    let pnpm_cmd = resolve_pnpm_command(&cfg)
        .ok_or_else(|| E_PNPM_NOT_FOUND.to_string())?;

    let pkg_file = profile_dir.join("package.json");
    let patch_file = profile_dir.join("cordis.patch.yml");
    let snapshot_pkg = read_to_string_opt(&pkg_file);
    let snapshot_patch = read_to_string_opt(&patch_file);

    let before = read_installed_version(&profile_dir, &pkg_name);

    let mut noop = |_line: String| {};
    let run = run_pnpm_streaming(
        &pnpm_cmd,
        &vec!["update".to_string(), pkg_name.clone()],
        &profile_dir,
        &mut noop,
    )?;

    let after = read_installed_version(&profile_dir, &pkg_name);
    let l3 = validate_installed_pkg(&profile_dir, &pkg_name);
    let blocked = parse_git_prepare_not_allowed(&run.output).contains(&pkg_name);
    // 与 install 流水线一致：ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED 是硬失败（git 依赖未真正更新）；
    // 其余非 0 退出（如 IGNORED_BUILDS 忽略构建脚本）以 L3 入口校验为最终判定。
    let ok = !blocked && !run.timed_out && l3.is_ok();

    let mut state = read_install_state();
    let mut report = DshInstallReport {
        profile: profile_name.clone(),
        mode: "update".to_string(),
        ok,
        installed: Vec::new(),
        updated: Vec::new(),
        failed: Vec::new(),
        warnings: Vec::new(),
        output: run.output.clone(),
    };

    if run.timed_out {
        report
            .warnings
            .push("pnpm update 执行超过 10 分钟，已强制终止（timeout）".to_string());
    }

    if blocked {
        report.warnings.push(format!(
            "pnpm 拒绝执行 git 依赖 prepare 构建脚本：{}；请在 pnpm-workspace.yaml 的 allowBuilds 中放行对应包/提交后重试",
            pkg_name
        ));
    }

    if ok {
        if before.as_deref() != after.as_deref() {
            report.updated.push(pkg_name.clone());
        }
        report.installed.push(pkg_name.clone());
        if let Some(profile_state) = state.get_mut(&profile_name) {
            profile_state.remove(&pkg_name);
        }
    } else {
        let reason = if blocked || run.timed_out {
            "non-zero-exit"
        } else {
            "missing-entry"
        };
        let stack = if reason == "non-zero-exit" {
            if run.output.is_empty() {
                "pnpm 拒绝执行 git 依赖 prepare 构建脚本（未加入 allowBuilds）".to_string()
            } else {
                run.output.clone()
            }
        } else {
            l3.err().unwrap_or_else(|| "入口校验失败".to_string())
        };
        report.failed.push(DshInstallFailure {
            name: pkg_name.clone(),
            reason: reason.to_string(),
            stack: trim_stack(&stack, 4096),
        });
        persist_install_failure(&mut state, &profile_name, &pkg_name, reason, &stack);
    }

    if let Some(profile_state) = state.get(&profile_name) {
        if profile_state.is_empty() {
            state.remove(&profile_name);
        }
    }
    write_install_state(&state);

    // update 失败仅回滚两个配置文件
    if !ok {
        if let Some(s) = &snapshot_pkg {
            let _ = fs::write(&pkg_file, s);
        }
        if let Some(s) = &snapshot_patch {
            let _ = fs::write(&patch_file, s);
        }
        // 回滚后重对账 node_modules，清理失败更新残留（best-effort）
        reconcile_node_modules(&profile_dir);
    }

    Ok(report)
}

#[tauri::command]
pub async fn update_dsh_plugin(profile: String, key: String) -> Result<DshInstallReport, String> {
    tauri::async_runtime::spawn_blocking(move || update_one_inner(profile, key))
        .await
        .map_err(|e| format!("更新执行失败: {}", e))?
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

    let profiles: Vec<DshProfileScan> = list_profile_dirs(&profiles_dir)
        .iter()
        .map(|name| scan_profile(&profiles_dir, name))
        .collect();

    crate::log_info!("scan", "扫描 DSH 插件完成（profile 数 {}）", profiles.len());
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
        return Err(coded(E_PROFILE_DIR_MISSING, dir.to_string_lossy()));
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

/// 把本地 link 目标路径转成 package.json 的 link: spec（Windows 下去掉 canonicalize 产生的 \\?\ 前缀）。
fn local_link_spec(target: &Path) -> String {
    let raw = target.to_string_lossy().replace('\\', "/");
    let stripped = raw.strip_prefix("//?/").unwrap_or(&raw);
    let stripped = match stripped.strip_prefix("UNC/") {
        Some(unc) => format!("//{}", unc),
        None => stripped.to_string(),
    };
    format!("link:{}", stripped)
}

/// 孤儿纳入配置时优先探测可移植 git spec：
/// 源目录是 git 仓库且 origin 为 http(s) 时返回 git+http(s)://...；ssh / git@ 等不可移植远端返回 None。
fn portable_git_spec(target: &Path) -> Option<String> {
    let args = vec![
        "remote".to_string(),
        "get-url".to_string(),
        "origin".to_string(),
    ];
    let run = run_with_timeout("git", &args, Some(target), 10000);
    if run.exit_code != Some(0) {
        return None;
    }
    let remote = run.output.lines().next()?.trim();
    if remote.is_empty() {
        return None;
    }
    if remote.starts_with("git+https://") || remote.starts_with("git+http://") {
        Some(remote.to_string())
    } else if remote.starts_with("https://") || remote.starts_with("http://") {
        Some(format!("git+{}", remote))
    } else {
        None
    }
}

/// 写入 dependencies(spec) 并加入 bundles，返回 (依赖是否变更, bundles 是否变更)。
fn add_dependency_and_bundle(
    profile_dir: &Path,
    pkg_name: &str,
    spec: &str,
) -> Result<(bool, bool), String> {
    let mut pkg = read_pkg(profile_dir).ok_or_else(|| E_PROFILE_PKG_MISSING.to_string())?;

    let mut dep_changed = false;
    if pkg.get("dependencies").is_none() {
        pkg["dependencies"] = JsonValue::Object(serde_json::Map::new());
    }
    if let Some(deps) = pkg["dependencies"].as_object_mut() {
        match deps.get(pkg_name).and_then(|v| v.as_str()) {
            Some(existing) if existing == spec => {}
            _ => {
                deps.insert(pkg_name.to_string(), JsonValue::String(spec.to_string()));
                dep_changed = true;
            }
        }
    }

    if pkg.get("dsh").is_none() {
        pkg["dsh"] = JsonValue::Object(serde_json::Map::new());
    }
    if pkg["dsh"].get("profile").is_none() {
        pkg["dsh"]["profile"] = JsonValue::Object(serde_json::Map::new());
    }
    let profile = pkg["dsh"]["profile"]
        .as_object_mut()
        .ok_or_else(|| "dsh.profile 不是 object".to_string())?;
    let bundles = profile
        .entry("bundles")
        .or_insert_with(|| JsonValue::Array(Vec::new()));
    let arr = bundles
        .as_array_mut()
        .ok_or_else(|| "bundles 不是数组".to_string())?;
    let mut bundle_changed = false;
    if !arr.iter().any(|b| b.as_str() == Some(pkg_name)) {
        arr.push(JsonValue::String(pkg_name.to_string()));
        bundle_changed = true;
    }

    if dep_changed || bundle_changed {
        write_pkg(profile_dir, &pkg);
    }
    Ok((dep_changed, bundle_changed))
}

// ==================== 诊断 ====================

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
    let mut command = spawn_cmd(cmd);
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

    Err(coded(E_PLUGIN_KEY_UNKNOWN, key))
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

    if let Some(pkg_name) = key.strip_prefix("orphan:") {
        let mut target = profile_dir.join("node_modules");
        for part in pkg_name.split('/') {
            target = target.join(part);
        }
        if target.exists() {
            let _ = fs::remove_dir_all(&target);
        }
        return Ok(());
    }

    Err(coded(E_PLUGIN_KEY_UNKNOWN, key))
}

/// 纳入配置：把本机 link/junction 安装的孤儿包写回 dependencies(link:) + bundles。
/// 仅接受链接目标位于 node_modules 之外的本地安装，避免把 pnpm 实体目录误纳管。
#[tauri::command]
pub fn adopt_dsh_orphan(profile: String, pkg_name: String) -> Result<(), String> {
    let profile_dir = ensure_profile_dir(&profile)?;
    let pkg_name = pkg_name.trim();
    if pkg_name.is_empty() {
        return Err(E_PKG_NAME_EMPTY.to_string());
    }

    let nm_root = profile_dir.join("node_modules");
    let mut nm_pkg = nm_root.clone();
    for part in pkg_name.split('/') {
        if part.is_empty() || part == "." || part == ".." {
            return Err(coded(E_PKG_NAME_INVALID, pkg_name));
        }
        nm_pkg = nm_pkg.join(part);
    }
    if !nm_pkg.exists() {
        return Err(coded(E_PKG_NOT_INSTALLED, pkg_name));
    }

    // 仅允许本地 link/junction 安装：canonicalize 后目标必须落在 node_modules 之外。
    let nm_root_real = fs::canonicalize(&nm_root)
        .map_err(|e| coded(E_ADOPT_LINK_TARGET, e))?;
    let target_real = fs::canonicalize(&nm_pkg)
        .map_err(|e| coded(E_ADOPT_LINK_TARGET, format!("{}: {}", pkg_name, e)))?;
    if target_real.starts_with(&nm_root_real) {
        return Err(coded(E_ADOPT_NOT_LINK, pkg_name));
    }

    // 校验链接目标 package.json 的包名一致。
    let target_pkg_file = target_real.join("package.json");
    let target_text = read_to_string_opt(&target_pkg_file)
        .ok_or_else(|| coded(E_ADOPT_NO_PKG_JSON, target_real.to_string_lossy()))?;
    let target_json: JsonValue = serde_json::from_str(&target_text)
        .map_err(|e| coded(E_ADOPT_NO_PKG_JSON, e))?;
    let target_name = target_json.get("name").and_then(|v| v.as_str()).unwrap_or("");
    if target_name != pkg_name {
        return Err(coded(E_ADOPT_NAME_MISMATCH, format!("期望 {}，实际 {}", pkg_name, if target_name.is_empty() { "?" } else { target_name })));
    }

    // 优先写入可移植的 git+http(s) spec（源目录为 git 仓库且 origin 为 http(s) 时），
    // 否则回退为 link: 本地路径。
    let spec = portable_git_spec(&target_real).unwrap_or_else(|| local_link_spec(&target_real));
    add_dependency_and_bundle(&profile_dir, pkg_name, &spec)?;
    Ok(())
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
        other => Err(coded(E_RECOVERY_UNKNOWN, other)),
    }
}

// ==================== 安装器 ====================

fn pnpm_install_args(mode: &str) -> Vec<String> {
    match mode {
        "update" => vec!["update".to_string()],
        "reinstall-all" => vec!["install".to_string(), "--force".to_string()],
        "reinstall-failed" => vec!["install".to_string(), "--force".to_string()],
        _ => vec!["install".to_string()],
    }
}

struct PnpmRunResult {
    exit_code: Option<i32>,
    timed_out: bool,
    output: String,
}

fn run_pnpm_streaming(
    cmd: &str,
    args: &[String],
    cwd: &Path,
    on_line: &mut dyn FnMut(String),
) -> Result<PnpmRunResult, String> {
    use std::io::{BufRead, BufReader};
    use std::sync::mpsc::{channel, RecvTimeoutError};

    let mut command = spawn_cmd(cmd);
    command
        .args(args)
        .current_dir(cwd)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    // pnpm（Node fetch）不读 Windows WinINET 系统代理，本机直连 GitHub 会被 reset；
    // 与 git 命令一致地注入探测到的系统代理。
    if let Some(proxy) = crate::git_sync::system_proxy() {
        command
            .env("HTTP_PROXY", &proxy)
            .env("HTTPS_PROXY", &proxy)
            .env("http_proxy", &proxy)
            .env("https_proxy", &proxy);
    }

    let mut child = command.spawn().map_err(|e| format!("无法执行 pnpm: {}", e))?;

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    let (tx, rx) = channel::<String>();

    if let Some(out) = stdout {
        let tx = tx.clone();
        std::thread::spawn(move || {
            let reader = BufReader::new(out);
            for line in reader.lines() {
                match line {
                    Ok(l) => {
                        let _ = tx.send(l);
                    }
                    Err(_) => break,
                }
            }
        });
    }
    if let Some(err) = stderr {
        let tx = tx.clone();
        std::thread::spawn(move || {
            let reader = BufReader::new(err);
            for line in reader.lines() {
                match line {
                    Ok(l) => {
                        let _ = tx.send(l);
                    }
                    Err(_) => break,
                }
            }
        });
    }
    drop(tx);

    let mut output_lines: Vec<String> = Vec::new();
    let deadline = Instant::now() + Duration::from_secs(600);
    let mut exit_code = None;
    let mut timed_out = false;

    loop {
        match rx.recv_timeout(Duration::from_millis(100)) {
            Ok(line) => {
                on_line(line.clone());
                output_lines.push(line);
            }
            Err(RecvTimeoutError::Timeout) => {
                if let Ok(Some(status)) = child.try_wait() {
                    exit_code = status.code();
                    break;
                }
                if Instant::now() >= deadline {
                    kill_tree(child.id());
                    let _ = child.kill();
                    timed_out = true;
                    break;
                }
            }
            Err(RecvTimeoutError::Disconnected) => {
                // 管道关闭：等待进程退出
                if let Ok(status) = child.wait() {
                    exit_code = status.code();
                }
                break;
            }
        }
    }

    Ok(PnpmRunResult {
        exit_code,
        timed_out,
        output: output_lines.join("\n"),
    })
}

/// 安装失败回滚配置后，尽力重跑一次 `pnpm install` 把 node_modules 剪枝/对账回当前配置，
/// 避免失败安装留下的残留包在下次对账中被误判为孤儿。失败不回抛，只做 best-effort。
pub(crate) fn reconcile_node_modules(profile_dir: &Path) {
    let cfg = load_config();
    let pnpm_cmd = match resolve_pnpm_command(&cfg) {
        Some(c) => c,
        None => return,
    };
    let mut noop = |_line: String| {};
    let _ = run_pnpm_streaming(&pnpm_cmd, &vec!["install".to_string()], profile_dir, &mut noop);
}

fn declared_pkgs(profile_dir: &Path) -> Vec<(String, String, Option<String>)> {
    let pkg = match read_pkg(profile_dir) {
        Some(p) => p,
        None => return Vec::new(),
    };

    let mut bundles: Vec<String> = Vec::new();
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

    let mut deps: HashMap<String, String> = HashMap::new();
    if let Some(obj) = pkg.get("dependencies").and_then(|d| d.as_object()) {
        for (k, v) in obj {
            if let Some(s) = v.as_str() {
                deps.insert(k.clone(), s.to_string());
            }
        }
    }

    let mut list = Vec::new();
    for b in bundles {
        if b.starts_with(BUILTIN_BUNDLE_PREFIX) {
            continue; // 内置不参与安装校验
        }
        let kind = "bundle".to_string();
        let spec = deps.get(&b).cloned();
        list.push((b, kind, spec));
    }
    let mut dep_names: Vec<String> = deps.keys().cloned().collect();
    dep_names.sort();
    for dep in dep_names {
        if list.iter().any(|(name, _, _)| name == &dep) {
            continue;
        }
        let spec = deps.get(&dep).cloned();
        list.push((dep, "plain".to_string(), spec));
    }
    list
}

fn persist_install_failure(
    state: &mut InstallStateMap,
    profile: &str,
    name: &str,
    reason: &str,
    stack: &str,
) {
    let entry = state.entry(profile.to_string()).or_default();
    entry.insert(
        name.to_string(),
        DshInstallStateItem {
            status: "failed".to_string(),
            reason: reason.to_string(),
            stack: Some(trim_stack(stack, 4096)),
            last_attempt_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0),
        },
    );
}

/// 解析 pnpm 输出中的 `Ignored build scripts: pkg1, pkg2`（pnpm 10+ 构建脚本白名单拦截）。
fn parse_ignored_builds(output: &str) -> Vec<String> {
    let Some(marker) = output.find("Ignored build scripts:") else {
        return Vec::new();
    };
    let rest = &output[marker + "Ignored build scripts:".len()..];
    let line = rest.lines().next().unwrap_or("");
    line.split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty() && !s.to_lowercase().contains("run \"pnpm approve-builds\""))
        .collect()
}

/// 解析 pnpm 输出中的 `ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED`，返回被拒绝的包名列表。
/// 这类错误是「硬失败」：pnpm 会拒绝安装/更新该 git 依赖（prepare 未执行），
/// 旧入口文件仍存在会误导 L3 校验误判为成功，必须显式标记失败。
fn parse_git_prepare_not_allowed(output: &str) -> Vec<String> {
    let mut names: Vec<String> = Vec::new();
    let mut parts = output.split("The git-hosted package '");
    parts.next(); // 跳过前导片段
    for part in parts {
        let Some(end) = part.find('\'') else { continue };
        let full = &part[..end]; // 形如 '@dsh-external/dsh-diff-review@0.0.1'
        // 去掉末尾的 @版本号
        let name = full
            .rsplit_once('@')
            .filter(|(_, ver)| ver.chars().next().is_some_and(|c| c.is_ascii_digit()))
            .map(|(n, _)| n)
            .unwrap_or(full)
            .to_string();
        if !name.is_empty() && !names.contains(&name) {
            names.push(name);
        }
    }
    names
}

fn install_inner(profile: String, mode: String, on_line: Option<&mut dyn FnMut(String)>) -> Result<DshInstallReport, String> {
    let cfg = load_config();
    let pnpm_cmd = resolve_pnpm_command(&cfg)
        .ok_or_else(|| E_PNPM_NOT_FOUND.to_string())?;
    let profile_name = if profile.trim().is_empty() {
        "web".to_string()
    } else {
        profile.trim().to_string()
    };
    let profile_dir = ensure_profile_dir(&profile_name)?;

    // 安装前自动快照（用户可见时间线；失败不阻塞安装）
    let _ = create_dsh_config_snapshot(
        profile_name.clone(),
        "install".to_string(),
        Some("安装前自动快照".to_string()),
    );

    let safe_mode = match mode.as_str() {
        "update" | "reinstall-all" | "reinstall-failed" | "incremental" => mode.as_str().to_string(),
        _ => "incremental".to_string(),
    };

    // 1. 快照备份：仅 package.json / cordis.patch.yml
    let pkg_file = profile_dir.join("package.json");
    let patch_file = profile_dir.join("cordis.patch.yml");
    let snapshot_pkg = read_to_string_opt(&pkg_file);
    let snapshot_patch = read_to_string_opt(&patch_file);

    let before_versions: HashMap<String, Option<String>> = declared_pkgs(&profile_dir)
        .iter()
        .map(|(name, _, _)| (name.clone(), read_installed_version(&profile_dir, name)))
        .collect();

    let mut noop = |_line: String| {};
    let line_sink: &mut dyn FnMut(String) = on_line.unwrap_or(&mut noop);

    let run = run_pnpm_streaming(
        &pnpm_cmd,
        &pnpm_install_args(&safe_mode),
        &profile_dir,
        line_sink,
    )?;

    let declared = declared_pkgs(&profile_dir);
    let mut installed: Vec<String> = Vec::new();
    let mut updated: Vec<String> = Vec::new();
    let mut failed: Vec<DshInstallFailure> = Vec::new();
    let mut warnings: Vec<String> = Vec::new();

    if run.timed_out {
        warnings.push("pnpm 执行超过 10 分钟，已强制终止（timeout）".to_string());
    }

    let mut state = read_install_state();

    let ignored_builds = parse_ignored_builds(&run.output);
    if !ignored_builds.is_empty() {
        warnings.push(format!(
            "pnpm 忽略了以下依赖的构建脚本：{}；如为原生模块，请在 pnpm-workspace.yaml 的 allowBuilds 中放行后重试",
            ignored_builds.join(", ")
        ));
    }

    let git_prepare_blocked = parse_git_prepare_not_allowed(&run.output);
    if !git_prepare_blocked.is_empty() {
        warnings.push(format!(
            "pnpm 拒绝执行 git 依赖 prepare 构建脚本：{}；请在 pnpm-workspace.yaml 的 allowBuilds 中放行对应包/提交后重试",
            git_prepare_blocked.join(", ")
        ));
    }

    for (name, _kind, _spec) in &declared {
        let before = before_versions.get(name).cloned().flatten();
        let after = read_installed_version(&profile_dir, name);
        let l3 = validate_installed_pkg(&profile_dir, name);
        let version_changed = before.is_some() && after.is_some() && before.as_deref() != after.as_deref();
        let blocked = git_prepare_blocked.contains(name);

        // L3 是最终判定：磁盘上入口文件存在即视为该包安装成功。
        // pnpm 可能因「忽略构建脚本」等非致命原因返回非 0 退出码，但包实际已安装，
        // 此时不应把全部声明包都标记为失败。
        // 例外：ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED 是硬失败（prepare 未执行、git 依赖未真正更新），
        // 即使旧入口文件仍在也必须标记失败，避免「虚假成功」。
        if l3.is_ok() && !blocked {
            installed.push(name.clone());
            if version_changed {
                updated.push(name.clone());
            }
            if let Some(profile_state) = state.get_mut(&profile_name) {
                profile_state.remove(name);
            }
            continue;
        }

        if blocked {
            let stack = if run.output.is_empty() {
                "pnpm 拒绝执行 git 依赖 prepare 构建脚本（未加入 allowBuilds）".to_string()
            } else {
                run.output.clone()
            };
            failed.push(DshInstallFailure {
                name: name.clone(),
                reason: "non-zero-exit".to_string(),
                stack: trim_stack(&stack, 4096),
            });
            persist_install_failure(&mut state, &profile_name, name, "non-zero-exit", &stack);
            continue;
        }

        if run.timed_out || run.exit_code != Some(0) {
            failed.push(DshInstallFailure {
                name: name.clone(),
                reason: "non-zero-exit".to_string(),
                stack: trim_stack(&run.output, 4096),
            });
            persist_install_failure(&mut state, &profile_name, name, "non-zero-exit", &run.output);
        } else if let Err(reason) = &l3 {
            failed.push(DshInstallFailure {
                name: name.clone(),
                reason: "missing-entry".to_string(),
                stack: trim_stack(reason, 4096),
            });
            persist_install_failure(&mut state, &profile_name, name, "missing-entry", reason);
        }
    }

    if run.exit_code != Some(0) && !run.timed_out {
        warnings.push(format!(
            "pnpm 退出码为 {:?}，但声明插件已按 L3 入口校验结果记录；请查看终端日志确认是否存在非致命错误",
            run.exit_code
        ));
    }

    // 安装成功与否以 L3 校验结果为准；pnpm 非 0 退出但所有声明包入口校验通过时，
    // 仍视为成功，同时用 warnings 保留 pnpm 的原始退出信息。
    let ok = failed.is_empty() && !run.timed_out;

    // 清理空 profile state
    if let Some(profile_state) = state.get(&profile_name) {
        if profile_state.is_empty() {
            state.remove(&profile_name);
        }
    }
    write_install_state(&state);

    // 失败回滚：仅 incremental / update，且只回滚两个配置文件
    if !ok && (safe_mode == "incremental" || safe_mode == "update") {
        if let Some(s) = &snapshot_pkg {
            let _ = fs::write(&pkg_file, s);
        }
        if let Some(s) = &snapshot_patch {
            let _ = fs::write(&patch_file, s);
        }
        // 回滚配置后重对账 node_modules，避免失败安装残留被误判为孤儿（best-effort）
        reconcile_node_modules(&profile_dir);
    }

    let mut installed = installed;
    let mut updated = updated;
    installed.sort();
    installed.dedup();
    updated.sort();
    updated.dedup();

    Ok(DshInstallReport {
        profile: profile_name,
        mode: safe_mode,
        ok,
        installed,
        updated,
        failed,
        warnings,
        output: run.output,
    })
}

/// 供其他模块（如 dsh_plugins_sync 对齐流程）同步调用的安装入口。
pub fn run_install_blocking(profile: String, mode: String) -> Result<DshInstallReport, String> {
    install_inner(profile, mode, None)
}

/// 兼容旧签名：增量安装并返回完整日志；失败抛错。
#[tauri::command]
pub fn install_dsh_plugins(profile: String) -> Result<String, String> {
    let report = install_inner(profile, "incremental".to_string(), None)?;
    if !report.ok {
        let detail = report
            .failed
            .iter()
            .map(|f| format!("{}: {}\n{}", f.name, f.reason, f.stack))
            .collect::<Vec<_>>()
            .join("\n");
        return Err(format!("pnpm install 未完全成功:\n{}", detail));
    }
    Ok(report.output)
}

#[tauri::command]
pub async fn install_dsh_plugins_v2(profile: String, mode: String) -> Result<DshInstallReport, String> {
    crate::log_info!("install", "开始安装 DSH 插件（profile={}, mode={}）", profile, mode);
    let profile_label = profile.clone();
    let report = tauri::async_runtime::spawn_blocking(move || install_inner(profile.clone(), mode.clone(), None))
        .await
        .map_err(|e| format!("安装执行失败: {}", e))??;
    if report.ok {
        crate::log_info!("install", "DSH 插件安装完成（profile={}, 成功 {} 个）", profile_label, report.installed.len());
    } else {
        crate::log_warn!("install", "DSH 插件安装部分失败（profile={}, 失败 {} 个）", profile_label, report.failed.len());
    }
    Ok(report)
}

#[tauri::command]
pub async fn install_dsh_plugins_streamed(
    profile: String,
    mode: String,
    on_event: tauri::ipc::Channel<String>,
) -> Result<DshInstallReport, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut on_line = |line: String| {
            let _ = on_event.send(line);
        };
        install_inner(profile, mode, Some(&mut on_line))
    })
    .await
    .map_err(|e| format!("安装执行失败: {}", e))?
}

// ==================== 配置快照与回滚 (WI-006) ====================

const SNAPSHOT_FILES: [&str; 4] = [
    "package.json",
    "cordis.patch.yml",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
];
const MAX_AUTO_SNAPSHOTS: usize = 20;

fn safe_profile_name(name: &str) -> String {
    name.replace('/', "_").replace('\\', "_")
}

fn dsh_snapshots_root() -> PathBuf {
    get_backups_dir().join("dsh-profiles")
}

fn snapshot_profile_root(profile: &str) -> PathBuf {
    dsh_snapshots_root().join(safe_profile_name(profile))
}

fn read_snapshot_meta(dir: &Path) -> Option<DshConfigSnapshot> {
    let text = fs::read_to_string(dir.join("meta.json")).ok()?;
    serde_json::from_str(&text).ok()
}

fn list_snapshots_of(profile: &str) -> Vec<DshConfigSnapshot> {
    let root = snapshot_profile_root(profile);
    let mut out = Vec::new();
    if let Ok(entries) = fs::read_dir(&root) {
        for e in entries.flatten() {
            if e.path().is_dir() {
                if let Some(meta) = read_snapshot_meta(&e.path()) {
                    out.push(meta);
                }
            }
        }
    }
    out.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    out
}

fn find_snapshot(snapshot_id: &str) -> Option<(PathBuf, DshConfigSnapshot)> {
    let root = dsh_snapshots_root();
    if let Ok(entries) = fs::read_dir(&root) {
        for e in entries.flatten() {
            if !e.path().is_dir() {
                continue;
            }
            let dir = e.path().join(snapshot_id);
            if let Some(meta) = read_snapshot_meta(&dir) {
                return Some((dir, meta));
            }
        }
    }
    None
}

fn prune_snapshots(profile: &str) {
    let root = snapshot_profile_root(profile);
    let snapshots = list_snapshots_of(profile);
    let mut keep: HashSet<String> = snapshots
        .iter()
        .filter(|s| !s.permanent)
        .take(MAX_AUTO_SNAPSHOTS)
        .map(|s| s.id.clone())
        .collect();
    for s in snapshots.iter().filter(|s| s.permanent) {
        keep.insert(s.id.clone());
    }
    for s in snapshots {
        if !keep.contains(&s.id) {
            let _ = fs::remove_dir_all(root.join(&s.id));
        }
    }
}

/// 创建一份用户可见的配置快照。trigger 仅接受 manual / install / align。
#[tauri::command]
pub fn create_dsh_config_snapshot(
    profile: String,
    trigger: String,
    note: Option<String>,
) -> Result<DshConfigSnapshot, String> {
    let profile_name = if profile.trim().is_empty() {
        "web".to_string()
    } else {
        profile.trim().to_string()
    };
    let profile_dir = resolve_dsh_home().join("profiles").join(&profile_name);
    let now = now_millis();
    let id = format!("dsh-snap-{}", now);
    let snap_dir = snapshot_profile_root(&profile_name).join(&id);
    fs::create_dir_all(&snap_dir).map_err(|e| format!("无法创建快照目录: {}", e))?;

    let mut files = Vec::new();
    for f in SNAPSHOT_FILES {
        let src = profile_dir.join(f);
        if src.exists() {
            let _ = fs::copy(&src, snap_dir.join(f));
            files.push(f.to_string());
        }
    }

    let trigger = match trigger.as_str() {
        "manual" | "install" | "align" | "upgrade" => trigger,
        _ => "manual".to_string(),
    };
    let meta = DshConfigSnapshot {
        id: id.clone(),
        created_at: now,
        trigger,
        note: note.filter(|s| !s.trim().is_empty()),
        permanent: false,
        profile_name: profile_name.clone(),
        files,
    };
    let meta_text = serde_json::to_string_pretty(&meta).map_err(|e| e.to_string())?;
    fs::write(snap_dir.join("meta.json"), meta_text).map_err(|e| e.to_string())?;

    prune_snapshots(&profile_name);
    crate::log_info!("snapshot", "创建配置快照 {}（profile={}, trigger={}）", id, profile_name, meta.trigger);
    Ok(meta)
}

#[tauri::command]
pub fn list_dsh_config_snapshots(profile: String) -> Vec<DshConfigSnapshot> {
    let profile_name = if profile.trim().is_empty() {
        "web".to_string()
    } else {
        profile.trim().to_string()
    };
    list_snapshots_of(&profile_name)
}

#[tauri::command]
pub fn rollback_dsh_config_snapshot(
    snapshot_id: String,
) -> Result<DshSnapshotRollbackResult, String> {
    let (dir, meta) = find_snapshot(&snapshot_id)
        .ok_or_else(|| format!("未找到快照: {}", snapshot_id))?;
    let profile_name = meta.profile_name.clone();
    let profile_dir = resolve_dsh_home().join("profiles").join(&profile_name);
    fs::create_dir_all(&profile_dir).map_err(|e| e.to_string())?;

    let mut restored = Vec::new();
    for f in SNAPSHOT_FILES {
        let snap_file = dir.join(f);
        let target = profile_dir.join(f);
        if snap_file.exists() {
            fs::copy(&snap_file, &target).map_err(|e| e.to_string())?;
            restored.push(f.to_string());
        } else if target.exists() {
            let _ = fs::remove_file(&target);
            restored.push(f.to_string());
        }
    }

    Ok(DshSnapshotRollbackResult {
        profile: profile_name,
        restored,
        needs_install: true,
    })
}

#[tauri::command]
pub fn set_dsh_config_snapshot_permanent(
    snapshot_id: String,
    permanent: bool,
) -> Result<DshConfigSnapshot, String> {
    let (dir, mut meta) = find_snapshot(&snapshot_id)
        .ok_or_else(|| format!("未找到快照: {}", snapshot_id))?;
    meta.permanent = permanent;
    let text = serde_json::to_string_pretty(&meta).map_err(|e| e.to_string())?;
    fs::write(dir.join("meta.json"), text).map_err(|e| e.to_string())?;
    Ok(meta)
}

#[tauri::command]
pub fn delete_dsh_config_snapshot(snapshot_id: String) -> Result<(), String> {
    let (dir, _meta) = find_snapshot(&snapshot_id)
        .ok_or_else(|| format!("未找到快照: {}", snapshot_id))?;
    fs::remove_dir_all(&dir).map_err(|e| e.to_string())
}

// ==================== DSH 版本升级与版本管理 (WI-009) ====================

pub(crate) const DSH_PACKAGE_NAME: &str = "@deepseek-ai/dsh";
const MAX_VERSION_HISTORY: usize = 50;

fn parse_version_token(text: &str) -> Option<String> {
    let re = regex::Regex::new(r"v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?").unwrap();
    re.find(text)
        .map(|m| m.as_str().trim_start_matches('v').to_string())
}

fn run_npm_sync(npm_cmd: &str, args: &[String]) -> RunResult {
    run_with_timeout(npm_cmd, args, None, 30000)
}

fn npm_global_root(npm_cmd: &str) -> Option<PathBuf> {
    let run = run_npm_sync(npm_cmd, &["root".to_string(), "-g".to_string()]);
    if run.exit_code != Some(0) {
        return None;
    }
    let root = run.output.lines().next()?.trim();
    if root.is_empty() {
        return None;
    }
    Some(PathBuf::from(root))
}

fn read_global_npm_package_version(npm_cmd: &str, pkg_name: &str) -> Option<String> {
    let root = npm_global_root(npm_cmd)?;
    let mut p = root;
    for part in pkg_name.split('/') {
        p = p.join(part);
    }
    p = p.join("package.json");
    let text = fs::read_to_string(p).ok()?;
    let v: JsonValue = serde_json::from_str(&text).ok()?;
    v.get("version")?.as_str().map(|s| s.to_string())
}

/// 当前 DSH 版本：优先 `dsh --version`，回退 npm 全局包 package.json（两者交叉验证，实测为准）。
pub fn get_current_dsh_version() -> Option<String> {
    let cfg = load_config();
    if let Some(dsh_cmd) = resolve_dsh_command(&cfg) {
        let run = run_with_timeout(&dsh_cmd, &["--version".to_string()], None, 10000);
        if let Some(v) = parse_version_token(&run.output) {
            return Some(v);
        }
    }

    let npm_cmd = resolve_npm_command(&cfg)?;
    read_global_npm_package_version(&npm_cmd, DSH_PACKAGE_NAME)
}

#[tauri::command]
pub fn get_dsh_version_info() -> DshVersionInfo {
    let cfg = load_config();
    DshVersionInfo {
        package_name: DSH_PACKAGE_NAME.to_string(),
        current: get_current_dsh_version(),
        dsh_command: resolve_dsh_command(&cfg),
        npm_command: resolve_npm_command(&cfg),
        checked_at: now_millis(),
    }
}

#[tauri::command]
pub fn check_dsh_version_update() -> DshVersionCheck {
    let cfg = load_config();
    let current = get_current_dsh_version();
    let checked_at = now_millis();

    if resolve_npm_command(&cfg).is_none() {
        return DshVersionCheck {
            package_name: DSH_PACKAGE_NAME.to_string(),
            current,
            latest: None,
            update_available: false,
            checked_at,
            error: Some("未找到 npm 命令，请先安装 Node.js / npm".to_string()),
        };
    }

    match query_npm_latest(DSH_PACKAGE_NAME) {
        Ok(latest) => DshVersionCheck {
            package_name: DSH_PACKAGE_NAME.to_string(),
            update_available: current
                .as_deref()
                .map(|c| semver_newer(&latest, c))
                .unwrap_or(false),
            current,
            latest: Some(latest),
            checked_at,
            error: None,
        },
        Err(e) => DshVersionCheck {
            package_name: DSH_PACKAGE_NAME.to_string(),
            current,
            latest: None,
            update_available: false,
            checked_at,
            error: Some(e),
        },
    }
}

/// 列出 npm registry 上该包的所有已发布版本（降序），供「安装指定版本」下拉选择。
#[tauri::command]
pub fn list_dsh_available_versions() -> DshAvailableVersions {
    let current = get_current_dsh_version();
    match query_npm_versions(DSH_PACKAGE_NAME) {
        Ok((latest, versions)) => DshAvailableVersions {
            package_name: DSH_PACKAGE_NAME.to_string(),
            current,
            latest,
            versions,
            error: None,
        },
        Err(e) => DshAvailableVersions {
            package_name: DSH_PACKAGE_NAME.to_string(),
            current,
            latest: None,
            versions: Vec::new(),
            error: Some(e),
        },
    }
}

/// 一键启动 `dsh web`（常驻进程，detached 不阻塞）。
///
/// 核心难点「成功常驻 vs 失败捕获」：`dsh web` 成功时不会退出，失败时很快退出并写
/// stderr。这里用宽限窗口轮询 `try_wait`：
/// - 窗口内退出 → 判定失败，返回累积的 stderr；
/// - 窗口结束仍存活 → 判定成功，返回 pid，不杀子进程（drop `Child` 不会杀进程）。
#[tauri::command]
pub async fn launch_dsh_web(profile: Option<String>) -> DshLaunchResult {
    tauri::async_runtime::spawn_blocking(move || launch_dsh_web_inner(profile))
        .await
        .unwrap_or_else(|e| DshLaunchResult {
            ok: false,
            pid: None,
            message: None,
            error: Some(format!("启动执行失败: {}", e)),
            stderr: None,
        })
}

fn launch_dsh_web_inner(profile: Option<String>) -> DshLaunchResult {
    let cfg = load_config();
    let dsh_cmd = match resolve_dsh_command(&cfg) {
        Some(c) => c,
        None => {
            return DshLaunchResult {
                ok: false,
                pid: None,
                message: None,
                error: Some("未找到 dsh 命令，请在「设置」中配置 dshCommand，或先安装 DeepSeek Harness".to_string()),
                stderr: None,
            }
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
    let mut command = spawn_cmd(&dsh_cmd);
    command
        .args(&args)
        .stdout(Stdio::null())
        .stderr(Stdio::piped());
    if cwd.exists() {
        command.current_dir(&cwd);
    }

    let mut child = match command.spawn() {
        Ok(c) => c,
        Err(e) => {
            return DshLaunchResult {
                ok: false,
                pid: None,
                message: None,
                error: Some(format!("无法启动 dsh: {}", e)),
                stderr: None,
            }
        }
    };

    let pid = child.id();
    let stderr = child.stderr.take();
    let captured = Arc::new(Mutex::new(String::new()));
    let reader = if let Some(mut s) = stderr {
        let c = captured.clone();
        Some(std::thread::spawn(move || {
            let mut buf = String::new();
            let _ = s.read_to_string(&mut buf);
            if let Ok(mut g) = c.lock() {
                g.push_str(&buf);
            }
        }))
    } else {
        None
    };

    // 宽限窗口：成功常驻，失败通常在 1~2 秒内退出。取 4 秒，兼顾「错误 profile 快速
    // 失败」与「冷启动较慢但成功」的场景。
    let grace = Duration::from_secs(4);
    let start = Instant::now();
    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                if let Some(r) = reader {
                    let _ = r.join();
                }
                let raw = captured.lock().unwrap().clone();
                let stderr_text = trim_stack(&raw, 4096);
                let text = if stderr_text.is_empty() {
                    format!(
                        "dsh web 启动后立即退出（exit code: {}）",
                        status
                            .code()
                            .map(|c| c.to_string())
                            .unwrap_or_else(|| "未知".to_string())
                    )
                } else {
                    stderr_text
                };

                let lower = text.to_lowercase();
                if lower.contains("eaddrinuse") || text.contains("端口占用") || text.contains("端口已被占用") {
                    return DshLaunchResult {
                        ok: false,
                        pid: None,
                        message: None,
                        error: None,
                        stderr: Some(text),
                    };
                }

                return DshLaunchResult {
                    ok: false,
                    pid: None,
                    message: None,
                    error: Some(text.clone()),
                    stderr: Some(text),
                };
            }
            Ok(None) => {
                if start.elapsed() >= grace {
                    return DshLaunchResult {
                        ok: true,
                        pid: Some(pid),
                        message: Some(format!("已启动 dsh web（profile: {}）", profile_name)),
                        error: None,
                        stderr: None,
                    };
                }
                std::thread::sleep(Duration::from_millis(100));
            }
            Err(_) => {
                return DshLaunchResult {
                    ok: true,
                    pid: Some(pid),
                    message: Some(format!("已启动 dsh web（profile: {}）", profile_name)),
                    error: None,
                    stderr: None,
                };
            }
        }
    }
}

fn version_history_file() -> PathBuf {
    crate::storage::get_app_data_dir().join("dsh_version_history.json")
}

fn read_version_history() -> Vec<DshVersionHistoryEntry> {
    let f = version_history_file();
    if !f.exists() {
        return Vec::new();
    }
    let text = match fs::read_to_string(&f) {
        Ok(t) => t,
        Err(_) => return Vec::new(),
    };
    serde_json::from_str::<Vec<DshVersionHistoryEntry>>(&text).unwrap_or_default()
}

fn append_version_history(entry: &DshVersionHistoryEntry) {
    let mut list = read_version_history();
    list.insert(0, entry.clone());
    list.truncate(MAX_VERSION_HISTORY);
    let dir = crate::storage::get_app_data_dir();
    let _ = fs::create_dir_all(&dir);
    if let Ok(text) = serde_json::to_string_pretty(&list) {
        let _ = fs::write(version_history_file(), format!("{}\n", text));
    }
}

#[tauri::command]
pub fn list_dsh_versions() -> Vec<DshVersionHistoryEntry> {
    read_version_history()
}

/// 升级前后诊断对比：对每个 profile 跑一次 `diagnose_inner`，累计失败插件条目数。
fn count_dsh_failures() -> u32 {
    let profiles = list_profile_dirs(&resolve_dsh_home().join("profiles"));
    let targets: Vec<String> = if profiles.is_empty() {
        vec!["web".to_string()]
    } else {
        profiles
    };
    let mut total = 0u32;
    for p in targets {
        let r = diagnose_inner(Some(p));
        total += r.failed_plugins.len() as u32;
    }
    total
}

fn version_change_inner(
    target: String,
    action: String,
    on_line: Option<&mut dyn FnMut(String)>,
) -> DshVersionUpgradeResult {
    let cfg = load_config();
    let before_version = get_current_dsh_version();
    let safe_target = if target.trim().is_empty() {
        "latest".to_string()
    } else {
        target.trim().to_string()
    };

    let base = || DshVersionUpgradeResult {
        ok: false,
        action: action.clone(),
        before_version: before_version.clone(),
        after_version: before_version.clone(),
        target_version: safe_target.clone(),
        snapshot_ids: Vec::new(),
        diagnosis_before: 0,
        diagnosis_after: 0,
        mass_failure: false,
        output: String::new(),
        warnings: Vec::new(),
        error: None,
    };

    let npm_cmd = match resolve_npm_command(&cfg) {
        Some(c) => c,
        None => {
            let mut r = base();
            r.error = Some("未找到 npm 命令，请先安装 Node.js / npm".to_string());
            return r;
        }
    };

    if safe_target != "latest" {
        let re = regex::Regex::new(r"^v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$").unwrap();
        if !re.is_match(&safe_target) {
            let mut r = base();
            r.error = Some(format!("非法版本号: {}", safe_target));
            return r;
        }
    }

    let mut noop = |_line: String| {};
    let line_sink: &mut dyn FnMut(String) = match on_line {
        Some(f) => f,
        None => &mut noop,
    };
    let action_label = if action == "upgrade" { "升级" } else { "安装" };
    let spec = if safe_target == "latest" {
        format!("{}@latest", DSH_PACKAGE_NAME)
    } else {
        format!("{}@{}", DSH_PACKAGE_NAME, safe_target)
    };
    line_sink(format!("→ 开始{} DSH：{}", action_label, spec));
    line_sink(format!(
        "→ 当前版本：{}",
        before_version.as_deref().unwrap_or("未知")
    ));

    // 1) 升级前诊断基准（每个 profile 跑一次 dsh web 诊断，可能耗时）
    line_sink("→ 诊断插件失败基线（变更前）…".to_string());
    let diagnosis_before = count_dsh_failures();
    line_sink(format!("→ 变更前诊断完成：失败插件 {} 个", diagnosis_before));

    // 2) 升级前自动快照（所有 profile，复用 WI-006）
    line_sink("→ 创建变更前配置快照…".to_string());
    let mut snapshot_ids = Vec::new();
    let profiles = list_profile_dirs(&resolve_dsh_home().join("profiles"));
    let snapshot_targets: Vec<String> = if profiles.is_empty() {
        vec!["web".to_string()]
    } else {
        profiles
    };
    for p in snapshot_targets {
        match create_dsh_config_snapshot(
            p.clone(),
            "upgrade".to_string(),
            Some("DSH 升级前自动快照".to_string()),
        ) {
            Ok(snap) => {
                line_sink(format!("→ 已创建快照 profile [{}]：{}", p, snap.id));
                snapshot_ids.push(snap.id);
            }
            Err(_) => {
                line_sink(format!("→ profile [{}] 快照创建失败（跳过）", p));
            }
        }
    }

    // 3) npm install -g（复用 run_pnpm_streaming 的 spawn + 代理注入 + 超时能力）
    let cwd = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    line_sink(format!("→ 执行 npm install -g {} …", spec));
    let run = run_pnpm_streaming(
        &npm_cmd,
        &vec!["install".to_string(), "-g".to_string(), spec],
        &cwd,
        &mut *line_sink,
    );

    let mut r = base();
    r.diagnosis_before = diagnosis_before;
    r.snapshot_ids = snapshot_ids;

    let (run_output, install_ok) = match run {
        Ok(res) => {
            let ok = res.exit_code == Some(0) && !res.timed_out;
            if res.timed_out {
                r.warnings
                    .push("npm install -g 执行超过 10 分钟，已强制终止（timeout）".to_string());
            }
            if !ok {
                r.warnings
                    .push(format!("npm install -g 退出码为 {:?}", res.exit_code));
            }
            (res.output, ok)
        }
        Err(e) => {
            r.warnings.push(e.clone());
            (e, false)
        }
    };
    r.output = run_output;

    line_sink("→ npm install 结束，正在诊断插件失败基线（变更后）…".to_string());
    r.after_version = get_current_dsh_version();
    r.diagnosis_after = count_dsh_failures();
    line_sink(format!("→ 变更后诊断完成：失败插件 {} 个", r.diagnosis_after));
    r.mass_failure = r.diagnosis_after > r.diagnosis_before;
    r.ok = install_ok && !r.mass_failure;
    if r.mass_failure {
        r.warnings.push(format!(
            "升级后失败插件数 {} → {}，疑似插件大面积失效，建议一键回滚",
            r.diagnosis_before, r.diagnosis_after
        ));
    }

    append_version_history(&DshVersionHistoryEntry {
        version: r.after_version.clone().unwrap_or_else(|| safe_target.clone()),
        action: action.clone(),
        installed_at: now_millis(),
        from_version: before_version.clone(),
        note: Some(if action == "upgrade" {
            "升级到最新版".to_string()
        } else {
            format!("安装指定版本 {}", safe_target)
        }),
    });

    r
}

#[tauri::command]
pub async fn upgrade_dsh_version() -> Result<DshVersionUpgradeResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        version_change_inner("latest".to_string(), "upgrade".to_string(), None)
    })
    .await
    .map_err(|e| format!("升级执行失败: {}", e))
}

#[tauri::command]
pub async fn install_dsh_version(target_version: String) -> Result<DshVersionUpgradeResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        version_change_inner(target_version, "install".to_string(), None)
    })
    .await
    .map_err(|e| format!("安装执行失败: {}", e))
}

#[tauri::command]
pub async fn upgrade_dsh_version_streamed(
    on_event: tauri::ipc::Channel<String>,
) -> Result<DshVersionUpgradeResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut on_line = |line: String| {
            let _ = on_event.send(line);
        };
        version_change_inner(
            "latest".to_string(),
            "upgrade".to_string(),
            Some(&mut on_line),
        )
    })
    .await
    .map_err(|e| format!("升级执行失败: {}", e))
}

#[tauri::command]
pub async fn install_dsh_version_streamed(
    target_version: String,
    on_event: tauri::ipc::Channel<String>,
) -> Result<DshVersionUpgradeResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut on_line = |line: String| {
            let _ = on_event.send(line);
        };
        version_change_inner(
            target_version,
            "install".to_string(),
            Some(&mut on_line),
        )
    })
    .await
    .map_err(|e| format!("安装执行失败: {}", e))
}

/// 一键回滚：同时覆盖两层 —— DSH 版本（装回旧版）+ 插件配置（复用 rollback_dsh_config_snapshot）。
fn rollback_inner(
    previous_version: String,
    snapshot_ids: Vec<String>,
    on_line: Option<&mut dyn FnMut(String)>,
) -> Result<DshVersionRollbackResult, String> {
    let cfg = load_config();
    let npm_cmd = resolve_npm_command(&cfg).ok_or_else(|| "未找到 npm 命令".to_string())?;
    let prev = previous_version.trim().to_string();
    if prev.is_empty() {
        return Err("缺少回滚目标版本（previousVersion）".to_string());
    }

    let mut noop = |_line: String| {};
    let line_sink: &mut dyn FnMut(String) = match on_line {
        Some(f) => f,
        None => &mut noop,
    };
    line_sink(format!("→ 开始回滚 DSH：目标版本 {}", prev));

    // 1) 回滚配置快照（复用 WI-006）
    line_sink(format!("→ 回滚配置快照（{} 份）…", snapshot_ids.len()));
    let mut restored_snapshots = Vec::new();
    for id in &snapshot_ids {
        match rollback_dsh_config_snapshot(id.clone()) {
            Ok(r) => {
                line_sink(format!("→ 已回滚快照 {}", id));
                restored_snapshots.push(r);
            }
            Err(_) => {
                line_sink(format!("→ 快照 {} 回滚失败（跳过）", id));
            }
        }
    }

    // 2) 装回旧版本
    let cwd = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    line_sink(format!("→ 执行 npm install -g {}@{} …", DSH_PACKAGE_NAME, prev));
    let run = run_pnpm_streaming(
        &npm_cmd,
        &vec![
            "install".to_string(),
            "-g".to_string(),
            format!("{}@{}", DSH_PACKAGE_NAME, prev),
        ],
        &cwd,
        &mut *line_sink,
    )
    .map_err(|e| e)?;

    let version = get_current_dsh_version();
    let ok = run.exit_code == Some(0) && !run.timed_out;
    line_sink(format!("→ 回滚完成：当前版本 {}", version.clone().unwrap_or_else(|| prev.clone())));

    append_version_history(&DshVersionHistoryEntry {
        version: version.clone().unwrap_or_else(|| prev.clone()),
        action: "rollback".to_string(),
        installed_at: now_millis(),
        from_version: None,
        note: Some(format!("回滚到 {}", prev)),
    });

    Ok(DshVersionRollbackResult {
        ok,
        version,
        restored_snapshots,
        output: run.output.clone(),
        error: if ok { None } else { Some(run.output) },
    })
}

#[tauri::command]
pub async fn rollback_dsh_version(
    previous_version: String,
    snapshot_ids: Vec<String>,
) -> Result<DshVersionRollbackResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        rollback_inner(previous_version, snapshot_ids, None)
    })
    .await
    .map_err(|e| format!("回滚执行失败: {}", e))?
}

#[tauri::command]
pub async fn rollback_dsh_version_streamed(
    previous_version: String,
    snapshot_ids: Vec<String>,
    on_event: tauri::ipc::Channel<String>,
) -> Result<DshVersionRollbackResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut on_line = |line: String| {
            let _ = on_event.send(line);
        };
        rollback_inner(previous_version, snapshot_ids, Some(&mut on_line))
    })
    .await
    .map_err(|e| format!("回滚执行失败: {}", e))?
}
