---
name: agenthub-sync
description: 同步当前开发的 Skill 或规则至 AgentHub 中央技能库与多 Agent 矩阵中。
version: 1.0.0
author: AgentHub
slash_commands:
  - /agenthub-sync
---

# AgentHub Sync Skill

此 Skill 用于将当前工作区或会话中新建/修改的 Skill，反向同步并收录至 AgentHub 中央技能库 `%APPDATA%\AgentHub\skills\` 中，并自动广播/挂载至所有已启用的 Agent。

## 使用场景与触发指令
当用户发出以下指令时调用：
- `/agenthub-sync`
- "把刚才写的技能同步到客户端"
- "把当前 skill 保存到 AgentHub"

## 执行流程与规范
1. 检查当前需要同步的 `SKILL.md` 文件内容与 YAML Frontmatter（确保包含 `name` 与 `description`）。
2. 将 Skill 文件夹复制或写入到中央技能库路径：
   - Windows: `%APPDATA%\AgentHub\skills\<skill-name>\SKILL.md`
   - Linux/macOS: `~/.config/agenthub/skills/<skill-name>/SKILL.md`
3. 检查各 Agent 是否已创建 Junction 软链，完成多 Agent 实时同步。
