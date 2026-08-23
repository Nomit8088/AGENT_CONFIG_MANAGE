# 待开发工作项清单（Backlog）

> 状态：📝 持续跟踪中。本文档记录接下来的待开发工作项，与具体模块解耦，随时增删改。
> 每条工作项 = 状态 + 优先级 + 描述 + 验收标准 + 关联/备注，用于排期与对账。

## 1. 使用说明

### 1.1 状态图例

| 状态 | 含义 |
|---|---|
| `待开发` | 已记录，尚未排期 |
| `计划中` | 已排期，准备开始 |
| `进行中` | 正在开发 |
| `已完成` | 开发完成并通过验收 |
| `阻塞` | 因外部条件卡住，需记录阻塞原因 |
| `取消` | 不再需要，标记取消并注明原因 |

### 1.2 优先级图例

| 优先级 | 含义 |
|---|---|
| `P0` | 最高优先（地基 / 紧急 / 阻塞项），最先处理 |
| `P1` | 高，近期必须完成 |
| `P2` | 中，正常排期 |
| `P3` | 低，有空再做 |

### 1.3 编号规则

- 编号格式：`WI-<序号>`（Work Item），按加入顺序递增，删除后不复用。

---

## 2. 工作项总表

> 优先级为建议值，可随时调整。

| 编号 | 状态 | 优先级 | 工作项 | 描述 | 验收标准 | 关联 | 备注 |
|---|---|---|---|---|---|---|---|
| WI-001 | 待开发 | P2 | 后台常驻与系统托盘 | 应用支持最小化/关闭到系统托盘后台运行，托盘图标提供「显示主窗口 / 退出」菜单 | 关闭窗口后应用仍在托盘驻留；托盘可唤回主窗口与彻底退出 | `src-tauri`（Tauri 2 tray） | 仅桌面端；Web 模式不适用 |
| WI-002 | 待开发 | P3 | 插件卡片 tag / 备注 / 描述 | 插件卡片支持用户自定义 tag/备注，并自动读取插件 `package.json` 的 `description` 回填 | 卡片展示 description；可增删改 tag 与备注并持久化 | `DshPluginList.vue`、`DshPluginEntry`、`dsh_plugins.rs` | 备注/tag 不入 `~/.dsh` 事实源，存 AgentHub 本地缓存 |
| WI-003 | 待开发 | P1 | 一键启动 dsh + 错误堆栈复制 | 插件管理 / 一键诊断页新增「启动 dsh」按钮，启动失败时捕获完整 stderr 堆栈并支持一键复制 | 点击即启动 dsh；失败时展示堆栈并可复制 | 复用 `PLAN_DSH_PLUGIN_MANAGER` §4.3 堆栈解析、`DshDiagnose.vue` | 端口占用(EADDRINUSE)提示、不算失败 |
| WI-004 | 待开发 | P2 | 首启卡顿定位与研究 | 定位首次启动程序卡顿的原因，产出结论与可执行的优化方向 | 给出卡顿原因说明 + 优化项列表（可转成后续工作项） | 前端初始化、Rust 启动、sync / 扫描 | 先研究后决策，本轮不改代码 |
| WI-005 | 待开发 | P1 | 插件选择性同步（按卡片勾选） | 同步从「整份 profile 全量镜像」细化为「每条插件卡片可独立勾选是否同步」 | 卡片有同步开关；推送/拉取只包含勾选条目 | `dsh_plugins_sync.rs`、`dshPlugins.ts`、`DshPluginRow/List.vue` | 内置包/不可移植依赖仍按现有规则剔除 |
| WI-006 | 待开发 | P1 | 配置快照与回滚 | 对 DSH 插件配置做快照，支持时间线查看与一键回滚 | 可手动/自动创建快照、列出历史、一键回滚 | `dsh_plugins.rs`、`dshPlugins.ts`、`backups/` | 复用对齐流程已有 `snapFiles` 快照；服务 WI-009 升级回滚 |
| WI-007 | 待开发 | P2 | 应用日志系统 | 统一日志采集/分级/导出，配合排障 | 关键路径有日志；可查看与一键导出 | Rust `log`/`tracing`、Node 端日志模块、`SettingsModal.vue` | 支撑 WI-004 首启卡顿排查 |
| WI-008 | 待开发 | P2 | 同步中心增强 | 定时同步 + 冲突可视化解决 + 同步历史，与 WI-005/WI-006 联动设计 | 支持定时触发、冲突解决、历史记录 | `SyncView.vue`、`syncRepo.ts`、`git_sync.rs` | 与 WI-005/WI-006 统一进同一条同步链路 |
| WI-009 | 待开发 | P1 | DSH 版本升级与版本管理 | 插件管理页新增 DSH 本体版本升级 + 版本管理，升级前自动快照，支持回滚 | 可查看当前/远端版本、升级、回滚到历史版本 | 插件管理页、WI-006 快照、`dsh_plugins.rs` 命令探测 | 防 DSH 升级后插件大面积失效 |
| WI-010 | 待开发 | P3 | MCP Server 配置总线 | 多 Agent 的 MCP Server 配置（claude_desktop_config.json / gemini/mcp / codex/mcp）集中可视化管理与共享 | 扫描 / 对账 / 启停 / 多端同步 | `syncRepo.ts`、`skills_sync.rs` 的 mcp/ 分类、新组件 | 既定 TODO；用户明确「要做但推后」 |
| WI-011 | 待开发 | P0 | macOS / Linux 系统适配 | 去 Windows 强耦合（NTFS Junction / taskkill / WinINET 代理 / npm 全局路径），适配 macOS 与 Linux | 三平台软链/进程清理/代理/npm 路径一致；三平台打包产物 | `fs_junction.rs`、`process.rs`、`git_sync.rs`、`localApi.ts`、CI | 用户标记为当前最高优先级；不做完整底层重构，验证驱动约 3~4 周 |
| WI-012 | 待开发 | P1 | 国际化（i18n） | UI 文案 + 后端错误消息多语言化，引入 vue-i18n，支持中/英切换 | 语言包覆盖全 UI 与后端提示；可切换并持久化 | 20+ `.vue` 组件、`useAppStore.ts`、`server/*.ts` 错误消息、`SettingsModal.vue` | 约 589 处 UI 中文硬编码；横切关注点，越早做越省 |

---

## 3. 工作项详情

### WI-001 — 后台常驻与系统托盘

- **背景**：当前应用关闭/最小化即退出（或仅缩到任务栏），无法后台常驻；用户希望收进系统托盘后台运行。
- **方案要点**：
  - Tauri 2 桌面端用 `TrayIconBuilder` 建托盘图标 + 上下文菜单（「显示主窗口」/「退出」）。
  - 拦截窗口关闭事件（`WindowEvent::CloseRequested`），改为 `hide()` 而非退出；「退出」菜单才真正 `app.exit(0)`。
  - 可选配合 `tauri-plugin-single-instance`：重复启动时聚焦已有实例而非再开一窗。
- **依赖**：Tauri 2 `tray-icon` 特性、可选 `tauri-plugin-single-instance`。
- **风险/边界**：仅 Tauri 桌面端生效，Web 模式无托盘，需能力探测与降级；Windows / macOS / Linux 托盘行为差异需分端验证。

### WI-002 — 插件卡片 tag / 备注 / 描述

- **背景**：插件卡片目前只展示 name / spec / version / portability，缺少描述与自定义备注。
- **方案要点**：自动读 `node_modules/<pkg>/package.json` 的 `description` 回填；用户可为条目打 tag 或写备注。
- **关键决策（已锁定）**：备注/tag 存 AgentHub 本地缓存（类似 `dsh_install_state.json`），**不写进 `~/.dsh` 事实源**，避免污染同步镜像；缓存文件加入 `.gitignore`。
- **依赖**：`DshPluginEntry` 类型扩展（Rust/Node 双端）、`DshPluginList.vue` 卡片交互、本地缓存读写。
- **风险/边界**：`description` 缺失兜底；备注与同步镜像边界要清晰（纯本地、不参与对账）。

### WI-003 — 一键启动 dsh + 错误堆栈复制

- **背景**：现有「诊断修复」是 spawn `dsh web` 捕获崩溃并解析失败插件，但目的偏「诊断后关闭重试」；用户需要更直接的「启动 dsh」入口，失败能拿完整堆栈并复制。
- **方案要点**：新增「启动 dsh」按钮，spawn `dsh web` 成功则保持运行；失败捕获 stderr 全文，UI 展示 + 「复制」按钮（Tauri clipboard / Web `navigator.clipboard`）；复用 §4.3 堆栈解析做「失败插件名」增强。
- **与现有诊断的关系**：区别于 `diagnose_dsh_web`（健康即 kill 诊断实例），「一键启动」是真正常驻拉起；两者共用 spawn/捕获底层。
- **依赖**：`DshDiagnose.vue` 入口按钮、spawn 与捕获逻辑、clipboard。
- **风险/边界**：dsh web 常驻进程生命周期；`EADDRINUSE` 沿用现有 hint 不算失败。

### WI-004 — 首启卡顿定位与研究

- **背景**：首次启动程序时有可感知卡顿，需定位原因。
- **方案要点**：先测量再定位，区分前端资源加载/渲染、Rust 启动初始化、skills sync 自动拉取、插件扫描、依赖懒加载、冷启动 `pnpm` 探测等环节；产出结论 + 优化方向。
- **验收**：一份「卡顿原因说明」+ 可执行优化项列表，优化项可转成后续工作项。
- **风险/边界**：可能多因素叠加需分层定位；部分优化改动较大，先研究、结论明确后再动手。

### WI-005 — 插件选择性同步（按卡片勾选）

- **背景**：现有 F3 同步是「整份 profile 全量镜像」，用户无法只同步部分插件；需要细化到「每条插件卡片可独立勾选是否同步」。
- **方案要点**：
  - 每条插件条目增加 `sync: boolean` 标记（默认 true，与现行为一致）。
  - **推送**：镜像 `package.json` / `cordis.patch.yml` 时只保留勾选条目；**复用现有镜像清洗链路**（`cleanLockfile` 已剔除不可移植依赖，`snapshot_local_to_mirror` 已剔除内置 bundle），再叠加「按勾选过滤」一层即可。
  - **拉取/对齐**：只对齐勾选条目；未勾选条目不写回本地、不触发 `pnpm install`。
- **关键决策（已锁定）**：
  - 同步标记存 AgentHub 本地缓存（不入 `~/.dsh` 事实源、不入同步镜像）。
  - 默认值：新插件默认「同步」（与现行为一致），可关。
  - `pnpm-lock.yaml` 整体照常同步（不按勾选裁剪），镜像只过滤 `package.json` / `cordis.patch.yml` 条目，避免破坏 lock 完整性。
- **依赖**：`dsh_plugins_sync.rs`、`dshPlugins.ts` 镜像/对齐函数、`DshPluginRow.vue` / `DshPluginList.vue`、`DshPluginEntry` 类型扩展。
- **风险/边界**：勾选过滤与「不可移植剔除」「内置剔除」三者叠加顺序要明确；`orphan`（本机装了但配置未声明）条目如何参与勾选需定义。

### WI-006 — 配置快照与回滚

- **背景**：改插件配置 / DSH 升级前需要一个可回退的「安全点」。
- **现状复用**：对齐流程已内置「对齐前快照」（`dshPlugins.ts` 的 `snapFiles = ['package.json','cordis.patch.yml','pnpm-lock.yaml','pnpm-workspace.yaml']`，失败回滚用），可扩展为「用户可见的时间线快照 + 手动创建 + 一键回滚」。
- **方案要点**：
  - 快照范围：`~/.dsh/profiles/<name>` 的 `package.json` + `cordis.patch.yml` + `pnpm-lock.yaml`（+ `pnpm-workspace.yaml`）。
  - 手动创建快照 + 关键操作前自动快照（安装、对齐、DSH 升级）。
  - 时间线列表（时间 + 触发来源 + 备注），一键回滚到某快照；回滚后提示是否需 `pnpm install` 对齐磁盘。
- **关键决策（已锁定）**：快照存 `%APPDATA%\AgentHub\backups\`；保留策略 = 最近 20 份 + 手动标记的永久保留，超出自动清理。
- **依赖**：`dsh_plugins.rs`、`dshPlugins.ts`、插件页/设置页入口、回滚 UI。
- **风险/边界**：回滚只覆盖配置文件、不覆盖 `node_modules`（回滚后可能需重新 install）；快照文件加入 `.gitignore` 避免进同步仓库。

### WI-007 — 应用日志系统

- **背景**：排查问题（尤其 WI-004 首启卡顿）缺少统一日志支撑。
- **方案要点**：
  - 统一日志：分级（debug/info/warn/error）+ 模块标签 + 时间戳，覆盖启动、扫描、同步、安装、更新等关键路径。
  - 双端：Rust 用 `log`/`tracing` 写入文件；Web 模式 Node 端写同一格式文件。
  - UI：设置页「日志」入口，可查看 + 一键导出（含复制路径）。
- **依赖**：Rust `log`/`tracing` + 文件 appender；Node 端日志模块；`SettingsModal.vue` 入口。
- **风险/边界**：日志文件轮转/大小上限，避免无限膨胀；含本机路径，导出时提示脱敏。

### WI-008 — 同步中心增强（联动 WI-005 / WI-006）

- **背景**：当前同步手动 + 启动 fast-forward 自动拉取，冲突只能跳过，无历史记录。
- **方案要点**：
  - 定时同步（可选间隔 / cron）。
  - 冲突可视化解决（本地 vs 远端 diff，选择覆盖方向）。
  - 同步历史记录（时间、结果、变更摘要）。
- **与 WI-005/WI-006 的联动**：选择性同步的条目过滤、同步前的自动快照，统一纳入同步中心这条链路设计，避免三处各写一套。
- **依赖**：`SyncView.vue`、`syncRepo.ts` / `git_sync.rs`、`gitSyncUtil.ts`。
- **风险/边界**：定时同步与手动同步互斥/去抖；冲突解决不能破坏 `~/.dsh` 事实源。

### WI-009 — DSH 版本升级与版本管理

- **背景**：DSH 升级后可能导致现有插件大面积失效，需要可升级 + 可回滚的版本管理。
- **现状依据**：DSH 是全局 npm 命令（探测 `where dsh` / `AppData\Roaming\npm\dsh.cmd`），版本管理即操作全局 npm 包。
- **方案要点**：
  - 插件管理页新增「DSH 版本」区：显示当前 DSH 版本、检测远端最新版本。
  - 升级：升级前自动创建配置快照（复用 WI-006），执行升级（`npm install -g <dsh>@<version>` 或 `pnpm` 等价），失败或插件大面积失效时可一键回滚版本 + 回滚配置快照。
  - 版本管理：记录历史版本，支持指定版本安装（降级 / 切换）。
- **关键决策（已锁定）**：
  - DSH 全局包名：`@deepseek-ai/dsh`（实施时以 `dsh --version` / npm 全局包实测为准）。
  - 「插件大面积失效」判定：升级后跑一次诊断/扫描，对比 before/after 失败条目数。
- **依赖**：插件管理页、WI-006 快照、`dsh_plugins.rs` 的 `resolve_dsh_command` / `resolve_pnpm_command`。
- **风险/边界**：升级/降级是全局操作、影响所有 profile；「回滚」需同时覆盖 DSH 版本与插件配置两层。

### WI-010 — MCP Server 配置总线

- **背景**：项目既定 TODO（`HANDOVER.md` §9）之一，补齐 AgentHub「三支柱」的第三块（Skills 已做 / DSH Plugins 已做 / MCP 规划中）；同步仓库已预留 `mcp/` 分类。
- **方案要点**：把多 Agent 的 MCP Server 配置（`claude_desktop_config.json`、`gemini/mcp`、`codex/mcp` 等）集中可视化：扫描 → 对账 → 启停 → 多端同步（复用 `mcp/` 分类与现有 sync 链路）。
- **优先级说明**：用户明确「要做，但优先级推后」，故标 P3。
- **依赖**：`syncRepo.ts` / `skills_sync.rs` 的 `mcp/` 分类扩展、新组件、`models.rs` 类型。
- **风险/边界**：各 Agent MCP 配置文件格式差异大（JSON 结构不一），需统一抽象层。

### WI-011 — macOS / Linux 系统适配

- **背景**：当前大量核心逻辑 Windows 强耦合（`mklink /J` NTFS Junction、`taskkill /T /F`、`AppData\Roaming\npm`、WinINET 代理自愈、Antigravity Hardlink Tree、`.cmd` shim）。README badge 宣称支持三平台，实际仅 Windows 验证。**用户标记为当前最高优先级。**
- **实施策略（已锁定：不做完整底层重构）**：
  - **三层判断**：
    1. **链接层**（junction/symlink/hardlink）：`fs_junction.rs` 已预埋 `#[cfg(not(windows))]` 的 symlink + 文件硬链接回退分支（`fs::hard_link` 跨平台可用），**骨架已存在、缺验证非重写** → 收敛 + 真机验证。
    2. **浅层耦合**（npm 全局路径 / Agent 目录 / WinINET 代理 / taskkill / 系统主题检测）：取值来源不同、非结构不同 → **加平台分支**，不重构。
    3. **Antigravity 特例**：Windows 沙箱跳过目录软链故用 hardlink-tree；Unix 行为未知 → **先探明再补策略**，非底层重构。
  - **唯一重构性质动作**：把散落在 Rust（`fs_junction.rs` + `lib.rs`）与 Node（`localApi.ts`）两端重复的「链接决策逻辑」收敛成一份 **Agent × 平台 → 链接策略矩阵**（junction / symlink / hardlink-tree / copy + fallback 顺序），两端共享同一套语义，避免越改越漂。
- **分阶段实施（估算 25~30 人天 ≈ 单人 3~4 周，含三平台真机验证）**：
  - **Phase 1 — 链接层收敛 + 核心跑通（6~7 人天）**：抽出链接决策矩阵（双端对齐）→ 三平台验证 symlink/hardlink 链路 → 修 Unix 分支 bug；应用能在 macOS/Linux 启动，Skills 分发核心可用。
  - **Phase 2 — 浅层耦合适配（8~10 人天）**：npm 全局路径（`npm prefix -g`/`which`）、16 Agent 目录矩阵（Linux `~/.config/*`、macOS `~/Library/Application Support/*`）、WinINET→环境变量代理、进程树清理（`pkill`/`pgrep`+`kill`）、系统主题检测、更新安装逻辑（darwin/linux）。
  - **Phase 3 — Antigravity 策略 + 打包 CI + 回归（10~12 人天）**：真机探明 Antigravity 在 Unix 对 symlink 的行为并补策略；`tauri build` 产出 `.app`/`.dmg`/`.deb`/`.AppImage` + 三平台 CI 矩阵（含 macOS 签名/公证）；三平台全量回归。
- **依赖**：`fs_junction.rs`、`process.rs`、`git_sync.rs` 代理、`dsh_plugins.rs` 命令探测、`agent_detector.rs`、`localApi.ts` 双端、`useAppStore.ts`、`.github/workflows` CI。
- **风险/边界**：Rust/Node 双端对齐是硬约束；Unix 分支是「从未跑过的代码 = 有 bug 的代码」，主工作量在真机验证与回归，而非写新代码。关键变量：Antigravity 在 Unix 的沙箱行为、macOS 签名/公证、16 Agent 目录覆盖度。
- **后续动作（落盘规范）**：WI-011 完成后，将 §5「跨平台开发规范」同步进 `HANDOVER.md` 与 `AGENTS.md`（本仓库当前无 `AGENTS.md`，需新建），作为后续所有开发的强制约束。

### WI-012 — 国际化（i18n）

- **背景**：UI 全中文硬编码（`\p{Han}` 匹配约 589 处，遍布 20+ 组件），README 中英双语文档但应用无 i18n。
- **方案要点**：
  - 引入 `vue-i18n`，抽取模板内联中文 → 语言包（先 zh / en 两语言）。
  - 后端返回的中文错误消息需「错误码化」或双端语言包，保证跨端提示一致。
  - 语言偏好持久化（localStorage / config.json），设置页新增语言切换入口。
- **关键决策（待锁定，推荐）**：
  - 语言包按组件/页面命名空间拆分。
  - 后端错误消息推荐「错误码化」（后端返回 code，前端查语言包），避免后端塞两份文案。
- **依赖**：`vue-i18n`、20+ 组件改造、`server/*.ts` 错误消息、`SettingsModal.vue`。
- **风险/边界**：文案量 589+ 处需分批抽取；建议在 macOS/Linux 适配新增文案前尽早做，避免二次补抽。

---

## 4. 优先级与推荐开发顺序

> 优先级经最终校准：WI-011 升为 P0（地基 + 后续规范），WI-012 升为 P1（紧随适配、避免返工）。

### 4.1 优先级总览

| 优先级 | 编号 | 工作项 |
|---|---|---|
| **P0 地基** | WI-011 | macOS / Linux 系统适配 |
| **P1 高** | WI-003 | 一键启动 dsh + 错误堆栈复制 |
| | WI-005 | 插件选择性同步（按卡片勾选） |
| | WI-006 | 配置快照与回滚 |
| | WI-009 | DSH 版本升级与版本管理 |
| | WI-012 | 国际化（i18n） |
| **P2 中** | WI-001 | 后台常驻与系统托盘 |
| | WI-004 | 首启卡顿定位与研究 |
| | WI-007 | 应用日志系统 |
| | WI-008 | 同步中心增强 |
| **P3 低** | WI-002 | 插件卡片 tag / 备注 / 描述 |
| | WI-010 | MCP Server 配置总线（推后） |

### 4.2 推荐开发顺序

| 序 | 梯队 | 编号 | 工作项 | 优先级 | 依赖 / 理由 |
|---|---|---|---|---|---|
| 1 | **T0 地基** | WI-011 | 三平台适配 | P0 | 最高优先；落地后成为后续开发规范，避免返工 |
| 2 | T1 规范基建 | WI-012 | 国际化 | P1 | 紧随适配，避免新增文案二次补抽 |
| 3 | T1 | WI-007 | 应用日志 | P2 | 基础设施，支撑排查 |
| 4 | T1 | WI-004 | 首启卡顿研究 | P2 | 有日志支撑后再定位 |
| 5 | **T2 插件核心** | WI-006 | 配置快照回滚 | P1 | WI-009 前置；多个功能复用 |
| 6 | T2 | WI-003 | 一键启动 dsh | P1 | 独立功能，可并行 |
| 7 | T2 | WI-005 | 插件选择性同步 | P1 | 插件管理核心 |
| 8 | T2 | WI-009 | DSH 版本管理 | P1 | 依赖 WI-006 快照 |
| 9 | T2 | WI-008 | 同步中心增强 | P2 | 联动 WI-005 / WI-006 统一设计 |
| 10 | T3 体验完善 | WI-001 | 系统托盘 | P2 | 独立小功能 |
| 11 | T3 | WI-002 | 插件卡片 tag / 备注 | P3 | 低优先增强 |
| 12 | T4 远期 | WI-010 | MCP 总线 | P3 | 远期推后 |

---

## 5. 跨平台开发规范（WI-011 落地后生效）

> WI-011 落地后，以下规范成为**后续所有开发的强制约束**。届时同步进 `HANDOVER.md` 与 `AGENTS.md`（本仓库当前无 `AGENTS.md`，需新建）。

1. **三平台一致**：所有新功能在 Windows / macOS / Linux 三平台行为一致，禁止只验证单一平台。
2. **Dual-Mode 双端对齐**：涉及底层文件系统 / 配置 / Git 的改动，Rust Tauri 端（`src-tauri/src/`）与 Node Web 端（`src/server/localApi.ts`）实现 100% 对齐（沿用 CONTRIBUTING 现有约定）。
3. **链接操作走统一决策矩阵**：任何技能/目录的软链、硬链、复制分发，必须经「Agent × 平台 → 链接策略矩阵」决策，禁止在业务代码里散落 `mklink` / `symlink` / `hard_link` 调用。
4. **平台差异走统一抽象**：路径（npm 全局目录 / Agent 目录 / 数据目录）、代理、进程树清理、系统主题检测等平台差异，收敛到统一 helper，禁止硬编码 `AppData\Roaming`、`taskkill`、WinINET 等 Windows 专属实现。
5. **新代码三平台验证**：提交前至少在目标平台（或 CI）跑通验证；macOS / Linux 新增逻辑不得以「本机是 Windows」为由跳过测试。

---

## 6. 更新记录

| 日期 | 变更 | 说明 |
|---|---|---|
| 2026-08-22 | 创建文档 | 建立通用待办清单骨架 |
| 2026-08-22 | 录入 4 项工作项 | WI-001 系统托盘 / WI-002 插件卡片 tag备注描述 / WI-003 一键启动 dsh+堆栈复制 / WI-004 首启卡顿研究 |
| 2026-08-22 | 录入 5 项工作项 | WI-005 插件选择性同步 / WI-006 配置快照回滚 / WI-007 应用日志 / WI-008 同步中心增强 / WI-009 DSH 版本管理（优先级为建议值） |
| 2026-08-22 | 锁定 4 项决策 + 新增 2 项 | 按推荐锁定 WI-002/005/006/009 决策；新增 WI-010 MCP 总线（P3 推后）、WI-011 macOS/Linux 适配（P1 最高优先级） |
| 2026-08-22 | 新增 1 项 | WI-012 国际化（i18n），P2；并补充 WI-011 工作量评估（大） |
| 2026-08-22 | WI-011 策略落盘 | 锁定「不做完整底层重构」，改三层判断 + 链接决策矩阵收敛 + 三 Phase；修正工作量评估为「验证驱动 3~4 周」 |
| 2026-08-22 | 排序与规范落盘 | 新增 §4 优先级/推荐开发顺序、§5 跨平台开发规范；WI-011 升 P0、WI-012 升 P1；标注规范后续同步 HANDOVER/AGENTS |

---

*文档创建日期：2026-08-22 | AgentHub Core Team*
