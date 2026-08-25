// 应用数据根目录（三平台），与 Rust 端 src-tauri/src/storage.rs::get_app_data_dir 语义一致。
// 单一事实源：localApi.ts / dshPlugins.ts / syncRepo.ts / appUpdate.ts 统一从这里取。
import os from 'os';
import path from 'path';

export function getAppDataDir(): string {
  let base: string;
  if (process.platform === 'win32') {
    // Windows：%APPDATA%（缺省 ~/AppData/Roaming）
    base = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  } else if (process.platform === 'darwin') {
    // macOS：~/Library/Application Support
    base = path.join(os.homedir(), 'Library', 'Application Support');
  } else {
    // Linux：$XDG_CONFIG_HOME（缺省 ~/.config）
    base = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  }
  return path.join(base, 'AgentHub');
}

/** 应用日志目录（三平台，与 Rust storage.rs::get_logs_dir 语义一致）。 */
export function getLogsDir(): string {
  return path.join(getAppDataDir(), 'logs');
}
