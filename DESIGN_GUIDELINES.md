# AgentHub 前端设计规范与风格指南 (Design Guidelines)

> **风格定义**：macOS 毛玻璃 (macOS Vibrancy)  
> **Slug**：`macos-vibrancy`  
> **适用范围**：AgentHub 全局界面、所有组件、弹窗、抽屉以及后续新增的任何功能模块。  
> **核心原则**：**优先保证风格一致性，其次再做创意延展。后续添加任何新功能模块与页面，必须严格参考本规范，严禁风格漂移！**

---

## 目录
1. [核心设计哲学](#1-核心设计哲学)
2. [颜色系统与深浅模式](#2-颜色系统与深浅模式)
3. [排版字体规范](#3-排版字体规范)
4. [边框、圆角与阴影](#4-边框圆角与阴影)
5. [核心组件交互标准](#5-核心组件交互标准)
6. [动效与过渡规范](#6-动效与过渡规范)
7. [绝对禁止项与自检清单](#7-绝对禁止项与自检清单)

---

## 1. 核心设计哲学

AgentHub 采用 **macOS Vibrancy（毛玻璃极简）** 风格：
* **精致、低噪音**：拒绝粗暴的颜色填充与夸张的装饰动效，通过微妙的明暗层级与半透明毛玻璃建立空间深度。
* **低信息密度**：善用分段导航卡片（Segmented Control）与按需抽屉（Slide-over Drawer），避免在同一视图堆砌过多操作与文本。
* **触感明确**：所有交互状态（启用/停用/选中）采用直观的 macOS 分段滑块或明确的高对比指示灯，确保用户 100 毫秒内认知当前系统状态。

---

## 2. 颜色系统与深浅模式

全站严格采用 **双轨制（Dark Mode & Light Mode）** 动态适配体系。

### 2.1 深色模式调色板 (Dark Palette - 核心底色)

| 层级 | 色值 | Tailwind 类名 | 用途 |
| :--- | :--- | :--- | :--- |
| **画布深层 (Canvas)** | `#1c1c1e` | `dark:bg-[#1c1c1e]` | 主窗口底层背景、一级背景 |
| **卡片中层 (Mid Layer)** | `#2c2c2e` | `dark:bg-[#2c2c2e]` | 内容卡片、操作条、表格头、弹窗背景 |
| **交互浅层 (Surface)** | `#3a3a3c` | `dark:bg-[#3a3a3c]` | 激活的滑块选项、主要操作按钮、高亮层 |
| **毛玻璃层 (Vibrancy)** | `#1c1c1e/80` 或 `/95` | `dark:bg-[#1c1c1e]/80 backdrop-blur-xl` | 顶栏、悬浮操作条、抽屉背景 |

### 2.2 浅色模式调色板 (Light Palette)

| 层级 | 色值 | Tailwind 类名 | 用途 |
| :--- | :--- | :--- | :--- |
| **画布浅层 (Canvas)** | `#f5f5f7` | `bg-[#f5f5f7]` | macOS 标准灰白工作区底色 |
| **卡片中层 (Mid Layer)** | `#ffffff` | `bg-white` | 白色内容卡片、容器背景 |
| **交互浅层 (Surface)** | `rgba(0,0,0,0.05)` | `bg-black/5` ~ `bg-black/10` | 悬停底色、滑块未激活槽 |
| **毛玻璃层 (Vibrancy)** | `rgba(255,255,255,0.8)` | `bg-white/80 backdrop-blur-xl` | 浅色顶栏、浮动栏 |

### 2.3 文字与透明度阶梯

* **主文字 / 标题**：`text-slate-900` / `dark:text-white/95` (最高对比度，正文与标题)
* **次级文字 / 标签**：`text-slate-600` / `dark:text-white/70` (辅助说明、字段名)
* **次次级 / 占位符**：`text-slate-400` / `dark:text-white/40` ~ `dark:text-white/50` (占位说明、未激活图标)

### 2.4 语义状态色彩 (Status Accents)
> **注意**：语义色仅用于状态指示灯（Status Dot）、徽章标签（Badge）与聚焦焦点，严禁大面积铺陈。

* **运行正常 / 已生效 / 成功**：`#30d158` (macOS Green)  
  * 徽章：`bg-[#30d158]/10 text-[#30d158] border border-[#30d158]/30`
* **主操作 / 链接 / 选中**：`#0a84ff` (macOS Blue)  
  * 徽章：`bg-[#0a84ff]/10 text-[#0a84ff] border border-[#0a84ff]/30`
* **警告 / 异常 / 未就绪**：`#ff9f0a` (macOS Amber)  
  * 徽章：`bg-[#ff9f0a]/10 text-[#ff9f0a] border border-[#ff9f0a]/30`
* **危险 / 错误 / 删除**：`#ff453a` (macOS Red)  
  * 徽章：`bg-[#ff453a]/10 text-[#ff453a] border border-[#ff453a]/30`

---

## 3. 排版字体规范

全站严格执行三套字体族规范：

1. **标题与品牌名 (Serif 衬线体)**：
   * 类名：`font-serif` (优先调用 Georgia / Times New Roman / Apple Garamond)
   * 适用范围：所有模块大标题、卡片标题、弹窗标题、Logo 文本。
   * 特点：沉稳、优雅、具有桌面级经典质感。
2. **正文与通用操作 (Sans-Serif 系统无衬线体)**：
   * 类名：默认字体 `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto`
   * 适用范围：段落正文、按钮文字、提示说明、输入框。
3. **代码、路径与按键 (Monospace 等宽体)**：
   * 类名：`font-mono` (优先调用 SF Mono / Menlo / Monaco / Cascadia Code)
   * 适用范围：文件路径、版本号、代码片段、快捷键、文件扩展名标签。

---

## 4. 边框、圆角与阴影

* **发丝线边框 (1px Hairline Border)**：
  * 深色模式：`border border-white/8` 到 `border-white/12`（激活态可用 `border-white/20`）
  * 浅色模式：`border border-black/8` 到 `border-black/10`（激活态可用 `border-black/15`）
  * **红线**：严禁出现 2px/4px 粗边框（禁止 `border-2`, `border-4`）。
* **圆角层次 (Border Radius)**：
  * 主卡片、弹窗、大容器：`rounded-xl` (12px)
  * 按钮、输入框、滑块容器：`rounded-lg` (8px)
  * 徽章、药丸标签、分段滑块内部项：`rounded-md` (6px)
  * 指示灯方点：`rounded-sm` (2px)
  * **红线**：除纯圆形头像外，严禁使用大圆角（禁止 `rounded-3xl`, `rounded-full`）。
* **微质感阴影 (Subtle Shadow)**：
  * 浅色模式下采用微阴影 `shadow-xs` / `shadow-sm`。
  * 深色模式下统一使用 `dark:shadow-none`，依赖 `#2c2c2e` 色阶与 `border-white/8` 发丝线区隔层级。

---

## 5. 核心组件交互标准

### 5.1 统一分段滑块开关 (Segmented Slider Switch)
全站所有开关统一采用分段滑块容器设计：

```html
<!-- 分段滑块开关通用结构 -->
<div class="flex items-center p-0.5 rounded-lg bg-black/5 dark:bg-[#1c1c1e] border border-black/10 dark:border-white/10 text-xs">
  <button
    type="button"
    @click="setValue(true)"
    :class="[
      'px-2.5 py-1 rounded-md transition-colors duration-200 font-medium flex items-center gap-1',
      isActive
        ? 'bg-white dark:bg-[#3a3a3c] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
        : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
    ]"
  >
    <span v-if="isActive" class="w-1.5 h-1.5 rounded-sm bg-[#30d158]"></span>
    <span>开启 / 启用</span>
  </button>
  <button
    type="button"
    @click="setValue(false)"
    :class="[
      'px-2.5 py-1 rounded-md transition-colors duration-200 font-medium flex items-center gap-1',
      !isActive
        ? 'bg-white dark:bg-[#3a3a3c] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
        : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
    ]"
  >
    <span>关闭 / 停用</span>
  </button>
</div>
```

### 5.2 分段选项卡 (Segmented Tabs Control)
用于多视图切换（如项目规则的「规则编辑」与「分发模式设置」）：

```html
<div class="flex items-center p-1 rounded-xl bg-white dark:bg-[#1c1c1e] border border-black/8 dark:border-white/8 shadow-xs text-xs">
  <button
    @click="tab = 'editor'"
    :class="[
      'px-3.5 py-1.5 rounded-lg transition-colors duration-200 font-medium flex items-center gap-1.5',
      tab === 'editor'
        ? 'bg-black/5 dark:bg-[#2c2c2e] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
        : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
    ]"
  >
    <span>Tab 1</span>
  </button>
</div>
```

### 5.3 抽屉式侧边面板 (Slide-Over Baseline Drawer)
用于辅助信息对照（如原版 `AGENTS.md` 基准参考），按需从右侧滑出：
* 类名结构：`bg-white dark:bg-[#1c1c1e] rounded-xl border border-black/8 dark:border-white/8 shadow-xl dark:shadow-none animate-in slide-in-from-right duration-200`

---

## 6. 动效与过渡规范

* **唯一过渡类**：`transition-colors duration-200 ease-out`
* **过渡属性限制**：仅允许颜色、背景色、透明度（`opacity`）、边框颜色发生渐变。
* **物理位移禁令**：悬停时严禁发生几何位置偏移、缩放或浮起。

---

## 7. 绝对禁止项与自检清单

在提交任何新页面或修改组件前，请对照以下红线清单自检：

| 检查项 | 是否合格 | 说明 |
| :--- | :---: | :--- |
| **禁止高饱和渐变** | ❌ 严禁 | 严禁使用 `bg-gradient-to-*`、霓虹光晕等装饰。 |
| **禁止粗边框** | ❌ 严禁 | 严禁使用 `border-2`, `border-4`，全站统一 1px 细线。 |
| **禁止大圆角卡片** | ❌ 严禁 | 严禁在大卡片上使用 `rounded-3xl` 或 `rounded-full`。 |
| **禁止悬停位移** | ❌ 严禁 | 严禁使用 `hover:-translate-y-1`、`hover:scale-105`。 |
| **禁止闪烁动效** | ❌ 严禁 | 严禁使用 `animate-pulse`、`animate-bounce`、`animate-ping`。 |
| **禁止破坏双主题** | ❌ 严禁 | 所有颜色类必须同时提供浅色与深色类（如 `bg-white dark:bg-[#1c1c1e]`）。 |
| **标题必须使用衬线体** | ✅ 必须 | 页面与卡片标题必须携带 `font-serif`。 |
| **开关使用分段滑块** | ✅ 必须 | 所有双态切换必须采用统一的 `Segmented Slider` 规范。 |

---
*文档版本：v1.0 | 维护团队：AgentHub Core Architecture Team*
