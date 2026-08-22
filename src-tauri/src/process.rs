//! 统一的子进程构造入口。
//!
//! Tauri 应用是 GUI 程序（无控制台），若直接用 `std::process::Command` 拉起
//! `git` / `reg` / `cmd` / `pnpm` / `dsh` 等控制台程序，Windows 会为每个子进程
//! 新建一个控制台窗口（表现为桌面频繁闪烁 cmd 窗口）。这里统一在 Windows 下
//! 设置 `CREATE_NO_WINDOW`，其余平台原样返回。

use std::ffi::OsStr;
use std::process::Command;

/// 构造一个不会弹出控制台窗口的 `Command`（Windows 下追加 CREATE_NO_WINDOW）。
pub fn spawn_cmd<S: AsRef<OsStr>>(program: S) -> Command {
    let mut cmd = Command::new(program);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd
}
