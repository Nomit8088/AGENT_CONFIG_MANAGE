# PLAN_WI014_SESSION_MIGRATION.md — 会话清单与迁移（可行性 + MVP 设计）

> 状态：📝 需求讨论期（2026-08-28）。本文档记录「多 Agent 会话管理」需求的可行性结论、真机探测结果与 MVP 设计，供排期与后续开发对账。
> 编号：`WI-014`（对应 `PLAN_BACKLOG.md`）。

---

## 0. 结论与范围（已与用户锁定）

| 决策点 | 结论 |
|---|---|
| 首期范围 | **第一档 MVP：会话清单 + 备份/导出**（不做原生 resume） |
| 「迁移」的产品定义 | **备份 + 中立交接文档**为主（不追求写私有库的原生导入） |
| 首期 Agent | DSH、Codex/OpenCode、Claude Code |
| 优先级 | P2（建议值，可调整） |

---

## 1. 背景与诉求

多 Agent 并行开发时，各 Agent 的会话分散在不同私有目录，缺乏统一视图，难以查找、备份、交接。用户原始诉求分解为三功能：

1. 自动识别各 Agent 会话存储位置 + 识别会话主题/工作区；
2. 把聊天记录转成目标 Agent 需要的格式（用户标记为**实现难度最大**）；
3. 迁移 / 保存 / 备份。

本轮先做可行性讨论，结论如上表：功能 ①③ 可行且高价值，功能 ② 因多数 Agent 无开放导入契约，**用「中立交接文档」替代「写私有库原生迁移」**，从而对全部 16 个 Agent 通用。

---

## 2. 真机探测结论（本机 Windows，2026-08-28）

> 探测命令为只读目录枚举 + 魔数检查，未读取会话正文内容。以下路径均以 `~` 代指用户主目录。

| Agent | 实测存储位置 | 格式 | 会话命名 | 规模 |
|---|---|---|---|---|
| **DSH** | `~/.dsh/sessions/<cwd编码>/<uuid>/session.jsonl.zstd` | JSONL + **标准 Zstandard 压缩**（魔数 `28 B5 2F FD` 已确认） | 会话目录两种命名并存：裸 `<uuid>` 与 `session-<uuid>` | 单文件 0.4MB ~ 10MB |
| **Claude Code** | `~/.claude/projects/<cwd编码>/<uuid>.jsonl` | 明文 JSONL | `<uuid>.jsonl` | `~/.claude/history.jsonl` 为 resume 索引（1.3MB） |
| **Codex** | `~/.codex/sessions/YYYY/MM/DD/rollout-<ISO时间戳>-<id>.jsonl` | 明文 JSONL | `rollout-*.jsonl` | 单文件可达 **177MB** |
| **OpenCode** | `~/.local/share/opencode/opencode.db`（伴 `-wal` / `-shm`） | **SQLite（WAL 模式）** | 库内表 | 35MB |

### 2.1 对先验判断的重要修正

- **DSH = zstd 压缩 JSONL**，不是明文。读取需 zstd 解码器：Rust 端 `zstd` crate 零外部依赖；Node 端需纯 wasm/JS 解码依赖（如 `@bokuweb/zstd-wasm` / `zstddec`）——这是 Dual-Mode 双端对齐的一个关键点。
- **OpenCode 本机为 SQLite**（非 JSONL），故从「Tier A 开放格式」降级到「Tier B 本地但需 DB 解析」。
- **Claude 有两套目录**：`~/.claude/sessions/` 仅存 pid 锁文件（非会话），真身是 `~/.claude/projects/<cwd编码>/<uuid>.jsonl`；`~/.claude/history.jsonl` 是 `claude --resume` 的会话索引。

### 2.2 cwd 编码规则（DSH 与 Claude 均确认）

`--` + 原路径（`:`、`\` → `-`）+ `--`。例：`D:\dev\toolPrograms\x` → `--D--dev-toolPrograms-x--`。

→ **工作区可直接从目录名反解，无需解析正文**。这是 MVP「清单」功能最稳的地基。

---

## 3. 分层可行性（实测更新版）

| 分层 | Agent | 清单 | 备份原文 | 中立导出（正文） | 说明 |
|---|---|---|---|---|---|
| **A** | DSH、Claude Code、Codex | ✅ | ✅ | ✅ | 文本消息流，可流式读/导出 |
| **B** | OpenCode | ✅ | ✅ | 🟡（需 SQLite 解析） | 只读访问 `opencode.db` + WAL |
| **C** | 其余 12 个（Cursor/Windsurf/Copilot/ZCode/Trae/Antigravity 等） | 🟡（目录级兜底） | 🟡 | 🔴 | 私有/云端，后续逐 Agent 扩 |

---

## 4. 产品形态

### 4.1 第一档（MVP，本轮目标）

**会话清单 + 备份/导出**：

- **扫描**：列出各 Agent 会话（来源 Agent / 工作区 / 时间 / 大小）。
- **主题/标题**（best-effort）：DSH 解压首条、Claude 读首条 user、Codex 读 rollout 头部；失败则回退到「工作区 + 时间」命名。
- **动作**：
  - 备份到 AgentHub 数据目录（版本化，不覆盖）；
  - 导出中立转录（Markdown / JSONL）；
  - 定位原始文件（在文件管理器中打开）。

### 4.2 第二档（迁移 = 备份 + 交接文档，后续）

- **交接文档**（中立 Markdown，全 16 Agent 通用）：主题 / 工作区 / 关键决策 / 未完成任务 / 涉及文件 / 时间线。
- **注入目标 Agent**：复用现有规则注入能力（`AGENTS.md` / `CLAUDE.md` / `.agents/rules/`），把交接文档喂给目标 Agent 的下一个会话。
- **原生 resume**：仅 Tier A 内部 best-effort，写前对目标端自动快照（复用 WI-006 范式），并明确「可能有损（工具调用/压缩历史无法完整往返）」。

---

## 5. 架构设计（双端对齐）

- **模块**：新增 `session_inventory`（Rust `src-tauri/src/session_inventory.rs` ↔ Node `src/server/localApi.ts` 的 `session/*` 路由），沿用 Dual-Mode 模板（`isTauri()` → invoke / HTTP 双路径）。
- **解析器注册表**：`SessionParser` trait / TS 接口，per-Agent 独立实现（`parsers/dsh.ts`、`claude.ts`、`codex.ts`、`opencode.ts`），可插拔扩展 16 Agent，避免一个巨型 if-else。
- **数据模型**（TS/Rust 共享 shape）：
  ```ts
  SessionEntry {
    agent: AgentId            // dsh | claude-code | codex | opencode
    sessionId: string
    workspace: string | null  // 从目录名/正文首条反解
    title: string | null      // best-effort
    startedAt: number
    updatedAt: number
    sizeBytes: number
    path: string              // 原始位置（展示时脱敏）
    format: 'jsonl' | 'jsonl.zstd' | 'sqlite' | 'unknown'
  }

  HandoffDoc {
    title: string
    workspace: string | null
    createdAt: number
    summary: string
    decisions: string[]       // 关键决策
    todos: string[]           // 未完成任务
    files: string[]           // 涉及文件
    timeline: { at: number; text: string }[]
  }
  ```
- **数据目录**：`%APPDATA%\AgentHub\sessions\`（Windows）/ `~/.config/agenthub/sessions/`（其他平台），**加入 `.gitignore`**（对齐 WI-006 `backups/` 约定）。备份命名 `<agent>/<sessionId>/` 下 `transcript.md|jsonl` + `meta.json` + `origin.manifest.json`（记录原始路径与格式）。
- **zstd 解码**：Rust `zstd` crate；Node 用纯 wasm 解码（`@bokuweb/zstd-wasm` 或 `zstddec`），实施期验证两端解出字节一致。
- **大文件策略**：Codex 单文件 177MB → 只读头部 N 行取标题/工作区，全文仅在备份/导出时流式复制，**不整读入内存**。

---

## 6. 关键风险与边界

1. **格式漂移**：zstd JSONL 内部 schema 未公开，DSH/Claude/Codex 升级可能变 → 解析器版本锁定 + 每 Agent 真机回归（沿用 CI 测试思路）。
2. **DSH 内部 schema 未知**：实施第一步 = 解压抽样确认首条记录元数据结构（标题/工作区/时间），再定 `SessionEntry` 字段。
3. **OpenCode SQLite**：只读访问（Rust `rusqlite` / Node `better-sqlite3`），WAL 需一并处理（`-wal`/`-shm`），**禁止写库**。
4. **隐私**：会话含敏感内容 → 备份/导出前脱敏提示（对齐 WI-007 口径），导出产物默认不进同步仓库。
5. **长尾成本**：解析器注册表 + 逐 Agent 维护，避免大 if-else 堆叠。
6. **三平台**：路径探测复用 `appPaths.ts` / `agent_detector.rs`（Linux `~/.config`、macOS `~/Library/Application Support`），禁止硬编码 Windows 路径（`AGENTS.md` §5）。

---

## 7. 复用现有基础设施

`agent_detector.rs`（路径探测范式）、`appPaths.ts`（平台差异）、WI-006 快照/`backups/` 范式、WI-007 日志、WI-008 单飞守卫、vue-i18n（zh/en）、Dual-Mode `localApi.ts` 模板、同步仓库 `.gitignore` 约定。

---

## 8. 验收标准（WI-014）

- 三平台可扫描并列出 DSH / Claude Code / Codex / OpenCode 会话（工作区、时间、大小正确）。
- 一键备份到数据目录，目录结构规范、版本化（重复备份不覆盖）。
- 导出中立 Markdown/JSONL 转录：DSH / Claude Code / Codex 可读正文；OpenCode 至少可导出元数据 + 原文副本。
- 双端（Tauri / Node）行为一致；zh/en i18n；日志埋点；导出产物不入同步仓库。

---

## 9. 后续动作

1. 实施第一步：DSH zstd 解压抽样（确认内部 schema）→ 锁定 `SessionEntry` 字段。
2. 生成开发提示词 `PROMPT_WI014_SESSION_MIGRATION.md` + 验收清单 `REVIEW_WI014.md`（沿用 WI-001/WI-007 流程），走 PR 合入。
3. 排期：MVP 单测覆盖 4 个解析器 + 双端对齐 + 三平台 CI。

---

*文档创建日期：2026-08-28 | AgentHub Core Team*
