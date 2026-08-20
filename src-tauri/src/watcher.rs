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
