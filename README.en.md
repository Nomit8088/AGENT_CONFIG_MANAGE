# AgentHub (AGENT_CONFIG_MANAGE)

<p align="center">
  <strong>Unified Cross-Agent AI Configuration Hub · Central Skills NTFS Junction Matrix · Zero-Git-Conflict Project Rules Engine</strong>
</p>

<p align="center">
  <a href="README.md">简体中文</a> ·
  <a href="README.en.md">English</a>
</p>

<p align="center">
  <a href="https://github.com/Nomit8088/AGENT_CONFIG_MANAGE/releases"><img src="https://img.shields.io/badge/release-v1.0.0-emerald.svg" alt="Release"></a>
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue.svg" alt="Platform">
  <img src="https://img.shields.io/badge/backend-Tauri%202.0%20(Rust)-orange.svg" alt="Tauri">
  <img src="https://img.shields.io/badge/frontend-Vue%203%20%2B%20TypeScript%20%2B%20Tailwind-38bdf8.svg" alt="Frontend">
  <img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License">
</p>

---

## 📖 Overview

As developers mix and match multiple AI coding agents (**Claude Code, Google Antigravity/Gemini, Cursor, Windsurf, OpenCode/Codex, ZCode, DeepSeek HARNESS, Trae**, etc.) across workflows, local environments suffer from severe fragmentation and Git conflicts.

**AgentHub** is a lightweight, modern desktop client and configuration bus. Leveraging **Windows NTFS Junction / Symlinks**, a **file-level Hardlink Tree two-way sync engine**, and **Git Hook Guards**, AgentHub provides instant cross-agent rule switching, central skill distribution, and zero-conflict repository customization.

---

## 🤖 16 AI Agents Master Matrix

| Agent ID | Official Name | Skills Directory | Native Rule File | Reads Root `AGENTS.md`? | Recommended Override File | Official Brand Color |
|---|---|---|---|:---:|---|---|
| `claude-code` | **Claude Code** | `~/.claude/skills` | `CLAUDE.md` | ❌ | `CLAUDE.local.md` | Anthropic Coral (`#D97757`) |
| `cursor` | **Cursor** | `~/.cursor/skills` | `.cursorrules`, `.cursor/rules/*.mdc` | ❌ | `.cursor/rules/local-override.mdc` | Sky Blue (`#38BDF8`) |
| `windsurf` | **Windsurf** | `~/.windsurf/skills` | `.windsurfrules`, `WINDSURF.local.md` | ❌ | `WINDSURF.local.md` | Codeium Teal (`#0D9488`) |
| `antigravity` | **Google Antigravity** | `~/.gemini/config/skills` | `GEMINI.md`, `.agents/rules/*.md`, `AGENTS.md` | ✅ | `.agents/rules/local-override.md` | Gemini Gradient (`#4E82EE` → `#10B981`) |
| `codex` | **OpenCode / Codex** | `~/.codex/skills` | `AGENTS.md`, `AGENTS.override.md` | ✅ | `AGENTS.override.md` | OpenAI Green (`#10A37F`) |
| `zcode` | **ZCode** | `~/.zcode/skills` | `ZCODE.local.md`, `AGENTS.md` | ✅ | `ZCODE.local.md` | Matrix Indigo (`#818CF8`) |
| `dsh` | **DeepSeek HARNESS** | `~/.dsh/skills` | `AGENTS.md`, `CLAUDE.md` | ✅ | `AGENTS.local.md` | DeepSeek Blue (`#4D6BFE`) |
| `mimocode` | **MiMo Code** | `~/.config/mimocode/skills` | `AGENTS.md`, `CLAUDE.md`, `mimocode.json` | ✅ | `AGENTS.md` | Xiaomi Orange (`#FF6900`) |
| `openclaw` | **OpenClaw** | `~/.openclaw/skills` | `AGENTS.md`, `SOUL.md`, `IDENTITY.md` | ✅ | `AGENTS.md` | Cyber Claw (`#F97316`) |
| `hermes` | **Hermes Agent** | `~/.hermes/skills` | `.hermes.md`, `AGENTS.override.md`, `AGENTS.md` | ✅ | `AGENTS.override.md` | Amber Gold (`#F59E0B`) |
| `copilot` | **GitHub Copilot** | `~/.copilot/skills` | `.github/copilot-instructions.md`, `AGENTS.md` | ✅ | `.github/copilot-instructions.md` | GitHub Purple (`#8957E5`) |
| `pi` | **Pi Coding Agent** | `~/.pi/skills` | `.omo/rules/`, `AGENTS.md`, `CLAUDE.md` | ✅ | `.omo/rules/local.md` | Green Pi (`#22C55E`) |
| `kimi` | **Kimi Code CLI** | `~/.kimi/skills` | `AGENTS.md` (root + sub), `~/.kimi/AGENTS.md` | ✅ | `AGENTS.md` | Moonshot Indigo (`#6366F1`) |
| `trae` | **Trae / TraeWork** | `~/.trae/skills` | `.trae/rules/`, `AGENTS.md`, `CLAUDE.local.md` | ✅ | `CLAUDE.local.md` | Prism Green (`#32F08C`) |
| `workbuddy` | **WorkBuddy** | `~/.workbuddy/skills` | `AGENTS.md`, Codex commands | ❓ | `AGENTS.md` | Robot Blue (`#3B82F6`) |
| `kiro` | **Kiro CLI** | `~/.kiro/skills` | `~/.kiro/agents/*`, `AGENTS.md`, `AmazonQ.md` | ✅ | `AGENTS.md` | Magenta Gradient (`#E056FD`) |

> **DSH multi-root note**: DSH's `skill-filesystem` scans user-level `~/.dsh/skills` (user-dsh) and `~/.agents/skills` (user-agents) by default — it does not scan `~/.dsh/skills-personal`. AgentHub mounts DSH skills into `~/.dsh/skills` and cleans all user-level skill roots on enable/disable/delete/takeover so the Skills Matrix toggle takes effect for DSH.

---

## ⚡ Core Features

1. **Agent Hub**: Automatic discovery of installed agent directories with global enabled/disabled toggles.
2. **Skills Matrix**: Central skills repository with Tag Pills, Teleported multi-agent distribution picker, fuzzy search/filters, and Table/Card gallery views.
3. **Project Rules Engine (Zero Git Conflict)**:
   - **Append Mode**: Keeps root `AGENTS.md` unchanged and dispatches custom rules into agent private files automatically added to `.git/info/exclude`.
   - **Overwrite Mode**: Replaces root `AGENTS.md` with personal rules and automatically injects Git Hook guards (`pre-checkout` / `post-checkout`) for seamless auto-restore and zero merge conflicts.
4. **Unmanaged Physical Skills Scanner & Diff Modal**: Grouped detection of local standalone folders with one-click adoption, ignore lists, and side-by-side Diff conflict resolution.
5. **Sync Center**: Sync only the central skills library using `%APPDATA%\AgentHub` as the Git repository root with `skills/` as a subdirectory. Works with any Git remote (GitHub/Gitee/GitLab). Manual pull/push plus optional startup auto-pull; auto-pull is fast-forward only and never overwrites local changes.
6. **Dual-Mode Execution Architecture**: Runs both as a lightweight **Tauri 2.0 desktop application** or directly in a **Web Browser dev server** with real NTFS Junction and filesystem integration.

---

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/Nomit8088/AGENT_CONFIG_MANAGE.git
cd AGENT_CONFIG_MANAGE

# Install dependencies
npm install

# Start development server (Web Browser Mode)
npm run dev

# Start Tauri desktop app (Requires Rust toolchain)
npm run tauri dev

# Build Windows desktop installer (.exe / .msi)
npm run tauri build
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
