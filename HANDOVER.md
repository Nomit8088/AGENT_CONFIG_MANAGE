# AgentHub 项目交接与后续开发维护指南 (HANDOVER.md)

> **💡 协作准则与强制规范**：
> 本文档是 **AgentHub** 项目的 Single Source of Truth 交接文档。任何 AI 智能体（Agent）或开发者在后续会话中接手、修改、重构或新增功能后，**必须同步更新本文档对应的架构说明、数据 Schema、模块索引与待办清单**，确保跨会话开发无缝衔接。
>
> **跨平台规范（WI-011 起生效）**：跨平台开发规范（三平台一致 / Dual-Mode 双端对齐 / 链接决策矩阵 / 平台差异统一抽象 / 三平台验证）以根 `AGENTS.md` 为权威，详见该文件，本文档不重复全文。

---

## 1. 项目概述与核心定位

### 1.1 为什么需要 AgentHub？
随着多款 AI Coding Agent（Claude Code、Google Antigravity、OpenCode/Codex、ZCode、Cursor、DSH、Windsurf 等）在实际开发中的混合使用，开发者面临以下三大痛点：
1. **规则与 Git 上下文冲突**：团队 Git 仓库通常追踪了全局 `AGENTS.md`。本地定制个性化偏好若直接修改该文件，切分支或 `git pull` 必出冲突；若仅靠 Prompt 提示“忽略”，原版内容依然注入上下文，浪费大量 Token 并干扰推理。
2. **Skills / Commands 生态割裂**：各 Agent 的技能存放目录各异（`~/.claude/skills`、`~/.gemini/config/skills`、`~/.codex/skills`、`~/.zcode/skills`、`~/.dsh/skills` 等），在一个 Agent 中开发的新 Skill 无法自动同步共享。
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
  "auto_check_update": false,         // 启动时自动检查更新 (GitHub Releases)
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
  },
  "dsh_plugins": {                   // DSH 插件中心（扫描/诊断/同步/对账）
    "dshCommand": "",                // 空 = 自动探测（where dsh → ~/AppData/Roaming/npm）
    "pnpmCommand": "",
    "sync": {
      "remoteUrl": "https://github.com/you/agenthub-sync.git",
      "branch": "main",
      "autoPullOnStartup": false,
      "lastSyncAt": 1723982400000,
      "lastSyncStatus": "idle",
      "lastError": null
    }
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
    "skillsDir": "~/.dsh/skills",
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
│   │   ├── localApi.ts                 # Web 模式下的 Node 原生系统操作层 (NTFS Junction/FS)
│   │   ├── dshPlugins.ts               # Web 模式 DSH 插件扫描/诊断/开关/同步/对账（与 Rust 对齐）
│   │   └── appUpdate.ts                # Web 模式应用本体在线更新（GitHub Releases 检查/下载/安装，代理感知）
│   ├── assets/
│   │   └── style.css                   # 全局样式、毛玻璃、滚动条美化
│   └── components/
│       ├── Header.vue                  # 顶部导航条 (状态统计、主题切换、设置)
│       ├── Navigation.vue              # 核心页签切换 Tab（大厅/技能/插件/项目/同步）
│       ├── AgentBrandIcon.vue          # 真实 Agent 官方高精度矢量 SVG 图标体系 (16 Agents)
│       ├── AgentCard.vue               # Agent 大厅卡片 (已启用/未启用双模；待纳管/忽略/已挂载为只读状态标签+悬浮提示，统一「技能管理」入口弹窗)
│       ├── AgentsView.vue              # 面板 1: Agent Hub (已启用/未启用分段页签切换 + 关键词检索 + 卡片网格)
│       ├── SkillsMatrix.vue            # 面板 2: Skills Matrix (蓝色品牌容器 + 来源/分发语义色徽章；搜索/筛选/排序/新建/编辑/删除)
│       ├── SyncView.vue                # 面板: 同步中心 (主视觉仓库卡 + 技能/DSH 对称功能卡 + 本地↔远端文件差异面板；未配置时展示仓库格式指引)
│       ├── UnmanagedGroupSection.vue   # [已弃用] 存量检测按 Agent 归类卡片区 (功能已合并进 AgentCard 卡片徽章 + AgentDetailModal)
│       ├── AgentDetailModal.vue        # Agent 技能管理弹窗 (待纳管/已忽略/中央技能分发 Tabs + 弹窗内搜索)
│       ├── AgentPillPicker.vue         # Teleported 智能翻转多选分发器
│       ├── SkillDrawer.vue             # 技能右侧详情抽屉 (Markdown 渲染)
│       ├── SkillEditorModal.vue        # SKILL.md 编辑与创建弹窗
│       ├── ProjectsView.vue            # 面板 3: Project Rules (项目规则中心 + 项目检索)
│       ├── ProjectEditor.vue           # 双栏规则编辑器 (追加/覆盖多基线指引 + 守卫修复)
│       ├── AddAgentModal.vue           # 自定义 Agent 注册弹窗
│       ├── AddProjectModal.vue         # 纳管新项目弹窗
│       ├── DiffModal.vue               # 面板 4: Diff 语法高亮冲突决策弹窗
│       ├── PluginsView.vue             # 面板 5: DSH 插件中心容器（紫色品牌头部 + 插件面板 / 诊断修复 两分段 Tab）
│       ├── DshPluginList.vue           # DSH 插件面板 V3：sticky 操作栏 + 健康胶囊 + 彩色分区头部图标瓦片 + 分组卡片顶部语义色强调线（按来源/按状态 + 列表/卡片 + 分页）
│       ├── DshPluginRow.vue            # DSH 插件统一条目（列表行/卡片双形态：状态点/按 kind 上色的图标瓦片/名称/单一徽章/内联 spec·installed·required/启停/操作）
│       ├── DshDiagnose.vue             # DSH 启动失败诊断修复面板（紫色品牌控件卡 + 崩溃堆栈解析 + 一键关闭并重试）
│       ├── DshPluginSync.vue           # DSH 插件配置对账卡片（本地 ~/.dsh ↔ 同步镜像 dsh/；对账/一键对齐/差异详情）
│       ├── DshPluginDiffModal.vue      # DSH 插件配置对账差异详情弹窗
│       ├── DshConfigSnapshots.vue      # DSH 配置快照时间线（手动创建 + 触发来源/备注 + 一键回滚 + 永久保留）
│       ├── DshVersionManager.vue       # DSH 版本管理（当前/远端版本 + 升级/回滚 + 版本历史 + 指定版本安装）
│       ├── SettingsModal.vue           # 全局偏好设置 (深色/浅色/跟随系统三态切换器 + 自动检查更新开关)
│       ├── UpdateModal.vue             # 应用在线更新弹窗 (检查/下载进度/安装重启)
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
        ├── dsh_plugins.rs              # DSH 插件扫描/诊断/开关/恢复/安装（文本级 patch 安全写盘）
        ├── dsh_plugins_sync.rs         # DSH 插件配置同步/对账/一键对齐（复用同一 .git，镜像到 dsh/）
        ├── agent_detector.rs           # 本地 Agent 探测与路径校验
        ├── storage.rs                  # %APPDATA%\AgentHub 本地持久化
        ├── app_update.rs               # 应用本体在线更新（GitHub Releases 检查/下载/安装，ureq + 代理）
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
6. **DSH 技能根目录（Multi-Root Skills）**：
   - DSH 的 `skill-filesystem` 默认扫描项目级 `.dsh/skills` / `.agents/skills`、`customSkillDirs`，以及用户级 `~/.dsh/skills`（user-dsh）与 `~/.agents/skills`（user-agents）；它**并不扫描** `~/.dsh/skills-personal`。
   - AgentHub 对 `dsh` 的主管理目录即 `~/.dsh/skills`：`getAgentSkillDirs()` / Rust `agent_skill_dirs()` 返回 `~/.dsh/skills` + `~/.agents/skills`（首个元素为主挂载目录）。
   - 停用/删除时会清理 DSH 的所有用户级 skill 根目录，避免出现“关闭后 DSH 仍能读到公共目录同名技能”的问题；启用只挂载主目录 `~/.dsh/skills`，不误删 `~/.agents/skills` 共享技能。
   - 存量“待纳管”扫描仍只扫主 `skillsDir`（即 `~/.dsh/skills`），避免把 `~/.agents/skills` 的共享技能当成待纳管噪音。
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
| `dsh` | **DeepSeek HARNESS** | `~/.dsh/skills` | `AGENTS.md`、`CLAUDE.md` | ✅ | `AGENTS.local.md` | DeepSeek Official Vector Whale (`#4D6BFE`) |
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

## 8A. DSH 插件中心（DSH Plugin Manager）架构

新增独立「DSH 插件中心」Tab（`Navigation.vue` 图标 `Puzzle`，badge = 对账差异数），实现四大能力：

| 能力 | 实现 |
|---|---|
| F1 启动失败诊断修复 | `diagnose_dsh_web` 拉起 `dsh web` 捕获崩溃 stderr，解析失败插件 → 建议动作 → 关闭并重试 |
| F2 本地插件可视化 | `scan_dsh_plugins` 扫描 `~/.dsh/profiles/*` 的 `package.json` + `cordis.patch.yml` |
| F3 配置同步 | 仅同步配置文件（`package.json` + `cordis.patch.yml` + `pnpm-lock.yaml`），拉取后 `pnpm install` 自装 |
| F4 对账提示 | 仓库镜像 vs 本地配置 diff，提示 +「一键对齐」 |

### 核心边界与数据模型
- **事实源始终是 `~/.dsh/profiles/<name>/package.json` + `cordis.patch.yml`**；AgentHub 只读写这些文件，不复制第二份「插件状态」。
- 插件条目 `DshPluginEntry`：`key` = `bundle:<pkg>` | `dep:<pkg>` | `row:<id>`；`kind` = `inbox`（内置 `@deepseek-ai/dsh-*`）/ `bundle`（用户 bundle）/ `plain`（依赖未激活）/ `row`（patch 行）；`portability` = `portable` / `unportable`（不可移植 = `link:` / `file:` / `workspace:` / `portal:` / `catalog:` / `git+ssh:` / `ssh:` / `git@`；`git+https:` / `github:` / `gitlab:` / 版本号 / `npm:` 均为可移植）。
- `config.json` 新增 `dsh_plugins` 块（`dshCommand` / `pnpmCommand` 可配置，空 = 自动探测；`sync` 同步配置）。

### 同步仓库布局（与 skills sync 共用同一 `.git`）
```
%APPDATA%\AgentHub\          # Git 仓库根（与 skills sync 共用）
├── .gitignore               # 排除 config.json / agents.json / projects.json / backups/ 等私有文件
├── skills\                  # 中央技能库（skills sync）
└── dsh\                     # DSH 插件配置镜像（本功能）
    └── profiles\<name>\
        ├── package.json     # 已剔除内置 bundle 与不可移植依赖
        ├── cordis.patch.yml
        └── pnpm-lock.yaml
```
- **推送**：`~/.dsh/profiles/<name>` → 镜像 `dsh\profiles\<name>`（sanitize）→ `git add -A -- dsh` → commit/push。
- **拉取**：`git pull --ff-only` → 读镜像 → 对账 →「一键对齐」写回 `~/.dsh` + `pnpm install`。
- **init 幂等**：无 `.git` 才 `git init`，避免与 skills sync 冲突。

### 安全写盘（双端一致）
- `package.json`：只改 `dsh.profile.bundles` / `dependencies`，2-space JSON 写回，幂等。
- `cordis.patch.yml`：**只做文本级追加/删除**（按 id 去重、保留注释与 `!!js`、绝不 `yaml.dump` 全文件）。停用 = 追加 `{id, disabled:true}`；启用 = 按 id 删除该顶层条目。

### API 命令表（Tauri Command ↔ Web 路由双端对齐）
| Tauri Command | Web 路由 | 说明 |
|---|---|---|
| `scan_dsh_plugins` | `GET /api/dsh/plugins/scan` | 扫描本地插件 |
| `diagnose_dsh_web` | `POST /api/dsh/plugins/diagnose` | 诊断启动失败（15s 超时 + 杀进程树） |
| `toggle_dsh_plugin` | `POST /api/dsh/plugins/toggle` | 启停 bundle/dep/row |
| `remove_dsh_plugin` | `POST /api/dsh/plugins/remove` | 卸载（移出 dependencies + bundles / 删除 patch 行 + 尽力 pnpm prune） |
| `apply_dsh_recovery` | `POST /api/dsh/plugins/recover` | 应用恢复动作 |
| `install_dsh_plugins` | `POST /api/dsh/plugins/install` | pnpm install |
| `get_dsh_plugins_sync_status` | `GET /api/dsh/plugins/sync/status` | 同步状态 |
| `init_dsh_plugins_sync` | `POST /api/dsh/plugins/sync/init` | 初始化（幂等） |
| `pull_dsh_plugins_sync` | `POST /api/dsh/plugins/sync/pull` | git pull --ff-only |
| `push_dsh_plugins_sync` | `POST /api/dsh/plugins/sync/push` | 镜像 + commit + push |
| `set_dsh_plugins_sync_auto_pull` | `POST /api/dsh/plugins/sync/auto-pull` | 启动自动拉取 |
| `reconcile_dsh_plugins` | `GET /api/dsh/plugins/reconcile` | 对账 diff |
| `align_dsh_plugins` | `POST /api/dsh/plugins/align` | 一键对齐 + pnpm install |

> 诊断错误解析优先级：`N entries did not activate` → `plugin(s) failed to load: <names>` → `fatal load failure`（用 profile 包名回扫）→ 提示手动定位；`EADDRINUSE`（端口 3080 占用）判为「另一实例运行」非插件故障。

---

## 8B. DSH 插件面板 V2 — 安装状态对账与安装器

将「插件面板」从只读配置声明升级为「配置 ↔ 本机磁盘 ↔ 安装结果」三方对账视图，补齐安装器能力（详见 `PLAN_DSH_PLUGIN_PANEL_V2.md`）：

| 能力 | 实现 |
|---|---|
| P1 全量状态对账 | 条目 = 配置声明 ∪ 本机已装，状态：`ok` / `pending` / `orphan` / `version-mismatch` / `failed` |
| P2 分模式安装 | `incremental` = `pnpm install`；`update` = `pnpm update`；`reinstall-all` / `reinstall-failed` = `pnpm install --force`（二次确认） |
| P3 失败回写 | `%APPDATA%\AgentHub\dsh_install_state.json` 持久化失败状态与堆栈（截断 4KB），磁盘自愈后自动清除 |
| P4 实时终端 | Tauri `Channel<String>` / Web SSE，统一汇入 `store.installTerminal.lines[]`，`DshInstallTerminal.vue` 展示 |

### 状态判定核心规则
- 内置 bundle（`@deepseek-ai/dsh-*`，`kind='inbox'`）整体豁免：不判 pending / orphan / version-mismatch，直接 `ok` 且只读。
- 仅语义化版本 spec（`1.2.3` / `^1.0.0` / `~1.0.0` / `>=1 <2` 等）参与版本对比；`requiredVersion` 优先取 `pnpm-lock.yaml` **`packages:` 段**解析版本，lock 缺失且 spec 为精确号时用 spec。
- 非语义化 spec（tarball / `git+` / `github:` / `link:` / `file:` 等）`requiredVersion = undefined`，永不判 `version-mismatch`。
- 孤儿只扫 profile `node_modules` 顶层直接依赖，排除内置、`.bin` / `.pnpm` / 隐藏目录；孤儿行可「纳入配置」（写入 `link:` 本地路径 + bundles）或移除。
- 版本对比不引入 semver 依赖：lock 解析版本字符串等值对比。

### 安装流水线
```
1. 快照备份：仅 package.json / cordis.patch.yml（不备份 lock）
2. 后端互斥 + 异步执行 pnpm（Rust spawn_blocking；Node 异步 spawn，600s 超时）
3. 逐包 L3 校验：读 node_modules/<pkg>/package.json，
   入口优先 main / exports，其次 dsh.bundle.patch；缺失 → missing-entry
4. 回写 dsh_install_state.json（磁盘 ok 的包清除旧 failed）
5. 生成 DshInstallReport
6. 失败回滚：仅 incremental / update 回滚两个配置文件；
   reinstall-all / reinstall-failed 只回写失败状态
```
`align_dsh_plugins` 内部改为调用 `install(profile, 'incremental')`，失败则回滚对齐前本地配置并抛出报告。

### 同步边界
- `dsh_install_state.json` 位于 skills sync 的 git 根 `%APPDATA%\AgentHub\` 下，**已加入共享 `.gitignore`**（`SYNC_GITIGNORE_CONTENT` / Rust `GITIGNORE_CONTENT` 均含该条目；已有 `.gitignore` 会幂等补齐）。
- 该文件是 AgentHub 自己的运营缓存，不是第二份插件事实源；事实源仍是 `~/.dsh/profiles/<name>/package.json` + `cordis.patch.yml`。

### API 命令表（V2 新增，双端对齐）
| Tauri Command | Web 路由 | 说明 |
|---|---|---|
| `reconcile_dsh_install` | `GET /api/dsh/plugins/install-entries` | 安装状态对账扫描 |
| `install_dsh_plugins_v2` | `POST /api/dsh/plugins/install` | 分模式安装（返回 `DshInstallReport`） |
| `install_dsh_plugins_streamed` | `GET /api/dsh/plugins/install/stream` | 流式安装（Channel / SSE） |
| `clear_dsh_install_state` | `POST /api/dsh/plugins/install-state/clear` | 清除安装失败状态 |

---

## 8C. DSH 配置快照与回滚（WI-006）

把「对齐/安装前的一次性内联快照」扩展为「用户可见的配置快照时间线 + 手动创建 + 一键回滚」，服务 WI-009（DSH 版本升级）的升级前安全点。

### 快照范围与存储
- 快照文件：`~/.dsh/profiles/<name>/` 下的 `package.json` + `cordis.patch.yml` + `pnpm-lock.yaml` + `pnpm-workspace.yaml`。
- 存储目录：应用数据目录 `backups/dsh-profiles/<profile>/<dsh-snap-<ms>>/`，每个快照目录含 `meta.json`（id / createdAt / trigger / note / permanent / profileName / files）与快照文件本身（仅存在于快照时点的文件）。
- 保留策略：最近 20 份非永久快照 + 全部「永久保留」标记；超出自动清理。`backups/` 已加入同步仓库共享 `.gitignore`，不进 Git。
- 回滚只覆盖配置文件、不覆盖 `node_modules`，返回 `needsInstall = true`，UI 提示是否需 `pnpm install` 对齐磁盘。

### 触发来源
- `manual`：用户手动创建（可带备注）。
- `install`：`install_dsh_plugins*` 执行前自动创建（`install_inner` / `installDshPluginsV2`，失败不阻塞安装）。
- `align`：`align_dsh_plugins` 执行前自动创建（`align_dsh_plugins` / `alignDshPlugins`，失败不阻塞对齐）。

### API 命令表（Tauri Command ↔ Web 路由双端对齐）
| Tauri Command | Web 路由 | 说明 |
|---|---|---|
| `create_dsh_config_snapshot` | `POST /api/dsh/plugins/snapshots` | 手动创建快照（`profile` / `note`） |
| `list_dsh_config_snapshots` | `GET /api/dsh/plugins/snapshots?profile=` | 快照时间线 |
| `rollback_dsh_config_snapshot` | `POST /api/dsh/plugins/snapshots/rollback` | 一键回滚（`snapshotId`） |
| `set_dsh_config_snapshot_permanent` | `POST /api/dsh/plugins/snapshots/permanent` | 标记/取消永久保留 |
| `delete_dsh_config_snapshot` | `POST /api/dsh/plugins/snapshots/delete` | 删除单份快照 |

---

## 8D. DSH 版本升级与版本管理（WI-009）

在插件中心新增「DSH 版本」分段页签，把 DSH 本体当作全局 npm 包（`@deepseek-ai/dsh`）管理：查看当前版本、检测远端最新、升级、回滚与版本历史，防止 DSH 升级后插件大面积失效。

### 能力与关键决策
- 当前版本：优先 `dsh --version`（实测），回退 npm 全局包 `package.json`（`npm root -g` + `@deepseek-ai/dsh/package.json`）交叉验证。
- 远端最新：npm registry（Rust 复用 `query_npm_latest`；Node 用 `npm view @deepseek-ai/dsh version`）。
- 升级 / 指定版本安装：`npm install -g @deepseek-ai/dsh@<version|latest>`；升级前对**所有 profile** 自动创建配置快照（复用 WI-006 `create_dsh_config_snapshot`，`trigger=upgrade`）。
- 「插件大面积失效」判定：升级前后各跑一次 `diagnose_dsh_web`（逐 profile），对比失败插件条目数，`after > before` 判定为大面积失效。
- 一键回滚：同时覆盖两层 —— `npm install -g` 装回旧版 + 复用 `rollback_dsh_config_snapshot` 回滚升级前快照。
- 版本历史：`dsh_version_history.json`（App 数据目录，最多 50 条，已入共享 `.gitignore`），记录版本 / 动作（升级/安装/回滚）/ 时间 / 来源版本。

### API 命令表（Tauri Command ↔ Web 路由双端对齐）
| Tauri Command | Web 路由 | 说明 |
|---|---|---|
| `get_dsh_version_info` | `GET /api/dsh/version` | 当前版本 + dsh/npm 命令 |
| `check_dsh_version_update` | `GET /api/dsh/version/check` | 检测远端最新版本 |
| `list_dsh_versions` | `GET /api/dsh/version/history` | 版本历史 |
| `upgrade_dsh_version` | `POST /api/dsh/version/upgrade` | 升级（快照 → 安装 → 诊断对比） |
| `install_dsh_version` | `POST /api/dsh/version/install` | 指定版本安装 / 降级 / 切换 |
| `rollback_dsh_version` | `POST /api/dsh/version/rollback` | 一键回滚（版本 + 配置快照） |

> 升级/降级是全局操作、影响所有 profile，UI 二次确认；诊断对比基于 `diagnose_dsh_web` 的失败插件数。

---

## 8E. 应用日志系统（WI-007）

内置自研轮转文件日志，用于排查启动、扫描、同步、安装、更新等链路问题；日志写入 App 数据目录 `logs/`（与 skills / dsh 快照同源），Rust 与 Node 双端行为完全一致。

### 统一格式与轮转
- 单行格式：`<ISO 本地时间> [LEVEL] [module] message`，LEVEL ∈ DEBUG / INFO / WARN / ERROR，module 覆盖 startup / scan / sync / install / update / dsh / snapshot。
- 活动文件：`logs/agenthub.log`；单文件 ≥ 5MB 触发轮转 `agenthub.log.N`，保留最近 5 份（`.1` 最新，`.5` 最旧，超出删除）。
- 落盘为追加写 + 写入失败静默降级（不阻塞主流程）；`logs/` 已加入技能与 DSH 插件同步仓库 `.gitignore`，不参与跨机同步。
- 时间戳统一为本地时间 `YYYY-MM-DD HH:mm:ss.mmm`（Rust `chrono::Local` / Node `Date` 手写格式化，双端一致）。

### 埋点覆盖
- startup：Rust `init_storage` + `run()`；Node `initLogger()` + `initStorage()`。
- sync：技能同步 `pull_skills_sync` / `push_skills_sync`（Rust + Node 成功/失败）。
- dsh：DSH 插件同步 pull/push、`install_dsh_plugins_v2` / `scan_dsh_plugins` / `create_dsh_config_snapshot`。
- update：应用更新检查 `check_app_update` / `checkAppUpdate`。
- 读取与导出：`export_app_logs` 导出快照时记录目标路径。

### API 命令表（Tauri Command ↔ Web 路由双端对齐）
| Tauri Command | Web 路由 | 说明 |
|---|---|---|
| `get_app_logs` | `GET /api/app/logs` | 读取最近日志（`limit` / `level` 过滤） |
| `export_app_logs` | `GET /api/app/logs/export` | 导出一份日志快照，返回文件路径与大小 |
| `get_app_log_path` | `GET /api/app/logs/path` | 返回日志文件路径（UI 一键复制） |

### UI 与 i18n
- 设置页新增「应用日志」入口，打开 `LogViewerModal.vue`：级别过滤（全部/DEBUG/INFO/WARN/ERROR 分段控件）、刷新、导出、复制日志路径。
- 日志查看器含脱敏提示：日志内容包含本机文件路径与命令输出，分享/导出前需先检查脱敏。
- 中文/英文文案分别落在 `src/locales/zh.ts` / `en.ts` 的 `settings.*` 与 `logs.*` 命名空间。

> 日志为纯文本追加、不加密；导出与查看可能暴露本机路径，UI 已给出脱敏提示，仍请勿在公开渠道直接粘贴完整日志。

---

## 8F. 系统托盘与后台常驻（WI-001）

Tauri 桌面端新增系统托盘与后台常驻能力：关闭主窗口不再退出进程，而是隐藏到托盘后台运行；托盘图标提供「显示主窗口 / 退出」菜单，可唤回主窗口或彻底退出。Web 模式（`npm run dev`）无托盘，此能力仅在 Tauri `setup` 中启用，浏览器模式完全不受影响。

### 实现要点
- **依赖特性**：`src-tauri/Cargo.toml` 的 `tauri` 启用 `tray-icon` feature（`features = ["tray-icon"]`）。
- **托盘创建**：`src-tauri/src/lib.rs::setup_tray` 在 `run()` 的 `setup` 中调用——`TrayIconBuilder` 克隆 `app.default_window_icon()` 作为图标，菜单两项 `显示主窗口` / `退出`；托盘句柄 `app.manage(tray)` 托管到应用状态，避免因局部 drop 被移除。
- **关闭驻留**：`Builder::on_window_event` 拦截 `WindowEvent::CloseRequested` → `api.prevent_close()` + `window.hide()`，应用继续后台运行。
- **托盘唤回**：菜单「显示主窗口」与（Windows/Linux）托盘左键单击复用 `show_main_window`：`unminimize()` + `show()` + `set_focus()`，覆盖最小化/隐藏任意状态。
- **彻底退出**：菜单「退出」→ `app.exit(0)`。
- **埋点**：托盘创建 / 唤回 / 退出 / 关窗驻留均用 WI-007 logger，模块标签 `tray`（`log_info!("tray", ...)`）。

### 平台差异（AGENTS.md §5）
- **Windows**：系统托盘，左键单击唤回主窗口、右键弹出菜单；真机实测。
- **macOS**：菜单栏图标遵循平台默认（左键弹出菜单），代码经 `#[cfg(not(target_os = "macos"))]` 仅对 Windows/Linux 启用「左键单击唤回」。
- **Linux**：`TrayIconBuilder` 代码路径跨平台一致，但托盘依赖 appindicator（`libayatana-appindicator`），`.deb` / `.AppImage` 需在运行时携带该依赖；左键唤回依赖 DE 对 StatusNotifierItem 的支持。

### 与可选增强的边界
- 本次落地为「固定关闭即托盘」，未做 `AppConfig.close_to_tray` 设置开关、`tauri-plugin-single-instance` 单实例与托盘菜单双语（均记录在 PR 说明中作为后续可选增强）。
- 纯桌面端能力，Node Web 端（`src/server/localApi.ts`）不实现、无对齐项。

---

## 8G. 同步中心增强：定时同步 + 同步历史（WI-008）

在同步中心新增「定时同步」与「同步历史」两块能力，补齐原同步三件套的最后两项（冲突可视化解决已随 WI-013 落地）。

### 能力与关键决策
- 定时同步（仅拉取）：`sync_schedule` 配置块挂在 `config.json` 的 `sync_repo` 同级；`mode` 当前仅支持 `interval`（MVP），`enabled` / `intervalMinutes`（最小 5 分钟，默认 30）/ `scopes`（`['skills','dsh']`）三平台一致。
- 调度动作 = 仅 fast-forward 拉取：复用 `pull_skills_sync` / `pull_dsh_plugins_sync`，**禁止自动 push**（push 非幂等且有覆盖风险，仍走手动方向化 UI）。错过触发点不补跑，仅应用运行期间到点触发。
- 调度器双端对齐：Rust 后台线程（`sync_scheduler.rs`，进程级 daemon，随进程退出）+ Node 服务入口 `setInterval`（不 unref）。时间来源 `chrono`（Rust）/ `Date.now()`（Node），不依赖系统 cron / 任务计划程序。
- 单飞守卫：手动与定时共用同一把互斥锁（Rust `sync_guard.rs` / Node `syncFlight.ts`），保证同一时刻只有一个同步动作操作共享 `.git`；忙时跳过本次（下次触发补上），历史记为 `skipped`。
- 配置热生效：`set_sync_schedule` / `setSyncSchedule` 保存后立即重排调度器，无需重启。
- 同步历史：App 数据目录 `sync_history.json`（UTF-8 数组，最新在前，保留最近 100 条，超出裁剪），字段 `id / at / trigger(manual|startup|scheduled) / scope(skills|dsh) / action(pull|push|apply|align|reset) / result(success|error|skipped) / summary / error`；在 Node `updateLastSync` 与 Rust 对应「最后状态」写入点追加，覆盖 pull / push / apply / align / reset。`sync_history.json` 已加入共享仓库 `.gitignore`（双端 7 处 `GITIGNORE_CONTENT` 统一补齐）。
- 摘要来源：pull 用 `ahead/behind`，push 用 `git rev-parse --short HEAD` + branch，apply/align 用处理条目/profile 数，reset 用 `origin/<branch>`。

### API 命令表（Tauri Command ↔ Web 路由双端对齐）
| Tauri Command | Web 路由 | 说明 |
|---|---|---|
| `get_sync_schedule` | `GET /api/sync/schedule` | 读取定时同步配置 |
| `set_sync_schedule` | `POST /api/sync/schedule` | 保存配置并热重排调度器（仅 interval） |
| `get_sync_history` | `GET /api/sync/history` | 读取同步历史（`limit`，默认 50，最新在前） |
| `clear_sync_history` | `DELETE /api/sync/history` | 清空同步历史 |

> 定时同步为「应用运行期间」的静默快进拉取；桌面端配合 WI-001 托盘后台驻留，关窗后仍有效。cron 模式与历史详情展开/一键复制错误为后续可选增强（见 PR 说明）。

---

## 8H. 插件卡片元信息：tag / 备注 / 描述（WI-002）

在 DSH 插件卡片上补齐「描述 / 标签 / 备注」三块信息，其中描述为派生展示、标签与备注为用户自定义并本地持久化。

### 能力与关键决策
- **描述自动回填**：`reconcile_dsh_install`（Rust）/ `reconcileDshInstall`（Node）与 `scan_dsh_plugins` / `scanDshPlugins` 在扫描/对账时读取 `node_modules/<pkg>/package.json` 的 `description` 回填；缺失或未安装（`installed=false`）时兜底为空，UI 不显示该行。
- **tag**：每条插件卡片可增删改多个 tag（上限 10 个、每个 ≤32 字符，去重、超长截断）。
- **备注**：每条插件卡片一条备注（≤500 字符）。
- **持久化边界（锁定）**：tag/note 只写 AgentHub 本地缓存 `dsh_plugin_meta.json`（应用数据目录，与 `dsh_install_state.json` 同级），**不入 `~/.dsh` 事实源、不入同步镜像**；`description` 派生自 package.json，不落缓存。缓存文件已加入同步仓库共享 `.gitignore`（`SYNC_GITIGNORE_CONTENT` / Rust `GITIGNORE_CONTENT` 两处）。

### 数据模型（双端 100% 对齐）
```jsonc
// dsh_plugin_meta.json
{
  "<profile>": {
    "<entry.key>": { "tags": ["..."], "note": "..." }
  }
}
```
- `entry.key` 复用稳定键：`bundle:<pkg>` / `dep:<pkg>` / `row:<id>` / `orphan:<pkg>`，保证重扫后 meta 不丢。
- `DshPluginInstallEntry` 增加 `description?: string`、`tags: string[]`、`note: string`（卡片使用此类型）；`DshPluginEntry` 增加 `description?: string`（scan 也回填，供列表展示）。
- Rust `DshPluginMetaItem { tags, note }` + `DshPluginInstallEntry` / `DshPluginEntry` 字段与 TS 一致（`#[serde(rename, default, skip_serializing_if...)]`）。

### API 命令表（Tauri Command ↔ Web 路由双端对齐）
| Tauri Command | Web 路由 | 说明 |
|---|---|---|
| `set_dsh_plugin_meta` | `POST /api/dsh/plugins/meta` | 保存某条目 tags/note（入参 `profile` + `key` + `tags` + `note`） |

- `description` 无需单独 set：reconcile 时后端回填；meta 直接 merge 进 reconcile 结果，UI 无需单独 get。

### UI 与 i18n
- `DshPluginRow.vue`：列表与卡片形态均展示 description / tag / 备注；新增「编辑标签/备注」弹窗（`Teleport` 到 body，避免卡片 grid 截断）。
- 文案走 `t()` + `src/locales/zh.ts` / `en.ts` 的 `plugins.*` 与 `toast.*` 命名空间。

---

## 9. 后续演进建议与待办清单 (TODO)

- [x] **应用本体在线更新**：支持 GitHub Releases 检查更新、下载（实时进度）与一键安装新版本（Session 48 落地；采用 GitHub Releases API + 安装包直装，无需 Tauri Updater 签名链路）。
- [ ] **MCP Server 配置总线**：扩展多 Agent 的 MCP Server（`claude_desktop_config.json`, `gemini/mcp`, `codex/mcp`）集中可视化管理与共享。
- [ ] **Skills 市场导入**：接入 GitHub / npm skills 生态一键搜索并远程下载至中央库。
- [ ] **CodeMirror 6 嵌入双栏 Diff**：在 ProjectEditor 与 DiffModal 中进一步引入 CodeMirror 6 的 MergeView 实时行级对比。
- [x] **系统托盘与最小化常驻**：Tauri 2.0 增加系统托盘图标、托盘右键菜单与快捷唤起快捷键（WI-001 落地：关闭驻留 + 显示主窗口/退出菜单 + 左键唤回）。

---

## 10. 跨会话接力维护协议

当你在新的会话中完成开发后，请遵循以下三步：
1. **核对改动**：运行 `npm run build` 确保无编译与语法错误；
2. **同步文档**：若新增了 Agent 适配、更新了 JSON 数据结构、新增了组件或改变了交互，**务必在本文档对应章节中记录更新**；
3. **更新版本与变更记录**：在文档末尾记录更新日期与更新简述。

---

### 变更记录 (Changelog)

- **2026-08-25 (Session — WI-002)**:
  - **插件卡片 tag / 备注 / 描述**：新增 §8H 模块；`reconcile`/`scan` 回填 `node_modules/<pkg>/package.json` 的 `description`；卡片支持自定义 tag（≤10 个、每个 ≤32 字符）与备注（≤500 字符）；tag/note 存 AgentHub 本地缓存 `dsh_plugin_meta.json`（不入 `~/.dsh`、不入同步镜像，已入共享 `.gitignore`）；Rust `set_dsh_plugin_meta` 命令 + Node `POST /api/dsh/plugins/meta` 路由 + 前端 `DshPluginRow.vue` 编辑弹窗 + zh/en i18n 双端对齐，版本保持 v1.0.6。
- **2026-08-25 (Session — WI-008)**:
  - **同步中心增强（定时同步 + 同步历史）**：新增 §8G 模块；`sync_schedule` 配置（interval 定时静默快进拉取，禁止 auto-push）+ `sync_history.json` 历史（最新在前，保留 100 条，可查看/清空）；Rust `sync_scheduler.rs` 后台线程 + Node `setInterval` 双端调度、`sync_guard.rs` / `syncFlight.ts` 单飞守卫、`sync_history.rs` / `syncHistory.ts` 历史读写；Rust 4 命令 + Node 4 路由 + 前端 `SyncView.vue` 定时配置区/历史区 + zh/en i18n 双端对齐，版本保持 v1.0.6。
- **2026-08-25 (Session — WI-001)**:
  - **系统托盘与后台常驻**：新增 §8F 托盘模块；`Cargo.toml` 启用 `tray-icon` feature；`lib.rs` 建托盘（`显示主窗口` / `退出`）+ 关窗拦截隐藏驻留 + 左键唤回（Windows/Linux）+ 彻底退出，关键事件用 WI-007 logger 模块标签 `tray` 埋点；纯桌面端能力，Web 模式不受影响，版本保持 v1.0.6（PR 合入）。
- **2026-08-25 (Session — WI-007)**:
  - **应用日志系统**：新增 §8E 日志模块；自研轮转文件日志（`logs/agenthub.log`，单文件 5MB × 保留 5 份）；统一格式 `<时间> [LEVEL] [module] message`；Rust 3 命令 + Node 3 路由 + 前端 `LogViewerModal.vue`（查看/导出/复制路径/级别过滤 + 脱敏提示）+ zh/en i18n 双端对齐，版本保持 v1.0.6。
- **2026-08-24 (Session — WI-009)**:
  - **DSH 版本升级与版本管理**：新增 §8D 版本管理模块；`DshVersionManager.vue` 版本页签 UI（当前/远端版本 + 升级 + 一键回滚 + 版本历史 + 指定版本安装）；升级前自动快照（`trigger=upgrade`）+ 升级后诊断对比失败插件数；回滚覆盖版本 + 配置两层。Rust 6 命令 + Node 6 路由 + 前端 store 动作双端对齐，版本保持 v1.0.6（与 WI-006 同版发布）。
- **2026-08-24 (Session — WI-006)**:
  - **DSH 配置快照与回滚**：新增 §8C 快照模块；`DshConfigSnapshots.vue` 时间线 UI（手动创建 + 触发来源/备注 + 一键回滚 + 永久保留）；安装/对齐前自动快照；保留策略最近 20 份 + 永久保留；`backups/` 入 `.gitignore`。Rust 5 命令 + Node 5 路由 + 前端 store 动作双端对齐，版本升 v1.0.6。
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

- **2026-08-20 (Session 17)**:
  - **DSH 插件中心 (DSH Plugin Manager) 全新落地**:
    - 新增独立「DSH 插件中心」Tab（`PluginsView.vue` + `DshPluginList.vue` / `DshDiagnose.vue` / `DshPluginSync.vue` / `DshPluginDiffModal.vue`），内部三分段 Tab：插件面板 / 诊断修复 / 同步与对账。
    - **F1 启动失败诊断修复**：`diagnose_dsh_web` 拉起 `dsh web` 捕获崩溃 stderr（15s 超时 + `taskkill /T /F` 杀进程树），解析 `N entries did not activate` / `plugin(s) failed to load` / `fatal load failure` 并给出 `remove-bundle` / `remove-dependency` / `disable-row` 建议动作，一键「关闭并重试」；`EADDRINUSE` 判为端口占用非插件故障。
    - **F2 本地插件可视化**：`scan_dsh_plugins` 扫描 `~/.dsh/profiles/*`，分类内置 bundle（`@deepseek-ai/dsh-*`）/ 用户 bundle / 依赖 / patch 行，展示版本、spec、可移植性（`link:` / `file:` / `git+` 标记不可移植），支持分段滑块启停。
    - **F3 配置同步**：仅同步配置文件（`package.json` + `cordis.patch.yml` + `pnpm-lock.yaml`），复用 skills sync 同一 `.git`，镜像到 `dsh/profiles/<name>`，剔除内置 bundle 与不可移植依赖，拉取后 `pnpm install` 自装。
    - **F4 对账**：`reconcile_dsh_plugins` 输出 missing/extra/version/patch 差异 + 不可移植警告，`align_dsh_plugins` 一键对齐（保留本地内置 bundle 与 link: 依赖）并 `pnpm install`。
    - **安全写盘**：`cordis.patch.yml` 只做文本级追加/删除（按 id 去重、保留注释与 `!!js`、绝不 `yaml.dump` 全文件），对齐 duplicate-entry 教训。
    - 类型与数据模型：`types/index.ts`、`models.rs`（Dsh 全量结构 + `AppConfig.dsh_plugins`）、`config.json` 默认块；`api.ts` 新增 12 个 DSH 方法；`useAppStore.ts` 新增 DSH state/actions 并在 `init()` 静默加载。
    - Rust 后端新增 `dsh_plugins.rs` / `dsh_plugins_sync.rs`，Node 后端新增 `dshPlugins.ts`，`vite.config.ts` 新增 `/api/dsh/plugins/*` 路由双端对齐。
    - 验收：`npx tsc --noEmit` 零错误、`npm run build` 零错误零警告；Web 模式实测 `/api/dsh/plugins/scan` 正确识别 `web` profile 与 `@dsh-external/dsh-super-injector`（`link:` 不可移植 + v0.3.3），reconcile 正确标记不可移植警告。
    - 验收：安装 Rust 工具链（rustup `stable-x86_64-pc-windows-msvc`，rustc/cargo 1.97.1），`cargo check`（`src-tauri`）**零错误零警告**通过；MSVC 链接器经 vswhere 自动定位（VS 18 BuildTools 已就绪）。

- **2026-08-20 (Session 18)**:
  - **修正 DSH 技能根目录：`~/.dsh/skills-personal` → `~/.dsh/skills`（方案 1）**:
    - 核对 deepseek-harness master 源码 `packages/skill/skill-filesystem`：DSH 用户级技能根为 `~/.dsh/skills`（user-dsh）与 `~/.agents/skills`（user-agents）；`customSkillDirs` 默认为空，本机 preset 中指向内置 cordis skills，DSH **从不扫描** `~/.dsh/skills-personal`。
    - 修正 Node 端 `localApi.ts`（DSH 默认 `skillsDir`、安装探测、`getAgentSkillDirs` 注释）与 `vite.config.ts` 注释；修正 Rust 端 `agent_detector.rs`、`lib.rs`（`agent_skill_dirs` 改为主目录优先 + 全局去重，不再 `sort` 导致 `.agents` 抢先）、`watcher.rs`（移除 `skills-personal` 死路径监听）。
    - 同步修正 `%APPDATA%\AgentHub\agents.json` 默认值，以及 HANDOVER / README 文档中 DSH 技能目录与多根说明。

- **2026-08-20 (Session 19)**:
  - **同步中心（Skills Sync）可用性根治与诊断增强**:
    - **根因 1 — git 真实报错被吞**：Node 端 `gitExec` 原先 `stdio: ['pipe','pipe','ignore']` 丢弃 stderr，`config.json` 只落盘无意义的 `Command failed: git pull ...`；新增 `src/server/gitSyncUtil.ts` 统一捕获 stderr/stdout 并设置 120s 超时（`localApi.ts` 与 `dshPlugins.ts` 共用），失败时返回真实 fatal 信息。
    - **根因 2 — git 不读 Windows 系统代理**：本机 WinINET 代理 `127.0.0.1:7897` 下 GitHub 直连被 reset，`git ls-remote` 亦失败；新增系统代理探测（环境变量 → `reg query` WinINET），并以 `-c http.proxy / -c https.proxy` 注入所有 git 网络命令，连接恢复秒级可用。
    - **根因 3 — 前端丢弃服务端错误体**：`api.ts requestApi` 原先仅抛 `API error: <statusText>`；改为解析 `{error}` 体透传真实信息，同步/拉取/推送失败提示不再失真。
    - **根因 4 — 本地与远端历史分叉无解**：本地仓库与远端各为独立 root commit 时 `--ff-only` 必然失败；新增 `test_skills_sync_connection`（`ls-remote` 连接自检）与 `reset_skills_sync_to_remote`（`fetch + reset --hard origin/<branch>`，仅覆盖受管 `skills/` 与 `.gitignore`，不触碰 config/agents/projects/backups 私有文件）。
    - **UI 优化**：`SyncView.vue` 错误横幅改为 `whitespace-pre-wrap` 展示多行 stderr + 模式化诊断提示；分叉场景显示「以远端为准（重置本地）」二次确认恢复卡。
    - **双端对齐**：Rust 新增 `src-tauri/src/git_sync.rs`（系统代理探测 + `proxy_args()`），`skills_sync.rs` / `dsh_plugins_sync.rs` 的 `run_git` 统一注入代理；新增 `test_skills_sync_connection` / `reset_skills_sync_to_remote` Tauri Command 并注册。
    - 验收：`npx tsc --noEmit` 零错误、`npm run build` 零错误零警告、`cargo check`（`src-tauri`）零错误零警告。

- **2026-08-20 (Session 20)**:
  - **DSH 插件中心补充「卸载 / 删除」能力**:
    - 在插件面板卡片上新增「卸载」按钮（`Trash2` 图标，非内置插件可用，点击二次确认）。
    - 新增 `remove_dsh_plugin` Tauri Command 与 `POST /api/dsh/plugins/remove` Web 路由，双端对齐：
      - `bundle:` / `dep:` → 从 `package.json` 的 `dependencies` 与 `dsh.profile.bundles` 同时移除，并尽力 `pnpm install` 清理 node_modules（pnpm 失败不影响配置已移除）；
      - `row:` → 从 `cordis.patch.yml` 删除该顶层条目。
    - 与「停用」区分：停用仅从 `bundles` 移除或追加 `disabled:true` patch；卸载则彻底移出依赖声明并清理安装产物。
    - `api.ts` 新增 `removeDshPlugin`，`useAppStore.ts` 新增 `removeDshPlugin` action（卸载后自动重扫 + Toast），`DshPluginList.vue` 接入。
    - 验收：`npx tsc --noEmit` 零错误、`npm run build` 零错误零警告、`cargo check`（`src-tauri`）零错误零警告。

- **2026-08-20 (Session 21)**:
  - **DSH 插件面板 V2：安装状态对账与安装器（PLAN_DSH_PLUGIN_PANEL_V2 落地）**:
    - 新增 `DshPluginInstallEntry` / `DshInstallFailure` / `DshInstallReport` / `DshInstallMode` / `DshPluginInstallStatus` 数据模型（TS + Rust `models.rs` 双端对齐）。
    - P1 全量状态对账：`reconcile_dsh_install`（Rust）/ `reconcileDshInstall`（Node）按「配置声明 ∪ 本机已装」生成 `ok / pending / orphan / version-mismatch / failed` 状态；内置 bundle 整体豁免；版本对比仅限语义化 spec 且只扫 `pnpm-lock.yaml` 的 `packages:` 段；孤儿只扫顶层 node_modules 并排除 `.bin` / `.pnpm` / 隐藏目录。
    - P2 分模式安装：`install_dsh_plugins_v2`（Rust）/ `installDshPluginsV2`（Node）支持 `incremental / update / reinstall-all / reinstall-failed`，异步执行 pnpm（Rust `spawn_blocking`；Node 异步 `spawn`，600s 超时）。
    - P3 失败回写：新增 `%APPDATA%\AgentHub\dsh_install_state.json` 持久化（独立文件，不塞 config.json），L3 入口校验（main/exports/dsh.bundle.patch）+ 失败堆栈截断 4KB；磁盘自愈自动清除陈旧 failed；`incremental/update` 失败回滚 package.json / cordis.patch.yml。
    - P4 实时终端：`install_dsh_plugins_streamed`（Tauri `Channel<String>`）+ `GET /api/dsh/plugins/install/stream`（Web SSE），新增 `DshInstallTerminal.vue`（`font-mono` 日志 + 自动滚动 + 状态行）。
    - `DshPluginList.vue` 改造：状态徽章（绿/琥珀/红语义色）、spec/installed/required 三列对比、四个安装按钮 + 终端开关、失败堆栈弹窗、孤儿移除 / 纳入配置。
    - `align_dsh_plugins`（Rust/Node）内部改为调用 incremental 安装并拿报告，失败回滚对齐前本地配置。
    - 同步安全：`dsh_install_state.json` 加入共享 `.gitignore`（Rust/Node 双端；已有 `.gitignore` 幂等补齐），避免被 skills sync `git add -A` 推送到远端。
    - 验收：`npx tsc --noEmit` 零错误、`npm run build` 零错误零警告、`cargo check`（`src-tauri`）零错误零警告。

- **2026-08-20 (Session 22)**:
  - **DSH 插件面板 V2 分组化 UI 重构**:
    - `DshPluginList.vue` 从平铺大卡片改为「健康摘要条 + 分组分区 + 区内列表行」的 macOS 设置列表布局。
    - 新增 6 格健康摘要条（正常 / 待装 / 版本冲突 / 失败 / 孤儿 / 不可移植）。
    - 分组展示：官方内置插件（`@deepseek-ai/dsh-*` chips 网格，只读）、用户插件·可移植、用户插件·本地开发（琥珀描边）、Patch 配置行、孤儿安装（红色描边）。
    - 行内三列版本对比（spec / installed / required），版本冲突与失败红色高亮，失败行附「查看失败堆栈」。
    - 轻量子组件改为本文件内 `defineComponent` 渲染函数（`PluginRow` / `SegmentedToggle` / `IconButton`），避免为小组件单独建文件。
    - 同步镜像（Node `snapshotLocalToMirror` / `alignDshPlugins` 与 Rust `snapshot_local_to_mirror` / `align_dsh_plugins`）新增 `pnpm-workspace.yaml` 文件同步，确保 git 安装依赖所需的 `allowBuilds`（pnpm 10+ 安全白名单）可跨机复现。
    - 修复插件面板 watcher 注册顺序导致的「profiles 已加载时不拉取对账数据」竞态：先注册 `selectedProfile` 监听（`immediate`）再注册 `profiles` 监听（`immediate`）。
    - 孤儿检测过滤 pnpm `hoistedLocations`（`.modules.yaml`）：顶层 `node_modules` 中被 pnpm 主动提升的传递依赖（如 `dsh-notification` -> `zod`）不再误判为孤儿，避免误删运行时依赖。
    - 验收：`npx tsc --noEmit` 零错误、`npm run build` 零错误零警告、`cargo check`（`src-tauri`）零错误零警告。

- **2026-08-20 (Session 23)**:
  - **DSH 插件面板 V2 单包更新检查 / 更新**:
    - 新增 `DshPluginUpdateCheck` 数据模型（TS + Rust `models.rs`），可移植插件行尾新增「检查更新」按钮；发现更新时显示琥珀色「可更新：<current> → <latest>」并出现「更新」按钮。
    - `check_dsh_plugin_update`（Rust）/ `checkDshPluginUpdate`（Node）：支持 `git+https:` / `github:` 规格，`git ls-remote HEAD` 与 `pnpm-lock.yaml` importers 段当前 commit 对比；先直连，失败再注入系统代理（兼顾 gh-proxy 与 GitHub 直连）。
    - `update_dsh_plugin`（Rust）/ `updateDshPlugin`（Node）：单包 `pnpm update <pkg>`，复用 L3 校验 + 安装状态回写 + 失败回滚两个配置文件，返回 `DshInstallReport`。
    - Web 路由新增 `POST /api/dsh/plugins/check-update` 与 `POST /api/dsh/plugins/update`；`api.ts` / `useAppStore` / `DshPluginList.vue` 接入。
    - 验收：`npx tsc --noEmit` 零错误、`npm run build` 零错误零警告、`cargo check`（`src-tauri`）零错误零警告；Web 模式实测 `bundle:dsh-context-doctor` 检查更新返回 `updateAvailable:false, current=a15e68d`。

- **2026-08-20 (Session 24)**:
  - **安装流水线 L3 判定修正（pnpm 非 0 退出 ≠ 全部失败）**:
    - 根因：pnpm 11 对 `cpu-features` / `node-pty` / `ssh2` 等原生依赖默认拦截构建脚本，报 `ERR_PNPM_IGNORED_BUILDS` 并以非 0 退出；但包实际已安装（176 packages added）。旧流水线把全部声明包标为 `non-zero-exit` 失败。
    - 修复：Node `installDshPluginsV2` / Rust `install_inner` 改为以 L3 入口校验为最终判定——L3 通过即计入 `installed` 并清除旧失败状态；pnpm 非 0 退出仅作为 `warnings` 保留；新增 `parseIgnoredBuilds`（Node/Rust）解析 `Ignored build scripts:` 并提示在 `pnpm-workspace.yaml` 的 `allowBuilds` 中放行。
    - 本机 `~/.dsh/profiles/web/pnpm-workspace.yaml` 已把 `cpu-features` / `node-pty` / `ssh2` 加入 `allowBuilds`，`pnpm install` 重新执行成功；`dsh_install_state.json` 已清空，12 个对账条目全部 `ok`。
    - 验收：`npx tsc --noEmit` 零错误、`npm run build` 零错误零警告、`cargo check`（`src-tauri`）零错误零警告。

- **2026-08-20 (Session 25)**:
  - **同步中心整合 DSH 插件同步，同仓库按功能分开同步/拉取/推送**:
    - `SyncView.vue` 新增分段 Tab（技能同步 / DSH 插件同步），内嵌 `DshPluginSync.vue` 与 `DshPluginDiffModal.vue`；`PluginsView.vue` 移除「同步与对账」Tab，DSH 插件同步统一收口到同步中心。
    - 按功能隔离提交：技能推送只 `git add -A -- skills .gitignore`，DSH 插件推送只 `git add -A -- dsh .gitignore`（Rust/Node 双端），不再出现 `git add -A` 把对方改动卷进同一 commit。
    - 按功能隔离未提交修改统计：`get_skills_sync_status` 只统计 `skills/.gitignore`，`get_dsh_plugins_sync_status` 只统计 `dsh/.gitignore`；拉取前脏检查同样按范围隔离，技能拉取不再被 DSH 插件未提交改动阻塞（反之亦然）。
    - 技能分叉恢复从 `git reset --hard` 改为 `git reset --mixed + git checkout -- skills .gitignore`，以远端为准时不再覆盖同一仓库内 `dsh/` 等其他功能的本地改动。
    - 共享 `.gitignore` 统一：skills sync 的 `GITIGNORE_CONTENT` 补齐 `dsh_install_state.json`，且两端 `ensure_gitignore` 均幂等补齐缺失条目。
    - `DshPluginSync.vue` 未配置远端时回退到技能同步的 remote/branch，避免同仓库维护出两套 origin。
    - `useAppStore.init()` 补齐 DSH 插件启动自动拉取（`dsh_plugins.sync.autoPullOnStartup`）。
    - 验收：`npx tsc --noEmit` 零错误、`npm run build` 零错误零警告、`cargo check`（`src-tauri`）零错误零警告。

- **2026-08-20 (Session 26)**:
  - **同步仓库配置上收为全局配置 + 校验门禁**:
    - `config.json` 新增顶层 `sync_repo`（`remoteUrl` / `branch` / `validatedAt` / `lastError`），技能同步与 DSH 插件同步不再各自维护 remote/branch；旧 `skills_sync` / `dsh_plugins.sync` 中的 remote/branch 字段保留但仅作回退。
    - 新增 `src-tauri/src/sync_repo.rs`（Rust）与 `src/server/syncRepo.ts`（Node），提供 `get_sync_repo_config` / `validate_sync_repo` / `save_sync_repo`；Web 路由新增 `GET /api/sync/repo`、`POST /api/sync/repo/validate`、`POST /api/sync/repo`。
    - 校验门禁：`validate_sync_repo` 执行 `git ls-remote --symref` 探测默认分支 → `git ls-remote refs/heads/<branch>` 校验连通性与仓库非空 → 浅克隆到临时目录校验根目录必须包含 `skills/` 与 `dsh/` 目录；连通性失败 / 分支不存在（未初始化）/ 格式不符均返回明确错误，只有校验通过才能保存并启用同步。
    - `save_sync_repo` 校验通过后初始化/校正本地共享仓库（`%APPDATA%\AgentHub\.git` + origin + fetch 基线），并同步旧配置块中的 remote/branch。
    - `Navigation.vue`：未配置全局仓库时「同步中心」Tab 置灰禁用，title 提示去全局设置配置；`SyncView.vue` 增加未配置守卫页（打开全局设置）。
    - `SettingsModal.vue` 新增「同步仓库配置（全局）」区：仓库 URL + 分支 + 「连通性校验 / 初始化校验」按钮 + 「保存仓库配置」按钮；校验未通过或校验后修改过 URL/分支时保存按钮禁用。
    - `SyncView.vue` / `DshPluginSync.vue` 移除各自的初始化表单，未初始化本地仓库时提示到全局设置重新保存。
    - 验收：`npx tsc --noEmit` 零错误、`npm run build` 零错误零警告、`cargo check`（`src-tauri`）零错误零警告。

- **2026-08-20 (Session 27)**:
  - **DSH 插件面板新增孤儿「纳入配置」**:
    - 新增 `adopt_dsh_orphan`（Rust）/ `adoptDshOrphan`（Node）命令：把本机 link/junction 安装的孤儿包写回 profile `package.json`——`dependencies` 写入 spec，`dsh.profile.bundles` 加包名。
    - **可移植优先**：孤儿源目录为 git 仓库且 `origin` 为 http(s) 时，自动写入 `git+http(s)://...`（pnpm 会归一化为 `github:owner/repo`）；否则回退为 `link:<canonicalize/realpath 目标>`。
    - 安全边界：仅接受链接目标位于 `node_modules` 之外的本地安装（canonicalize/realpath 后比较），并校验目标 `package.json` 的 `name` 与包名一致；pnpm 实体目录 / 传递依赖不会误纳管。
    - Windows 兼容：Rust `local_link_spec` 去掉 `canonicalize` 产生的 `\\?\` 前缀并转正斜杠，`UNC` 前缀还原为 `//server/share`。
    - Web 路由新增 `POST /api/dsh/plugins/adopt-orphan`；`api.ts` / `useAppStore` / `DshPluginList.vue` 接入；孤儿行新增「纳入配置」按钮（蓝色语义，与红色移除并列）。
    - 本机实操：`@dsh-external/dsh-better-input-box` 已改为可移植纳管（`github:Nomit8088/dsh-better-input-box` + bundles）；插件仓库补齐 `lib/` 构建产物并推送（commit `78dca5f`），`pnpm-lock.yaml` 已锁定该 commit，`node_modules` 由 pnpm 管理（含 `lib/index.js`）。
    - 本机实操：`@dsh-external/dsh-diff-review` 已改为可移植纳管（`github:Nomit8088/dsh-diff-review` + bundles）；插件仓库自带 `prepare: node scripts/build.mjs`，安装时构建 `lib/`；已按 pnpm 报错把该 git 包加入 profile `pnpm-workspace.yaml` 的 `allowBuilds`（commit `fe87698`），`pnpm-lock.yaml` 已锁定，`node_modules` 由 pnpm 管理（含 `lib/index.js`）。
    - 验收：`npx tsc --noEmit` 零错误、`npm run build` 零错误零警告、`cargo check`（`src-tauri`）零错误零警告。

- **2026-08-20 (Session 28)**:
  - **cc-switch 式小窗口与全站紧凑化布局重构**:
    - `src-tauri/tauri.conf.json` 默认窗口从 `1280×860`（min `1024×700`）调整为 `960×640`（min `760×520`）并居中启动，贴近 cc-switch 小窗形态。
    - `Header.vue` 高度 `h-14 → h-12`，品牌区紧凑化，状态徽章仅在 `lg+` 大窗展示，小窗自动隐藏避免拥挤；扫描按钮小窗仅显示图标。
    - `Navigation.vue` Tab 文案全面短标签化（大厅 / 技能 / 同步 / 插件 / 项目 / 待纳管），Tab 列表支持小窗横向滚动不换行；右侧快捷操作在小窗仅显示图标（`xl` 才显示文字）。
    - `AgentsView.vue` / `SkillsMatrix.vue` / `ProjectsView.vue` / `PluginsView.vue` / `SyncView.vue` 统一 `p-6/p-5 → p-4`，卡片网格从 `lg:grid-cols-3` 调整为 `xl:grid-cols-3`（960 小窗下保持 2 列，避免信息熵过密）；Agent 卡片与项目侧栏同步收紧。
    - Skills Matrix 表格列 `min-w` 压缩（已挂载 Agent 列 `340px → 200px` 等），小窗下横向滚动距离显著减小。
    - 弹窗兜底：`SettingsModal.vue` / `AddAgentModal.vue` / `AddProjectModal.vue` 增加 `max-h-[85vh] overflow-y-auto`，小窗不裁切。
  - **DSH 插件面板筛选 + 可展开行重构**:
    - 新增 `DshPluginRow.vue`：插件行默认仅显示状态点 / 名称 / 类型与状态徽章 / 启停开关 / 展开箭头；`spec / installed / required` 与「检查更新 / 更新 / 卸载 / 失败堆栈」等操作统一点击展开后展示，异常状态（failed / version-mismatch / 可更新）自动展开。
    - `DshPluginList.vue` 新增筛选工具栏：插件名 / spec / key 模糊搜索 + 状态筛选（全部/正常/待装/版本冲突/失败/孤儿）+ 类型筛选（全部/内置/bundle/依赖/patch 行），分组计数支持「筛选后/总数」展示，无匹配时给出空态与重置入口。
    - 健康摘要条与各分组保留全量统计，不受筛选影响；筛选只影响列表展示。
    - 验收：`npx tsc --noEmit` 零错误、`npm run build`（Vite 生产构建）零错误零警告。

- **2026-08-20 (Session 29)**:
  - **Agent Hub 大厅小窗信息密度与页签化重构**:
    - `AgentsView.vue` 改为分段页签切换：`[ 已启用 (N) | 未启用 (N) ]`，同一时间只展示一类 Agent 列表，避免小窗下双区堆叠导致的长时间滚动；搜索框只作用于当前页签，页签计数随搜索结果实时变化。
    - `AgentCard.vue` 从大卡片重构为紧凑列表行卡片：单行展示品牌图标、名称、状态、启停开关与快捷操作，第二行以 3 列摘要展示「技能目录 / 私有规则 / Junction·Hardlink 类型」，使 960 小窗下无需横向滚动即可看完关键配置；未启用卡片同步紧凑化。
    - 列表由双列网格改为单列紧凑列表，Agent 数量多时纵向信息密度提升约 2~3 倍。
    - 验收：`npx tsc --noEmit` 零错误、`npm run build`（Vite 生产构建）零错误零警告。

- **2026-08-20 (Session 30)**:
  - **技能管理合入大厅，技能页签聚焦中央技能库（小窗同屏）**:
    - `AgentsView.vue` 大厅新增第三分段页签「待纳管 (N)」，原技能页签顶部的 `UnmanagedGroupSection` 整体迁移至此；搜索框仅作用于已启用/未启用页签，待纳管页签使用组件自带搜索/筛选/排序。
    - `AgentCard.vue` 启用卡片新增可展开「技能分发管理」：展开后直接勾选/取消中央技能完成对该 Agent 的挂载/卸载，支持「全部挂载 / 全部卸载」，列表内实时显示已挂载/未挂载状态；原「配置技能分发」按钮改为「打开中央技能库」。
    - `SkillsMatrix.vue` 移除 `UnmanagedGroupSection` 与表格/卡片中的「已挂载 Agent 目标」药丸列（`AgentPillPicker` / `AgentBrandIcon` 不再在技能页签使用），表格压缩为 5 列（选择/名称/版本来源/全局分发状态/操作），全局分发状态列下方显示「已分发 N 个 Agent」；卡片视图底部只显示紧凑分发计数。
    - `Navigation.vue` 移除独立「待纳管」Tab，大厅 Tab 在存在待纳管时以橙色徽章显示待纳管数量；`App.vue` 将 `unmanaged` 路由至大厅。
    - 效果：技能页签只保留中央技能库，小窗下无需滚动即可同屏完成搜索、筛选与技能管理；按 Agent 维度的技能分发与存量纳管全部收口到大厅。
    - 验收：`npx tsc --noEmit` 零错误、`npm run build`（Vite 生产构建）零错误零警告。

- **2026-08-20 (Session 31)**:
  - **Agent 恢复卡片形式，待纳管信息合并进 Agent 卡片（去掉第三页签）**:
    - `AgentsView.vue` 移除「待纳管」第三分段页签，恢复 `[ 已启用 | 未启用 ]` 两页签；Agent 列表恢复为卡片网格（`sm:2 / md:3 / xl:4` 列），小窗 960 下 3 列、大窗 4 列。
    - 保留全局「一键纳管全部 (N)」快捷入口（顶部工具栏，有待纳管时显示）。
    - `AgentCard.vue` 参考原纳管卡片样式重构为卡片：头部品牌图标 + 名称 + 状态 + 启停开关；卡片内直接展示技能目录路径，并新增三枚可点击徽章——**「N 待纳管 / 存量受控」**（点击打开 AgentDetailModal 待纳管页签）、**「N 忽略」**（点击打开已忽略页签）、**「N 已挂载」**（点击展开技能分发管理）。
    - 技能分发管理（勾选中央技能挂载/卸载、全部挂载/全部卸载）保留在卡片内展开区。
    - `UnmanagedGroupSection.vue` 不再被引用（功能已并入 AgentCard + AgentDetailModal），组件文件保留但标记弃用。
    - 验收：`npx tsc --noEmit` 零错误、`npm run build`（Vite 生产构建）零错误零警告。

- **2026-08-20 (Session 32)**:
  - **技能分发改为点击弹窗管理（与纳管卡片一致）**:
    - `AgentCard.vue` 移除卡片内展开式技能分发区；「N 已挂载」徽章点击直接调用 `store.openAgentDetailModal(agentId, 'skills')` 打开弹窗，与「待纳管 / 忽略」徽章的交互一致。
    - `AgentDetailModal.vue` 新增第三页签「中央技能分发」：展示中央技能库列表，勾选即可对该 Agent 挂载 / 卸载，支持「全部挂载 / 全部卸载」、弹窗内搜索技能名称/描述；底部提示文案随页签动态切换（Junction / Hardlink）。
    - `useAppStore.ts` 的 `agentDetailModal.activeTab` 与 `openAgentDetailModal` 签名扩展为 `'unmanaged' | 'ignored' | 'skills'`。
    - 验收：`npx tsc --noEmit` 零错误、`npm run build`（Vite 生产构建）零错误零警告。

- **2026-08-20 (Session 33)**:
  - **Agent 卡片统一管理入口 + 状态标签只读化**:
    - `AgentCard.vue` 将「待纳管/存量受控」「忽略」「已挂载」三枚可点击徽章改为**只读状态标签**，仅保留颜色语义与 `title` 悬浮提示（解释各自含义），不再单独可点，避免误触与认知负担。
    - 卡片底部新增**统一「技能管理」按钮**（FolderSearch + 文案 + ChevronRight），点击打开 AgentDetailModal：有待纳管时默认进入「待纳管」页签，否则默认进入「中央技能分发」页签。
    - 移除卡片内零散的技能库跳转按钮，保持卡片尺寸与页面可读性。
    - 验收：`npx tsc --noEmit` 零错误、`npm run build`（Vite 生产构建）零错误零警告。

- **2026-08-20 (Session 34)**:
  - **同步页签排序调整 + 未配置可进入 + 共享仓库状态重构**:
    - `Navigation.vue` Tab 顺序调整为 **大厅 / 技能 / 插件 / 项目 / 同步**；同步 Tab 不再因未配置仓库而置灰禁用，始终可点击进入。
    - `SyncView.vue` 未配置仓库时展示守卫页：说明当前仓库未配置，并给出**仓库格式规范指引**（根目录必须含 `skills/` 与 `dsh/`、目录用途、HTTPS/私有仓库凭据建议、本地仓库路径与只同步范围），附「打开全局设置配置仓库」按钮。
    - `SyncView.vue` 重构同步展示逻辑，去掉顶部「技能同步 / DSH 插件同步」分段页签切换：
      - 顶部为**共享仓库状态卡**（初始化状态 / 当前分支 / 领先 / 落后 / 远端 URL / 测试连接），技能与 DSH 插件复用同一 Git 仓库，不再各自重复展示。
      - 下方为**技能同步 / DSH 插件同步双功能卡片并排**（`xl` 双列，小窗单列）：技能卡片展示未提交修改、最后同步、拉取/推送、自动拉取开关、分叉恢复与错误横幅；DSH 卡片展示未提交修改与最后同步，并内嵌 `DshPluginSync.vue` 的拉取/推送/自动拉取/配置对账。
    - `DshPluginSync.vue` 新增 `showRepoStatus` prop（默认 true），嵌入同步页时设为 false 隐藏内部仓库状态卡，避免与共享状态卡重复。
    - 验收：`npx tsc --noEmit` 零错误、`npm run build`（Vite 生产构建）零错误零警告。

- **2026-08-20 (Session 35)**:
  - **同步页视觉层次重构（主视觉仓库卡 + 彩色功能卡）**:
    - `SyncView.vue` 将普通「仓库状态」卡升级为**主视觉仓库卡**：蓝色顶部标识线 + 大尺寸 GitBranch 图标 + 仓库 URL 副标题 + 状态徽章 + 三格统计条（分支/领先/落后），成为页面视觉中心。
    - **技能同步卡**改为蓝色标识（顶部蓝色标识线 + 蓝色图标头 + `skills/` 路径标签）；**DSH 插件同步**改为紫色标识（紫色图标头 + `dsh/` 路径标签），两者差异一目了然。
    - `DshPluginSync.vue` 操作卡同步改为紫色标识头部（`同步操作`），与同步页 DSH 分区呼应。
    - 状态语义色保持绿色/橙色/红色，品牌标识色（蓝/紫）只用于功能区分，不干扰状态判断。
    - 验收：`npx tsc --noEmit` 零错误、`npm run build`（Vite 生产构建）零错误零警告。

- **2026-08-20 (Session 36)**:
  - **DSH 插件面板展示逻辑重构（消除多轴重叠与工具栏堆叠）**:
    - **根因**：原面板同时铺开「来源（kind/portability）」与「健康（status）」两套正交分类轴——「孤儿」「不可移植」既是分区、又是筛选选项、又是健康摘要格，观感混乱；且内容前堆叠 4 条工具栏（profile / 安装 / 筛选 / 摘要）。
    - **单条 sticky 操作栏**：合并 profile 下拉 + 搜索 + 视图切换 + 安装下拉 + 终端开关为一条 sticky 操作栏，首屏内容区立即露出。
    - **双视图单一主轴**：新增 `[ 按来源 | 按状态 ]` 分段切换。按来源 = 官方内置 / 用户·可移植 / 用户·本地开发 / Patch 行 / 孤儿；按状态 = 正常 / 待装 / 版本冲突 / 失败 / 孤儿。同一时刻只让一个轴当分区主角，另一轴退化为行内「单一徽章」。
    - **健康胶囊行**：以「全部/正常/待装/版本冲突/失败/孤儿」可点击胶囊替代原 6 格摘要条，点击即按状态筛选；移除「不可移植」独立格（已由分区承载）。
    - **统一行组件**：`DshPluginRow.vue` 固定列（状态点 / 图标 / 名称+单一徽章 / 内联 spec·installed·required / 启停 / 操作），默认平铺版本列、移除点击展开机制；内置只读、孤儿提供「纳入配置/移除」、patch 行提供「删除」，操作图标常驻。
    - 移除 `kindFilter` 下拉（来源靠分组与徽章表达），搜索与状态筛选保留。
    - 验收：`npx tsc --noEmit` 零错误、`npm run build`（Vite 生产构建，6.3s）零错误零警告。

- **2026-08-21 (Session 37)**:
  - **DSH 插件同步/安装链路加固（修复本机增量安装失败与 186 孤儿）**:
    - **根因**：一次「一键对齐」安装失败后，回滚仅还原 `package.json`/`cordis.patch.yml`，未清理失败安装写入的 `node_modules`，且 `.modules.yaml` 陈旧，导致对账把 10 个插件及其传递依赖全部误判为孤儿（186 个）；同时本机直连 GitHub 的 tarball/git spec 被 reset，增量安装报 `missing-entry` 失败。
    - **镜像 lock 清洗**：Node `snapshotLocalToMirror` 与 Rust `snapshot_local_to_mirror` 在复制 `pnpm-lock.yaml` 前先做文本级清洗（`sanitizeLockForMirror` / `sanitize_lock_for_mirror`），剔除 `link:`/`file:`/`workspace:`/`portal:`/`catalog:`/`git+ssh:`/`ssh:`/`git@` 等不可移植条目引用，杜绝本机路径/死链漏进同步镜像。
    - **pnpm 注入系统代理**：Node `runPnpmStream` 与 Rust `run_pnpm_streaming` 统一把 `detectSystemProxy()` / `git_sync::system_proxy()` 探测到的代理注入 `HTTP_PROXY`/`HTTPS_PROXY`，与 git 命令对齐，修复本机直连 GitHub 被 reset 的问题。
    - **失败回滚后重对账 node_modules**：Node `installDshPluginsV2`/`updateDshPlugin`/`alignDshPlugins` 与 Rust `install_inner`/`update_one_inner`/`align_dsh_plugins` 在回滚配置后 best-effort 重跑 `pnpm install` 剪枝（`reconcileNodeModules` / `reconcile_node_modules`），避免残留包被误判为孤儿。
    - **本机运维修复**：`~/.dsh/profiles/web` 恢复远程 10 插件 + 保留 `dsh-super-injector`（改 `ghproxy.net` 反代 tarball）+ 内置 bundle；清空 `node_modules` 干净重装（+195 包，原生构建全过）；`dsh_install_state.json` 清空；孤儿 186→0；镜像 lock 清掉死链并 push（commit `f1c4188`）。
    - 验收：`npx tsc --noEmit` 零错误、`npm run build` 零错误零警告、`cargo check`（`src-tauri`）零错误零警告。

- **2026-08-21 (Session 38)**:
  - **DSH 插件面板补充「列表/卡片」视图切换与「官方插件/用户插件」区分显示**:
    - **列表/卡片切换**：参照技能页签，在 sticky 操作栏新增 `[列表|卡片]` 图标分段切换（`List`/`LayoutGrid`），`viewMode` 持久化至 `localStorage('dsh_plugins_view_mode')`（默认列表）。
    - **卡片形态**：`DshPluginRow.vue` 新增 `layout: 'list' | 'card'` 属性，卡片以网格呈现（`sm:2 / xl:3` 列），顶部状态点/图标/名称+徽章+启停、中部内联 spec·installed·required、底部操作图标，复用同一套 badge/dot/action 判定逻辑。
    - **官方插件/用户插件区分**：「按来源」视图按官方/用户维度分组——「官方插件」（`@deepseek-ai/dsh-*`，蓝色标识 + 只读）与「用户插件 · 可移植 / 用户插件 · 本地开发」；inbox 行徽章由「内置」改为「官方」，与「官方插件/用户插件」术语对齐（「按状态」视图中官方/用户同样靠徽章区分）。
    - 验收：`npx tsc --noEmit` 零错误、`npm run build`（Vite 生产构建，2.1s）零错误零警告。

- **2026-08-21 (Session 39)**:
  - **DSH 插件面板：展示顺序调整 + 用户插件卡片分页**:
    - **展示顺序**：「按来源」视图将「官方插件」移到「用户插件 · 可移植 / 本地开发」之下，顺序为 用户插件(可移植) → 用户插件(本地开发) → 官方插件 → Patch 配置行 → 孤儿安装。
    - **用户插件分页**：用户插件分区（可移植/本地开发）在列表与卡片视图下均启用分页，默认每页 10 个（`pageSize`），底部渲染「« ‹ 页码 › » + 每页条数选择器 [5/10/20/50/100]」分页条；页码可点选、当前页绿色高亮，超过 7 页自动收缩为「1 … 当前±2 … N」；官方插件/ Patch/ 孤儿分区不分页。切换 profile / 搜索 / 状态筛选 / 每页条数时自动重置到第 1 页，并对越界页做钳制。
    - 验收：`npx tsc --noEmit` 零错误、`npm run build`（Vite 生产构建，2.1s）零错误零警告。

- **2026-08-21 (Session 40)**:
  - **同步页签卡片对称化 + 本地↔远端文件差异面板 + DSH 配置对账归属明确化**:
    - **卡片对称化**：`SyncView.vue` 将「DSH 插件同步」从右上角小字（`未提交 N · 时间`）升级为与「技能同步」完全同构的紫色卡片——顶部紫色标识头（Puzzle 图标 + 标题 + `dsh/` 路径标签 + 状态徽章）+「未提交修改 / 最后同步」双状态框 + 拉取/推送 + 启动自动拉取分段开关 + 错误横幅；两个功能卡在 `xl` 双列下并排、小窗单列。
    - **本地 ↔ 远端 文件差异面板**：两张功能卡各新增「本地 ↔ 远端 文件差异」面板，按 `skills/` 或 `dsh/` 范围计算本地工作区/提交与已知远端 `origin/<branch>` 的文件级差异（`git diff origin/<branch>...HEAD` + `HEAD...origin/<branch>` + `status --porcelain`），逐条展示「状态点（绿=新增/琥珀=修改/红=删除）+ 方向箭头（↑本地 / ↓远端 / ⇅双向）+ 路径」，空态提示「与远端无文件差异」。不做网络 fetch，复用最近一次 pull/push/fetch 后的远端引用。
    - **DSH 配置对账归属明确化**：`DshPluginSync.vue` 从「同步操作 + 对账」复合卡重构为单一的「DSH 插件配置对账」卡——紫色顶部标识 + `GitCompare` 图标 + 标题「DSH 插件配置对账」+ 副标题「本地 `~/.dsh` ↔ 同步镜像 `dsh/`」+ `dsh/` 标签，明确其对账对象是 DSH 插件配置而非技能；拉取/推送/自动拉取上收至 SyncView 的 DSH 同步卡。
    - **双端对齐**：新增 `SyncDiffEntry` 数据模型（TS + Rust `models.rs`）；Node `gitSyncUtil.computeGitSyncDiff` 与 Rust `git_sync::sync_diff` 共用同一套差异计算逻辑；新增 `GET /api/skills/sync/diff`、`GET /api/dsh/plugins/sync/diff` Web 路由与 `get_skills_sync_diff`、`get_dsh_plugins_sync_diff` Tauri Command；`api.ts` / `useAppStore` 增加 `skillsSyncDiff` / `dshPluginsSyncDiff` 状态与 `loadSkillsSyncDiff` / `loadDshPluginsSyncDiff`（拉取/推送/重置后自动刷新）。
    - 验收：`npx tsc --noEmit` 零错误、`npm run build`（Vite 生产构建）零错误零警告、`cargo check`（`src-tauri`）零错误零警告。

- **2026-08-21 (Session 41)**:
  - **DSH 插件页视觉细节丰富（在 macOS Vibrancy 规范内增补品牌色与分区强调）**:
    - **头部品牌化**：`PluginsView.vue` 顶部新增紫色（`#bf5af2`，DSH 品牌色）图标容器（Puzzle 图标 + `/10` 底 + `/20` 边框）+ 标题旁的「N profile」紫色胶囊徽章，替代原先纯文本标题，呼应同步页 DSH 紫色标识体系。
    - **分区头部彩色图标瓦片**：`DshPluginList.vue` 每个分组（按来源 / 按状态）标题前新增 24px 彩色图标瓦片（`w-6 h-6 rounded-md`，语义色 `/10` 底 + `/20` 边框 + 语义色图标），并配以彩色副标题——可移植（绿 `Globe`）、本地开发（琥珀 `Wrench`）、官方插件（蓝 `Shield`）、Patch 配置行（紫 `ListTree`）、孤儿（红 `Unlink`）；按状态视图：正常（绿 `CheckCircle2`）、待装（琥珀 `Clock`）、版本冲突/失败（红 `AlertTriangle`/`XCircle`）、孤儿（红 `Unlink`）。
    - **分区卡片顶部强调线**：列表视图分组卡片从「全边框着色」改为「1px 发丝线 + 顶部 1px 语义色强调线」（`border border-black/8 dark:border-white/8 border-t-[语义色]/60`），与同步页功能卡顶部标识线保持一致，避免大面积边框着色、贴合规范「语义色仅用于强调」。
    - 严格遵守规范红线：无渐变、无粗边框、无大圆角、无悬停位移、双主题 `dark:` 全覆盖、标题 `font-serif`。
    - 验收：`npx tsc --noEmit` 零错误、`npm run build`（Vite 生产构建）零错误零警告。

- **2026-08-21 (Session 42)**:
  - **DSH 插件分页条风格与定位对齐 macOS Vibrancy 规范**:
    - 分页条从「左页签 + 右每页选择」的 `justify-between` 拆分改为整体右对齐（`justify-end`），统一置于用户插件分区（可移植/本地开发）卡片右下角。
    - 当前页高亮由高饱和 `bg-[#30d158] text-white` 改为规范内的分段滑块式选中态（`bg-black/5 dark:bg-[#3a3a3c]` + 1px 发丝线边框），非当前页使用 `border-transparent` 透明边框保持尺寸稳定，仅 `hover` 时轻微着色，杜绝大面积高饱和色块。
    - 「每页」选择器统一为 `font-mono` 等宽 + `pr-5` 下拉留白，与 profile 选择器风格一致；页码按钮保持 `rounded-md`、`transition-colors duration-200`、双主题 `dark:` 全覆盖。
    - 验收：`npx tsc --noEmit` 零错误、`npm run build`（Vite 生产构建）零错误零警告。

- **2026-08-21 (Session 43)**:
  - **诊断修复控件卡品牌化 + 插件行图标瓦片按 kind 上色**:
    - **诊断控件卡**：`DshDiagnose.vue`「启动失败诊断」控件卡新增紫色顶部强调线（`border-t-[#bf5af2]/60`），Stethoscope 图标瓦片由中性灰改为紫色品牌容器（`bg-[#bf5af2]/10 border-[#bf5af2]/20 text-[#bf5af2]`），与插件页头部 / 同步页 DSH 紫色标识统一。
    - **插件行图标瓦片按 kind 上色**：`DshPluginRow.vue` 列表/卡片两种形态的 28px 图标瓦片由统一中性灰改为按 kind 语义上色——官方 `inbox`=蓝（`#0a84ff`，`Layers`）、用户 `bundle`=绿（`#30d158`，`Package`）、依赖 `plain`（含孤儿）=琥珀（`#ff9f0a`，`CircleDot`）、`row`=紫（`#bf5af2`，`ListTree`）；新增 `iconTileClass` 计算属性，与状态点/徽章/分区语义色一致。
    - 验收：`npx tsc --noEmit` 零错误、`npm run build`（Vite 生产构建）零错误零警告。

- **2026-08-21 (Session 44)**:
  - **DSH 插件页配色增润（在 macOS Vibrancy 规范内提升语义色存在感，解决页面偏素）**:
    - **健康胶囊按语义色着色**：`DshPluginList.vue` 健康胶囊选中态由统一中性灰改为按状态语义色着色——正常=绿（`bg-[#30d158]/10 + text/border-[#30d158]`）、待装/孤儿=琥珀（`#ff9f0a`）、版本冲突/失败=红（`#ff453a`）、全部=中性灰；未选中保持白底灰字 + hover 提亮，双主题 `dark:` 全覆盖。
    - **安装按钮品牌化**：sticky 操作栏「安装」下拉按钮由中性灰改为 DSH 紫色主操作（`bg-[#bf5af2]/10 hover:bg-[#bf5af2]/15 text/border-[#bf5af2]`），作为全页唯一主 CTA 突出。
    - **分区计数徽章着色**：`sectionTint(id)` 按分区语义色给计数徽章上色（可移植/正常=绿、本地开发/待装/孤儿=琥珀、官方=蓝、Patch=紫、版本冲突/失败=红），替代原先统一灰色。
    - **状态点光环**：`DshPluginRow.vue` 插件行/卡片状态点由纯色小方块升级为「2px 语义色 ring（20% 透明）」光环（`rounded-sm ring-2 ring-[语义色]/20`），提升层次但无大投影。
    - **卡片顶部语义强调线**：卡片视图每个插件卡新增顶部语义色强调线（`cardAccentClass`，`border-t-[语义色]/60`），与列表视图分区卡 / 同步页功能卡顶部标识线一致。
    - 严守规范红线：无 `bg-gradient`、无 `rounded-full`、无 `shadow-xl/2xl`、无粗边框、无位移动效、双主题 `dark:` 全覆盖。
    - 验收：`npx tsc --noEmit` 零错误、`npm run build`（Vite 生产构建）零错误零警告。

- **2026-08-21 (Session 45)**:
  - **技能页（中央技能库）配色方案落地（蓝色品牌 + 来源/分发语义色）**:
    - **容器品牌化**：`SkillsMatrix.vue` 中央技能库容器新增蓝色顶部强调线（`border-t-[#0a84ff]/60`），标题区 Layers 图标瓦片由中性灰改为蓝色品牌容器（`bg-[#0a84ff]/10 border-[#0a84ff]/20 text-[#0a84ff]`），与同步页「技能同步」蓝卡呼应。
    - **来源语义色**：技能来源徽章 / 图标瓦片（FileCode）按 `source` 上色——内置（`agenthub-sync`）=蓝 `#0a84ff`、中央自建 `central`=绿 `#30d158`、NPX 捕获 `npx`=琥珀 `#ff9f0a`、存量纳管 `imported`=紫 `#bf5af2`、其他=灰；新增 `SOURCE_TILE` / `SOURCE_BADGE` / `SOURCE_TEXT` 三套色板与 `sourceMeta(skill)` 映射，并把表格来源徽章从原始英文 `skill.source` 改为友好中文标签（内置/中央自建/NPX 捕获/存量纳管），移除名称旁冗余的「内置」标签（改由来源列蓝色徽章承载）。
    - **分发状态着色**：表格「已分发 N 个 Agent」与卡片 footer 的挂载计数按分发程度着色——全部分发=绿、部分分发=琥珀、未分发=灰（`mountCountClass(skill)`）。
    - 严守规范红线：无渐变、无粗边框、无大圆角、无位移动效、双主题 `dark:` 全覆盖、标题 `font-serif`。
    - 验收：`npx tsc --noEmit` 零错误、`npm run build`（Vite 生产构建）零错误零警告。

- **2026-08-21 (Session 46)**:
  - **技能页重新开放「按 Agent 精确分发」多选器**:
    - 表格视图「全局分发状态」列与卡片视图 footer 各新增 `AgentPillPicker`（Teleported 多选分发器），点「分发至 Agent... N/M」弹出浮层勾选/取消具体 Agent，支持「⚡ 全选活跃 / 清空 / 搜索」，与原有 `[启用|停用]` 全局分段开关并存——全局开关 = 一键全量分发/解绑，多选器 = 精确勾选目标 Agent。
    - 复用此前 Session 30 起闲置的 `AgentPillPicker.vue`（文件仍在、未删除），走 `store.toggleSkillForAgent` / `mountSkillToAllActive` / `unmountSkillFromAll`，毫秒级乐观更新 + 挂载计数实时回显；卡片 footer 保留「已分发 N 个 Agent」着色计数。
    - 恢复后技能页同时具备「全局分发」与「按 Agent 分发」两种粒度，按 Agent 维度的分发仍保留在大厅「中央技能分发」页签。
    - 验收：`npx tsc --noEmit` 零错误、`npm run build`（Vite 生产构建）零错误零警告。

- **2026-08-22 (Session 47)**:
  - **DSH 插件安装/更新：修复 git 依赖 prepare 构建脚本未放行导致的「更新失败」与「虚假成功」**:
    - **根因**：`dsh-diff-review` 等 git 托管插件 spec 为未锁 commit 的 `github:owner/repo`，而 `pnpm-workspace.yaml` 的 `allowBuilds` 条目按「包名@codeload tarball URL(含 commit)」精确锁定。上游新 commit 出现后，pnpm 解析到新 commit 但 allowBuilds 仍是旧 commit → 报 `ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED`，`pnpm update` 硬失败；而安装流水线又只以 L3 入口校验判定，旧 `lib/` 仍在导致「虚假成功」。
    - **配置修复**：`~/.dsh/profiles/web/pnpm-workspace.yaml` 与同步镜像 `%APPDATA%\AgentHub\dsh\profiles\web\pnpm-workspace.yaml` 的 `dsh-diff-review` allowBuilds 条目同步更新到最新 commit `69f084e66...`；实测 `pnpm update @dsh-external/dsh-diff-review` 后 lockfile/`node_modules` 均已切到新 commit，`lib/` 构建成功。
    - **代码修复（双端对齐）**：新增 `parseGitPrepareNotAllowed`（Node）/ `parse_git_prepare_not_allowed`（Rust）解析 pnpm 输出中的 `The git-hosted package '<name>'`，得到被拒绝包名；`installDshPluginsV2`/`install_inner` 将命中该错误的包强制标记 `failed`（覆盖 L3 误判），并给出「请在 allowBuilds 放行对应包/提交后重试」的 warning；`updateDshPlugin`/`update_one_inner` 同步改为「`!blocked && !timed_out && L3.ok`」判定，使 `ERR_PNPM_IGNORED_BUILDS`（构建脚本被忽略、包实际已装）不再误报失败，同时保留 `ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED` 为硬失败。
    - 验收：`npx tsc --noEmit` 零错误、`npm run build` 零错误零警告、`cargo check`（`src-tauri`）零错误零警告。

---
- **2026-08-22 (Session 48)**:
  - **应用本体在线更新（cc-switch 风格：检查更新 + 下载 + 一键安装）**:
    - **数据模型**：新增 `AppUpdateCheck` / `AppUpdateDownload`（TS `types/index.ts` + Rust `models.rs` 双端对齐）；`AppConfig` 新增 `auto_check_update`（默认 false）。
    - **Rust 后端 `src-tauri/src/app_update.rs`**：`check_app_update`（GitHub Releases API `releases/latest`，解析 tag/body/assets，语义化版本比较，优先 `.exe` 其次 `.msi`）、`download_app_update`（`ureq` 流式下载 + `Channel<String>` 实时进度，注入 `git_sync::system_proxy()` 代理）、`install_app_update`（NSIS `/S` 静默 / MSI `msiexec /qn`，启动后退出应用释放文件锁）；新增 `ureq = "2.9"` 依赖并注册三命令。
    - **Node 后端 `src/server/appUpdate.ts`**：`checkAppUpdate` / `downloadAppUpdate` / `installAppUpdate`，自带 HTTPS CONNECT 系统代理隧道（复用 `gitSyncUtil.detectSystemProxy`）与 302 跳转跟随；`vite.config.ts` 新增 `GET /api/app/update/check`、`GET /api/app/update/download/stream`（SSE 进度）、`POST /api/app/update/install`。
    - **前端**：`api.ts` 新增三方法（Tauri Channel / Web SSE 双模）；`useAppStore.ts` 新增 `appUpdate*` 状态与 `checkAppUpdate` / `downloadAppUpdate` / `installAppUpdate` / `openUpdateModal` 动作，`init()` 按 `auto_check_update` 启动静默检查；新增 `UpdateModal.vue`（版本对比 + 更新日志 + 下载进度条 + 安装重启，macOS Vibrancy 规范）；`Header.vue` 版本徽章可点击打开更新弹窗、有更新时显示琥珀色圆点；`SettingsModal.vue` 新增「启动时自动检查更新」分段开关 +「检查更新」入口；`App.vue` 注册 `UpdateModal`。
    - 更新源仓库硬编码为 `Nomit8088/AGENT_CONFIG_MANAGE`（与 `.github/workflows/release.yml` 的 tauri-action 产物一致）。
    - 验收：`npx tsc --noEmit` 零错误、`npm run build`（Vite 生产构建）零错误零警告、`cargo check`（`src-tauri`）零错误零警告。

---
- **2026-08-22 (Session 49)**:
  - **前端视觉重构升级：Linear / Raycast 级高设计感与丰富语义色谱全量落地**:
    - **视觉层级痛点攻关**：
      - 针对原浅色模式下列表泛白泛素（无阴影、低对比、缺乏层级）与旧版满屏荧光绿过载问题，全面重构为符合 Linear / Raycast / Supabase 顶级开发工具质感的现代化 UI；
      - **画布与卡片对比**：浅色模式采用冷调 Slate 灰底（`#f1f5f9`）+ 纯白立体卡片（`#ffffff` + 微阴影 `shadow-xs`），深色模式采用深邃极客黑（`#0c0d12`）+ 深冷卡片（`#14161f` + 悬浮发光发丝边框 `hover:border-indigo-500/35`）；
      - **来源协议精致微徽章 (Protocol Micro-Pills)**：为 `GITHUB` (经典钴蓝)、`NPM` (紫罗兰)、`GIT+` (冰川蓝)、`LOCAL` (琥珀金)、`OFFICIAL` (电光紫) 独立设计代码胶囊微标签与渐变图标瓦片；
      - **状态指示微型化**：`正常` 状态采用精致温润的翡翠微胶囊（`bg-emerald-500/10 text-emerald-600` + 微型圆点），彻底告别大面积荧光绿刷屏；
      - **模块品牌维度色谱**：DSH 插件中心（科技紫）、技能中心（电光靛蓝）、同步中心（冰川蓝）、大厅 Agent（琥珀金），使各功能板块个性鲜明且整体协调优雅。
    - **全站 20+ 组件全量同步**：`style.css`、`Header.vue`、`DshPluginRow.vue`、`DshPluginList.vue`、`PluginsView.vue`、`SkillsMatrix.vue`、`SyncView.vue` 全量焕新。
    - 验收：`npx tsc --noEmit` 零错误、`npm run build`（Vite 生产构建，2.09s）零错误零警告。

*文档更新时间：2026-08-22 | AgentHub Core Team*
