## 📋 变更描述

请简要说明本次 Pull Request 的核心内容、修复的缺陷或新增的功能特性。

## 🏷️ 变更类型

- [ ] 🚀 **feat**: 新增功能 / 新增 Agent 适配
- [ ] 🐛 **fix**: 修复 Bug 或逻辑缺陷
- [ ] 📝 **docs**: 文档更新或修正
- [ ] 🎨 **style**: 样式美化 / 浅色与深色模式微调
- [ ] ♻️ **refactor**: 代码重构 / 性能优化
- [ ] ⚙️ **chore**: 构建流程 / 依赖项或工具更新
- [ ] 🧪 **test**: 增加或修改测试用例

## 🔗 关联 Issue

Closes # <!-- 如果有关联的 issue 请在此处注明，例如 Closes #12 -->

## 🧪 自测与验证清单

请在提交前完成以下自测核对：

- [ ] 本地运行 `npx tsc --noEmit` 静态类型检查 100% 零错误通过
- [ ] 本地运行 `npm run build` 生产环境打包无报错无警告
- [ ] 若涉及底层软链/存储修改，已验证 Rust 端 (`src-tauri`) 与 Node Web 端 (`localApi.ts`) 逻辑双向对齐
- [ ] 已在 Chrome/Edge 或 Tauri 桌面端实际运行验证交互正常
- [ ] 如涉及新增 Agent 或架构变动，已同步更新 [HANDOVER.md](HANDOVER.md) 与 [README.md](README.md)
