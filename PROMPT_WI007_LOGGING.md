# WI-007 应用日志系统 — 开发提示词

> 本提示词由 AgentHub 主会话（需求管理会话）生成，用于在新会话中启动 WI-007 开发。
> 开发完成后请按 §6.5 的回报格式回复，**不要自行 merge / push 到 main**，由主会话 review 后合入。

## 0. 你的任务

在 AgentHub 仓库实现 WI-007「应用日志系统」（`PLAN_BACKLOG.md` §WI-007），交付：
1. 可运行的代码（Rust 双端 + 前端 UI + i18n）；
2. 文档更新（`HANDOVER.md` 新增日志模块章节、`CHANGELOG.md` 追加条目）；
3. 自测结果（build / cargo / 手工验证）。

**禁止事项**：不要修改 `PLAN_BACKLOG.md`（状态由主会话维护）；不要升版本号；不要 push 远端；不要自行 merge main。

## 1. 仓库与必读文档

- 仓库路径：`D:\dev\toolPrograms\agent_config_manager`（如换机器，先 `git pull` 最新 main）
- 必读文档（按顺序）：
  1. `AGENTS.md` —— 跨平台开发规范（五条**全部强制**适用）
  2. `CONTRIBUTING.md` —— PR 准入与工程约定
  3. `HANDOVER.md` —— 项目 Single Source of Truth；重点：§4 数据存储、§8C/8D 双端对齐样板、§10 接力维护协议
  4. `PLAN_BACKLOG.md` §WI-007 —— 需求原文、验收标准
  5. `DESIGN_GUIDELINES.md` —— UI 视觉规范（新增组件必须遵守，禁止风格漂移）
  6. `CHANGELOG.md` —— 变更记录格式
- 双端对齐参考样板：WI-006 快照（`DshConfigSnapshots.vue` + `dsh_plugins.rs` 快照命令 + `localApi.ts` 路由 + store 动作）、WI-009 版本管理（`DshVersionManager.vue`）

## 2. 需求背景

当前排障是"盲"的：

- Rust 端无日志框架（`src-tauri/Cargo.toml` 无 `tracing` / `log` / `log4rs` 依赖）；
- Node 端无日志模块（`src/server/` 无 logger，只有各处零散 `console` 输出）；
- UI 仅有 `DshInstallTerminal.vue` / `DshVersionTerminal.vue` 的**终端输出**，无统一日志查看/导出。

WI-004「首启卡顿研究」需要日志与耗时埋点支撑，故先做 WI-007 基建。

## 3. 需求详述

### 3.1 功能要求

1. **统一日志格式**：`时间戳 [级别] [模块] 消息`；级别 `debug / info / warn / error`；模块标签覆盖关键路径：`startup`（启动）、`scan`（扫描）、`sync`（同步）、`install`（安装）、`update`（更新）、`dsh`（插件中心）、`snapshot`（快照）等。
2. **Rust 端**：`tracing` + `tracing-appender`（或 `log4rs`），日志文件落在应用数据目录 `logs/` 下；数据目录必须走现有单一事实源（Rust `storage.rs` / Node `appPaths.ts`），**禁止硬编码 `%APPDATA%` 等路径**。
3. **Node Web 端**：同格式日志写入**同一路径同一格式**的文件（Dual-Mode 100% 对齐）；关键函数埋点与 Rust 对应。
4. **轮转**：按大小（建议 5MB）或按天轮转，保留最近 N 份（建议 5 份），防止无限膨胀。
5. **UI**：`SettingsModal.vue` 新增「日志」区/入口 —— 只读查看最近日志（可选分级过滤）、一键导出（保存对话框）、一键复制日志文件路径。
6. **脱敏提示**：日志含本机路径，查看/导出时 UI 给出脱敏提示文案。
7. **i18n**：所有新增 UI 文案走 `t()`，同步补充 `src/locales/zh.ts` / `en.ts`（沿用 WI-012 的组件命名空间拆分），**禁止硬编码中文**。

### 3.2 双端 API（沿用命令表惯例，名称可微调）

| Tauri Command | Web 路由 | 说明 |
|---|---|---|
| `get_app_logs` | `GET /api/app/logs` | 读取最近日志（支持 `limit` / `level` 过滤） |
| `export_app_logs` | `GET /api/app/logs/export` | 导出日志（另存 / 返回导出文件路径） |
| `get_app_log_path` | `GET /api/app/logs/path` | 返回日志文件路径（UI 一键复制） |

要求：Tauri Command ↔ Node 路由 ↔ 前端 `api.ts` ↔ store 动作**四层同步实现**（参考 HANDOVER §8C/8D 的表格与实现风格）。

### 3.3 验收标准（必须全部满足）

- 启动 / 扫描 / 同步 / 安装 / 更新 / 快照等关键路径有分级日志，日志文件实际落盘可查；
- Rust 与 Node 写出的日志**格式一致、路径一致**（Web 模式 `npm run dev` 下可验证同一文件追加）；
- 设置页可查看 + 一键导出 + 复制路径；轮转生效；脱敏提示存在；
- `npm run build` 零错误零警告；`cargo check` 通过；新增 UI 符合 DESIGN_GUIDELINES（双主题 `dark:` 前缀、1px 细边框、无夸张动效/大圆角）。

## 4. 技术约束（AGENTS.md §5 强制）

1. **三平台一致**：路径、换行、时间格式不得有 Windows 专属假设；数据目录走 `appPaths.ts` / `storage.rs` 统一抽象。
2. **Dual-Mode 100% 对齐**：Rust 端（`src-tauri/src/`）与 Node Web 端（`src/server/`）行为、格式、API 必须对齐。
3. **平台差异收敛到统一 helper**，禁止在业务代码散落平台分支。
4. **新代码三平台验证**：至少本机验证 + 代码层面保证 macOS / Linux 语义正确；不得以「本机是 Windows」为由跳过。

## 5. 改动文件预估（以实际为准）

- **Rust**：`Cargo.toml`（+ `tracing` / `tracing-appender`，或 `log4rs`）、新增 `src-tauri/src/logger.rs`、`lib.rs`（日志初始化 + 3 个 command 注册）、`models.rs`（`LogEntry` 等类型）、关键模块埋点（`storage.rs`、`dsh_plugins.rs`、`dsh_plugins_sync.rs`、`skills_sync.rs`、`git_sync.rs`、`app_update.rs`、`watcher.rs`、`process.rs`）
- **Node**：新增 `src/server/logger.ts`、`localApi.ts`（3 条路由）、`dshPlugins.ts` / `syncRepo.ts` / `appUpdate.ts` 埋点、`appPaths.ts`（如需要 `logs` 子目录 helper）
- **前端**：`src/services/api.ts`（3 个方法）、`src/stores/useAppStore.ts`（state + actions）、`SettingsModal.vue`（或新增 `LogViewerModal.vue` 并挂入设置页）、`src/locales/zh.ts` / `en.ts`
- **文档**：`HANDOVER.md`（新增 §8E 应用日志系统：能力说明 + API 命令表 + 变更记录行）、`CHANGELOG.md`（顶部追加 `[Unreleased]` 条目，**版本号由主会话定，本轮不改 package.json / Cargo.toml / tauri.conf.json 版本**）

## 6. 仓库管理与提交规范（重要）

1. **分支**：基于最新 main，`git switch -c feature/wi-007-logging`。
2. **提交粒度**：建议按 4 个逻辑提交：① Rust 日志基建与埋点 → ② Node 双端对齐 → ③ 前端 UI + i18n → ④ 文档（HANDOVER / CHANGELOG）。每条 commit message 以 `WI-007:` 开头 + 中文简述（参考仓库现有提交风格）。
3. **红线**：
   - 不提交 `node_modules/`、`dist/`、`src-tauri/target/`（.gitignore 已有，勿破坏）；
   - 日志文件位于用户数据目录，不属于仓库内容；如新增任何仓库内文件，必须评估并同步 `.gitignore`；
   - 不改 `PLAN_BACKLOG.md`；不升版本号；不 push 远端；不自行 merge main。
4. **提交前验证清单**：`npm run build`（零错误零警告）、`npx vue-tsc --noEmit`、`cargo check`（Rust 端）、`node scripts/check-version-sync.mjs`（版本未变应通过）；Web 模式 `npm run dev` 手工验证：日志文件生成与追加、设置页查看/导出/复制路径、i18n 中英切换。
5. **回报格式（完成后回复主会话）**：
   - 功能分支名 + commit hash 列表；
   - 改动文件清单；
   - 验证结果（build / vue-tsc / cargo check / 手工项）；
   - HANDOVER §8E 与 CHANGELOG 更新位置。

## 7. 完成定义（Definition of Done）

- 代码满足 §3.3 全部验收标准；
- 文档按 §5 更新完毕；
- 提交符合 §6 规范；
- 按 §6.5 格式回报。

---
*生成：AgentHub 主会话 | 需求：WI-007 应用日志系统（P2）*
