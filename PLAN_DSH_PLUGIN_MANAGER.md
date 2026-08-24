# AgentHub DSH 插件管理器 — 详细实施计划

> 状态：✅ 已实施（Session 17 落地）。本文档是「DSH 插件中心」功能的设计与开发蓝图，落地后需同步更新 `HANDOVER.md`。
> 后续增强见 `PLAN_DSH_PLUGIN_PANEL_V2.md`（Session 21 落地）：插件面板 V2 安装状态对账与安装器。

## 1. 目标与范围

在 AgentHub 内新增 **「DSH 插件中心」** 独立 Tab，实现四大能力：

| # | 能力 | 一句话 |
|---|---|---|
| F1 | 启动失败诊断修复 | AgentHub 拉起 `dsh web` 捕获崩溃堆栈 → 解析失败插件 → 关闭后重试 |
| F2 | 本地插件可视化 | 扫描 `~/.dsh/profiles/*` 的 `package.json` + `cordis.patch.yml`，卡片/表格展示 |
| F3 | 插件同步 | 仅同步配置文件（`package.json` + `cordis.patch.yml` + `pnpm-lock.yaml`），拉取后 `pnpm install` 自装 |
| F4 | 对账提示 | 仓库配置 vs 本地配置 diff，对不上提示 +「一键对齐」 |

**核心边界（贯穿全程）**：AgentHub 是 DSH 配置的**编辑器 + 编排器**，事实源始终是 `~/.dsh/profiles/*/package.json` + `cordis.patch.yml`。AgentHub 只读写这些文件，自身不复制第二份“插件状态”。

---

## 2. 关键设计决策

已锁定决策 + 实现新增决策：

1. **诊断触发**：AgentHub 主动 `spawn dsh web` 捕获 stderr，带超时；崩溃即退出→解析；健康→kill 掉诊断实例。
2. **关闭粒度**：bundle 级（从 `dsh.profile.bundles` 移除）+ 行级（`cordis.patch.yml` 追加 `{id, disabled:true}`）双支持；可选「停用 / 卸载」。
3. **同步范围**：仅用户插件（`dependencies` + 额外 bundles + `cordis.patch.yml` + `pnpm-lock.yaml`），**不含** `@deepseek-ai/dsh-*` 内置 bundle。
4. **不可移植依赖**：`link:`/`file:`/`workspace:`/`portal:`/`catalog:`/`git+ssh:`/`ssh:`/`git@` 跳过并警告（推送时从镜像清单中剔除）；`git+https:`/`github:`/`gitlab:`/版本号/`npm:` 视为可移植（跨机可 `pnpm install` 批量安装）。
5. **对账**：对比声明配置 + 锁定版本，提供「一键对齐」但不自动覆盖。
6. **UI**：新增独立 `plugins` Tab，内部用 Segmented Tabs 分三区。
7. **同步仓库布局**：复用现有 skills sync 的同一个 Git 仓库（根 `%APPDATA%\AgentHub`），新增 **`dsh/` 分类目录**作为插件配置的**镜像副本**。真实插件配置在 `~/.dsh`（含 sessions/credentials，绝不能进仓库），因此：
   - **推送**：`~/.dsh/profiles/<name>/...` → 镜像 `%APPDATA%\AgentHub\dsh\profiles\<name>\...` → `git add dsh/` → commit/push。
   - **拉取**：`git pull` → 读镜像 → 与本地 `~/.dsh` 对比（F4）→「一键对齐」写回 `~/.dsh` + `pnpm install`。
8. **命令定位**：`config.json` 新增 `dsh_plugins.dshCommand` / `pnpmCommand` 可配置；缺省自动探测（Windows `where dsh` / `where pnpm`，再探 `~/AppData/Roaming/npm`）。
9. **patch 写入安全**：`cordis.patch.yml` 只做**文本级幂等合并**（同 id 去重、保留 `!!js` 与注释、不重序列化），对齐 `dev_fix_patch` 的 duplicate-entry 教训。

---

## 3. 数据模型

### 3.1 前端 `src/types/index.ts`（新增）

```ts
export type DshPluginKind = 'inbox' | 'bundle' | 'plain' | 'row';

export interface DshPluginEntry {
  key: string;              // 稳定键：`bundle:<pkg>` | `row:<id>` | `dep:<pkg>`
  profileName: string;
  name: string;             // 包名或行 id
  kind: DshPluginKind;      // inbox=内置 dsh-* / bundle=用户 bundle / plain=无 dsh.bundle 依赖 / row=patch 行
  spec?: string;            // 依赖规格（version / link: / file: / git+）
  installedVersion?: string;
  enabled: boolean;
  portability: 'portable' | 'unportable'; // link:/file:/git+ => unportable
  disabledBy?: 'bundles' | 'patch';
}

export interface DshPatchRow {
  id?: string;
  name?: string;
  disabled?: boolean;
  raw: unknown;
}

export interface DshProfileScan {
  name: string;
  dir: string;
  exists: boolean;
  bundles: string[];
  dependencies: Record<string, string>;
  plugins: DshPluginEntry[];
  patchRows: DshPatchRow[];
  patchFile: string;
}

export interface DshPluginScanResult {
  homeDir: string;
  dshCommand: string | null;
  pnpmCommand: string | null;
  profiles: DshProfileScan[];
}

export interface DshRecoveryAction {
  kind: 'remove-bundle' | 'disable-row' | 'remove-dependency';
  profileName: string;
  target: string;           // 包名或行 id
  description: string;
}

export interface DshDiagnoseResult {
  ok: boolean;              // 超时内未崩溃 = 健康
  exitCode: number | null;
  rawStderr: string;
  failedPlugins: string[];  // 解析出的失败插件名
  suggestedActions: DshRecoveryAction[];
  hint?: string;            // 如「端口占用」等非插件失败提示
}

export interface DshPluginDiffItem {
  kind: 'missing' | 'extra' | 'version' | 'patch';
  profileName: string;
  name: string;
  local?: string;
  remote?: string;
}

export interface DshPluginDiff {
  compatible: boolean;
  items: DshPluginDiffItem[];
  warnings: string[];       // 不可移植依赖等
}

export interface DshPluginsSyncConfig {
  remoteUrl: string;
  branch: string;
  autoPullOnStartup: boolean;
  lastSyncAt: number;
  lastSyncStatus: 'idle' | 'syncing' | 'success' | 'error';
  lastError?: string;
}

export interface DshPluginsConfig {
  dshCommand: string;       // 空 = 自动探测
  pnpmCommand: string;
  sync?: DshPluginsSyncConfig;
}
```

`AppConfig` 增加字段：`dsh_plugins?: DshPluginsConfig`。

### 3.2 Rust `src-tauri/src/models.rs`（新增，serde 全带 rename）

镜像上述结构：`DshPluginKind`（字符串）、`DshPluginEntry`、`DshPatchRow`、`DshProfileScan`、`DshPluginScanResult`、`DshRecoveryAction`、`DshDiagnoseResult`、`DshPluginDiffItem`、`DshPluginDiff`、`DshPluginsSyncConfig`、`DshPluginsConfig`，并给 `AppConfig` 加 `dsh_plugins: Option<DshPluginsConfig>`。

---

## 4. 后端实现

### 4.1 Rust 新模块 `src-tauri/src/dsh_plugins.rs`（扫描/诊断/开关）

```rust
// 路径/命令解析
pub fn resolve_dsh_home() -> PathBuf          // $DSH_HOME else ~/.dsh
pub fn resolve_dsh_command(cfg: &AppConfig) -> Option<String>  // 配置覆盖 > where dsh > npm 目录探测
pub fn resolve_pnpm_command(cfg: &AppConfig) -> Option<String>

// 扫描
#[tauri::command] pub fn scan_dsh_plugins() -> DshPluginScanResult
// 内部：
//   read profiles: ~/.dsh/profiles/*/package.json + cordis.patch.yml + pnpm-lock.yaml
//   分类：bundles 中 @deepseek-ai/dsh-base|web-app|headless => inbox；其余 => bundle
//   dependencies 中非 bundle => plain；patch 行 => row
//   portability 判定：spec 以 link:/file:/git+ 开头 => unportable
//   enabled 判定：bundle 在 bundles 列表且无 disable patch；row 无 disabled:true

// 诊断
#[tauri::command] pub fn diagnose_dsh_web(profile: Option<String>) -> DshDiagnoseResult
//   spawn <dshCmd> web（或 --profile <name>），stdio pipe，cwd=profile dir
//   超时 15s：未退出 => 判健康，taskkill /T /F 杀进程树，ok=true
//   非零退出 => 解析 stderr（见 4.3）
//   端口占用（EADDRINUSE）=> hint，不算插件失败

// 开关/恢复
#[tauri::command] pub fn set_dsh_plugin_enabled(profile: String, key: String, enabled: bool) -> Result<(), String>
#[tauri::command] pub fn apply_dsh_recovery(action: DshRecoveryAction) -> Result<(), String>
//   内部写盘逻辑（见 4.4）

// 安装（供同步对齐使用）
#[tauri::command] pub fn install_dsh_plugins(profile: String) -> Result<String, String>
//   spawn pnpm install（cwd=profile dir，win32 shell=true），返回 stdout/stderr
```

### 4.2 Rust 新模块 `src-tauri/src/dsh_plugins_sync.rs`（同步/对账）

镜像 `skills_sync.rs`，但作用于 `dsh/` 目录 + 镜像拷贝：

```rust
fn dsh_sync_dir() -> PathBuf   // %APPDATA%\AgentHub\dsh
fn mirror_dir(profile: &str) -> PathBuf  // %APPDATA%\AgentHub\dsh\profiles\<name>

// 快照：本地 ~/.dsh → 镜像（剔除不可移植依赖，sanitize）
fn snapshot_local_to_mirror() -> Result<Vec<String>, String>  // 返回警告列表

// 应用：镜像 → 本地 ~/.dsh
fn apply_mirror_to_local(profile: &str) -> Result<(), String>

#[tauri::command] pub fn get_dsh_plugins_sync_status() -> SkillsSyncStatus  // 复用同仓库 .git
#[tauri::command] pub fn init_dsh_plugins_sync(remote_url: String, branch: Option<String>) -> Result<SkillsSyncStatus, String>
#[tauri::command] pub fn pull_dsh_plugins_sync() -> Result<SkillsSyncStatus, String>      // 仅 git pull --ff-only
#[tauri::command] pub fn push_dsh_plugins_sync(message: Option<String>) -> Result<SkillsSyncStatus, String>
//   push 前先 snapshot_local_to_mirror()，再 git add dsh/ && commit && push
#[tauri::command] pub fn set_dsh_plugins_sync_auto_pull(enabled: bool) -> Result<(), String>
#[tauri::command] pub fn reconcile_dsh_plugins() -> DshPluginDiff   // F4 对账
#[tauri::command] pub fn align_dsh_plugins(profile: Option<String>) -> Result<(), String>
//   一键对齐：apply_mirror_to_local() + install_dsh_plugins()
```

> 说明：`init_*_sync` 与 skills sync 共用同一 `.git`（`%APPDATA%\AgentHub`），所以插件的 init 只需确保 `.gitignore` 已存在并排除本地私有文件；**不要**重新 `git init`（否则会与 skills sync 冲突）。这要求 `dsh_plugins_sync.rs` 里把 `init` 逻辑做成「幂等：无 .git 才 init」。

### 4.3 错误堆栈解析（Rust 与 Node 完全一致）

优先级：
1. `N entries did not activate` + 后续每行 `<entry.name>: <stack>` → 收集 name。
2. `plugin(s) failed to load: <names>`（逗号分隔）→ 收集 names。
3. `fatal load failure: <stack>` → 从 stack 中抽取已知包名。
4. 兜底：调用 `dsh --profile <name> --dump-config`（boot-free）列出完整行表，返回给前端让用户手选（前端展示「无法自动定位，请手动选择」）。

**name → 动作映射**：
- name 命中 `dsh.profile.bundles` 中某用户 bundle → `remove-bundle`。
- name 命中 `dependencies` 中某依赖（且不在 bundles）→ `remove-dependency`。
- 其余 → 尝试用 dump-config 的 `id` 匹配 name → `disable-row`。

### 4.4 配置写盘逻辑（幂等 + 安全，双端一致）

**remove-bundle / remove-dependency**（改 `package.json`）：
- 读 JSON → 从 `dsh.profile.bundles` 移除（remove-bundle）→ 若「卸载」则同时从 `dependencies` 移除 → 写回 2-space JSON + 换行。幂等（已不存在则 no-op）。

**disable-row**（改 `cordis.patch.yml`）：
- 读原文（保留 `!!js`、注释、格式）。
- 若已存在 `- id: <rowId>` 顶级条目 → no-op（幂等）。
- 否则在末尾追加文本：

  ```yaml
  - id: <rowId>
    disabled: true
  ```

- **严禁** `js-yaml` 重序列化整个文件（会丢 `!!js`/注释）。

**toggle（启停，非诊断路径）**：
- bundle：从 `bundles` 增/删（启用时追加，需先确认依赖已装）。
- row：`cordis.patch.yml` 增/删 `{id, disabled:true}` 条目。

### 4.5 Node 端 `src/server/dshPlugins.ts`（新文件，供 web 模式）

把 4.1–4.4 逻辑用 `fs` / `child_process` 重写一份（与 Rust 行为 100% 对齐），关键差异：
- `resolveDshHome`：`process.env.DSH_HOME || ~/.dsh`。
- `spawn`：`child_process.spawn(cmd, args, { cwd, shell: process.platform === 'win32' })`（Windows `.cmd` shim 必须 shell）。
- 杀进程树：`spawnSync('taskkill', ['/PID', pid, '/T', '/F'])`。
- 超时：`setTimeout` + `child.kill`。
- `pnpm install`：`execFileSync('pnpm', ['install'], { cwd: profileDir, shell: win32, stdio: 'pipe' })`。

`localApi.ts` 末尾 re-export 这些函数；`vite.config.ts` 新增路由：

```
GET  /api/dsh/plugins/scan
POST /api/dsh/plugins/diagnose
POST /api/dsh/plugins/toggle
POST /api/dsh/plugins/recover
POST /api/dsh/plugins/install
GET  /api/dsh/plugins/sync/status
POST /api/dsh/plugins/sync/init
POST /api/dsh/plugins/sync/pull
POST /api/dsh/plugins/sync/push
POST /api/dsh/plugins/sync/auto-pull
GET  /api/dsh/plugins/reconcile
POST /api/dsh/plugins/align
```

### 4.6 Rust 接线 `src-tauri/src/lib.rs`

- `pub mod dsh_plugins; pub mod dsh_plugins_sync;`
- `invoke_handler!` 注册全部新 command。
- `Cargo.toml`：预期**零新增依赖**（`serde_json`/`serde_yaml`/`chrono`/`uuid` 已就绪）。

---

## 5. 前端实现

### 5.1 `src/services/api.ts`（新增方法）

`scanDshPlugins / diagnoseDshWeb / toggleDshPlugin / applyDshRecovery / installDshPlugins / getDshPluginsSyncStatus / initDshPluginsSync / pullDshPluginsSync / pushDshPluginsSync / setDshPluginsSyncAutoPull / reconcileDshPlugins / alignDshPlugins`，沿用 `isTauri()` 双分支模式。

### 5.2 `src/stores/useAppStore.ts`（新增 state + actions）

```ts
state: {
  dshPluginsScan: null as DshPluginScanResult | null,
  dshDiagnose: null as DshDiagnoseResult | null,
  dshDiagnosing: false,
  dshPluginsSyncStatus: {...} as SkillsSyncStatus,
  dshPluginsSyncLoading: false,
  dshPluginDiff: null as DshPluginDiff | null,
}
actions: {
  loadDshPlugins(), diagnoseDshWeb(), applyDshRecovery(),
  toggleDshPlugin(), installDshPlugins(),
  loadDshPluginsSyncStatus(), init/pull/push/setAutoPull,
  reconcileDshPlugins(), alignDshPlugins(),
}
```

`init()` 里并行加载 `loadDshPlugins()` + `loadDshPluginsSyncStatus()`（静默，失败不阻塞主流程）。

### 5.3 新组件

| 文件 | 职责 |
|---|---|
| `src/components/PluginsView.vue` | 容器：标题 + 三段 Segmented Tabs（`插件面板` / `诊断修复` / `同步与对账`） |
| `src/components/DshPluginList.vue` | F2 扫描面板：profile 选择 + 插件卡片/表格 + 启停开关 + 版本/规格/可移植性标签 |
| `src/components/DshDiagnose.vue` | F1：诊断按钮 + 崩溃堆栈展示 + 失败插件列表 + 每项「关闭并重试」 |
| `src/components/DshPluginSync.vue` | F3+F4：仓库状态 + 拉/推 + 自动拉取 + 对账 diff 列表 +「一键对齐」 |
| `src/components/DshPluginDiffModal.vue` | 对账差异详情弹窗（diff 高亮，可选复用 CodeMirror MergeView） |

### 5.4 接线

- `src/App.vue`：`<PluginsView v-else-if="store.currentTab === 'plugins'" />`。
- `src/components/Navigation.vue`：tabs 数组加 `{ id: 'plugins', label: 'DSH 插件中心', icon: Puzzle, badge: 可移植插件数或对账差异数 }`。
- `src/stores/useAppStore.ts`：`currentTab` 联合类型加 `'plugins'`。

---

## 6. UI 设计（严格遵循 DESIGN_GUIDELINES.md）

- 三层暗灰 `dark:bg-[#1c1c1e]` / `#2c2c2e` / `#3a3a3c`，浅色 `bg-[#f5f5f7]` / `bg-white`，全量 `dark:` 成对。
- 标题 `font-serif`；插件名/版本/路径 `font-mono`；正文系统无衬线。
- 开关统一 **Segmented Slider**（`[ 启用 | 停用 ]`）；Tab 用 Segmented Tabs。
- 1px 发丝线 `border-black/8 dark:border-white/8`；卡片 `rounded-xl`、按钮 `rounded-lg`、药丸 `rounded-md`。
- 过渡仅 `transition-colors duration-200 ease-out`；无渐变/大阴影/位移动画。
- 状态色：健康 `#30d158`、警告 `#ff9f0a`、错误 `#ff453a`、主操作 `#0a84ff`（仅指示灯/徽章）。

---

## 7. 分阶段实施顺序

- **Phase 0 — 类型与存储**：`types/index.ts` + `models.rs` + `AppConfig` 字段 + `config.json` 默认块。
- **Phase 1 — 扫描（F2）**：Rust `dsh_plugins.rs` 扫描 + Node `dshPlugins.ts` + `/api/dsh/plugins/scan` + `DshPluginList.vue` + 面板接入。先跑通“读”。
- **Phase 2 — 开关/恢复（F1）**：写盘逻辑 + `diagnose`/`set_enabled`/`recover` + `DshDiagnose.vue`。
- **Phase 3 — 同步（F3）**：`dsh_plugins_sync.rs` + Node sync + `DshPluginSync.vue`。
- **Phase 4 — 对账（F4）**：`reconcile`/`align` + `DshPluginDiffModal.vue` + 一键对齐。
- **Phase 5 — 验收与文档**：见第 8、9 节。

---

## 8. 测试与验收

1. `npx tsc --noEmit` 零错误；`npm run build` 零错误零警告。
2. `cargo check`（Rust 侧编译通过，若本机有 Tauri 工具链）。
3. Web 模式手动回归（本机 `~/.dsh/profiles/web` 现有 super-injector）：
   - 扫描面板正确显示 `web` profile + `@dsh-external/dsh-super-injector`（标记 `link:` 不可移植）。
   - 诊断：临时把某插件 bundle 加进列表 → `dsh web` 崩溃 → 诊断解析出插件名 → 关闭 → 重试成功。
   - 开关：bundle 级移除/恢复、行级 `disabled:true` 增删均幂等。
   - 同步：初始化远端 → 推送（镜像生成、不可移植项被剔除并警告）→ 另一侧拉取 → 对账显示 diff → 一键对齐后 `pnpm install` 成功。
   - 端口占用场景：诊断提示「端口占用」，不误判为插件失败。

---

## 9. 风险与边界

| 风险 | 缓解 |
|---|---|
| Windows 杀进程树不彻底（`.cmd`→node 子进程） | `taskkill /PID <pid> /T /F` |
| `dsh web` 端口 3080 已被占用被误判为插件失败 | 检测 `EADDRINUSE` → hint，不算失败 |
| `cordis.patch.yml` 含 `!!js`/注释，重序列化会损坏 | 只文本级追加/删除，永不 `yaml.dump` 全文件 |
| 重复 patch 导致 duplicate entry id 崩溃 | 写盘前按 id 去重（幂等） |
| 插件 sync 与 skills sync 同仓库 `.git` 冲突 | init 幂等（无 `.git` 才 init），共享同一 `.gitignore` |
| `link:`/`file:`/`git+` 跨机不可移植 | 推送剔除 + 对账标记警告 |
| 同步执行第三方代码（`!!js`/pnpm prepare 脚本） | UI 明确「可信操作」提示，不额外沙箱 |

---

## 10. HANDOVER.md 同步（验收后必做）

- 新增「DSH 插件管理器」架构章节（数据 Schema、模块索引 `dsh_plugins.rs` / `dsh_plugins_sync.rs` / `PluginsView.vue` 等、API 命令表）。
- Changelog 追加 Session 17 记录。

---

*文档创建日期：2026-08-20 | AgentHub Core Team*
