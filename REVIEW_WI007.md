# WI-007 应用日志系统 — 合入验收清单（主会话管理文档）

> 本文档由 AgentHub 主会话（需求管理会话）维护，用于 WI-007 代码合入 main 前的验收执行记录。
> **开发会话不要修改本文件**；开发请遵循 `PROMPT_WI007_LOGGING.md`。

## 0. 基线（main @ 9508727，2026-08-25 实测）

| 检查项 | 命令 | 结果 | 备注 |
|---|---|---|---|
| 前端生产构建 | `npm run build` | ✅ 通过（exit 0） | 有 1 条既有 Vite `rollupOptions.external` 外部化提示（`@tauri-apps/*`），main 上即存在，非本次改动引入 |
| TypeScript 类型检查 | `npx vue-tsc --noEmit` | ⚠️ 不可用 | vue-tsc 1.8.27 在 Node v24 下抛 `Search string not found: /supportedTSExtensions/` —— 既有工具链不兼容，与代码无关；**不作为本次验收 gate**，以 `npm run build` 为准 |
| 版本同步 | `node scripts/check-version-sync.mjs` | ✅ 版本一致 1.0.6 | 合入后版本未变应继续通过 |
| Rust cargo check | `cargo check` | ⚠️ 环境受限 | 沙箱拒绝拉起 `C:\Users\nomit\.cargo\bin\cargo.exe`（拒绝访问，非编译错误）；**合入时须在可用环境补跑**（CI / 本地 shell） |

> 注意：`cargo check 2>&1 | tail` 的退出码是 `tail` 的，不能用管道尾部判断 cargo 结果；须用 `$?`/`$LASTEXITCODE`。

## 1. 代码验收（对照 PROMPT_WI007_LOGGING.md §3.3）

- [ ] 关键路径（startup / scan / sync / install / update / snapshot / dsh）有分级日志 `debug/info/warn/error` + 模块标签 + 时间戳
- [ ] Rust 端日志落盘：应用数据目录 `logs/`（走 `storage.rs` 统一路径，无硬编码 `%APPDATA%`）
- [ ] Node 端同格式同路径（走 `appPaths.ts`），Dual-Mode 100% 对齐
- [ ] 轮转：按大小（建议 5MB）或按天，保留最近 N 份（建议 5 份）
- [ ] UI：`SettingsModal.vue` 日志查看（分级过滤可选）+ 一键导出 + 复制路径；脱敏提示文案存在
- [ ] i18n：新增文案走 `t()`，`src/locales/zh.ts` / `en.ts` 补齐，无硬编码中文
- [ ] API 四层对齐：Tauri Command ↔ Node 路由 ↔ `api.ts` ↔ store 动作；命令表写入 HANDOVER §8E
- [ ] DESIGN_GUIDELINES：双主题 `dark:` 前缀、1px 细边框、无夸张动效/大圆角
- [ ] 仓库纪律：无 `node_modules/` / `dist/` / `src-tauri/target/` 提交；新增仓库内文件已评估 `.gitignore`；未改版本号

## 2. 构建验证（合入前在功能分支上执行）

- [ ] `npm run build`（零错误；与基线一致的既有警告可接受）
- [ ] `cargo check`（须在能拉起 cargo 的环境执行，记录真实退出码）
- [ ] `node scripts/check-version-sync.mjs`（版本未变应通过）
- [ ] Web 模式 `npm run dev` 手工项：日志文件生成与追加、设置页查看/导出/复制路径、中英切换

## 3. 合入流程

1. 获取功能分支：`git fetch origin` / 本地 `feature/wi-007-logging`
2. 代码审查：`git diff main...feature/wi-007-logging`（重点：双端对齐、路径抽象、轮转、i18n、错误处理、`.gitignore`）
3. 在功能分支上执行 §2 验证
4. 合入 main（按主会话判断 `--no-ff` 保留分支历史 或 squash）
5. 推送 `origin/main`（含主会话管理提交 `9508727` —— 用户已确认合入时一并推送）
6. 文档同步：复核 HANDOVER §8E / CHANGELOG `[Unreleased]`；`PLAN_BACKLOG.md` WI-007 → 已完成 + 更新记录

## 4. 执行记录

| 日期 | 阶段 | 结果 |
|---|---|---|
| 2026-08-25 | 基线 | 见 §0；开发代码未到，待 review |
