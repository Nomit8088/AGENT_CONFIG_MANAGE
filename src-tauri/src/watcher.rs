use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher};
use std::sync::mpsc::channel;
use std::thread;
use tauri::{AppHandle, Emitter};
use crate::fs_junction::expand_tilde;

pub fn start_watcher(app_handle: AppHandle) {
    thread::spawn(move || {
        let (tx, rx) = channel();

        let mut watcher = match RecommendedWatcher::new(tx, Config::default()) {
            Ok(w) => w,
            Err(e) => {
                eprintln!("无法初始化文件监听器: {}", e);
                crate::log_error!("scan", "文件监听器初始化失败: {}", e);
                return;
            }
        };

        let watch_dirs = vec![
            expand_tilde("~/.skills"),
            expand_tilde("~/.agent-skills"),
            expand_tilde("~/.claude/skills"),
            expand_tilde("~/.gemini/config/skills"),
            expand_tilde("~/.codex/skills"),
            expand_tilde("~/.dsh/skills"),
            expand_tilde("~/.agents/skills"),
            // 4 个 Electron 系 Agent 的挂载目标（L11：纳入链接矩阵目录来源）
            expand_tilde("~/.cursor/skills"),
            expand_tilde("~/.windsurf/skills"),
            expand_tilde("~/.zcode/skills"),
            expand_tilde("~/.trae/skills"),
        ];

        for dir in watch_dirs {
            if dir.exists() {
                let _ = watcher.watch(&dir, RecursiveMode::Recursive);
            }
        }

        while let Ok(res) = rx.recv() {
            match res {
                Ok(event) => {
                    if let notify::EventKind::Create(_) = event.kind {
                        for path in event.paths {
                            if path.is_file() && path.file_name().map_or(false, |n| n == "SKILL.md") {
                                let path_str = path.to_string_lossy().to_string();
                                crate::log_info!("scan", "检测到外部技能创建: {}", path_str);
                                let _ = app_handle.emit("external-skill-created", path_str);
                            }
                        }
                    }
                }
                Err(e) => eprintln!("Watch error: {:?}", e),
            }
        }
    });
}
