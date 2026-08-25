# WI-001 系统托盘与后台常驻 — 开发提示词

> 由 AgentHub 主会话（需求管理会话）生成，用于新会话开发 WI-001。
> **⚠️ 本版本合入流程改为 PR（与 WI-007 不同）**：开发会话推分支 + 开 PR，主会话/用户 review 后经 PR 合入；**禁止直推 main**。

## 0. 你的任务

在 AgentHub 仓库实现 WI-001「后台常驻与系统托盘」（`PLAN_BACKLOG.md` §WI-001）：
- Tauri 2 桌面端系统托盘图标 + 上下文菜单（「显示主窗口」/「退出」）；
- 关闭窗口 → **隐藏到托盘后台驻留**（而非退出）；
- 托盘可唤回主窗口、可彻底退出；
- Web 模式不适用 → 能力降级，不破坏浏览器模式。

## 1. 仓库与必读文档

- 仓库路径：`D:\dev\toolPrograms\agent_config_manager`（开始前先 `git pull origin main`，基线 = origin/main）
- 必读（按顺序）：
  1. `AGENTS.md` —— 跨平台开发规范（五条**全部强制**适用）
  2. `CONTRIBUTING.md` —— PR 准入（本版本走 PR 合入）
  3. `HANDOVER.md` —— 重点：§4 数据存储、§8E（WI-007 日志，作埋点参考）、§10 交接协议
  4. `PLAN_BACKLOG.md` §WI-001 —— 需求原文与验收标准
  5. `DESIGN_GUIDELINES.md` —— 若涉及任何 UI 改动（可选设置项）必须遵守
  6. `CHANGELOG.md` —— 变更记录格式（已有 `[Unreleased]` 含 WI-007 条目，WI-001 追加）
- 参考：WI-007 的 `logger.rs` / `logger.ts` 用法（托盘事件埋点沿用 `log_info!` / `logInfo` 模块标签 `tray`）

## 2. 现状（代码事实，已核验）

- `src-tauri/Cargo.toml`：`tauri = { version = "2.0.0", features = [] }` → **需加 `"tray-icon"` feature**；可选 `tauri-plugin-single-instance`
- `src-tauri/src/main.rs`：仅 `agenthub_lib::run()`；窗口/托盘逻辑在 `src-tauri/src/lib.rs` 的 `run()`（`tauri::Builder`）
- `src-tauri/tauri.conf.json`：单窗口（label 默认 `"main"`，decorations true）、图标 `icons/` 齐全
- 日志系统（WI-007）已就位：Rust `crate::log_info!("tray", ...)`；Web 模式 `src/server/logger.ts`
- 当前无任何托盘/single-instance 代码

## 3. 需求详述

### 3.1 核心（验收必达）

1. **托盘图标**：`TrayIconBuilder` 创建（`app.default_window_icon()` 克隆现有图标）；上下文菜单两项：`显示主窗口` / `退出`。
2. **关闭驻留**：拦截 `WindowEvent::CloseRequested` → `api.prevent_close()` + `window.hide()`（窗口隐藏、应用继续后台运行）。
3. **托盘唤回**：菜单「显示主窗口」→ `show()` + `set_focus()` + `unminimize()`（处理最小化/隐藏任意状态）。
4. **彻底退出**：菜单「退出」→ `app.exit(0)`。
5. **交互细节**：托盘左键单击显示主窗口（Windows/Linux 常规）；macOS 菜单栏图标行为遵循平台默认（点击弹出菜单），右击/左击差异按 Tauri 2 文档处理。
6. **埋点**：托盘创建 / 显示主窗口 / 退出等关键事件用 WI-007 logger（模块标签 `tray`）。

### 3.2 平台差异（AGENTS.md §5 强制）

- **Windows**：系统托盘，真机实测。
- **macOS**：菜单栏图标；可选处理 template image（深浅色自适应）；真机实测。
- **Linux**：托盘依赖 appindicator（`libayatana-appindicator`）；代码层面 `TrayIconBuilder` 跨平台一致，但需在文档/PR 中说明 `.deb`/`.AppImage` 的运行时依赖与验证状态。
- **Web 模式**：无托盘（N/A）。托盘代码只允许在 Tauri `setup` 中运行；Web 模式（`npm run dev`）必须完全不受影响（回归验证必做）。

### 3.3 可选增强（做与不做均需在 PR 说明；建议先做核心）

- `single-instance`：`tauri-plugin-single-instance`，重复启动时聚焦已有实例（macOS/Linux 注意其事件模型差异）。
- 设置页「关闭到托盘」开关：`AppConfig.close_to_tray`（Rust `models.rs` ↔ Node `config.json` 双端对齐 + `SettingsModal.vue` + zh/en 语言包）。**默认值建议 true**；不做则固定「关闭即托盘」。
- 托盘菜单文案双语：原生菜单按 `AppConfig.locale` 分支（可选；否则固定中文「显示主窗口/退出」）。

### 3.4 验收标准（必须全部满足）

- 关闭窗口后应用仍在托盘驻留，进程不退出；
- 托盘可唤回主窗口（含从最小化/隐藏恢复）；
- 托盘可彻底退出应用；
- Web 模式（vite dev）功能回归不受影响；
- 三平台代码路径一致（Windows 实测 + macOS/Linux 代码审查 + CI）；若做 AppConfig 字段则双端 100% 对齐。

## 4. 技术约束（AGENTS.md §5）

1. 三平台一致；2. Dual-Mode 100% 对齐（托盘本身纯桌面端、Node 端不实现，但**新增 AppConfig 字段必须双端对齐**）；3. 平台差异收敛统一 helper（托盘 API 本身跨平台，不散落平台分支）；4. 新代码三平台验证（本机 Windows 实测 + macOS/Linux 审查 + CI，不得以「本机是 Windows」跳过）。

## 5. 改动文件预估（以实际为准）

- **Rust**：`Cargo.toml`（`features = ["tray-icon"]`，可选 single-instance）、`src-tauri/src/lib.rs`（`setup` 建托盘 + `on_window_event` 关窗隐藏 + 菜单事件处理）、可选 `models.rs`（`close_to_tray` 字段）
- **Node**（仅可选做设置项时）：`localApi.ts` / `config.json` 读写对齐
- **前端**（仅可选做设置项时）：`SettingsModal.vue` + `src/locales/zh.ts|en.ts`
- **文档**：`HANDOVER.md` 新增托盘章节（建议 §8F，位于 §8E 之后）+ 内部变更记录；`CHANGELOG.md` `[Unreleased]` 追加 WI-001 条目
- **不改** `PLAN_BACKLOG.md`（主会话维护）；**不升版本号**（保持 v1.0.6）

## 6. 仓库管理与 PR 流程（⚠️ 本版本起强制，与 WI-007 不同）

1. `git pull origin main` 取得最新基线；
2. 建分支：`git switch -c feature/wi-001-tray`；
3. 提交：message 前缀 `WI-001:` + 中文简述，建议按「Rust 托盘基建 → 关窗驻留/退出逻辑 → 埋点与可选设置 → 文档」分逻辑提交；
4. **推送分支**：`git push -u origin feature/wi-001-tray`；
5. **开 PR**：`gh pr create --base main --head feature/wi-001-tray --title "WI-001: 系统托盘与后台常驻" --body "<变更摘要 + 验证结果>"`；若 `gh` 未认证，用浏览器在 GitHub 开 PR 并回报 PR URL；
6. **等 CI**：PR 必须通过远端状态检查（含 `Frontend Typecheck & Build`）；若 CI 失败需修复后重推（不要用 `--force` 覆盖他人提交，仅推自己的分支）；
7. **不要自行 merge**：主会话/用户 review 后经 PR 合入（`gh pr merge` 或 GitHub UI）；
8. 红线：不直推 main、不改 `PLAN_BACKLOG.md`、不升版本号、不删/不 force 覆盖分支；
9. **回报格式**：分支名 + PR URL + commit hash 列表 + 改动文件清单 + 验证结果（含 CI 状态）+ HANDOVER/CHANGELOG 更新位置。

## 7. 提交前验证清单

- [ ] `cargo check`（本环境沙箱可能拒绝拉起 cargo，需在可用 shell/CI 跑并记录**真实退出码**，勿用管道尾部）
- [ ] `npm run build`（零错误；既有 chunk-size 提示可接受）
- [ ] `npx tsc --noEmit`（vue-tsc 在 Node v24 环境不兼容时按 WI-007 先例用 tsc 替代）
- [ ] `node scripts/check-version-sync.mjs`（版本未变应通过）
- [ ] Windows 手工：托盘图标出现、关闭窗口驻留、托盘唤回、托盘退出、左键/右键菜单行为
- [ ] Web 模式回归：`npm run dev` 正常启动，托盘相关代码不破坏浏览器模式
- [ ] macOS/Linux：代码路径审查 + PR 说明 appindicator 依赖；CI 绿
- [ ] 文档：HANDOVER 章节 + CHANGELOG `[Unreleased]` 追加完成

## 8. Definition of Done

- §3.4 验收全部通过；PR 已开且 CI 绿；文档已更新；按 §6.9 回报格式提交。
