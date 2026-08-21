# AgentHub DSH 插件面板 V2 — 安装状态对账与安装器设计

> 状态：✅ 已实施（Session 21 落地）。本文档是「插件面板」四类增强的实现方案：
> 全量状态对账展示、分模式安装、失败结果回写、实时安装终端。
> 第 8 节 6 项决策均已按推荐项锁定。落地后需同步 `HANDOVER.md` 与 `PLAN_DSH_PLUGIN_MANAGER.md`。
> 评审修订：§2.4 / §3 / §4 / §10 已按本机 DSH 环境与现有代码核对后修订——内置包整体豁免、非语义化 spec 版本对比豁免、lock 只扫 `packages:` 段、安装状态文件入 `.gitignore`、安装流水线异步化并收紧回滚范围。

## 1. 目标与范围

在现有「DSH 插件中心 → 插件面板」基础上，把面板从「只读配置声明」升级为「配置 ↔ 本机磁盘 ↔ 安装结果」三方对账视图，并补齐安装器能力：

| # | 能力 | 一句话 |
|---|---|---|
| P1 | 全量状态对账 | 条目 = 配置声明 ∪ 本机已装，标注正常/待装/孤儿/失败/版本冲突/不可移植 |
| P2 | 分模式安装 | 增量安装 / 更新 / 全部重装 / 仅失败重装 |
| P3 | 失败回写 | 安装结果持久化，失败堆栈回显到对应条目 |
| P4 | 实时终端 | 安装进程 stdout/stderr 流式展示 |

**核心边界不变**：事实源仍是 `~/.dsh/profiles/<name>/package.json` + `cordis.patch.yml`。新增的「安装状态」是 AgentHub 自己的运营缓存，不是第二份插件事实源。

---

## 2. 核心数据模型

### 2.1 安装状态枚举（新增）

```ts
export type DshPluginInstallStatus =
  | 'ok'               // 本机已装 + 配置已声明 + 版本一致
  | 'pending'          // 配置已声明，本机未装
  | 'orphan'           // 本机已装，配置未声明（多余）
  | 'version-mismatch' // 本机已装，但版本与配置/lock 不一致
  | 'failed';          // 上次安装失败（来自持久化状态）
```

> `enabled`（启停）、`portability`（可移植性）沿用现有字段，不并入状态，避免多义。

### 2.2 对账条目（新增，替换面板的数据来源）

```ts
export interface DshPluginInstallEntry {
  key: string;                 // bundle:<pkg> | dep:<pkg> | row:<id> | orphan:<pkg>
  profileName: string;
  name: string;                // 包名或 row id
  kind: DshPluginKind;
  spec?: string;               // 配置声明的规格
  declaredInConfig: boolean;   // 是否出现在 package.json / cordis.patch.yml
  installed: boolean;          // node_modules 是否存在
  installedVersion?: string;
  requiredVersion?: string;    // lock 解析版本（无 lock 时用精确 spec）
  status: DshPluginInstallStatus;
  installError?: string;       // 失败原因 + 堆栈（截断）
  portability: 'portable' | 'unportable';
  enabled: boolean;
  disabledBy?: 'bundles' | 'patch';
}
```

### 2.3 安装报告（新增）

```ts
export interface DshInstallFailure {
  name: string;
  reason: string;              // 'non-zero-exit' | 'missing-entry' | 'resolve-error'
  stack: string;               // pnpm 相关错误片段
}

export interface DshInstallReport {
  profile: string;
  mode: DshInstallMode;
  ok: boolean;
  installed: string[];         // 校验通过的包
  updated: string[];           // 本次发生版本变化的包
  failed: DshInstallFailure[];
  warnings: string[];
  output: string;              // 完整日志（供终端回放）
}
```

### 2.4 安装状态持久化（新增）

独立文件 `%APPDATA%\AgentHub\dsh_install_state.json`（不塞进 config.json，避免污染用户设置）：

```jsonc
{
  "web": {
    "@dsh-external/dsh-super-injector": {
      "status": "failed",
      "reason": "missing-entry",
      "stack": "…",
      "lastAttemptAt": 1724000000000
    }
  }
}
```

> **同步边界（重要）**：该文件位于 skills sync 的 git 根 `%APPDATA%\AgentHub\` 下，而 `pushSkillsSync` 使用 `git add -A` 全量暂存。必须将 `dsh_install_state.json` 加入共享 `.gitignore`（`src/server/dshPlugins.ts` 的 `SYNC_GITIGNORE_CONTENT`），否则含本机路径与失败堆栈的运营缓存会被推送到远端仓库。

---

## 3. 状态判定规则（P1 核心）

对每个「包名」取 **配置 ∪ 本机** 的并集，按优先级判定：

| 判定条件 | status |
|---|---|
| 内置 bundle（`@deepseek-ai/dsh-*`，`kind = 'inbox'`） | 直接 `ok`（只读），不参与以下任何判定 |
| 持久化状态里该包 `status == failed`，且磁盘未证明已自愈 | `failed` |
| 配置声明了、本机 `node_modules/<pkg>` 不存在（非内置） | `pending` |
| 本机存在、配置未声明（且非内置 `@deepseek-ai/dsh-*`） | `orphan` |
| 本机存在、`installedVersion != requiredVersion`（仅语义化版本 spec） | `version-mismatch` |
| 其余（本机存在 + 配置声明 + 版本一致） | `ok` |

**关键实现细节**：

1. **内置包整体豁免（不只是孤儿）**：`@deepseek-ai/dsh-*` 由 Harness 运行时解析，**不在 profile `node_modules` 中**，因此绝不能因为「声明了但没装」判 `pending`，也绝不判 `version-mismatch`。凡 `kind === 'inbox'` 直接 `ok` 并只读。
2. **spec 先分类，再谈版本对比**：
   - **语义化版本 spec**（`1.2.3` / `^1.0.0` / `~1.0.0` / `>=1 <2` 等）→ 参与 `version-mismatch`：`requiredVersion` 优先取 `pnpm-lock.yaml` **`packages:` 段**该包的 `version:` 解析值；lock 缺失且 spec 为精确号时用 spec，范围 spec 标 `undefined`（不误报）。
   - **非语义化 spec**（`https:` tarball / `git+` / `github:` / `gitlab:` / `link:` / `file:` 等）→ `requiredVersion = undefined`，**永不判 `version-mismatch`**。这类 spec 的「锁解析值」与 `installedVersion` 语义不可比（例如 tarball URL 的 `importers.version` 是 URL，而 `installedVersion` 是 `0.3.3`），强行比较必然误报。
3. **lock 扫描只取 `packages:` 段**：`pnpm-lock.yaml` 里同一包在 `importers:`（`version:` 常为 URL/别名）与 `packages:`（`version:` 为解析后的真实版本）各有一处 `version:`，文本扫描必须限定在 `packages:` 段，否则取到 `importers:` 的 URL 会误报冲突。
4. **孤儿排除**：`@deepseek-ai/dsh-*` 内置包不判孤儿；`.bin` / `.pnpm` / 隐藏目录跳过。
5. **版本对比不引入 semver 依赖**：用「lock 解析版本」字符串等值对比，避免 Rust 侧新增依赖。
6. **陈旧 `failed` 自愈检测**：先按磁盘重算 ok/pending/mismatch；若磁盘已 `ok`，清除持久化的 `failed`（用户手动 `pnpm install` 修复后不应长期挂失败徽章），持久化状态仅作为 pending/mismatch 的附加说明。

---

## 4. 安装器设计（P2）

### 4.1 安装模式 → pnpm 命令映射

```ts
export type DshInstallMode = 'incremental' | 'update' | 'reinstall-all' | 'reinstall-failed';
```

| 模式 | 按钮文案 | pnpm 动作 | 说明 |
|---|---|---|---|
| `incremental` | 增量安装 | `pnpm install` | 只装缺失/变更，默认最安全 |
| `update` | 更新 | `pnpm update` | 在 spec 范围内升级到最新 |
| `reinstall-all` | 全部重新安装 | `pnpm install --force` | 全量重拉（需二次确认） |
| `reinstall-failed` | 仅失败重装 | `pnpm install --force`（或按失败包清理 `.pnpm` 虚拟仓库对应条目后 `pnpm install`） | 精准重装上次失败的包 |

> **`reinstall-failed` 注意**：pnpm 会把顶层 `node_modules/<pkg>` 链接回 `.pnpm` 虚拟仓库，仅删顶层目录不会触发重新校验/下载。必须用 `--force` 或清理虚拟仓库条目，否则「仅失败重装」对 pnpm 无效。

### 4.2 安装流水线（每次安装统一走）

```
1. 快照备份：仅备份 package.json / cordis.patch.yml（不备份 pnpm-lock.yaml）
2. 后端互斥 + 异步执行 pnpm（对应 mode）：
   - Rust：`spawn_blocking` 内跑，禁止阻塞主线程 / async runtime
   - Node：异步 `spawn`（弃用 `spawnSync`），冷缓存下 pnpm 可能耗时数分钟
3. 逐包校验（L3）：对每个 bundle/dep 读 node_modules/<pkg>/package.json，
   检查入口文件是否存在（优先 main / exports，其次 dsh.bundle.patch）
4. 回写持久化状态：ok/failed + reason + stack（磁盘已 ok 的包清除旧 failed）
5. 生成 DshInstallReport
6. 失败回滚：仅回滚步骤 1 的 package.json / cordis.patch.yml（不回滚 lock，不回滚 node_modules）；
   仅 incremental/update 需要；reinstall-all/failed 只回写失败状态、不回滚配置
```

> **L3 校验细节**：入口优先检查 `main` / `exports` 指向的文件，其次检查 `dsh.bundle.patch` 声明的文件；两者都缺失 → `failed { reason: 'missing-entry' }`。`dsh.bundle.patch` 是叠加补丁层，不是 bundle 入口，只能作辅助信号。这正是抓「pnpm 退出 0 但装的是源码残包」的关键（super-injector 的 `github:` 装法会在此暴露）。
> **回滚边界**：`update` 模式下锁文件变化是期望产物，失败时 pnpm 通常不写锁，回滚 lock 反而可能制造 `node_modules` 与 lock 不一致；配置快照也不含 node_modules，故回滚只覆盖两个配置文件。

### 4.3 与现有对齐流程的关系

`align_dsh_plugins` 内部改为调用 `install_dsh_plugins(profile, 'incremental')`，拿报告；失败则回滚本地配置并抛出报告，UI 展示失败项。

---

## 5. 实时终端（P4）

### 5.1 双端流式方案（推荐）

| 端 | 方案 | 说明 |
|---|---|---|
| Tauri | `Channel<String>` 命令参数 | `install_dsh_plugins_streamed(profile, mode, onEvent: Channel<String>)`，逐行 `onEvent.send(line)`，最终返回 `DshInstallReport` |
| Web | SSE（GET） | `/api/dsh/plugins/install/stream?profile=..&mode=..`，`Content-Type: text/event-stream`，逐行 `data: <line>`，结束发 `data: {"done":true,"report":{...}}` |

**前端**：
- Tauri：`new Channel<string>()` + `onEvent.onmessage` 追加到 store 的行缓冲。
- Web：`new EventSource(url)` 收流。
- 两条路统一汇入 `store.installTerminal.lines[]`，终端组件只消费这一个缓冲。

### 5.2 备选：job + 轮询（若 SSE 中间件改造过重）

- `start_dsh_install(profile, mode) → jobId`（后台线程 + 写日志文件）。
- 前端 300ms 轮询 `get_dsh_install_progress(jobId)` 读增量日志。
- 优点：双端实现完全一致；缺点：300ms 粒度，且要管理后台 job 生命周期与清理。

> **决策点**：推荐 5.1（Tauri Channel + Web SSE），SSE 需对 `vite.config.ts` 的中间件做一次「流式路由提前返回」的小改造；若嫌重则退 5.2。

### 5.3 终端组件

`DshInstallTerminal.vue`：底部抽屉/模态，`font-mono` 日志 + 自动滚动 + 状态行（运行中/成功/失败），遵循 DESIGN_GUIDELINES（1px 边框、`rounded-xl`、三层暗灰、`transition-colors`）。

---

## 6. 前端改动

### 6.1 `DshPluginList.vue` 改造（P1 + P2 + P3）

- 顶部工具条：profile 选择 + 四个安装按钮（`增量安装` / `更新` / `全部重新安装` / `仅失败重装`，其中「全部重装」带确认）+「终端」开关。
- 条目卡：新增**状态徽章**（语义色遵循规范）：
  - `ok` → `#30d158` 绿；`pending` / `orphan` / `unportable` → `#ff9f0a` 琥珀；`failed` / `version-mismatch` → `#ff453a` 红。
  - `failed` 条目附「查看失败堆栈」→ 弹出 `<pre>` 模态展示 `installError`。
- 每条目展示 `spec` / `installedVersion` / `requiredVersion` 三列对比，`version-mismatch` 高亮差异。

### 6.2 `useAppStore` 新增

```ts
state: {
  dshInstallEntries: DshPluginInstallEntry[],   // 对账视图
  dshInstallReport: DshInstallReport | null,
  dshInstalling: boolean,
  installTerminal: { visible: boolean; lines: string[]; running: boolean },
}
actions: {
  loadDshInstallEntries(profile),   // 调对账扫描
  installDsh(profile, mode),        // 触发安装（阻塞版）
  installDshStreamed(profile, mode),// 触发流式安装（终端）
  clearDshInstallState(profile, pkg?),
}
```

### 6.3 `api.ts` 新增方法

`scanDshInstallEntries` / `installDshPlugins(profile, mode)` / `installDshPluginsStreamed` / `clearDshInstallState`。

---

## 7. 后端改动

### 7.1 Rust `dsh_plugins.rs`

- `reconcile_dsh_install(profile) -> Vec<DshPluginInstallEntry>`（配置 ∪ node_modules ∪ install_state）。
- `install_dsh_plugins(profile, mode) -> DshInstallReport`（流水线 + L3 + 状态回写）。
- `install_dsh_plugins_streamed(profile, mode, on_event: Channel<String>) -> DshInstallReport`。
- `clear_dsh_install_state(profile, pkg?)`。
- 新增 `read_install_state` / `write_install_state`（`%APPDATA%\AgentHub\dsh_install_state.json`）。

### 7.2 Node `dshPlugins.ts` + `vite.config.ts`

- 同构 `reconcileDshInstall` / `installDshPlugins(mode)` / `clearDshInstallState`。
- 新路由：
  - `GET  /api/dsh/plugins/install-entries`
  - `POST /api/dsh/plugins/install`（mode）
  - `GET  /api/dsh/plugins/install/stream`（SSE，可选）
  - `POST /api/dsh/plugins/install-state/clear`

### 7.3 双端一致性要点

- L3 校验、状态判定、版本对比逻辑 Rust/Node 完全一致。
- 安装状态文件路径双端一致（`%APPDATA%\AgentHub\dsh_install_state.json`）。

---

## 8. 关键设计决策（已锁定，均按推荐项）

1. **安装状态落盘位置**：✅ 独立 `dsh_install_state.json`（不塞进 `config.json`）。
2. **孤儿扫描范围**：✅ 仅 profile `node_modules` 顶层直接依赖，排除内置 `@deepseek-ai/dsh-*` 与 `.bin` / `.pnpm` / 隐藏目录。
3. **版本冲突判定**：✅ lock 解析版本字符串等值对比，不引入 semver 依赖。
4. **`reinstall-all` 二次确认**：✅ 是（`--force` 全量重拉，需确认）。
5. **实时终端方案**：✅ Tauri `Channel` + Web SSE（若 SSE 中间件改造过重，退化为 job+轮询）。
6. **失败回滚策略**：✅ `incremental` / `update` 失败回滚配置备份；`reinstall-all` / `reinstall-failed` 只回写失败状态、不回滚（重装目标本就是修复）。

---

## 9. 分阶段实施

- **Phase A — 对账视图（P1）**：✅ 数据模型 + `reconcile_dsh_install` 双端 + `DshPluginList` 状态徽章展示。
- **Phase B — 安装器（P2+P3）**：✅ 四模式安装 + L3 校验 + 安装状态持久化 + 失败回写/回显。
- **Phase C — 实时终端（P4）**：✅ 流式安装 + `DshInstallTerminal.vue` + store 订阅。
- **Phase D — 验收与文档**：✅ `tsc` / `build` / `cargo check` 全部零错误零警告 + `HANDOVER.md` 同步（Session 21）。

---

## 10. 风险与边界

| 风险 | 缓解 |
|---|---|
| 扫 `node_modules` 噪音（传递依赖） | 只扫顶层直接依赖 + 排除内置/`.bin`/`.pnpm` |
| `pnpm update` 突破 spec 预期 | update 只在 spec 范围内；UI 提示「按 spec 升级」 |
| `--force` 全量重拉慢/耗流量 | 二次确认 + 仅用户手动触发 |
| SSE 与现有 vite 中间件冲突 | 流式路由提前返回；或退 job+轮询 |
| 安装状态文件被 skills sync 全量暂存推送到远端 | `dsh_install_state.json` 加入共享 `.gitignore`（§2.4） |
| tarball/git spec 版本对比误报 `version-mismatch` | 仅语义化版本 spec 参与对比；lock 只扫 `packages:` 段（§3） |
| 安装状态文件与真实磁盘漂移 | 每次成功安装后重扫对账，覆盖状态；状态只是缓存，可随时清除 |
| 失败堆栈过大 | 持久化前截断（如 4KB），完整日志存报告 |

---

*文档创建日期：2026-08-20 | AgentHub Core Team*
