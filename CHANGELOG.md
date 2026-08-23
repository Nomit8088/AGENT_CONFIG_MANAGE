# Changelog

All notable changes to AgentHub are documented in this file.

## [1.0.5] - 2026-08-23

### Added
- 三平台适配（WI-011）：完整支持 macOS（Intel + Apple Silicon，universal `.dmg`）与 Linux（`.deb` / `.AppImage`），实现 Windows / macOS / Linux 三平台功能对等；应用数据目录、进程树清理、代理探测、系统主题、更新安装等平台差异统一抽象。
- 三平台 CI 矩阵：PR 级 ubuntu `cargo check` + 前端 typecheck/build；release 级三平台打包（Windows / macOS universal / Linux）。
- 跨语言对拍（B-M2.2）：Rust 与 Node 双端各自 dump 链接策略决策表并在 CI `diff`，锁死双端漂移。
- 版本同步检查（R14）：`scripts/check-version-sync.mjs` 校验 package.json / Cargo.toml / tauri.conf.json / types 四处版本一致。
- 三端开发规范落盘：新建根 `AGENTS.md`（五条跨平台规范权威版）、`CONTRIBUTING.md` §5 并入 PR 准入、`HANDOVER.md` 加指针。
- CI-A 验收测试：链接结构等价（junction/symlink/hardlink-tree）、进程树递归清理、应用数据目录三平台断言（Rust + Node 双端）。

### Changed
- 链接策略收敛为「Agent × 平台 → 链接策略矩阵」（`fs_junction.rs::link_strategy_for` / `src/shared/linkStrategy.ts`），消除 antigravity 散落的硬编码；清理 `supports_junction` 死字段。
- macOS 产物改为 universal 交叉编译（arm64 runner 上 `--target universal-apple-darwin`），摆脱对已淘汰的 macos-13 Intel runner 的依赖。

### Fixed
- 修复 Node 端应用数据目录在 macOS/Linux 错误落到 `~/AppData/Roaming`（新增 `src/server/appPaths.ts` 单一事实源，收敛 localApi / dshPlugins / syncRepo 三处独立实现）。
- 修复 Unix 进程树清理只杀单进程（Rust `process.rs` + Node `dshPlugins.ts` 改为递归 `pgrep -P` 自底向上 + `kill -9`）。
- 修复 macOS 更新安装（`.dmg` 挂载 + `ditto` 复制 + `xattr` 去 quarantine + detached 后置替换脚本）。
- 补 4 个 Electron 系 Agent（cursor/windsurf/zcode/trae）的 macOS/Linux 探测路径；系统主题检测补 macOS `defaults` / Linux `gsettings` 分支；npm 全局 bin 补 `npm prefix -g` 兜底。

## [1.0.3] - 2026-08-22

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
