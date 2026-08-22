# AGENTS.md — AgentHub 项目协作指令

> 本文件为 AI Coding Agent（Claude Code / DSH / Codex / Cursor 等）提供项目上下文与协作规范。接手任何改动前请先阅读本文件与下方关键文档。

## 项目概览

**AgentHub (AGENT_CONFIG_MANAGE)** 是一款跨 AI Coding Agent 的统一配置中枢桌面客户端，核心能力：

- DSH 插件全生命周期管理（扫描 / 对账 / 安装 / 诊断 / 同步）
- 中央 Skills 软链 / 硬链分发矩阵
- 零 Git 冲突项目规则引擎
- 应用本体在线更新

## 技术栈与架构

- **桌面端**：Tauri 2.0（Rust 后端，`src-tauri/`）
- **前端**：Vite 5 + Vue 3 + TypeScript + Tailwind CSS + Pinia（`src/`）
- **Dual-Mode 双运行架构**：Tauri 桌面端与 Web 浏览器开发模式（`src/server/localApi.ts` + `vite.config.ts` 的 `/api/...` 路由）行为必须 **100% 对齐**。底层文件系统（NTFS Junction / Hardlink）、Git Hook、数据存储相关改动，必须 Rust 端（`src-tauri/src/`）与 Node Web 端（`src/server/localApi.ts`）双向实现。

## 常用命令

```bash
npm install           # 安装依赖
npm run dev           # Web 开发模式（http://localhost:1420）
npm run build         # 前端生产构建
npx tsc --noEmit      # TypeScript 类型检查
npm run tauri dev     # Tauri 桌面调试（需 Rust 工具链）
npm run tauri build   # 打包桌面安装包
cargo check           # Rust 侧编译检查（在 src-tauri/ 下）
```

## 关键文档（必读）

| 文档 | 用途 |
|---|---|
| `README.md` / `README.en.md` | 项目介绍、功能与使用 |
| `HANDOVER.md` | **Single Source of Truth** 交接文档（架构、Schema、模块索引、变更记录） |
| `CONTRIBUTING.md` | 协作与仓库治理规范 |
| `DESIGN_GUIDELINES.md` | UI 设计规范（macOS Vibrancy） |

## 强制规范

1. **双端对齐**：涉及文件系统、Git、数据存储的改动，Rust 与 Node Web 端逻辑必须 100% 一致。
2. **文档同步**：任何架构、数据 Schema、模块新增或变更，必须同步更新 `HANDOVER.md` 与 `README.md`。
3. **UI 规范**：所有前端改动严格遵循 `DESIGN_GUIDELINES.md`，严禁风格漂移。
4. **提交规范**：遵循 Conventional Commits；提交前运行 `npx tsc --noEmit` 与 `npm run build` 确保零错误零警告。

## 隐私红线（开源项目）

- 严禁提交任何本地绝对路径、Windows 用户名、密码、Token、API Key、私钥、个人项目路径。
- 文档与示例数据必须使用占位符（如 `<username>`、`<host>:<port>`、`C:\Users\<username>\`）。
- 涉及 `~/.dsh`、`%APPDATA%` 等路径时，一律使用通用形式，不得出现真实本机用户名。
