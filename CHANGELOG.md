# Changelog

All notable changes to AgentHub are documented in this file.

## [1.0.2] - 2026-08-22

### Fixed
- 修复 `git_url_from_spec` 丢失 scheme 的问题：`git+https://` 依赖（含 gitee / gitlab / gh-proxy 镜像）此前会被剥成无 scheme 地址，导致 `git ls-remote` 报 `protocol not supported`、检查更新全部失败；现只剥 `git+`、保留 `https://`。
- 修复 `github:` 依赖检查更新误报：pnpm 将 `github:user/repo` 解析为 `https://codeload.github.com/…/tar.gz/<commit>`（可带 peer 上下文后缀），`extract_commit_hash` 此前只认 `#` 导致当前版本恒为空；现支持 codeload tarball 与 `/archive/` 两种形态。
- 同步镜像时归一化公共 GitHub 镜像前缀（`gh-proxy.com` / `ghproxy.net`）为原始 `github.com`，避免本机镜像域名随插件配置同步进共享仓库、在其它机器上失效。

### Added
- 新增 `dsh_plugins.gitHubMirror` 配置项（设置页「DSH 插件 GitHub 镜像」）：对 `github:` 依赖的检查更新可优先走镜像，尝试顺序为 镜像 → 直连 → 系统代理。
- 新增 npm registry 依赖（`^x.y.z` 等 semver 范围）的检查更新，并对超出 spec 范围的 latest 版本给出「需先改 spec 才能升级」提示。
- 新增 GitHub Release 固定 URL（tgz 资产）的检查更新，对比 `releases/latest` 的 tag 判断是否有新版。

### Changed
- 全站视觉重构升级：Linear / Raycast 级 UI、语义色谱、来源协议微徽章、状态指示微型化、模块品牌维度色谱，覆盖 20+ 组件（style.css / Header / DshPluginRow / DshPluginList / PluginsView / SkillsMatrix / SyncView 等）。
