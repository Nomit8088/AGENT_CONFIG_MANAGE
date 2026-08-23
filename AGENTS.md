# AGENTS.md — AgentHub 仓库开发规范（AI 协作强制约束）

> 本文件是 AgentHub 仓库根目录的**团队基线规范**，随仓库提交，供所有 AI 协作会话（及人类贡献者）自动注入遵循。
> 命名避坑：本文件与应用内「管理 16 个 Agent 的 `AGENTS.md`」是两个不同概念，互不冲突。

## 跨平台开发规范（WI-011 落地后强制生效）

来源：`PLAN_BACKLOG.md` §5 权威版。所有新增功能与改动必须满足：

1. **三平台一致**：所有新功能在 Windows / macOS / Linux 三平台行为一致，禁止只验证单一平台。
2. **Dual-Mode 双端对齐**：涉及底层文件系统 / 配置 / Git 的改动，Rust Tauri 端（`src-tauri/src/`）与 Node Web 端（`src/server/localApi.ts`）实现 100% 对齐。
3. **链接操作走统一决策矩阵**：任何技能/目录的软链、硬链、复制分发，必须经「Agent × 平台 → 链接策略矩阵」决策（Rust `src-tauri/src/fs_junction.rs::link_strategy_for` / Node `src/shared/linkStrategy.ts`），禁止在业务代码里散落 `mklink` / `symlink` / `hard_link` 调用。
4. **平台差异走统一抽象**：路径（npm 全局目录 / Agent 目录 / 数据目录）、代理、进程树清理、系统主题检测等平台差异，收敛到统一 helper（如 `src/server/appPaths.ts` / `src-tauri/src/process.rs::kill_tree`），禁止硬编码 `AppData\Roaming`、`taskkill`、WinINET 等 Windows 专属实现。
5. **新代码三平台验证**：提交前至少在目标平台（或 CI）跑通验证；macOS / Linux 新增逻辑不得以「本机是 Windows」为由跳过测试。
