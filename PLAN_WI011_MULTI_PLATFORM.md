# WI-011 多端适配（macOS / Linux）技术实现文档

> 状态：✅ 方案已定稿，**已按评审修订（v2）**；待复审，评审通过前禁止开发
> 关联：`PLAN_BACKLOG.md` WI-011（backlog 只保留状态追踪，本文件承载全部技术细节）
> 说明：本文件是 WI-011「macOS / Linux 系统适配」的专项实现文档，与 `PLAN_BACKLOG.md` 解耦。讨论期只沉淀**已锁定决策 + 功能盘点 + 平台耦合点盘点**；实现方案定稿（落盘）并经逐条确认后，才允许进入开发。

---

## 0. 流程约束（本轮讨论约定）

- 讨论阶段**禁止修改任何代码**（`src-tauri/`、`src/`、构建/配置脚本、CI workflow 等）。
- 最终实现方案在本文件定稿（落盘）并经逐条确认后，才按方案开发。
- 本文件独立于 `PLAN_BACKLOG.md`；backlog 侧 WI-011 仅做状态流转，不在讨论期改动。
- 方案评审：实现方案定稿后将在**新会话**做一次方案评审；评审通过前不进入开发。

---

## 1. 已锁定决策（需求基线）

| 编号 | 议题 | 决策 |
|---|---|---|
| A1 | 平台矩阵 | macOS（Apple Silicon + Intel，最低 macOS 12）+ Linux（Ubuntu 22.04 x86_64 为基线，`.AppImage` 通用分发；arm64 视资源决定）+ Windows 维持现状回归 |
| A2 | 完成线 | **方案②：后端逻辑 + 产物结构三平台对等**；GUI 交互以 Windows 对照 + V1 真机抽验清单交付（详见 §4.1.2 方案甲） |
| A3 | 验证资源 | **CI 自动化为主**；本机仅 Windows 资源 |
| P | 流程约束 | 讨论期零代码修改，方案落盘后才开发 |

### 1.1 卡点决议（C1 / C2 / C3，均已定）

| # | 卡点 | 决议 |
|---|---|---|
| C1 | 仓库 public / private | ✅ **public，维持公开**。CI 采用**分级触发**：push/PR 跑 Linux 前端 typecheck/build + ubuntu `cargo check`；三平台 Tauri 打包仅在 `v*` tag 或 `workflow_dispatch` 手动触发 |
| C2 | macOS 签名 / 公证 | ✅ **未签名产物为完成线**（`.app`/`.dmg` 可构建 + README 记录绕过 Gatekeeper 步骤）；Developer ID 签名 + 公证列为 WI-011 之后的可选增强 |
| C3 | 工作量重估 | ✅ **方向性 35~45 人天（≈单人 5~6 周）**；CI-only 远程迭代再 +20~30%（保守 6 周上下）；待 B 议题「验收矩阵」定稿后复核。A2 维持「完全对等」不变 |

#### 1.1.1 重估明细（方向性，B 议题定稿后复核）

| Phase | 原估算（方案①核心跑通） | 方案②完全对等 | 调整依据 |
|---|---|---|---|
| Phase 1 链接层收敛 + 核心跑通 | 6~7 人天 | 6~7（基本不变） | 技术本体不受完成线影响 |
| Phase 2 浅层耦合适配 | 8~10 人天 | 10~12 | 16 Agent 目录矩阵 + L2~L9 全项完成（非「核心可用」） |
| Phase 3 打包 CI + 回归 | 10~12 人天 | 15~20 | 回归面 M1~M9 三平台 + 4 类安装包 + 3 平台 CI 矩阵 + `cargo check` 基建（现有 CI 从零补） |
| **合计** | **25~30 人天** | **35~45 人天** | ≈ 单人 5~6 周；CI-only 迭代再放大 20~30% |

---

## 2. 功能盘点（A2「完全对等」的验收对象）

> 依据：`README.md`「核心功能全景」+ `HANDOVER.md` §5 / §8A / §8B。以下为 WI-011 启动时**已实现**的功能面（backlog 项如 WI-001 托盘、WI-010 MCP 不在此列）。A2=方案②要求下，每行都需在三平台逐项回归。

| 模块 | 子功能 | 涉及主要文件 | 三平台回归要点（已由 §4.1 验收矩阵细化） |
|---|---|---|---|
| M1 Agent Hub 大厅 | 16 Agent 卡片（已启用/未启用、待纳管/已忽略/已挂载只读）；关键词检索；自定义 Agent 注册 | `AgentsView.vue`、`AgentCard.vue`、`AgentDetailModal.vue`、`AddAgentModal.vue` | Agent 探测路径三平台一致；卡片状态一致 |
| M2 Skills Matrix 技能分发 | 中央技能库扫描/新建/编辑/删除；Tag 多选分发；链接分发（junction/symlink/hardlink-tree）；Antigravity Hardlink Tree；存量检测/一键纳管/私有忽略；同名版本双栏 Diff | `SkillsMatrix.vue`、`SkillEditorModal.vue`、`SkillDrawer.vue`、`AgentPillPicker.vue`、`DiffModal.vue`、`fs_junction.rs`、`lib.rs`、`localApi.ts` | **核心**：三平台链接策略一致；分发后各 Agent 真实可读；Antigravity 行为 |
| M3 Project Rules 规则引擎 | 追加模式（私有覆盖文件 + `.git/info/exclude`）；覆盖模式（`pre-checkout`/`post-checkout` hook + `pre-commit` 拦截）；多基线规则文件（`AGENTS.md`/`CLAUDE.md`/`.cursorrules`/`.windsurfrules`） | `ProjectsView.vue`、`ProjectEditor.vue`、`AddProjectModal.vue`、`git_guard.rs` | Git hook 在三平台 `.git/hooks` 行为一致；覆盖文件路径一致 |
| M4 DSH 插件中心 | 本地插件扫描；可移植性评估；三方状态对账（ok/pending/orphan/version-mismatch/failed）；四大模式安装器 + 实时流式终端；启动失败诊断（15s 超时 + 进程树清理）；文本级安全 patch 写入；配置镜像同步/对账/一键对齐；失败状态回写 | `DshPluginList.vue`、`DshPluginRow.vue`、`DshDiagnose.vue`、`DshPluginSync.vue`、`dsh_plugins.rs`、`dsh_plugins_sync.rs`、`dshPlugins.ts`、`process.rs` | **核心**：`dsh`/`pnpm` 命令探测与 `.cmd` shim；进程树清理；npm 全局路径；pnpm 代理注入 |
| M5 同步中心 | `skills/` 与 `dsh/` 分路径 git 同步（init/pull/push/status）；本地↔远端差异面板；代理自愈 | `SyncView.vue`、`skills_sync.rs`、`git_sync.rs`、`sync_repo.rs`、`syncRepo.ts`、`gitSyncUtil.ts` | git 命令跨平台；代理探测（WinINET → env） |
| M6 应用本体在线更新 | GitHub Releases 检查/下载进度/一键安装重启 | `UpdateModal.vue`、`app_update.rs`、`appUpdate.ts` | **核心**：三平台安装包形态（`.exe/.msi` / `.app/.dmg` / `.deb/.AppImage`）与安装逻辑 |
| M7 设置与主题 | 深色/浅色/跟随系统三态主题；自动检查更新开关 | `SettingsModal.vue`、`useAppStore.ts`、`localApi.ts` | 系统主题探测（Windows 注册表 → macOS/Linux） |
| M8 网络代理自愈（横切） | 系统代理探测 + git/pnpm/HTTP 统一注入 | `git_sync.rs`、`gitSyncUtil.ts`、`dsh_plugins.rs`、`dshPlugins.ts`、`app_update.rs`、`appUpdate.ts` | WinINET 注册表逻辑在 Unix 侧的等价与兜底 |
| M9 本地存储与数据模型（横切） | `%APPDATA%\AgentHub` 目录布局（`config.json`/`agents.json`/`projects.json`/`skills/`/`dsh/`/`backups/`/`dsh_install_state.json`）；文件监听 | `storage.rs`、`localApi.ts`、`watcher.rs`、`syncRepo.ts`、`dshPlugins.ts`、`appUpdate.ts` | **核心**：应用数据目录三平台化（AppData → Library/Application Support → XDG） |

---

## 3. 平台耦合点盘点（实现方案的技术输入）

> 已按源码定位核实（`src-tauri/src/*.rs` 15 个模块 + `src/server/*.ts`）。这是后续「链接策略矩阵」「平台差异表」的原始输入。

| 编号 | 耦合点 | Windows 现状（源码实证） | macOS / Linux 目标 | 涉及文件（定位） |
|---|---|---|---|---|
| L1 | 目录链接 | `mklink /J` NTFS Junction（免提权）；失败回退 hardlink-tree / copy | symlink（`fs_junction.rs` 已预埋 `#[cfg(not(windows))]` 分支，缺真机验证）；`fs::hard_link` 跨平台 | `fs_junction.rs`、`lib.rs`、`localApi.ts` |
| L2 | 进程树清理 | `taskkill /PID <pid> /T /F` | `pkill`/`pgrep` + `kill`（当前 Unix 侧仅 `kill -9` 单进程，**需补进程树**） | `process.rs`、`dshPlugins.ts` |
| L3 | npm 全局路径 | `~/AppData/Roaming/npm` + `.cmd` shim | `npm prefix -g` / `which`，无 `.cmd` | `dsh_plugins.rs`、`dshPlugins.ts` |
| L4 | 系统代理 | WinINET 注册表（HKCU）探测 | 环境变量 `http(s)_proxy`（已有一层 env 探测，需确认 Unix 兜底） | `git_sync.rs`、`gitSyncUtil.ts`、`dsh_plugins.rs`、`dshPlugins.ts`、`app_update.rs`、`appUpdate.ts` |
| L5 | Agent 目录矩阵 | `~/AppData/Roaming/{ZCode,Cursor,Windsurf,Trae}` 等 Windows 专有路径 | macOS `~/Library/Application Support/*`、Linux `~/.config/*` | `agent_detector.rs`、`localApi.ts` |
| L6 | 应用数据目录 | `%APPDATA%\AgentHub` | macOS `~/Library/Application Support/AgentHub`、Linux `~/.config/AgentHub`（XDG） | `storage.rs`、`localApi.ts`、`syncRepo.ts`、`dshPlugins.ts`、`appUpdate.ts` |
| L7 | DSH 命令 shim | `.cmd` | 无 shim，直接命令名 | `dsh_plugins.rs`、`dshPlugins.ts` |
| L8 | 系统主题检测 | `reg query HKCU\...\AppsUseLightTheme`（前端有 `matchMedia` 兜底） | macOS `NSUserDefaults` / Linux `gsettings`/GTK（`matchMedia` 兜底可用） | `localApi.ts`、`useAppStore.ts` |
| L9 | 应用更新安装 | `.exe` / `.msi` 直装 | `.app` / `.dmg`（macOS）、`.deb` / `.AppImage`（Linux） | `app_update.rs`、`appUpdate.ts` |
| L10 | Antigravity 特例 | 目录软链被沙箱跳过 → hardlink-tree | Unix 沙箱对 symlink 已探明（见 §4.4）：hardlink-tree 三平台终态 | `lib.rs`、`fs_junction.rs`、`localApi.ts` |
| L11 | watcher 监听目录 | `watcher.rs` L19-27 硬编码 7 目录（含 `~/.skills`、`~/.agent-skills` 两个矩阵外目录） | 纳入链接矩阵的目录来源，补 4 Electron 系 macOS/Linux 路径 | `watcher.rs` |

> 补充：16 Agent 目录矩阵的**全量三平台映射表**（16 Agent × Win/macOS/Linux 的 `skillsDir`、规则文件、覆盖文件路径）是 Phase 2 交付物，需单独列出（当前 README/HANDOVER 仅列了 home 目录形式与 Windows 专有路径，macOS/Linux 等价路径待补全）。

---

## 4. 议题结论（随讨论逐步填充）

### 4.0 议题状态总览

| 议题 | 内容 | 状态 |
|---|---|---|
| A | 范围与目标 | ✅ 已锁定（A1/A2/A3 + C1/C2/C3） |
| B | 验收标准 | ✅ 已确认（见 §4.1：28 项矩阵 + 方案甲降级 + CI-B 不纳入） |
| C | 链接策略矩阵（Phase 1 核心） | ✅ 已确认（见 §4.2：能力枚举矩阵 + 5 项决议） |
| D | 浅层耦合平台差异表（Phase 2） | ✅ 已确认（见 §4.3：D1~D7 + 4 项决议） |
| E | Antigravity 特例（Phase 3） | ✅ 已确认（见 §4.4：hardlink-tree 三平台终态，不降级 symlink） |
| F | 打包与 CI / 签名（Phase 3） | ✅ 已确认（见 §4.5：三平台产物 + 分级触发 + 4 项决议） |
| G | 风险与验证资源 / 重估 | ✅ 已确认（见 §4.6：R1~R8 + V1~V4 + 重估维持 35~45 人天） |
| H | 三端开发规范落点 | ✅ 已确认（见 §4.8：AGENTS.md 新建 / CONTRIBUTING §5 / HANDOVER 指针，开发启动时同步） |

### 4.1 议题 B — 验收标准（✅ 已确认）

> 目的：把 A2「完全对等」转成可执行的「功能 × 平台」验收矩阵。核心矛盾是 A3「仅 CI 自动化、本机只有 Windows」→ 必须明确**验证载体分层**与**GUI/手动项的降级策略**。

#### 4.1.1 验证载体分层（因 A3 引入的核心设计）

| 载体 | 说明 | 三平台可用性 |
|---|---|---|
| **CI-A** | GitHub-hosted macOS/ubuntu runner 上**无 GUI 自动化**：`cargo test`、Node 集成脚本、路径/链接/进程断言 | macOS ✅ / Linux ✅ / Windows ✅（本机 + runner 双重） |
| **CI-B** | 需**真实第三方 Agent**（Claude Code 等）或重外部服务，CI 可行但 flaky/重 | ⚠️ 默认**不纳入硬性完成线** |
| **手动** | GUI 交互 / 真实桌面环境（安装器点击、Tauri 窗口、托盘） | Windows ✅（本机）/ macOS ❌ / Linux ❌ |

> 关键澄清：GitHub-hosted `macos-latest` / `ubuntu-latest` **本身就是真实 macOS/Linux 机器**，所以「CI-only」缺的是**交互式 GUI 与本地快速迭代**，不缺 headless 逻辑验证。

#### 4.1.2 GUI / 手动项的验收降级策略（✅ 已定：方案甲）

| 方案 | 内容 | 结论 |
|---|---|---|
| **方案甲（推荐）** | **结构验收替代交互验收**：GUI 类行为的完成线 = 产物可构建 + bundle 结构校验 + 后端逻辑 CI-A 全绿 + Windows 本机对照；真实 GUI 点击/窗口/托盘不在 macOS/Linux 上硬性验收，标注「用户真机抽验」 | ✅ **已选**：与 A3 一致，可落地 |
| 方案乙 | 要求三平台 GUI 交互真机验收 | 需引入外部真机，与 A3 冲突，不可行 |

#### 4.1.3 功能 × 平台验收矩阵（定稿）

> 载体列：`CI-A` / `CI-B` / `手动`。Windows 作为回归基线（本机 + CI 双重）；macOS/Linux 以 CI-A 为主，手动项按 §4.1.2 降级。

**横切验收（所有模块共享前置）**

| 编号 | 验收点 | 通过判据 | 载体 | 关联耦合 |
|---|---|---|---|---|
| B0.1 | 三平台构建 | `npm run build` + `cargo build` 在 windows/macos/ubuntu runner 全绿 | CI-A | — |
| B0.2 | 三平台打包产物 | `.exe/.msi`、`.app/.dmg`、`.deb/.AppImage` 全部产出 | CI-A | L9 |
| B0.3 | Web 模式三平台冒烟 | Node `localApi` 核心 API（scan/detect/sync-status）在 macOS/Linux runner headless 跑通 | CI-A | L6 |

**M1 Agent Hub 大厅**

| 编号 | 验收点 | 通过判据 | 载体 | 关联耦合 |
|---|---|---|---|---|
| B-M1.1 | Agent 探测三平台路径 | 探测路径 + `skillsDir` 双断言：验证 `~/.xxx/skills` 在 macOS/Linux 是否等价于 Electron userData（`~/Library/Application Support/*`） | CI-A | L5 |
| B-M1.2 | 16 Agent 目录矩阵补全 | 16 × 3 平台路径表全量补齐，数据驱动断言通过 | CI-A | L5 |

**M2 Skills Matrix 技能分发（核心）**

| 编号 | 验收点 | 通过判据 | 载体 | 关联耦合 |
|---|---|---|---|---|
| B-M2.1 | 链接分发结构等价 | 分发后 `skillsDir/<skill>` 用 `fs.readdir` 可读、内容与中央库一致 | CI-A | L1 |
| B-M2.2 | 双端链接决策一致 | 同一「Agent × 平台」下 Rust 端与 Node 端策略相同（junction/symlink/hardlink-tree/copy + fallback 顺序） | CI-A | L1 |
| B-M2.3 | Antigravity hardlink-tree 结构 | 目录为物理目录、文件为 hard_link（`lstat` 非 symlink、inode 一致） | CI-A | L1, L10 |
| B-M2.4 | 存量检测/纳管/忽略 | 三平台扫描语义一致，忽略清单生效 | CI-A | L1, L5 |
| B-M2.5 | 停用/删除清理 | 停用后目标目录不残留链接 | CI-A | L1 |

**M3 Project Rules 规则引擎**

| 编号 | 验收点 | 通过判据 | 载体 | 关联耦合 |
|---|---|---|---|---|
| B-M3.1 | 追加模式 `.git/info/exclude` | 临时 git 仓库断言 exclude 生效、基线文件物理未改 | CI-A | — |
| B-M3.2 | 覆盖模式 hook | `pre-checkout`/`post-checkout`/`pre-commit` 在 macOS/Linux 为可执行 sh、切分支还原生效 | CI-A | — |

**M4 DSH 插件中心（核心）**

| 编号 | 验收点 | 通过判据 | 载体 | 关联耦合 |
|---|---|---|---|---|
| B-M4.1 | dsh 命令探测 | Windows `.cmd`；macOS/Linux 无 shim 直接命令名 | CI-A | L7 |
| B-M4.2 | pnpm 命令探测 | 三平台返回可用 pnpm 命令 | CI-A | L7 |
| B-M4.3 | npm 全局路径 | macOS/Linux 走 `npm prefix -g`/`which`，不硬编码 AppData | CI-A | L3 |
| B-M4.4 | 插件扫描 | `scan_dsh_plugins` 在 fixture profile 上三平台语义一致 | CI-A | L3, L6 |
| B-M4.5 | 四大模式安装 | 小规模 fixture 包真实 `pnpm install/update` 三平台成功（真实网络，flaky） | CI-B | L3, L4 |
| B-M4.6 | 诊断进程树清理 | spawn 带子进程 → 超时诊断后整棵进程树消失（macOS/Linux 用 `pkill/pgrep`） | CI-A | L2 |
| B-M4.7 | 文本级 patch 写入 | 追加/删除幂等、保留注释与 `!!js`，三平台一致 | CI-A | — |
| B-M4.8 | 同步/对账 | git push/pull/reconcile 三平台一致（含代理注入；依赖外网 git 服务） | CI-B | L4 |

**M5 同步中心**

| 编号 | 验收点 | 通过判据 | 载体 | 关联耦合 |
|---|---|---|---|---|
| B-M5.1 | 同步中心 git 操作 | init/pull/push/status 三平台一致（依赖外网 git 服务） | CI-B | L4 |
| B-M5.2 | 代理探测 | macOS/Linux 走环境变量（`http_proxy` 等），不依赖 WinINET 注册表 | CI-A | L4 |

**M6 应用本体在线更新**

| 编号 | 验收点 | 通过判据 | 载体 | 关联耦合 |
|---|---|---|---|---|
| B-M6.1 | 更新安装逻辑 | 结构校验：`dpkg --info` / `hdiutil verify` + 平台分支单测（非端到端真实安装，后者需提权） | CI-A | L9 |

**M7 设置与主题**

| 编号 | 验收点 | 通过判据 | 载体 | 关联耦合 |
|---|---|---|---|---|
| B-M7.1 | 系统主题探测 | `defaults read -g` / gsettings 分支单元断言；headless 无 GUI 会话，真实值手动验证 | CI-A + 手动 | L8 |
| B-M7.2 | 主题三态切换持久化 | localStorage 三平台一致 | CI-A | L8 |

**M8 网络代理自愈（横切）**

| 编号 | 验收点 | 通过判据 | 载体 | 关联耦合 |
|---|---|---|---|---|
| B-M8.1 | 代理自愈等价 | WinINET(Windows) / env(macOS/Linux) 等价；git/pnpm/HTTP 注入一致 | CI-A | L4 |

**M9 本地存储与数据模型（横切）**

| 编号 | 验收点 | 通过判据 | 载体 | 关联耦合 |
|---|---|---|---|---|
| B-M9.1 | 应用数据目录 | Windows `%APPDATA%`、macOS `~/Library/Application Support`、Linux `~/.config`(XDG) | CI-A | L6 |
| B-M9.2 | 目录布局 + watcher | 三平台目录结构一致；notify 事件时序在 CI 上 flaky，事件触发改单元断言 + 手动 | CI-A + 手动 | L6 |

#### 4.1.4 B 议题决议（✅ 已确认）

1. ✅ 降级策略 = **方案甲**（结构验收替代交互验收）。
2. ✅ CI-B 项默认不纳入硬性完成线，改为「结构验收 + Windows 本机对照 + 用户真机抽验」。具体映射：B-M4.5 / B-M4.8 / B-M5.1 为 CI-B；B-M6.1 改结构校验；B-M7.1 / B-M9.2 为 CI-A + 手动。
3. ✅ 验收矩阵暂无漏项（M1~M9 覆盖完整）。

### 4.2 议题 C — 链接策略矩阵（Phase 1 核心，✅ 已确认）

#### 4.2.1 现状（源码实证）

- **策略集合**：Windows = junction（`mklink /J`）→ 回退 hardlink-tree → 回退 copy；macOS/Linux = symlink → 回退 hardlink-tree → 回退 copy（`fs_junction.rs` / `localApi.ts` 已预埋，缺真机验证）。
- **Agent 维度**：仅 `antigravity` 特例（hardlink-tree），其余全部走默认策略。
- **决策逻辑散落 3 层 9 处（异质：4 处选策略 + 3 处行为特例 + 2 处 UI 展示）**：

| 层 | 位置 | 特例内容 |
|---|---|---|
| Rust | `lib.rs` L280（toggle）、L325/L339（takeover） | `if agent.id == "antigravity"` → hardlink-tree |
| Rust | `lib.rs` L119（is_symlink_map）、L172（scan）、L228（save_skill） | antigravity 特例 |
| Node | `localApi.ts` L420（mountSkillForAgent） | `if agentId === 'antigravity'` → hardlink-tree |
| UI | `AgentCard.vue` L92、`AgentDetailModal.vue` L345 | 「Hardlink / Junction」展示硬编码 |

- **死字段**：`supports_junction` 双端 4 文件镜像（Rust `models.rs` L500 + `agent_detector.rs` L279/L287；TS `types/index.ts` L296 + `services/api.ts` L133/L139），仅在校验结果赋值、UI 未消费，**不参与任何链接决策** → 遗留字段，收敛时双端 4 文件清理或复用。

#### 4.2.2 目标矩阵（定稿）

> 键设计：**Agent 能力枚举 × 平台 → 具体操作 + fallback 链**（不采用 16×3 显式全表，因当前仅 2 个有效策略，显式表 90% 冗余）。macOS/Linux 在链接层等价，可合并为 Unix 列。

| Agent 链接策略 | Windows | macOS/Linux (Unix) | fallback 链 |
|---|---|---|---|
| `Default`（除 antigravity 外全部） | junction（`mklink /J`） | symlink | → hardlink-tree → copy |
| `HardlinkTree`（antigravity） | hardlink-tree（物理目录 + 文件硬链） | hardlink-tree（保守，待 E 探明） | → copy |
| `Copy`（预留，当前无 Agent 使用） | copy | copy | — |

#### 4.2.3 决策决议（✅ 已确认，均按推荐）

1. ✅ 键设计 = **能力枚举 × 平台**（不采用 16×3 显式全表）。
2. ✅ Unix 上 antigravity 保持 hardlink-tree（三平台统一），议题 E 探明后决定是否降级 symlink。
3. ✅ 预留 `Copy` 一级策略（当前无 Agent 使用）。
4. ✅ 双端对齐 = 双端各自实现 + **B-M2.2 跨语言对拍**（同一份 (agent × platform) 输入表，Rust `cargo test` 与 Node 脚本各 dump 决策表 JSON，CI diff 比对；对拍脚本为 Phase 1 交付物）；不引入单一 JSON 事实源。
5. ✅ UI 层 Hardlink/Junction 展示改为读策略来源，纳入矩阵落地范围。

### 4.3 议题 D — 浅层耦合平台差异表（Phase 2，✅ 已确认）

#### 4.3.1 总表

| # | 耦合 | Windows 现状（实证） | macOS 方案 | Linux 方案 | 统一 helper | 改动量 |
|---|---|---|---|---|---|---|
| D1 (L3/L7) | npm 全局路径 + dsh/pnpm 命令 shim | `~/AppData/Roaming/npm` + `.cmd`（`dsh_plugins.rs` L52、`dshPlugins.ts` L36/67） | `npm prefix -g` 前缀、无 shim | 同 macOS | `resolve_global_bin(name)`（`which_cmd` 已有，仅补 `which` 失效时 `npm prefix -g` 兜底） | 低 |
| D2 (L2) | 进程树清理 | `taskkill /PID /T /F`（杀整树） | 递归 `pgrep -P` 自底向上 + `kill -9` | 同 macOS | `kill_tree(pid)` 补 Unix 子树（**Rust `process.rs` + Node `dshPlugins.ts::killProcessTree` 双端**） | 中（**真缺陷**：Unix 双端均只杀单进程） |
| D3 (L4) | 系统代理 | env 优先 + WinINET（`cfg!(windows)` 已隔离，`git_sync.rs` L62-89） | env（已生效，零改） | env（已生效，零改） | 已有；仅把 `query_reg_value` 加 `#[cfg(windows)]` 清理 | 极低 |
| D4 (L5) | 16 Agent 目录矩阵 | 4 agent 带 `~/AppData/Roaming/*` 专有探测 | 补 `~/Library/Application Support/*` 探测 | 补 `~/.config/*` 探测 | 数据驱动探测表 | 中（需查证） |
| D5 (L6) | 应用数据目录 | `%APPDATA%\AgentHub`（Node 端 Unix 会**错误**落到 `~/AppData/Roaming`） | `~/Library/Application Support/AgentHub` | `~/.config/AgentHub`(XDG) | `app_data_dir()` = `dirs::config_dir()` | 中（**真 bug**） |
| D6 (L8) | 系统主题检测 | `reg query AppsUseLightTheme`（`localApi.ts` L237） | `defaults read -g AppleInterfaceStyle` | gsettings / matchMedia 兜底 | `detect_system_theme()` 平台分支 | 低 |
| D7 (L9) | 更新安装逻辑 | `.exe/.msi` 直装 | `.app.zip` 解压替换（未签名友好） | `.deb` `dpkg -i` / `.AppImage` chmod+x | `install_update(asset)` 平台分支 | 中 |

#### 4.3.2 16 Agent 目录矩阵（D4 明细）

> 关键修正：16 个 Agent 中**仅 4 个**（cursor / windsurf / zcode / trae）带 Windows 专有探测路径，其余 12 个已用 `~/.xxx` 跨平台路径。D4 的实际改动 = 4 个补 macOS/Linux 等价路径 + 全量查证 skillsDir 是否平台相关，**不是 16 个全部重写**。

| Agent | Windows 专有探测? | macOS/Linux 补充建议 | 确定性 |
|---|---|---|---|
| claude-code / antigravity / codex / dsh / mimocode / openclaw / hermes / copilot / pi / kimi / workbuddy / kiro（12 个） | ❌ 仅 `~/.xxx` | 无需补充（跨平台），仅验证 | 高 |
| cursor | ✅ `~/AppData/Roaming/Cursor` | `~/Library/Application Support/Cursor`（mac）/ `~/.config/Cursor`（linux） | 中 |
| windsurf | ✅ `~/AppData/Roaming/Windsurf` | `~/Library/Application Support/Windsurf` / `~/.config/Windsurf` | 中 |
| zcode | ✅ `~/AppData/Roaming/ZCode`(+zcode) | `~/Library/Application Support/ZCode` / `~/.config/ZCode` | 低（小众，需查证） |
| trae | ✅ `~/AppData/Roaming/Trae` | `~/Library/Application Support/Trae` / `~/.config/Trae` | 中 |

> 深层风险：这 4 个 Electron 系 Agent 的 **skillsDir 本身**是否在 macOS/Linux 也走 `~/Library/Application Support/*` 而非 `~/.xxx/skills`，需逐一查证（影响挂载正确性，不止探测）。

#### 4.3.3 决策决议（✅ 已确认）

1. ✅ D4 查证方式 = **web 搜索补 best-known 路径 + 标注「未真机验证」**（真机抽验列入用户后续清单）。
2. ✅ D5 = `dirs::config_dir()`（Rust）语义；Node 端加等价 helper（`XDG_CONFIG_HOME`/`~/Library/Application Support` 分支），收敛 `localApi.ts` / `dshPlugins.ts` / `syncRepo.ts` 三处独立实现（`appUpdate.ts` 复用 `localApi` 版）；macOS/Linux 全新目录无需迁移。
3. ✅ D2 Unix 杀树 = **递归 `pgrep -P` 自底向上** + `kill -9 <pid>`（`pkill -P` 只杀直接子进程，非递归）；显式覆盖 Rust `kill_tree` 与 Node `killProcessTree` 双端。
4. ✅ D7 macOS 载体 = **`.dmg` 挂载**（`hdiutil attach` → 复制 `.app` → `detach`）+ detached 后置脚本（app 退出后执行替换）+ 新 `.app` 去 quarantine（`xattr -dr com.apple.quarantine`）；未签名则 README 记录 Gatekeeper 绕过（与 C2 一致）。

### 4.4 议题 E — Antigravity 特例（Phase 3，✅ 已确认）

#### 4.4.1 现状与已知
- Windows：Antigravity 沙箱静默跳过 NTFS junction（reparse point）→ 项目用 hardlink-tree 绕过（`lib.rs` L280 等）。
- Unix：沙箱对 symlink 行为此前未知（backlog 标「先探明再补策略」）。

#### 4.4.2 Web 查证结果（实证，标注未真机验证）
- Windows junction 问题已被社区确认：`/skills` 菜单在 Windows junction 下列不出技能（[Google AI 论坛](https://discuss.ai.google.dev/t/antigravity-cli-skills-menu-fails-to-list-skills-on-windows-using-junctions/145746/2)）。
- Gemini CLI 在 Unix **能读 symlink 技能目录**：`~/.gemini` symlink 到 `~/.agents` 会读到技能，但报 duplicate warning（[issue #28944](https://github.com/google-gemini/gemini-cli/issues/28944)）。
- 官方 [PR #28956](https://github.com/google-gemini/gemini-cli/pull/28956)「resolve symlinked/junctioned skills directories via realpath」正在修复 symlink/junction 解析 → 若合入，Unix symlink 路径规范化后 duplicate warning 消除。

#### 4.4.3 结论与策略
- **Unix 可降级 symlink**（证据充分），但 hardlink-tree 在 Unix 同样可靠（物理目录 + 文件硬链，跨文件系统时自动 fallback copy，`fs_junction.rs` 已处理）。
- **本轮策略（与 C#2 一致）**：维持三平台 hardlink-tree 为**终态**；「降级 symlink」不落地，仅作为可选优化记录（收益是省 inode / 语义更简单，代价是引入 duplicate warning 边缘风险，需真机抽验）。

#### 4.4.4 决策决议（✅ 已确认）

1. ✅ E 探明完成：结论 = hardlink-tree 三平台终态，不降级 symlink。

### 4.5 议题 F — 打包与 CI / 签名（Phase 3，✅ 已确认）

#### 4.5.1 现状（实证）

- `tauri.conf.json`：`bundle.targets: "all"`（无平台限定）；**无 `minimumSystemVersion`**（macOS 默认 10.13，低于 A1 的 12）；version 1.0.3。
- `ci.yml`：仅 ubuntu 前端 typecheck/build（push/PR）。
- `release.yml`：仅 windows-latest 单平台 Tauri build（tag/workflow_dispatch），`releaseDraft: false`，无 Linux 系统依赖步骤。

#### 4.5.2 产物清单（三平台）

| 平台 | 产物 | 建议 `--bundles` | 签名 | 备注 |
|---|---|---|---|---|
| Windows | `.exe`(NSIS) + `.msi`(WiX) | `nsis,msi` | 无（现状） | — |
| macOS | `.app` + `.dmg`（arm64 + x86_64 双架构） | `app,dmg` | 无（C2） | 设 `minimumSystemVersion=12.0`；`macos-latest`(arm64) + `macos-13`(x86_64) 双 job；README 记 Gatekeeper 绕过 |
| Linux | `.deb` + `.AppImage` | `deb,appimage` | — | **不含 rpm**（避免 rpmbuild 依赖）；Ubuntu 22.04+ 无 libfuse2，AppImage 需 `--appimage-extract-and-run` 或 deb 为首选 |

#### 4.5.3 CI 分级触发落地（C1）

- **ci.yml（push/PR，常驻）**：ubuntu 前端 typecheck/build + `cargo check --manifest-path src-tauri/Cargo.toml`（需 Linux 系统依赖，约 2 分钟；非 `tauri build`）。
- **release.yml（tag v\* / workflow_dispatch，重资产）**：三平台 matrix（windows-latest / **macos-latest + macos-13**（arm64 + x86_64）/ ubuntu-latest），各自 `tauri build --bundles <上表>` + tauri-action 上传；`releaseDraft: true` 防并发冲突；Linux job 需 apt 系统依赖（`libwebkit2gtk-4.1-dev`、`libappindicator3-dev`、`librsvg2-dev`、`patchelf` 等，现有 workflow 无此步骤，需新增）。

#### 4.5.4 决策决议（✅ 已确认）

1. ✅ 产物清单 = Windows `nsis,msi` / macOS `app,dmg`（`minimumSystemVersion=12`，arm64+x86_64 双 job）/ Linux `deb,appimage`（不含 rpm）。
2. ✅ `releaseDraft: true`（三平台并发上传 draft，最后统一 publish）。
3. ✅ PR 级 = 前端 typecheck/build + ubuntu `cargo check`（补 Unix cfg 分支编译门禁）；完整三平台 build 仍仅 release 级。
4. ✅ Linux 本轮先 x86_64，arm64 后续按需加。

### 4.6 议题 G — 风险与验证资源汇总（✅ 已确认）

#### 4.6.1 风险登记表（汇总）

| # | 风险 | 影响 | 缓解 | 残余 |
|---|---|---|---|---|
| R1 | Rust/Node 双端漂移 | 链接/同步语义不一致 | B-M2.2 双端一致性测试锁死 | 低 |
| R2 | Unix 分支从未真机跑过 | 隐藏 bug | Phase 1 CI runner 真机验证（B0.1/B-M2.x） | 中→低 |
| R3 | 16 Agent 目录覆盖度（4 Electron 系） | skillsDir 探测/挂载错误 | D4 web 查证 + 标注未实测 + 真机抽验 V3 | 中（抽验前） |
| R4 | macOS 未签名 | Gatekeeper 拦截 | C2 未签名 + README 绕过 + 真机抽验 V4 | 体验降级 |
| R5 | 工作量重估 35~45 人天 | 排期压力 | 分三阶段 + 验证驱动 | 已接受 |
| R6 | hardlink 跨文件系统 | 0-copy 降级 copy | `fs_junction.rs` 已有 fallback | 低 |
| R7 | Linux 系统依赖缺失 | CI 构建失败 | release.yml 新增 apt 步骤 | 低 |
| R8 | 三平台并发发布 | 资产冲突/覆盖 | `releaseDraft: true` | 低 |
| R9 | macOS 双架构遗漏 | Intel Mac 无产物 | P0-1：加 `macos-13`(x86_64) job | 已缓解 |
| R10 | macOS 12 最低版本不可 CI 验证 | 高版本 API 误用 | 列入 V4 真机抽验 | 中 |
| R11 | 未签名自更新供应链 | 无签名/无校验二进制 | README / 风险表披露 | 中 |
| R12 | Node 端孤儿数据 | 旧用户数据落在 `~/AppData/Roaming` | README 提示手动迁移 | 低 |
| R13 | Linux 桌面碎片化 | gsettings / 主题在非 GNOME 桌面不一致 | 列入残余风险 | 低 |
| R14 | 版本号 5 处硬编码漂移 | M6 更新判定失效 | 实施时收敛为单一来源 | 低 |

#### 4.6.2 用户后续真机抽验清单（CI 无法覆盖，按 B 方案甲降级）

| # | 抽验项 | 说明 |
|---|---|---|
| V1 | GUI 交互（macOS/Linux） | 窗口/弹窗/设置/托盘（WI-001）；结构验收 + Windows 本机对照替代 |
| V2 | 真实 16 Agent 读取 | CI-B 不纳入；真机装 Agent 验证技能可读（尤其 4 Electron 系） |
| V3 | 4 Electron 系实际路径 | cursor/windsurf/zcode/trae 的 macOS/Linux 实际 skillsDir 确认 |
| V4 | macOS Gatekeeper 绕过 + `.dmg` 挂载安装 | README 记录，真机走一遍 |

#### 4.6.3 最终重估确认（C3 复核）

- 议题 A~F 已全部锁定，Phase 拆分维持：Phase 1 链接层（C）+ Phase 2 浅层耦合（D）+ Phase 3 Antigravity/打包 CI/回归（E/F）。
- ✅ 已确认：维持 **35~45 人天（≈单人 5~6 周）** 为最终口径（CI-only 迭代再 +20~30%）。

### 4.8 议题 H — 三端开发规范落点（✅ 已确认）

结论：**需要补，已确认照此执行**。分三处落盘（时机：WI-011 开发启动时同步，而非全部完成后，避免适配过程再引入单平台耦合）：

| 落点 | 定位 | 内容 |
|---|---|---|
| `AGENTS.md`（**新建**，仓库根） | AI 协作的强制约束入口（每次会话自动注入） | 《`PLAN_BACKLOG.md`》§5 五条规范的权威版全文 |
| `CONTRIBUTING.md` §5「本地代码与架构规范」 | 人类贡献者的评审 / DoD 依据 | 同一份规范，并入 PR 合并准入 |
| `HANDOVER.md` | 状态交接（已 100KB，勿膨胀） | 仅加一条指针/引用，不复制全文 |

> 命名避坑：新建的是 **AgentHub 仓库自己的根 `AGENTS.md`**（团队基线、随仓库提交），与应用内「管理 16 个 Agent 的 `AGENTS.md`」是两个概念，互不冲突。

---

## 5. 变更记录

| 日期 | 变更 | 说明 |
|---|---|---|
| 2026-08-22 | 创建文档 | 建立 WI-011 专项实现文档骨架 |
| 2026-08-22 | 锁定需求基线 | A1 平台矩阵 / A2 方案②完全对等 / A3 CI 为主 + 流程约束 P |
| 2026-08-22 | 功能盘点 | 依据 README + HANDOVER 盘点 9 大功能模块（M1~M9） |
| 2026-08-22 | 平台耦合点盘点 | 源码定位 10 类耦合点（L1~L10）+ 15 个 Rust 模块清单 |
| 2026-08-22 | 卡点决议 C1/C2/C3 | C1=public+分级触发；C2=未签名完成线；C3=方向性重估 35~45 人天（CI-only 再放大），A2 维持完全对等 |
| 2026-08-22 | B 议题草案 | 产出验证载体分层（CI-A/CI-B/手动）+ 降级策略 + 28 项「功能 × 平台」验收矩阵（B0.1~B-M9.2） |
| 2026-08-22 | B/H 议题决议 | B=方案甲降级 + CI-B 不纳入 + 无漏项；H=AGENTS.md 新建 / CONTRIBUTING §5 / HANDOVER 指针，开发启动时同步；新会话方案评审记入 §0 |
| 2026-08-22 | C 议题草案 | 链接策略矩阵：现状（antigravity 散落 3 层 ~8 处 + supports_junction 死字段）+ 能力枚举矩阵草案 + 5 决策点 |
| 2026-08-22 | C 议题决议 | 5 项均按推荐：能力枚举 / antigravity 保持 hardlink / 预留 Copy / 双端+测试锁死 / UI 读策略来源 |
| 2026-08-22 | D 议题草案 | 浅层耦合总表 D1~D7 + 16 Agent 目录矩阵（仅 4 个需补）+ 发现 2 真缺陷（D2 进程树、D5 数据目录）+ 4 决策点 |
| 2026-08-22 | D 议题决议 | D4=web 搜索+标注未实测；D5=dirs::config_dir + 修 Unix 误落 bug；D2=pkill -P 递归；D7=`.dmg` 挂载 |
| 2026-08-22 | E 议题草案 | Antigravity Unix 探明（web 实证：Gemini CLI 能读 symlink + PR #28956 realpath 修复）；结论 = hardlink-tree 三平台终态，不降级 symlink |
| 2026-08-22 | E 议题决议 | 探明完成：hardlink-tree 三平台终态，不降级 symlink |
| 2026-08-22 | F 议题草案 | 三平台产物清单（nsis/msi + app/dmg + deb/appimage）+ 分级触发落地 + minimumSystemVersion=12 + releaseDraft + 4 决策点 |
| 2026-08-22 | F 议题决议 | 产物清单确认 / releaseDraft=true / PR 只保留前端 / Linux 先 x86_64 |
| 2026-08-22 | G 议题草案 | 风险登记表 R1~R8 + 用户真机抽验清单 V1~V4 + 最终重估确认 |
| 2026-08-22 | G 议题决议 + 方案定稿 | G 确认；议题 A~H 全部锁定，方案落盘完成，待新会话方案评审 |
| 2026-08-22 | 方案评审修订（v2） | 按评审结论修订：P0-1 加 macos-13；P1-1 补 cargo check；P1-2 矩阵重分类（CI-B/结构校验/手动）；P1-3 A2 措辞；P1-4 跨语言对拍；P1-5 D2 双端杀树；P2-1~P2-10 小修正；风险 R9~R14；新增 L11 watcher |

---

*文档创建日期：2026-08-22 | AgentHub Core Team*
