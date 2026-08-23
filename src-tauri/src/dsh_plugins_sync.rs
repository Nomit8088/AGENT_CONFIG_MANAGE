use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use crate::git_sync::run_git;

use serde_json::Value as JsonValue;

use crate::dsh_plugins::{
    create_dsh_config_snapshot, is_portable_spec, list_profile_dirs, read_pkg,
    reconcile_node_modules, resolve_dsh_home, run_install_blocking, write_pkg, BUILTIN_BUNDLE_PREFIX,
};
use crate::models::{DshPluginDiff, DshPluginDiffItem, DshPluginsSyncConfig, SkillsSyncStatus, SyncDiffEntry};
use crate::storage::{get_app_data_dir, load_config, save_config};

/// 与 skills sync 共用同一 Git 仓库根目录。
fn sync_root() -> PathBuf {
    get_app_data_dir()
}

fn dsh_mirror_dir() -> PathBuf {
    get_app_data_dir().join("dsh")
}

fn mirror_profile_dir(profile: &str) -> PathBuf {
    dsh_mirror_dir().join("profiles").join(profile)
}

const GITIGNORE_CONTENT: &str = "# AgentHub sync repo local-only files
config.json
agents.json
projects.json
dsh_install_state.json
backups/
*.log
.DS_Store
Thumbs.db
";

fn ensure_gitignore(root: &Path) {
    let gitignore = root.join(".gitignore");
    if !gitignore.exists() {
        let _ = fs::write(&gitignore, GITIGNORE_CONTENT);
        return;
    }
    // 已有 .gitignore 时补齐新增的私有文件条目（幂等）
    if let Ok(text) = fs::read_to_string(&gitignore) {
        let missing: Vec<&str> = GITIGNORE_CONTENT
            .lines()
            .filter(|l| !l.trim().is_empty() && !text.contains(l.trim()))
            .collect();
        if !missing.is_empty() {
            let mut new_text = text.trim_end().to_string();
            new_text.push('\n');
            new_text.push_str(&missing.join("\n"));
            new_text.push('\n');
            let _ = fs::write(&gitignore, new_text);
        }
    }
}

fn git_try(cwd: &Path, args: &[&str]) -> String {
    run_git(cwd, args.iter().copied()).unwrap_or_default()
}

/// 只统计指定路径范围内的未提交修改（含未跟踪文件），用于按功能隔离同步状态。
fn git_dirty_count_paths(cwd: &Path, paths: &[&str]) -> i32 {
    let mut args = vec!["status", "--porcelain", "--"];
    for p in paths {
        if cwd.join(p).exists() {
            args.push(p);
        }
    }
    if args.len() == 3 {
        return 0; // 范围内没有任何路径存在
    }
    let out = git_try(cwd, &args);
    out.lines().filter(|l| !l.trim().is_empty()).count() as i32
}

fn parse_ahead_behind(status_sb: &str) -> (i32, i32) {
    let first = status_sb.lines().next().unwrap_or("").to_string();
    if !first.starts_with("## ") {
        return (0, 0);
    }
    let mut ahead = 0;
    let mut behind = 0;
    if let Some(start) = first.find('[') {
        let bracket = &first[start..];
        if let Some(pos) = bracket.find("ahead ") {
            let rest = &bracket[pos + "ahead ".len()..];
            let num: String = rest.chars().take_while(|c| c.is_ascii_digit()).collect();
            ahead = num.parse().unwrap_or(0);
        }
        if let Some(pos) = bracket.find("behind ") {
            let rest = &bracket[pos + "behind ".len()..];
            let num: String = rest.chars().take_while(|c| c.is_ascii_digit()).collect();
            behind = num.parse().unwrap_or(0);
        }
    }
    (ahead, behind)
}

fn sync_config() -> DshPluginsSyncConfig {
    load_config()
        .dsh_plugins
        .and_then(|p| p.sync)
        .unwrap_or_default()
}

fn save_sync_config(cfg: &DshPluginsSyncConfig) -> Result<(), String> {
    let mut app_cfg = load_config();
    let mut plugins = app_cfg.dsh_plugins.clone().unwrap_or_default();
    plugins.sync = Some(cfg.clone());
    app_cfg.dsh_plugins = Some(plugins);
    save_config(&app_cfg)
}

/// 与 skills sync 共用同一 .git：本功能配置为空时，回退到共享仓库实际的 origin / 当前分支，
/// 再回退到另一功能的配置，避免同一仓库出现“一边已配置、一边未配置”的假象。
fn effective_remote_url(cfg: &DshPluginsSyncConfig) -> String {
    let global = crate::sync_repo::global_remote_url();
    if !global.is_empty() {
        return global;
    }
    if !cfg.remote_url.is_empty() {
        return cfg.remote_url.clone();
    }
    let root = sync_root();
    if root.join(".git").exists() {
        if let Ok(url) = run_git(&root, ["remote", "get-url", "origin"]) {
            let url = url.trim().to_string();
            if !url.is_empty() {
                return url;
            }
        }
    }
    load_config()
        .skills_sync
        .map(|s| s.remote_url)
        .unwrap_or_default()
}

fn effective_branch(cfg: &DshPluginsSyncConfig) -> String {
    let global = crate::sync_repo::global_branch();
    if !global.is_empty() {
        return global;
    }
    if !cfg.branch.is_empty() {
        return cfg.branch.clone();
    }
    let root = sync_root();
    if root.join(".git").exists() {
        if let Ok(branch) = run_git(&root, ["rev-parse", "--abbrev-ref", "HEAD"]) {
            let branch = branch.trim().to_string();
            if !branch.is_empty() && branch != "HEAD" {
                return branch;
            }
        }
    }
    load_config()
        .skills_sync
        .map(|s| s.branch)
        .filter(|b| !b.is_empty())
        .unwrap_or_else(|| "main".to_string())
}

fn update_last_sync(status: &str, error: Option<&str>) -> Result<(), String> {
    let mut cfg = sync_config();
    cfg.last_sync_status = status.to_string();
    cfg.last_sync_at = chrono::Utc::now().timestamp_millis() as u64;
    cfg.last_error = error.map(|s| s.to_string());
    save_sync_config(&cfg)
}

#[tauri::command]
pub fn get_dsh_plugins_sync_status() -> SkillsSyncStatus {
    let root = sync_root();
    let cfg = sync_config();
    let initialized = root.join(".git").exists();

    let mut status = SkillsSyncStatus {
        initialized,
        remote_url: {
            let url = effective_remote_url(&cfg);
            if url.is_empty() {
                None
            } else {
                Some(url)
            }
        },
        branch: None,
        ahead: 0,
        behind: 0,
        dirty_count: 0,
        last_sync_at: if cfg.last_sync_at > 0 {
            Some(cfg.last_sync_at)
        } else {
            None
        },
        last_sync_status: cfg.last_sync_status.clone(),
        last_error: cfg.last_error.clone(),
    };

    if initialized {
        if let Ok(branch) = run_git(&root, ["rev-parse", "--abbrev-ref", "HEAD"]) {
            status.branch = Some(branch);
        }
        if let Ok(sb) = run_git(&root, ["status", "-sb", "--porcelain=v1"]) {
            let (ahead, behind) = parse_ahead_behind(&sb);
            status.ahead = ahead;
            status.behind = behind;
            // 按功能隔离：只统计 DSH 插件范围内的未提交修改（与技能同步分开）
            status.dirty_count = git_dirty_count_paths(&root, &["dsh", ".gitignore"]);
        }
    }

    status
}

/// DSH 插件范围的「本地 vs 远端」文件级差异（复用共享仓库 origin/<branch>）。
#[tauri::command]
pub fn get_dsh_plugins_sync_diff() -> Vec<SyncDiffEntry> {
    let root = sync_root();
    if !root.join(".git").exists() {
        return Vec::new();
    }
    let cfg = sync_config();
    let branch = effective_branch(&cfg);
    crate::git_sync::sync_diff(&root, "dsh", &branch)
}

#[tauri::command]
pub fn init_dsh_plugins_sync(
    remote_url: String,
    branch: Option<String>,
) -> Result<SkillsSyncStatus, String> {
    let root = sync_root();
    fs::create_dir_all(&root).map_err(|e| format!("无法创建同步根目录: {}", e))?;
    ensure_gitignore(&root);

    let branch = branch
        .filter(|b| !b.trim().is_empty())
        .unwrap_or_else(|| "main".to_string());

    // 幂等：与 skills sync 共用同一 .git，无 .git 才 init
    if !root.join(".git").exists() {
        if run_git(&root, ["init", "-b", branch.as_str()]).is_err() {
            run_git(&root, ["init"]).map_err(|e| format!("初始化 Git 仓库失败: {}", e))?;
            let head_ref = format!("refs/heads/{}", branch);
            let _ = run_git(&root, ["symbolic-ref", "HEAD", head_ref.as_str()]);
        }
        let _ = run_git(&root, ["remote", "remove", "origin"]);
        run_git(&root, ["remote", "add", "origin", remote_url.as_str()])
            .map_err(|e| format!("设置远端仓库失败: {}", e))?;
    } else if !remote_url.is_empty() {
        let _ = run_git(&root, ["remote", "remove", "origin"]);
        run_git(&root, ["remote", "add", "origin", remote_url.as_str()])
            .map_err(|e| format!("设置远端仓库失败: {}", e))?;
    }

    if run_git(&root, ["fetch", "origin"]).is_ok() {
        let remote_ref = format!("origin/{}", branch);
        if run_git(&root, ["rev-parse", "--verify", remote_ref.as_str()]).is_ok() {
            let head = run_git(&root, ["rev-parse", "--verify", "HEAD"]).unwrap_or_default();
            if head.is_empty() {
                let head_ref = format!("refs/heads/{}", branch);
                let _ = run_git(&root, ["symbolic-ref", "HEAD", head_ref.as_str()]);
                let _ = run_git(&root, ["reset", "--mixed", remote_ref.as_str()]);
            }
        }
    }

    let mut cfg = sync_config();
    cfg.remote_url = remote_url;
    cfg.branch = branch;
    cfg.last_sync_status = "idle".to_string();
    cfg.last_error = None;
    save_sync_config(&cfg)?;

    Ok(get_dsh_plugins_sync_status())
}

#[tauri::command]
pub fn pull_dsh_plugins_sync() -> Result<SkillsSyncStatus, String> {
    let root = sync_root();
    let cfg = sync_config();

    if !root.join(".git").exists() {
        return Err("尚未初始化同步仓库，请先在插件同步中初始化".to_string());
    }
    if effective_remote_url(&cfg).is_empty() {
        return Err("尚未配置远端仓库地址".to_string());
    }

    let dirty = git_dirty_count_paths(&root, &["dsh", ".gitignore"]);
    if dirty > 0 {
        let msg = format!("DSH 插件同步：本地有 {} 个未提交修改（dsh/.gitignore），已跳过拉取；请先推送或手动处理", dirty);
        let _ = update_last_sync("error", Some(&msg));
        return Err(msg);
    }

    let branch = effective_branch(&cfg);
    match run_git(&root, ["pull", "--ff-only", "origin", branch.as_str()]) {
        Ok(_) => {
            update_last_sync("success", None)?;
            Ok(get_dsh_plugins_sync_status())
        }
        Err(e) => {
            let msg = format!("拉取失败: {}", e);
            let _ = update_last_sync("error", Some(&msg));
            Err(msg)
        }
    }
}

/// 判断一行是否是「n 空格 + 非空格」开头的子行（用于锁文件的文本级块跳过）。
fn is_indent_sub(line: &str, n: usize) -> bool {
    let b = line.as_bytes();
    b.len() > n && b[..n].iter().all(|c| *c == b' ') && b[n] != b' '
}

/// 顶层条目 key 中内嵌不可移植 spec 的识别（如 `dep@link:../x`、`@scope/pkg@file:...`）。
/// 包名本身不含 `:`，因此 key 里出现这些前缀只可能来自 spec。
fn unportable_lock_key(line: &str) -> bool {
    let re = regex::Regex::new(r"@(?:link:|file:|workspace:|portal:|catalog:|git\+ssh:|ssh:|git@)").unwrap();
    re.is_match(line)
}

/// 清洗 pnpm-lock.yaml：剔除不可移植（link:/file:/workspace:/portal:/catalog:/git+ssh:/ssh:/git@）条目引用，
/// 避免本机路径/内部协议漏进同步镜像。只做文本级过滤，保留 pnpm 原始格式与注释。
fn sanitize_lock_for_mirror(text: &str) -> String {
    let lines: Vec<&str> = text.lines().collect();
    let mut out: Vec<&str> = Vec::new();
    let mut section: u8 = 0; // 0=none 1=importers 2=packages 3=snapshots
    let mut skip_deep = false;
    let mut i = 0usize;

    while i < lines.len() {
        let line = lines[i];

        // 顶层 section 切换（列 0 的非缩进行）
        if !line.is_empty() && !line.starts_with(' ') && !line.starts_with('\t') {
            section = if line.starts_with("importers:") {
                1
            } else if line.starts_with("packages:") {
                2
            } else if line.starts_with("snapshots:") {
                3
            } else {
                0
            };
            skip_deep = false;
            out.push(line);
            i += 1;
            continue;
        }

        if section == 1 {
            // 依赖条目 key：6 空格缩进；紧随其后的 `specifier:` 为真实 spec
            if is_indent_sub(line, 6) && line.trim_end().ends_with(':') {
                if let Some(spec_line) = lines.get(i + 1) {
                    let t = spec_line.trim_start();
                    if let Some(v) = t.strip_prefix("specifier:") {
                        let spec = v.trim().trim_matches(|c| c == '\'' || c == '"');
                        if !is_portable_spec(Some(spec)) {
                            // 跳过该依赖条目（key + specifier + version 等 8 空格子行）
                            i += 1;
                            while i < lines.len() && is_indent_sub(lines[i], 8) {
                                i += 1;
                            }
                            continue;
                        }
                    }
                }
            }
            out.push(line);
            i += 1;
            continue;
        }

        if section == 2 || section == 3 {
            if skip_deep {
                // 已删除条目的子行（4+ 空格）
                if line.starts_with("    ") {
                    i += 1;
                    continue;
                }
                skip_deep = false;
            }
            // 条目 key：2 空格缩进，key 内嵌 spec
            if is_indent_sub(line, 2) && line.trim_end().ends_with(':') && unportable_lock_key(line) {
                skip_deep = true;
                i += 1;
                continue;
            }
            out.push(line);
            i += 1;
            continue;
        }

        out.push(line);
        i += 1;
    }

    out.join("\n")
}

/// 常见公共 GitHub 镜像前缀 → 原始 github.com（机器无关）。
const GITHUB_MIRROR_PREFIXES: &[&str] = &[
    "https://gh-proxy.com/",
    "https://ghproxy.net/",
    "http://gh-proxy.com/",
    "http://ghproxy.net/",
];

/// 归一化单个依赖 spec（可带 git+ 前缀）：git+https://<镜像>/https://github.com/… → git+https://github.com/…
fn normalize_spec_for_mirror(spec: &str) -> String {
    let s = spec.trim();
    let (proto, rest) = match s.strip_prefix("git+") {
        Some(r) => ("git+", r),
        None => ("", s),
    };
    for m in GITHUB_MIRROR_PREFIXES {
        if let Some(inner) = rest.strip_prefix(m) {
            if inner.starts_with("https://github.com/") || inner.starts_with("http://github.com/") {
                return format!("{}{}", proto, inner);
            }
        }
    }
    s.to_string()
}

/// 归一化 lockfile / workspace 等文本中的镜像前缀（覆盖 importer version / package key / resolution.repo / allowBuilds）。
fn normalize_mirror_text(text: &str) -> String {
    let mut out = text.to_string();
    for m in GITHUB_MIRROR_PREFIXES {
        out = out.replace(&format!("{}{}", m, "https://github.com/"), "https://github.com/");
        out = out.replace(&format!("{}{}", m, "http://github.com/"), "http://github.com/");
    }
    out
}

/// 本地 ~/.dsh → 镜像（剔除内置 bundle 与不可移植依赖）。返回警告列表。
fn snapshot_local_to_mirror() -> Vec<String> {
    let mut warnings = Vec::new();
    let profiles_dir = resolve_dsh_home().join("profiles");

    for name in list_profile_dirs(&profiles_dir) {
        let local_dir = profiles_dir.join(&name);
        let pkg = match read_pkg(&local_dir) {
            Some(p) => p,
            None => continue,
        };
        let mirror_dir = mirror_profile_dir(&name);
        if fs::create_dir_all(&mirror_dir).is_err() {
            continue;
        }

        let mut port_pkg = pkg.clone();

        if let Some(deps) = pkg.get("dependencies").and_then(|d| d.as_object()) {
            let mut new_deps = serde_json::Map::new();
            for (dep, spec) in deps {
                let spec_s = spec.as_str().unwrap_or("");
                if !is_portable_spec(Some(spec_s)) {
                    warnings.push(format!(
                        "{}: 依赖 {} 使用不可移植规格 {}，已从镜像中剔除",
                        name, dep, spec_s
                    ));
                    continue;
                }
                new_deps.insert(dep.clone(), JsonValue::String(normalize_spec_for_mirror(spec_s)));
            }
            port_pkg["dependencies"] = JsonValue::Object(new_deps);
        }

        if let Some(bundles) = pkg
            .get("dsh")
            .and_then(|d| d.get("profile"))
            .and_then(|p| p.get("bundles"))
            .and_then(|b| b.as_array())
        {
            let user_bundles: Vec<JsonValue> = bundles
                .iter()
                .filter(|b| {
                    let bs = b.as_str().unwrap_or("");
                    if bs.starts_with(BUILTIN_BUNDLE_PREFIX) {
                        return false;
                    }
                    let spec = pkg
                        .get("dependencies")
                        .and_then(|d| d.get(bs))
                        .and_then(|v| v.as_str());
                    is_portable_spec(spec)
                })
                .cloned()
                .collect();
            port_pkg["dsh"]["profile"]["bundles"] = JsonValue::Array(user_bundles);
        }

        write_pkg(&mirror_dir, &port_pkg);

        for f in ["cordis.patch.yml", "pnpm-lock.yaml", "pnpm-workspace.yaml"] {
            let src = local_dir.join(f);
            if !src.exists() {
                continue;
            }
            let dest = mirror_dir.join(f);
            if let Some(text) = read_text_opt(&src) {
                let normalized = if f == "pnpm-lock.yaml" {
                    // lock 里可能残留 link:/file: 等本机路径，进入镜像前清洗
                    normalize_mirror_text(&sanitize_lock_for_mirror(&text))
                } else {
                    normalize_mirror_text(&text)
                };
                let _ = fs::write(&dest, normalized);
            }
        }
    }

    warnings
}

#[tauri::command]
pub fn push_dsh_plugins_sync(message: Option<String>) -> Result<SkillsSyncStatus, String> {
    let root = sync_root();
    let cfg = sync_config();

    if !root.join(".git").exists() {
        return Err("尚未初始化同步仓库，请先在插件同步中初始化".to_string());
    }
    if effective_remote_url(&cfg).is_empty() {
        return Err("尚未配置远端仓库地址".to_string());
    }

    let _warnings = snapshot_local_to_mirror();

    if dsh_mirror_dir().exists() {
        let _ = run_git(&root, ["add", "-A", "--", "dsh"]);
    }
    // 共享的 .gitignore 有变更时也随插件同步提交，避免被遗漏
    if root.join(".gitignore").exists() {
        let _ = run_git(&root, ["add", "-A", "--", ".gitignore"]);
    }

    let staged = git_try(&root, &["diff", "--cached", "--name-only"]);
    if !staged.trim().is_empty() {
        let msg = message
            .filter(|m| !m.trim().is_empty())
            .unwrap_or_else(|| {
                format!(
                    "sync dsh plugins [{}]",
                    chrono::Local::now().format("%Y-%m-%d %H:%M:%S")
                )
            });
        run_git(&root, ["commit", "-m", msg.as_str()])
            .map_err(|e| format!("提交 dsh 配置改动失败: {}", e))?;
    }

    let branch = effective_branch(&cfg);
    if let Err(e) = run_git(&root, ["push", "-u", "origin", branch.as_str()]) {
        let msg = format!("推送失败: {}", e);
        let _ = update_last_sync("error", Some(&msg));
        return Err(msg);
    }

    update_last_sync("success", None)?;
    Ok(get_dsh_plugins_sync_status())
}

#[tauri::command]
pub fn set_dsh_plugins_sync_auto_pull(enabled: bool) -> Result<(), String> {
    let mut cfg = sync_config();
    cfg.auto_pull_on_startup = enabled;
    save_sync_config(&cfg)
}

// ---- 对账 ----

fn portable_deps(pkg: &JsonValue) -> std::collections::HashMap<String, String> {
    let mut deps = std::collections::HashMap::new();
    if let Some(obj) = pkg.get("dependencies").and_then(|d| d.as_object()) {
        for (dep, spec) in obj {
            if let Some(s) = spec.as_str() {
                if is_portable_spec(Some(s)) {
                    deps.insert(dep.clone(), s.to_string());
                }
            }
        }
    }
    deps
}

fn all_deps(pkg: &JsonValue) -> std::collections::HashMap<String, String> {
    let mut deps = std::collections::HashMap::new();
    if let Some(obj) = pkg.get("dependencies").and_then(|d| d.as_object()) {
        for (dep, spec) in obj {
            if let Some(s) = spec.as_str() {
                deps.insert(dep.clone(), s.to_string());
            }
        }
    }
    deps
}

fn user_bundles(pkg: &JsonValue) -> Vec<String> {
    match pkg
        .get("dsh")
        .and_then(|d| d.get("profile"))
        .and_then(|p| p.get("bundles"))
        .and_then(|b| b.as_array())
    {
        Some(arr) => arr
            .iter()
            .filter_map(|b| b.as_str())
            .filter(|b| !b.starts_with(BUILTIN_BUNDLE_PREFIX))
            .map(|s| s.to_string())
            .collect(),
        None => Vec::new(),
    }
}

fn read_text_opt(p: &Path) -> Option<String> {
    fs::read_to_string(p).ok()
}

#[tauri::command]
pub fn reconcile_dsh_plugins() -> DshPluginDiff {
    let mut items: Vec<DshPluginDiffItem> = Vec::new();
    let mut warnings: Vec<String> = Vec::new();

    let profiles_dir = resolve_dsh_home().join("profiles");
    let mirror_root = dsh_mirror_dir().join("profiles");

    let mut names: HashSet<String> = HashSet::new();
    for n in list_profile_dirs(&mirror_root) {
        names.insert(n);
    }
    for n in list_profile_dirs(&profiles_dir) {
        names.insert(n);
    }

    let mut names: Vec<String> = names.into_iter().collect();
    names.sort();

    for name in names {
        let local_pkg = read_pkg(&profiles_dir.join(&name));
        let mirror_pkg = read_pkg(&mirror_root.join(&name));
        if local_pkg.is_none() && mirror_pkg.is_none() {
            continue;
        }

        if let Some(lp) = &local_pkg {
            for (dep, spec) in all_deps(lp) {
                if !is_portable_spec(Some(&spec)) {
                    warnings.push(format!("{}: {} ({}) 不可移植，不会参与同步", name, dep, spec));
                }
            }
        }

        // 仅在存在镜像基线（已推送过）时进行差异对账
        if let Some(mirror_pkg_ref) = &mirror_pkg {
            let local_deps = local_pkg.as_ref().map(portable_deps).unwrap_or_default();
            let mirror_deps = portable_deps(mirror_pkg_ref);

            let mut dep_names: HashSet<String> = HashSet::new();
            for d in local_deps.keys() {
                dep_names.insert(d.clone());
            }
            for d in mirror_deps.keys() {
                dep_names.insert(d.clone());
            }
            let mut dep_names: Vec<String> = dep_names.into_iter().collect();
            dep_names.sort();

            for dep in dep_names {
                let l = local_deps.get(&dep);
                let r = mirror_deps.get(&dep);
                match (l, r) {
                    (None, Some(r)) => items.push(DshPluginDiffItem {
                        kind: "missing".to_string(),
                        profile_name: name.clone(),
                        name: dep,
                        local: None,
                        remote: Some(r.clone()),
                    }),
                    (Some(l), None) => items.push(DshPluginDiffItem {
                        kind: "extra".to_string(),
                        profile_name: name.clone(),
                        name: dep,
                        local: Some(l.clone()),
                        remote: None,
                    }),
                    (Some(l), Some(r)) if l != r => items.push(DshPluginDiffItem {
                        kind: "version".to_string(),
                        profile_name: name.clone(),
                        name: dep,
                        local: Some(l.clone()),
                        remote: Some(r.clone()),
                    }),
                    _ => {}
                }
            }

            let lb = local_pkg.as_ref().map(user_bundles).unwrap_or_default();
            let rb = user_bundles(mirror_pkg_ref);
            let mut bundle_names: HashSet<String> = HashSet::new();
            for b in lb.iter().chain(rb.iter()) {
                bundle_names.insert(b.clone());
            }
            let mut bundle_names: Vec<String> = bundle_names.into_iter().collect();
            bundle_names.sort();

            for b in bundle_names {
                let in_l = lb.contains(&b);
                let in_r = rb.contains(&b);
                if in_l && !in_r {
                    items.push(DshPluginDiffItem {
                        kind: "extra".to_string(),
                        profile_name: name.clone(),
                        name: format!("bundle:{}", b),
                        local: Some("bundles".to_string()),
                        remote: None,
                    });
                } else if !in_l && in_r {
                    items.push(DshPluginDiffItem {
                        kind: "missing".to_string(),
                        profile_name: name.clone(),
                        name: format!("bundle:{}", b),
                        local: None,
                        remote: Some("bundles".to_string()),
                    });
                }
            }

            let local_patch = read_text_opt(&profiles_dir.join(&name).join("cordis.patch.yml"));
            let mirror_patch = read_text_opt(&mirror_root.join(&name).join("cordis.patch.yml"));
            if local_patch != mirror_patch {
                items.push(DshPluginDiffItem {
                    kind: "patch".to_string(),
                    profile_name: name.clone(),
                    name: "cordis.patch.yml".to_string(),
                    local: local_patch.or_else(|| Some("(空)".to_string())),
                    remote: mirror_patch.or_else(|| Some("(空)".to_string())),
                });
            }
        }
    }

    DshPluginDiff {
        compatible: items.is_empty(),
        items,
        warnings,
    }
}

#[tauri::command]
pub fn align_dsh_plugins(profile: Option<String>) -> Result<(), String> {
    let profiles_dir = resolve_dsh_home().join("profiles");
    let mirror_root = dsh_mirror_dir().join("profiles");

    let targets: Vec<String> = match profile.filter(|p| !p.trim().is_empty()) {
        Some(p) => vec![p],
        None => list_profile_dirs(&mirror_root),
    };

    for name in targets {
        let local_dir = profiles_dir.join(&name);
        let mirror_dir = mirror_root.join(&name);
        let mirror_pkg = match read_pkg(&mirror_dir) {
            Some(p) => p,
            None => continue,
        };

        if fs::create_dir_all(&local_dir).is_err() {
            continue;
        }

        // 对齐前自动快照（用户可见时间线；失败不阻塞对齐）
        let _ = create_dsh_config_snapshot(
            name.clone(),
            "align".to_string(),
            Some("对齐前自动快照".to_string()),
        );

        // 对齐前快照：安装失败时回滚本地配置
        let snap_files = ["package.json", "cordis.patch.yml", "pnpm-lock.yaml", "pnpm-workspace.yaml"];
        let mut snapshots: Vec<(String, Option<String>)> = Vec::new();
        for f in snap_files {
            let p = local_dir.join(f);
            snapshots.push((f.to_string(), read_text_opt(&p)));
        }

        let local_pkg = read_pkg(&local_dir).unwrap_or_else(|| JsonValue::Object(serde_json::Map::new()));

        let builtin_bundles: Vec<String> = match local_pkg
            .get("dsh")
            .and_then(|d| d.get("profile"))
            .and_then(|p| p.get("bundles"))
            .and_then(|b| b.as_array())
        {
            Some(arr) => arr
                .iter()
                .filter_map(|b| b.as_str())
                .filter(|b| b.starts_with(BUILTIN_BUNDLE_PREFIX))
                .map(|s| s.to_string())
                .collect(),
            None => Vec::new(),
        };

        let mut local_unportable: std::collections::HashMap<String, String> =
            std::collections::HashMap::new();
        for (dep, spec) in all_deps(&local_pkg) {
            if !is_portable_spec(Some(&spec)) {
                local_unportable.insert(dep, spec);
            }
        }

        let mut merged_deps = portable_deps(&mirror_pkg);
        for (dep, spec) in local_unportable {
            merged_deps.insert(dep, spec);
        }

        let mut merged_bundles: Vec<String> = builtin_bundles.clone();
        merged_bundles.extend(user_bundles(&mirror_pkg));

        let mut merged_pkg = local_pkg.clone();
        if !merged_pkg.is_object() {
            merged_pkg = JsonValue::Object(serde_json::Map::new());
        }
        if merged_pkg.get("name").and_then(|v| v.as_str()).is_none() {
            merged_pkg["name"] = JsonValue::String(format!("dsh-profile-{}", name));
        }
        merged_pkg["private"] = JsonValue::Bool(true);
        merged_pkg["dependencies"] = JsonValue::Object(
            merged_deps
                .into_iter()
                .map(|(k, v)| (k, JsonValue::String(v)))
                .collect(),
        );
        if merged_pkg.get("dsh").is_none() {
            merged_pkg["dsh"] = JsonValue::Object(serde_json::Map::new());
        }
        if merged_pkg["dsh"].get("profile").is_none() {
            merged_pkg["dsh"]["profile"] = JsonValue::Object(serde_json::Map::new());
        }
        merged_pkg["dsh"]["profile"]["bundles"] =
            JsonValue::Array(merged_bundles.into_iter().map(JsonValue::String).collect());

        write_pkg(&local_dir, &merged_pkg);

        for f in ["cordis.patch.yml", "pnpm-lock.yaml", "pnpm-workspace.yaml"] {
            let src = mirror_dir.join(f);
            if src.exists() {
                let _ = fs::copy(&src, local_dir.join(f));
            }
        }

        let report = run_install_blocking(name.clone(), "incremental".to_string())?;
        if !report.ok {
            // 安装失败：回滚对齐写盘前的本地配置
            for (f, content) in &snapshots {
                let target = local_dir.join(f);
                match content {
                    Some(text) => {
                        let _ = fs::write(&target, text);
                    }
                    None => {
                        if target.exists() {
                            let _ = fs::remove_file(&target);
                        }
                    }
                }
            }
            // 回滚后重对账 node_modules，清理对齐安装残留（best-effort）
            reconcile_node_modules(&local_dir);
            let detail = report
                .failed
                .iter()
                .map(|f| format!("{}: {}", f.name, f.reason))
                .collect::<Vec<_>>()
                .join("\n");
            return Err(format!("对齐安装失败: {}", detail));
        }
    }

    Ok(())
}
