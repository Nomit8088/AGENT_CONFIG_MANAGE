# AgentHub 项目交接与后续开发维护指南 (HANDOVER.md)

> **💡 协作准则与强制规范**：
> 本文档是 **AgentHub** 项目的 Single Source of Truth 交接文档。任何 AI 智能体（Agent）或开发者在后续会话中接手、修改、重构或新增功能后，**必须同步更新本文档对应的架构说明、数据 Schema、模块索引与待办清单**，确保跨会话开发无缝衔接。

---

## 1. 项目概述与核心定位

### 1.1 为什么需要 AgentHub？
随着多款 AI Coding Agent（Claude Code、Google Antigravity、OpenCode/Codex、ZCode、Cursor、DSH、Windsurf 等）在实际开发中的混合使用，开发者面临以下三大痛点：
1. **规则与 Git 上下文冲突**：团队 Git 仓库通常追踪了全局 `AGENTS.md`。本地定制个性化偏好若直接修改该文件，切分支或 `git pull` 必出冲突；若仅靠 Prompt 提示“忽略”，原版内容依然注入上下文，浪费大量 Token 并干扰推理。
2. **Skills / Commands 生态割裂**：各 Agent 的技能存放目录各异（`~/.claude/skills`、`~/.gemini/config/skills`、`~/.codex/skills`、`~/.zcode/skills`、`~/.dsh/skills-personal` 等），在一个 Agent 中开发的新 Skill 无法自动同步共享。
3. **缺乏统一可视化管理**：市面上的 `cc-switch` 仅关注模型 API 代理切换，缺乏一款集「多 Agent 自动适配、中央 Skills 软链矩阵、项目规则零 Git 冲突一键开关、存量技能一键纳管与忽略」于一体的轻量桌面客户端。

### 1.2 AgentHub 的核心目标
打造一款 **`cc-switch` 风格的高颜值、极轻量桌面客户端**，通过 **Windows NTFS Junction / Symlink** 与 **Git Hook 守卫**，实现秒级跨 Agent 规则与技能调配。

---

## 2. 🎨 全局设计规范与 UI 开发准则 (核心强制)

> 📖 **设计规范详见专门文档**：[**DESIGN_GUIDELINES.md**](file:///d:/dev/toolPrograms/agent_config_manager/DESIGN_GUIDELINES.md)

* **设计风格**：**macOS 毛玻璃极简 (macOS Vibrancy / `macos-vibrancy`)**。
* **开发红线与继承原则**：
  1. **后续无论添加任何新功能、新页面、新弹窗或重构组件，都必须无条件参考 [DESIGN_GUIDELINES.md](file:///d:/dev/toolPrograms/agent_config_manager/DESIGN_GUIDELINES.md) 中的规范，严禁风格漂移！**
  2. **双主题兼容**：所有组件必须同时支持浅色（`#f5f5f7` / `#ffffff` / `text-slate-900`）与深色（`#1c1c1e` / `#2c2c2e` / `text-white/95`），必须携带 `dark:` 前缀类名。
  3. **排版规范**：标题统一采用 **Serif 衬线体 (`font-serif`)**，正文采用系统无衬线体，代码/路径/版本号采用 **等宽体 (`font-mono`)**。
  4. **开关交互**：全站所有开关统一采用 **macOS 分段滑块 (Segmented Slider)**：`[ 选项 A | 选项 B ]`。
  5. **边框与阴影**：统一使用 1px 发丝线细边框（`border-white/8` / `border-black/8`），严禁 2px/4px 粗边框，严禁夸张大阴影和大圆角（禁止 `rounded-3xl` / `rounded-full`，大卡片统一 `rounded-xl`）。
  6. **动效禁令**：过渡统一使用 `transition-colors duration-200 ease-out`，悬停严禁几何位移、缩放与弹跳。

---

## 3. 技术架构与选型

- **客户端架构**：**Tauri 2.0 (Rust 后端 + Vue 3 / TypeScript 前端)**
  - **Rust 后端**：封装 Windows NTFS Junction 底层操作、Git Hooks 守卫注入与还原、`notify` 内核级文件监听、`%APPDATA%\AgentHub` 数据存储。
  - **前端 UI 栈**：**Vite 5 + Vue 3 (Composition API) + Tailwind CSS + Lucide Vue Icons + Pinia + TypeScript**。
- **Dual-Mode 双运行架构（关键设计）**：
  - **Tauri 桌面端模式**：直接调用 Rust Tauri Command (`window.__TAURI_INTERNALS__`)；
  - **Web 浏览器开发模式**：通过 Vite 内置的 Node 本地系统 API 插件（`src/server/localApi.ts` 与 `vite.config.ts` 中的 `/api/...`），在浏览器 `npm run dev` 中操作时**同样 100% 触发真实的 Windows NTFS Junction 与文件落地**，保证开发与真机环境完全一致。

---

## 4. 数据模型与本地存储规范

客户端独立保存在本地系统目录中，**不与任何外部 Git 仓库强绑定**：
- **Windows 路径**：`%APPDATA%\AgentHub\`（即 `C:\Users\<username>\AppData\Roaming\AgentHub\`）
- **Linux/macOS 路径**：`~/.config/agenthub/`

```text
%APPDATA%\AgentHub\
├── config.json               # 客户端全局设置 (开机自启、主题、默认模式、忽略技能列表)
├── agents.json               # 已注册 Agent 列表与路径映射规则
├── projects.json             # 已纳管项目列表、规则配置及开关状态
├── skills\                   # 中央技能库 (Single Source of Truth)
│   ├── obsidian-sync\
│   │   └── SKILL.md
│   ├── archify\
│   │   └── SKILL.md
│   └── agenthub-sync\
│       └── SKILL.md
└── backups\                  # 项目原版规则安全镜像备份
    └── <project-id>\
        ├── AGENTS.md.orig
        └── CUSTOM_AGENTS.md
```

### 核心 JSON Schema 定义

#### 1. `config.json`
```jsonc
{
  "auto_start": false,
  "theme": "dark",
  "default_rule_mode": "append",     // "append" 或 "overwrite"
  "auto_capture_skills": true,
  "toast_notifications": true,
  "ignored_skills": [                // 已标记为私有/忽略的存量技能 (不纳管)
    {
      "agentId": "claude-code",
      "agentName": "Claude Code",
      "skillName": "omc-doctor",
      "path": "C:\\Users\\nomit\\.claude\\skills\\omc-doctor",
      "ignoredAt": 1723982400000
    }
  ],
  "skills_sync": {                   // 中央技能库多端同步
    "remoteUrl": "https://github.com/you/agenthub-skills.git",
    "branch": "main",
    "autoPullOnStartup": true,
    "lastSyncAt": 1723982400000,
    "lastSyncStatus": "success",
    "lastError": null
  }
}
```

#### 2. `agents.json`
```jsonc
[
  {
    "id": "claude-code",
    "name": "Claude Code",
    "icon": "bot",
    "detected": true,
    "enabled": true,
    "skillsDir": "C:\\Users\\nomit\\.claude\\skills",
    "ruleType": "local_file",
    "localRuleFilename": "CLAUDE.local.md"
  },
  {
    "id": "antigravity",
    "name": "Google Antigravity",
    "icon": "sparkles",
    "detected": true,
    "enabled": true,
    "skillsDir": "C:\\Users\\nomit\\.gemini\\config\\skills",
    "ruleType": "global_file",
    "localRuleFilename": "GEMINI.local.md"
  },
  {
    "id": "codex",
    "name": "OpenCode / Codex",
    "icon": "terminal",
    "detected": true,
    "enabled": true,
    "skillsDir": "~/.codex/skills",
    "ruleType": "local_file",
    "localRuleFilename": "AGENTS.override.md",
    "isCustom": false
  },
  {
    "id": "zcode",
    "name": "ZCode",
    "icon": "terminal",
    "detected": true,
    "enabled": true,
    "skillsDir": "~/.zcode/skills",
    "ruleType": "local_file",
    "localRuleFilename": "ZCODE.local.md",
    "isCustom": false
  },
  {
    "id": "cursor",
    "name": "Cursor",
    "icon": "code",
    "detected": false,
    "enabled": false,
    "skillsDir": "~/.cursor/skills",
    "ruleType": "local_file",
    "localRuleFilename": ".cursor/rules/local-override.mdc",
    "isCustom": false
  },
  {
    "id": "dsh",
    "name": "DSH",
    "icon": "cpu",
    "detected": true,
    "enabled": true,
    "skillsDir": "~/.dsh/skills-personal",
    "ruleType": "local_file",
    "localRuleFilename": "AGENTS.local.md",
    "isCustom": false
  },
  {
    "id": "windsurf",
    "name": "Windsurf",
    "icon": "code",
    "detected": false,
    "enabled": false,
    "skillsDir": "~/.windsurf/skills",
    "ruleType": "local_file",
    "localRuleFilename": "WINDSURF.local.md",
    "isCustom": false
  }
]
```

#### 3. `projects.json`
```jsonc
[
  {
    "id": "proj-kingeye-v4",
    "name": "kingeye_v_4",
    "path": "D:\\dev\\PythonPrograms\\kingeye_v_4",
    "isGit": true,
    "overrideEnabled": true,        // 规则总开关: ON / OFF
    "ruleMode": "overwrite",        // "overwrite" (覆盖) 或 "append" (追加)
    "customRuleContent": "# 本机运行总则\n- 所有回复使用中文\n...",
    "originalRuleContent": "# 团队基线规则...",
    "linkedAgents": ["claude-code", "antigravity", "codex", "zcode"],
    "gitBranch": "feature/agent-integration",
    "hookInstalled": true
  }
]
```

---

## 5. 四大核心系统设计与技术实现

```mermaid
flowchart TD
    subgraph UI["前端交互层 (Vue 3 + Tailwind)"]
        Tab1["Agent Hub (大厅)"]
        Tab2["Skills Matrix (技能分发矩阵)"]
        Tab3["Project Rules (规则中心)"]
        ModalDiff["Diff 冲突对比弹窗"]
        ModalDetail["Agent 存量管理弹窗 (待纳管/已忽略)"]
    end

    subgraph Dispatcher["中央分发中枢"]
        Pills["Tag Pills + AgentPillPicker (Teleported 浮层)"]
        GroupSection["UnmanagedGroupSection (按 Agent 归类)"]
    end

    subgraph CoreEngine["底层执行引擎 (Rust / Node API)"]
        JunctionBus["Windows NTFS Junction 总线"]
        GitGuard["Git Hook 守卫 (.git/hooks & .git/info/exclude)"]
        CentralRepo["%APPDATA%/AgentHub/skills/ (中央单例├── builtin-skills/                     # 内置技能模板
│   └── agenthub-sync/
│       └── SKILL.md                    # 反向同步技能定义 (/agenthub-sync)
│
├── src/                                # 前端源码 (Vue 3 + TS)
│   ├── main.ts                         # Vue 应用初始化
│   ├── App.vue                         # 根组件
│   ├── types/
│   │   └── index.ts                    # 全局 TypeScript 接口定义
│   ├── stores/
│   │   └── useAppStore.ts              # Pinia 全局响应式状态机
│   ├── services/
│   │   └── api.ts                      # Dual-Mode IPC 适配层 (Tauri ↔ Web API)
│   ├── server/
│   │   └── localApi.ts                 # Web 模式下的 Node 原生系统操作层 (NTFS Junction/FS)
│   ├── assets/
│   │   └── style.css                   # 全局样式、毛玻璃、滚动条美化
│   └── components/
│       ├── Header.vue                  # 顶部导航条 (状态统计、主题切换、设置)
│       ├── Navigation.vue              # 核心四栏切换 Tab
│       ├── AgentBrandIcon.vue          # 真实 Agent 官方高精度矢量 SVG 图标体系 (16 Agents)
│       ├── AgentCard.vue               # Agent 大厅状态卡片 (已启用 / 未启用双模卡片)
│       ├── AgentsView.vue              # 面板 1: Agent Hub (已启用/未启用分组 + 关键词检索)
│       ├── SkillsMatrix.vue            # 面板 2: Skills Matrix (中央技能库全维度搜索、来源/挂载过滤与排序)
│       ├── SyncView.vue                # 面板: 同步中心 (中央技能库 Git 多端同步)
│       ├── UnmanagedGroupSection.vue   # 存量检测按 Agent 归类卡片区 (支持状态筛选、排序与一键纳管全部)
│       ├── AgentDetailModal.vue        # 存量管理弹窗 (待纳管/已忽略 Tabs + 弹窗内技能搜索)
│       ├── AgentPillPicker.vue         # Teleported 智能翻转多选分发器
│       ├── SkillDrawer.vue             # 技能右侧详情抽屉 (Markdown 渲染)
│       ├── SkillEditorModal.vue        # SKILL.md 编辑与创建弹窗
│       ├── ProjectsView.vue            # 面板 3: Project Rules (项目规则中心 + 项目检索)
│       ├── ProjectEditor.vue           # 双栏规则编辑器 (追加/覆盖多基线指引 + 守卫修复)
│       ├── AddAgentModal.vue           # 自定义 Agent 注册弹窗
│       ├── AddProjectModal.vue         # 纳管新项目弹窗
│       ├── DiffModal.vue               # 面板 4: Diff 语法高亮冲突决策弹窗
│       ├── SettingsModal.vue           # 全局偏好设置 (深色/浅色/跟随系统三态切换器)
│       └── ToastContainer.vue          # 全局浮动操作提示
│
└── src-tauri/                          # Rust 桌面端源码 (Tauri 2.0)
    ├── Cargo.toml                      # Rust 依赖 (tauri, notify, serde, windows-sys)
    ├── tauri.conf.json                 # Tauri 客户端窗口与安全策略
    ├── build.rs                        # Tauri 构建脚本
    └── src/
        ├── main.rs                     # 桌面可执行程序入口
        ├── lib.rs                      # Tauri Command 分发接口
        ├── models.rs                   # Rust 数据结构
        ├── fs_junction.rs              # Windows NTFS Junction 驱动
        ├── git_guard.rs                # Git Hook 注入与多基线还原引擎
        ├── skills_sync.rs              # 中央技能库 Git 同步 (init/pull/push/status)
        ├── agent_detector.rs           # 本地 Agent 探测与路径校验
        ├── storage.rs                  # %APPDATA%\AgentHub 本地持久化
        └── watcher.rs                  # Notify 内核级文件监听后台线程
```

---

## 7. 开发、调试与构建指南

### 7.1 前端 / Web 开发模式（推荐日常快速调试）
```bash
# 安装依赖
npm install

# 启动开发服务器 (支持热重载，并内置了 Node 本地系统 API，直接操作真实磁盘)
npm run dev
```
浏览器打开 `http://localhost:1420` 即可体验全功能交互。

### 7.2 生产前端构建验证
```bash
npm run build
```
输出目录位于 `dist/`，打包时间约 6~7 秒，零错误零警告。

### 7.3 Tauri 桌面端编译与运行（需安装 Rust/Cargo）
```bash
# 启动 Tauri 桌面调试窗口
npm run tauri dev

# 打包发布 Windows 独立桌面安装包 (.exe / .msi)
npm run tauri build
```

---

## 8. 关键业务细节与踩坑排查备忘录

1. **Claude Code 斜杠命令重复问题**：
   - Claude Code v2.1+ 会原生扫描 `~/.claude/skills/*/SKILL.md` 并自动识别为 `/command`。
   - **禁止**在 `~/.claude/commands/` 下再次创建同名 `.md`，否则会导致 Claude Code 补全列表中出现两个一模一样的命令。
2. **Claude Code 运行时热重载限制**：
   - Claude Code 会在会话启动时加载技能，会话中途创建软链需要退出会话（`/exit`）重新打开生效。
3. **Windows 下创建 Junction 的权限优势**：
   - 使用 `mklink /J`（NTFS Junction）无需管理员权限或 Windows 开发者模式即可创建目录链接；而符号链接（`mklink /D`）在未开启开发者模式的 Windows 上需要提权。
4. **前端浮层 Teleport 原则**：
   - 所有全局下拉或 Popover（如 `AgentPillPicker`）必须使用 `<Teleport to="body">` 并结合 `getBoundingClientRect()` 进行绝对定位与上下翻转，避免被卡片或表格外层容器的 `overflow-hidden` 截断。
5. **Antigravity 沙箱与文件级 Hardlink Tree 机制**：
   - Google Antigravity 的安全沙箱与文件扫描器在 Windows 下出于防循环引用与隔离策略，会**静默跳过带有 `FILE_ATTRIBUTE_REPARSE_POINT` 的目录软链（NTFS Junction）**。
   - 解决方案：针对 `antigravity`，采用 **「物理目录（`d-----`）+ 文件级 NTFS 硬链接（`mklink /H` / `fs.linkSync`）」** 的 Hardlink Tree 架构。
   - 目录为普通物理文件夹，Antigravity 不会跳过；目录内的文件与中央库共享 MFT 物理 Inode，实现 **0 拷贝、0 磁盘冗余、毫秒级双向实时同步**。
6. **DSH 多 Skill 根目录（Multi-Root Skills）**：
   - DSH 的 `skill-filesystem` 默认会同时扫描 `customSkillDirs`（`~/.dsh/skills-personal`）、用户级公共目录 `~/.dsh/skills`、`~/.agents/skills`，以及项目级 `.dsh/skills` / `.agents/skills`。
   - AgentHub 对 `dsh` 已按多根模型处理：`getAgentSkillDirs()` / Rust `agent_skill_dirs()` 会返回 `~/.dsh/skills-personal` + `~/.dsh/skills` + `~/.agents/skills`。
   - 停用/删除时会清理 DSH 的所有用户级 skill 根目录，避免出现“关闭后 DSH 仍能读到公共目录同名技能”的问题；启用只挂载主目录，不误删公共技能。
   - 存量“待纳管”扫描仍只扫主 `skillsDir`，避免把 `~/.dsh/skills` 的公共技能当成待纳管噪音。
   - 项目级 `.dsh/skills` / `.agents/skills` 属于项目本地技能，AgentHub 全局开关暂不清理。

---

### 16 大 Agent 原生规则与技能全景矩阵 (16 Agents Master Matrix)

| Agent ID | 官方名称 | 技能目录 (`skillsDir`) | 原生识别的规则文件 | 主动读根目录 `AGENTS.md`? | 推荐本地覆盖文件 (`localRuleFilename`) | 官方图标与品牌色 |
|---|---|---|---|:---:|---|---|
| `claude-code` | **Claude Code** | `~/.claude/skills` | `CLAUDE.md` | ❌ | `CLAUDE.local.md` | Anthropic Coral 14-spoke Sunburst (`#D97757`) |
| `cursor` | **Cursor** | `~/.cursor/skills` | `.cursorrules`、`.cursor/rules/*.mdc` | ❌ | `.cursor/rules/local-override.mdc` | 3D Isometric Cube & Arrow (`#38BDF8`) |
| `windsurf` | **Windsurf** | `~/.windsurf/skills` | `.windsurfrules`、`WINDSURF.local.md` | ❌ | `WINDSURF.local.md` | Codeium Teal Ocean Wave (`#0D9488`) |
| `antigravity` | **Google Antigravity** | `~/.gemini/config/skills` | `GEMINI.md`、`.agents/rules/*.md`、`AGENTS.md` | ✅ | `.agents/rules/local-override.md` | Google AI 4-Point Gradient Star (`#4E82EE` -> `#10B981`) |
| `codex` | **OpenCode / Codex** | `~/.codex/skills` | `AGENTS.md`、`AGENTS.override.md` | ✅ | `AGENTS.override.md` | OpenAI Ribbon Swirl Vortex (`#10A37F`) |
| `zcode` | **ZCode** | `~/.zcode/skills` | `ZCODE.local.md`、`AGENTS.md` | ✅ | `ZCODE.local.md` | Indigo High-Tech Matrix Terminal (`#818CF8`) |
| `dsh` | **DeepSeek HARNESS** | `~/.dsh/skills-personal` | `AGENTS.md`、`CLAUDE.md` | ✅ | `AGENTS.local.md` | DeepSeek Official Vector Whale (`#4D6BFE`) |
| `mimocode` | **MiMo Code** | `~/.config/mimocode/skills` | `AGENTS.md`、`CLAUDE.md`、`mimocode.json` | ✅ | `AGENTS.md` | Xiaomi Intelligence Dual-Node (`#FF6900`) |
| `openclaw` | **OpenClaw** | `~/.openclaw/skills` | `AGENTS.md`、`SOUL.md`、`IDENTITY.md` | ✅ | `AGENTS.md` | Cybernetic Claw / Eagle Badge (`#F97316`) |
| `hermes` | **Hermes Agent** | `~/.hermes/skills` | `.hermes.md`、`AGENTS.override.md`、`AGENTS.md` | ✅ | `AGENTS.override.md` | Nous Research Winged Helm Crest (`#F59E0B`) |
| `copilot` | **GitHub Copilot** | `~/.copilot/skills` | `.github/copilot-instructions.md`、`AGENTS.md` | ✅ (Coding Agent) | `.github/copilot-instructions.md` | GitHub Purple Pilot Robot (`#8957E5`) |
| `pi` | **Pi Coding Agent** | `~/.pi/skills` | `.omo/rules/`、`AGENTS.md`、`CLAUDE.md` | ✅ (需 pi-rules) | `.omo/rules/local.md` | Inflection Green Mathematical Pi (`#22C55E`) |
| `kimi` | **Kimi Code CLI** | `~/.kimi/skills` | `AGENTS.md` (根+子目录)、`~/.kimi/AGENTS.md` | ✅ | `AGENTS.md` | Moonshot Indigo/Cyan Star Burst (`#6366F1`) |
| `trae` | **Trae / TraeWork** | `~/.trae/skills` | `.trae/rules/`、`AGENTS.md`、`CLAUDE.local.md` | ✅ (需设置开启) | `CLAUDE.local.md` | ByteDance Trae 3D Prism Cube (`#00E5FF`) |
| `workbuddy` | **WorkBuddy** | `~/.workbuddy/skills` | `AGENTS.md`、Codex 指令 | ❓ (依赖配置) | `AGENTS.md` | Collaboration Robot Intelligence (`#3B82F6`) |
| `kiro` | **Kiro CLI** | `~/.kiro/skills` | `~/.kiro/agents/*`、`AGENTS.md`、`AmazonQ.md` | ✅ | `AGENTS.md` | Amazon Q / Magenta Gradient Badge (`#E056FD`) |

---

## 9. 后续演进建议与待办清单 (TODO)

- [ ] **应用本体在线更新**：接入 Tauri Updater，支持 GitHub Releases 检查更新、下载与自动安装新版本。
- [ ] **MCP Server 配置总线**：扩展多 Agent 的 MCP Server（`claude_desktop_config.json`, `gemini/mcp`, `codex/mcp`）集中可视化管理与共享。
- [ ] **Skills 市场导入**：接入 GitHub / npm skills 生态一键搜索并远程下载至中央库。
- [ ] **CodeMirror 6 嵌入双栏 Diff**：在 ProjectEditor 与 DiffModal 中进一步引入 CodeMirror 6 的 MergeView 实时行级对比。
- [ ] **系统托盘与最小化常驻**：Tauri 2.0 增加系统托盘图标、托盘右键菜单与快捷唤起快捷键。

---

## 10. 跨会话接力维护协议

当你在新的会话中完成开发后，请遵循以下三步：
1. **核对改动**：运行 `npm run build` 确保无编译与语法错误；
2. **同步文档**：若新增了 Agent 适配、更新了 JSON 数据结构、新增了组件或改变了交互，**务必在本文档对应章节中记录更新**；
3. **更新版本与变更记录**：在文档末尾记录更新日期与更新简述。

---

### 变更记录 (Changelog)

- **2026-08-18 (Session 5)**:
  - **16 大主流 AI Agent 全景深度适配**：
    - 全面适配 Claude Code、Cursor、Windsurf、Google Antigravity、OpenCode/Codex、ZCode、DSH、MiMo Code、OpenClaw、Hermes Agent、GitHub Copilot、Pi Coding Agent、Kimi Code CLI、Trae / TraeWork、WorkBuddy、Kiro CLI 16 款 Agent。
    - 补齐各 Agent 原生私有覆盖文件（`CLAUDE.local.md`, `WINDSURF.local.md`, `AGENTS.override.md`, `ZCODE.local.md`, `AGENTS.local.md`, `.cursor/rules/local-override.mdc`, `.omo/rules/local.md`, `.github/copilot-instructions.md` 等）及多路径真机自动探测体系（Rust & Node 双端无缝对齐）。
    - 动态升级 `localApi.ts` 与 `agent_detector.rs`，所有技能分发、卸载、存量检测及 Project Rules 规则写入均基于全量 16 Agent 矩阵动态化调度，彻底消除硬编码限制。
  - **真实官方品牌矢量图标体系 (100% Authentic Brand Vectors)**：
    - 全面重写 `AgentBrandIcon.vue`，彻底淘汰泛型图标与合成简笔画，严格按照各家官方品牌规范实现高精度矢量 SVG（Anthropic 14 角星芒、Gemini 四角渐变星、OpenAI 旋涡 Ribbon、Cursor 3D 立方体透视、Windsurf 浪花、Copilot 紫色飞行员机器人、Moonshot Kimi 星光、Trae 棱镜立方体、Nous Hermes 战盔、Pi 符号徽章、MiMo、Amazon Q / Kiro 等）。
- **2026-08-18 (Session 4)**:
  - **页面交互与视觉系统全方位重构**：
    - **外观主题系统升级**：全面支持「深色模式 / 浅色模式 / 跟随系统」三态切换，扩展 Tailwind CSS 变量与光影质感，在全局设置与顶部导航条中提供快捷切换。
    - **真实 Agent 品牌图标系统**：创建 `AgentBrandIcon.vue`，内置 Claude Code、Google Antigravity/Gemini、OpenCode/Codex、Cursor、Windsurf、ZCode、DSH 等官方高精度矢量 SVG 图标体系。
    - **Agent Hub 双区分流卡片**：将 Agent Hub 分割为「已启用 Agent 矩阵」与「未启用 / 待激活 Agent」双独立区域，采用不同卡片视觉设计，并提供在页关键词检索与一键批量激活。
    - **Skills Matrix 搜索/筛选/排序全功能就绪**：
      - 中央技能库增加关键词模糊检索（名称/描述/Tag/斜杠命令）、来源筛选（内置/中央/NPX/存量）、分发状态筛选（全部活跃/部分挂载/未挂载）、多维度排序（A-Z、挂载数、版本号）与一键重置。
      - 本地存量检测（`UnmanagedGroupSection` 与 `AgentDetailModal`）增加实时搜索、状态过滤与排序。
    - **顶部导航栏精简**：清理冗余孤立搜索框，聚焦于系统健康状态监测、环境快速重扫与主题切换。
- **2026-08-18 (Session 3)**:
  - **Antigravity 技能分发全面升级（Hardlink Tree 架构）**：
    - 深入分析并攻克 Antigravity 在 Windows 下因沙箱策略跳过 NTFS Junction 目录导致无法动态感知技能的底层问题。
    - 实现 **文件级 NTFS 硬链接树（Hardlink Tree）分发引擎**（Rust 端与 Web 本地模拟端双向对齐）。
    - 将 Antigravity 目标技能目录置为纯物理文件夹，内部文件与中央库共享 NTFS 物理 Inode，实现 Antigravity 100% 原生识别 + 中央库编辑秒级双向无感同步。
    - 在技能保存（`save_skill`）与技能卸载（`removeSkillMount`）中加入了对 Hardlink Tree 的全自动同步守护。
- **2026-08-18 (Session 2)**:
  - **DSH 默认规则升级**：将 DSH 的默认规则文件从 `AGENTS.md` 调整为 `AGENTS.local.md`，实现 100% 零 Git 冲突与专属本地规则隔离。
  - **Project Rules 规则引擎全面重构**：
    - 修复 Web 开发模式（`localApiPlugin`）未实际向项目目录写入物理规则文件的问题，补齐与 Rust 后端 100% 对齐的落盘与 Git 守卫支持。
    - 修复多 Agent 原生规则精准分发逻辑，确保勾选 Claude Code (`CLAUDE.local.md`)、Antigravity (`.agents/rules/local-override.md`)、ZCode (`ZCODE.local.md`)、Codex (`AGENTS.override.md`)、DSH (`AGENTS.local.md`) 时所有目标 Agent 都能精准获得属于自己的原生规则文件，并自动加锁至 `.git/info/exclude`。

- **2026-08-18 (Session 6)**:
  - **前端风格与浅色/深色模式配色逻辑全面重构**：
    - **彻底根除粗暴反色与 `!important` 污染**：移除了 `style.css` 中破坏主操作按钮与徽章对比度的全局强制反色样式，基于 Tailwind `dark:` 原生双模机制与语义化设计变量重构全局视觉基础。
    - **浅色模式（Light Mode）工业级质感重塑**：
      - 视口画布底色采用清爽纯净的 `#f8fafc`，卡片与面板采用纯白 `#ffffff` 搭配精致细边框（`#e2e8f0`）与微投影（`shadow-sm` / `shadow-md`）；
      - 文本可读性全面达到最高标准：正文深灰高对比（`#0f172a` / `#334155`），状态胶囊（成功/警告/错误/信息）采用高饱和度饱和色系（`-700` / `-800`）搭配柔和底色（`-50` / `-100`）；
      - 主操作按钮始终保持高对比度白字与饱满品牌色（`bg-brand-600 hover:bg-brand-500 text-white`）。
    - **全量 18 个前端组件展示逻辑与微交互优化**：
      - `Header.vue` & `Navigation.vue`：导航 Tab 活跃指示器、未纳管待办计数胶囊、环境扫描与主题切换三态按钮视觉升级；
      - `AgentsView.vue` & `AgentCard.vue`：已启用卡片（纯白高光 + 呼吸绿灯）与未启用卡片（柔和灰阶）视觉分流，路径与私有规则文件名高亮；
      - `SkillsMatrix.vue` & `AgentPillPicker.vue`：表格行选中高亮、已分发 Agent 药丸徽章、Teleported 智能浮动下拉菜单光影升级、悬浮批量操作条优化，**默认视图调整为卡片画廊模式（Card View）并自动持久化用户视图偏好至 localStorage**；
      - `ProjectsView.vue` & `ProjectEditor.vue`：双栏规则编辑器（只读参考 `AGENTS.md` vs 本地规则 Markdown 编辑器）代码容器质感强化，追加/覆盖模式指示横幅与关联 Agent 勾选卡片对比度提升；
- **2026-08-18 (Session 7)**:
  - **全方位项目代码审查与 Bug 根治 (Full Code Review & Hardening)**:
    - **TypeScript 类型环境与编译零错误修复**：
      - 补充 `src/vite-env.d.ts`，修复 `*.vue` 模块声明与 Vite 客户端类型；
      - 修复 `useAppStore.ts` 及 `AgentDetailModal.vue` 中 `takeoverUnmanagedSkill` 与 `takeoverSkill` 调用传参 `'create'` 不符合联合类型 `'overwrite' | 'rename' | 'skip'` 的类型报错问题；
      - 运行 `npx tsc --noEmit` 与 `npm run build` 达到 **100% 零错误、零警告通过**。
    - **Tauri Rust 后端双端指令与数据模型完全对齐**：
      - 补齐 `src-tauri/src/models.rs` 中的 `IgnoredSkill` 结构体及 `AppConfig` 的 `ignored_skills: Option<Vec<IgnoredSkill>>` 字段；
      - 补齐 `src-tauri/src/lib.rs` 中的 `ignore_skill` 与 `unignore_skill` Tauri Command 并注册至 `tauri::generate_handler!`，彻底杜绝桌面端调用忽略技能时的崩溃风险；
      - 修复 `scan_unmanaged_skills` 存量检测未过滤已忽略私有技能的问题，并补充 `get_central_skills` 内置来源标识。
    - **前端业务逻辑持久化与状态保护修复**：
      - 修复 `SettingsModal.vue` 保存配置时覆盖丢失 `ignored_skills` 列表的隐患；
      - 修复 `AgentCard.vue` 移除自定义 Agent 时未调用 `saveAgentsList` 持久化落盘导致刷新还原的问题，新增 `store.deleteCustomAgent` 动作；
      - 清理已被 `UnmanagedGroupSection.vue` 完全替代的历史废弃组件 `UnmanagedSkillsBanner.vue`。
    - **Git 仓库标准化与远程关联**：
      - 创建规范的 `.gitignore` 过滤 `node_modules/`、`dist/`、`src-tauri/target/` 等构建与临时产物；
      - 成功关联 GitHub 远程仓库：`https://github.com/Nomit8088/AGENT_CONFIG_MANAGE.git`。

- **2026-08-19 (Session 9)**:
  - **全站 UI 工业级重构：macOS 毛玻璃 (macOS Vibrancy) 风格体系**:
    - **严格遵照 Stylekit macOS Vibrancy 规范规范体系**：
      - **三层暗灰系统**：严格构建从深到浅的纯色阶体系：深底色 `#1c1c1e`（Deepest Canvas / Body） -> 中层卡片 `#2c2c2e`（Mid Layer / Cards / Floating Bar） -> 交互浅层 `#3a3a3c`（Surface / Primary Action Buttons）；
      - **毛玻璃与透明度层次**：顶栏、侧栏与浮层使用 `backdrop-blur-xl` 配合 `bg-[#1c1c1e]/80` 或 `bg-[#1c1c1e]/95`，文字阶梯采用 `text-white/95`（正文与标题）、`text-white/70`（次级文字与标签）、`text-white/50`（说明与占位符）；
      - **排版与边框工艺**：标题统一采用 Serif 衬线体（`font-serif`，Georgia / Times New Roman），正文采用系统无衬线体（`-apple-system, BlinkMacSystemFont`），代码采用单宽体（`font-mono`，SF Mono / Menlo）；所有边框统一为 1px 细线（`border-white/8` 到 `border-white/12`），彻底根除粗边框（`border-2/4`）；
      - **交互与动效规范**：过渡统一采用 `transition-colors duration-200 ease-out`（仅颜色渐变，杜绝 hover 位移、缩放、浮动与弹跳）；彻底根除大投影（`shadow-xl/2xl`）、高饱和渐变（`bg-gradient-*`）、装饰性动画（`animate-pulse/bounce/ping`）与超大圆角（`rounded-3xl/full`），开关与勾选框统一采用方圆角（`rounded-md` / `rounded-lg`）；
    - **全量 18 个核心前端视图与组件 100% 改造对齐**：
      - `tailwind.config.js` & `index.html` & `src/assets/style.css`：配置 macOS Vibrancy 调色板、Serif 字体族、macOS 自定义滚动条与复选框；
      - `App.vue`、`Header.vue`、`Navigation.vue`：精致毛玻璃顶栏、Serif Logo、极简暗色导航 Tab 与状态指示器；
      - `AgentsView.vue` & `AgentCard.vue`：三层暗灰卡片架构、macOS 矩形开关切换器、官方纯净品牌图标；
      - `SkillsMatrix.vue`、`UnmanagedGroupSection.vue`、`AgentPillPicker.vue`、`SkillDrawer.vue`、`SkillEditorModal.vue`：全维度暗灰表格与卡片画廊、Teleported 浮动药丸分发器、代码抽屉与编辑器；
      - `ProjectsView.vue` & `ProjectEditor.vue`：双栏暗灰规则中心、Markdown 规则编辑器；
      - `AgentDetailModal.vue`、`AddAgentModal.vue`、`AddProjectModal.vue`、`DiffModal.vue`、`SettingsModal.vue`、`ToastContainer.vue`：macOS Vibrancy 规范弹窗与操作通知。
    - **代码质量与构建自检**：
      - `npm run build` 100% 通过（Vite 生产构建耗时 6s，零警告零报错）；
      - 全局 grep 验证零禁止类名（零 `bg-gradient`、零 `shadow-xl/2xl`、零 `rounded-full`、零 `animate-pulse`、零 `border-2/4`）。

- **2026-08-19 (Session 10)**:
  - **深浅色双主题与多 Agent 技能分发全面修复**:
    - **深色/浅色模式双轨制深度兼容 (Fix Issue 1)**:
      - 彻底修复主题切换失效问题，配置 `:root`（浅色 `#f5f5f7` / `#ffffff` / `text-slate-900`）与 `.dark`（深色 `#1c1c1e` / `#2c2c2e` / `text-white/95`）动态调色板；
      - 全量更新所有 18 个核心组件，采用 `dark:` 双模式类名，确保浅色与深色模式均保持 macOS 极简质感；
    - **全 Agent NTFS Junction 与 Hardlink 分发可靠性攻坚 (Fix Issue 2)**:
      - 修复 `fs_junction.rs` 与 `localApi.ts` 中针对断开的 Junction / 符号链接 `existsSync` 返回 false 导致 `mklink /J` 报错 `EEXIST` 的隐患，全面切换为 `symlink_metadata` / `lstatSync` 强力清理；
      - 为其他 Agent 增加自动降级至 NTFS Hardlink Tree 机制；
      - 重构 `AgentPillPicker.vue` 响应式数据绑定与行点击拦截，实现毫秒级乐观更新与 100% 可靠挂载；
- **2026-08-19 (Session 11)**:
  - **Git Hook pre-commit 防误提防护与纳管项目工作区体验升级**:
    - **Git Hook 守卫全面升级 pre-commit 提交拦截**:
      - 在 `git_guard.rs` 与 `localApi.ts` 中新增 `pre-commit` 自动化拦截守卫：在覆盖模式下，当检测到暂存区包含本地个性化 `AGENTS.md` 时自动拦截提交并给出友好的终端彩色提示，杜绝团队仓库被误污染；
      - 新增 `repairGitHooks` API 与 Tauri Command，并在界面提供 **「⚡ 一键安装/修复 Git Hook」** 按钮，秒级检测与自愈丢失的 Hook 文件；
      - 状态明确化：追加模式明确显示 `(.git/info/exclude 私有隔离生效中 · 免 Hook)`，覆盖模式明确显示 `(Git Hook 守卫生效中 · pre-checkout & pre-commit 防护)`；
    - **纳管项目界面（Project Rules）全面重构降噪**:
      - 彻底消除传统双栏并排挤占空间导致的拥挤感；
      - 采用顶部精简元数据栏（项目名、分支、复制路径、直观定制开关 `[ ● 规则定制已生效 ]` 与保存按钮）；
      - 引入 **分段控制卡片（Segmented Control）** 双 Tab 架构：
        - Tab 1: **规则内容编辑 (Markdown)**：提供宽敞舒适的全宽 Markdown 编辑器、字数/行数统计、标准模板插入，并支持按需呼出 **「📖 查看原版 AGENTS.md」** 抽屉式侧边基准参考；
        - Tab 2: **分发模式与防护设置**：以卡片对比形式直观呈现「追加模式 (Append)」与「覆盖模式 (Overwrite)」，并聚合目标 Agent 网格勾选与 Hook 修复面板；
- **2026-08-19 (Session 12)**:
  - **全站分段滑块开关样式统一与 pre-commit 守卫手动放行开关**:
    - **开关交互统一为 macOS 分段滑块 (Segmented Slider)**:
      - 参照「外观主题设置」的分段滑块容器设计，将全局所有开关统一为触感极佳的 `[ 开启 / 启用 | 关闭 / 停用 ]` 分段滑块控制组件；
      - 涉及组件：`SettingsModal.vue`（自动捕获、Toast 提示、默认规则模式）、`AgentCard.vue`（Agent 启用/停用）、`ProjectEditor.vue`（项目规则定制总开关、pre-commit 守卫开关）、`SkillsMatrix.vue`（表格与卡片视图的技能全局分发开关）；
    - **项目纳管 pre-commit 守卫手动开启/关闭控制 (Bypass Guard)**:
      - 在 `ProjectInfo` 架构与 Tauri/Node API (`update_project_rule` & `apply_project_rules`) 中接入 `preCommitGuard` 字段；
      - 在项目设置的防护面板中提供 **`[ 开启拦截 (防误提) | 允许提交 (放行) ]`** 分段滑块开关；
      - 当确实需要向团队远程仓库提交 `AGENTS.md` 时，用户可一键切换为「允许提交 (放行)」，系统自动移除或放行 pre-commit 守卫。

- **2026-08-20 (Session 13)**:
  - **存量技能纳管与中央覆盖更新逻辑彻底修复 (Fix Takeover & Unmanaged Detection)**:
    - **修复「一键全部纳管」静默跳过同名冲突项的 Bug**:
      - 移除 `useAppStore.ts` 中 `takeoverAllForAgent` 对 `item.hasConflict` 的静默跳过过滤，确保所有待纳管实体均执行覆盖纳管并替换为中央受控软链；
      - 新增 `takeoverAllUnmanagedSkills` 跨 Agent 全局一键纳管动作；
    - **Tauri Rust 端与 Node 本地 API 双端 Takeover 对齐 Antigravity Hardlink Tree 架构**:
      - 修复 `src-tauri/src/lib.rs` 与 `vite.config.ts` 中的 `takeover_unmanaged_skill` 逻辑：在纳管替换目录时，对 Google Antigravity 自动使用 Hardlink Tree 分发，对其他 Agent 自动使用 Windows NTFS Junction；
    - **存量检测面板体验升级**:
      - 在 `UnmanagedGroupSection.vue` 控制栏新增 **「⚡ 一键纳管全部 (N)」** 快捷操作，支持一次性将所有 Agent 的存量物理技能全部替换为中央受控软链/硬链。

- **2026-08-20 (Session 14)**:
  - **多基线规则引擎重构与模式互斥安全回滚 (Multi-Baseline Rules Engine & Safe Rollback)**:
    - **打破单一 `AGENTS.md` 局限，全面支持多基线规则文件**:
      - 全面纳管 `AGENTS.md`、`CLAUDE.md`、`.cursorrules`、`.windsurfrules` 等多生态团队基线；
      - 升级 Git Hook 守卫（`pre-checkout`、`post-checkout`、`pre-commit`）支持多基线文件并发防护与分支切换秒级还原。
    - **覆盖模式 (Overwrite) 与追加模式 (Append) 严格物理互斥**:
      - **覆盖模式**：统一置换已关联 Agent 的基线文件（`AGENTS.md`、`CLAUDE.md` 等），并**强制清空所有私有覆盖文件**（`CLAUDE.local.md`、`.agents/rules/` 等），彻底根除双重规则注入；
      - **追加模式**：**100% 物理还原所有基线文件**，仅向勾选的 Agent 写入私有覆盖文件并注入 `.git/info/exclude`，实现零 Git 冲突与免 Hook。
    - **三层幂等回滚与防误删自愈机制**:
      - 实现 `restore_all_baselines` 与 `clean_all_private_rules`，无论是否 Git 仓库，在关闭定制或切换模式时 100% 从备份层复原团队原版文件，彻底杜绝误删基线文件的重大隐患；
      - Tauri Rust 端（`git_guard.rs` / `lib.rs`）与 Web Node.js 端（`localApi.ts`）双端逻辑 100% 对齐。

- **2026-08-20 (Session 15)**:
  - **DSH 多 Skill 根目录支持，修复 Skills Matrix 开关对 DSH 无效**:
    - 根因：DSH 的 `skill-filesystem` 会同时扫描 `~/.dsh/skills-personal`、`~/.dsh/skills` 与 `~/.agents/skills`，而 AgentHub 原先只管理 `~/.dsh/skills-personal`，导致关闭同名技能后 DSH 仍能从公共目录读到。
    - Node/Web 端：新增 `getAgentSkillDirs()` / `findAgentSkillDir()`，`vite.config.ts` 的挂载状态判断、卸载、删除、纳管逻辑按 Agent 多根目录处理；存量待纳管仍只扫主目录，避免公共技能噪音。
    - Rust/Tauri 端：新增 `agent_skill_dirs()` / `find_agent_skill_dir()`，`lib.rs` 的 `get_central_skills`、`delete_skill`、`toggle_skill_for_agent`、`takeover_unmanaged_skill` 同步支持多根目录；`watcher.rs` 增加 `~/.dsh/skills` 与 `~/.agents/skills` 监听。
    - 修复纳管误删中央库风险：`findAgentSkillDir()` 只返回物理目录，跳过 Junction/Symlink；纳管删除本地目录改用 `removeSkillMount()` 安全移除，避免 `fs.rmSync` 递归清空 Junction 指向的中央库。

- **2026-08-20 (Session 16)**:
  - **中央技能库多端同步 (Skills Sync)**:
    - 新增独立「同步中心」Tab（`SyncView.vue`），仅同步中央技能库，不涉及 Agent/项目配置。
    - 以 `%APPDATA%\AgentHub` 作为 Git 仓库根，`skills/` 作为仓库子目录；初始化时自动生成 `.gitignore` 排除 `config.json`、`agents.json`、`projects.json`、`backups/` 等本机私有文件。
    - 仓库结构为单一私有仓库多分类：`skills/`（当前）、`dsh/`、`mcp/`（未来扩展），远端可为 GitHub/Gitee/GitLab 等任意 Git 仓库。
    - 提供状态查看、初始化连接、手动拉取/推送、启动自动拉取开关。
    - 自动拉取仅 fast-forward：本地有未提交修改或冲突时安全跳过并提示，绝不覆盖本地 skills。
    - Rust 后端新增 `skills_sync.rs`（`get_skills_sync_status` / `init_skills_sync` / `pull_skills_sync` / `push_skills_sync` / `set_skills_sync_auto_pull`）；Node 本地 API 与 `vite.config.ts` 路由 `/api/skills/sync/*` 双端对齐。
    - `config.json` 新增 `skills_sync` 配置块，保存远端地址、分支、启动自动拉取与最后同步状态。

---
*文档更新时间：2026-08-20 | AgentHub Core Team*
