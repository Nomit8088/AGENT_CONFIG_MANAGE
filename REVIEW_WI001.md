# WI-001 系统托盘 — 合入验收清单（主会话管理文档）

> **PR 流程版**：开发会话推分支开 PR；主会话 review 后经 PR 合入。管理文档由主会话维护，开发会话不要修改。

## 0. 基线

- origin/main @ `a9d2f0f`（WI-007 完成态，本地已同步）
- 开发分支：`feature/wi-001-tray`（预期）

## 1. 代码验收（对照 PROMPT_WI001_TRAY.md §3）

- [ ] `Cargo.toml` tauri features 含 `tray-icon`
- [ ] 托盘图标：`TrayIconBuilder` + `app.default_window_icon()`（现有 icons，无新增资源）
- [ ] 上下文菜单：`显示主窗口` / `退出`
- [ ] `CloseRequested` → `prevent_close` + `hide()`（关窗驻留，进程不退出）
- [ ] 显示主窗口：`show()` + `set_focus()` + `unminimize()`
- [ ] 退出：`app.exit(0)`（真正退出）
- [ ] 托盘事件埋点：WI-007 logger，模块标签 `tray`
- [ ] Web 模式不受影响（托盘代码仅在 Tauri setup；`npm run dev` 回归）
- [ ] 三平台：TrayIconBuilder 跨平台一致；macOS 菜单栏行为；Linux appindicator 依赖说明
- [ ] 可选设置项（若做）：`AppConfig.close_to_tray` 双端对齐 + `SettingsModal` + zh/en i18n；默认值明确
- [ ] 仓库纪律：不直推 main、不改 `PLAN_BACKLOG.md`、不升版本号（v1.0.6 不变）

## 2. 验证（合入前）

- [ ] PR CI 绿（含 `Frontend Typecheck & Build` 状态检查）
- [ ] `npm run build` / `npx tsc --noEmit` / `node scripts/check-version-sync.mjs` 通过
- [ ] `cargo check` 在可用环境通过（记录真实退出码）
- [ ] Windows 手工：托盘出现 / 关窗驻留 / 唤回 / 退出 / 菜单行为
- [ ] Web 模式回归

## 3. 合入流程（PR）

1. 检查 PR：`gh pr view <url>` 或 GitHub UI —— diff 完整性、CI 状态、改动范围
2. review 通过 → 经 PR 合入（`gh pr merge --merge` 保留逻辑提交，或 `--squash` 压平，按提交粒度定）
3. 合入后确认：origin/main 更新、功能分支删除
4. 文档复核：HANDOVER 托盘章节 / CHANGELOG `[Unreleased]`；`PLAN_BACKLOG.md` WI-001 → 已完成（主会话更新）
5. 推送管理文档（提示词/验收清单/backlog 状态）到 main —— 由主会话准备，用户执行 push（沙箱无 GitHub 凭据）

## 4. 执行记录

| 日期 | 阶段 | 结果 |
|---|---|---|
| 2026-08-25 | 排期 | 提示词 `PROMPT_WI001_TRAY.md` 已生成；WI-001 标「计划中」；PR 流程已写入 |
