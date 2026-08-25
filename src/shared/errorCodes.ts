// 双端共享错误码清单（Rust `src-tauri/src/error_codes.rs` 与 Node `src/server/*` 保持 100% 对齐）。
// 约定：后端把错误码作为错误字符串返回（可选携带动态信息，形如 `E_XXX::detail`），
// 前端 `translateError` 识别 `E_` 前缀后查语言包，并把 `::detail` 拼到本地化文案之后。
// 进程原始输出（git stderr / pnpm 日志等）不是错误码，继续原样透传展示，不在此列。
export const ERROR_CODES = {
  // 同步仓库（技能同步 / DSH 插件同步共用同一份语义）
  SYNC_NOT_INITIALIZED: 'E_SYNC_NOT_INITIALIZED',
  SYNC_NO_REMOTE: 'E_SYNC_NO_REMOTE',
  SYNC_BRANCH_MISSING: 'E_SYNC_BRANCH_MISSING',
  SYNC_DIRTY: 'E_SYNC_DIRTY',
  SYNC_PULL_FAILED: 'E_SYNC_PULL_FAILED',
  SYNC_PUSH_FAILED: 'E_SYNC_PUSH_FAILED',
  SYNC_FETCH_FAILED: 'E_SYNC_FETCH_FAILED',
  SYNC_CONNECT_FAILED: 'E_SYNC_CONNECT_FAILED',
  SYNC_BUSY: 'E_SYNC_BUSY',
  SYNC_SCHEDULE_UNSUPPORTED: 'E_SYNC_SCHEDULE_UNSUPPORTED',

  // Git / 工具链
  GIT_NOT_FOUND: 'E_GIT_NOT_FOUND',
  GIT_TIMEOUT: 'E_GIT_TIMEOUT',
  PNPM_NOT_FOUND: 'E_PNPM_NOT_FOUND',
  NPM_NOT_FOUND: 'E_NPM_NOT_FOUND',

  // DSH 插件
  PLUGIN_KEY_UNKNOWN: 'E_PLUGIN_KEY_UNKNOWN',
  PROFILE_DIR_MISSING: 'E_PROFILE_DIR_MISSING',
  PROFILE_PKG_MISSING: 'E_PROFILE_PKG_MISSING',
  PKG_NAME_EMPTY: 'E_PKG_NAME_EMPTY',
  PKG_NAME_INVALID: 'E_PKG_NAME_INVALID',
  PKG_NOT_INSTALLED: 'E_PKG_NOT_INSTALLED',
  ADOPT_LINK_TARGET: 'E_ADOPT_LINK_TARGET',
  ADOPT_NOT_LINK: 'E_ADOPT_NOT_LINK',
  ADOPT_NO_PKG_JSON: 'E_ADOPT_NO_PKG_JSON',
  ADOPT_NAME_MISMATCH: 'E_ADOPT_NAME_MISMATCH',
  RECOVERY_UNKNOWN: 'E_RECOVERY_UNKNOWN',

  // 配置 / 仓库校验
  CONFIG_SAVE_FAILED: 'E_CONFIG_SAVE_FAILED',
  REPO_VALIDATE_FAILED: 'E_REPO_VALIDATE_FAILED',

  // 应用更新
  APP_UPDATE_CHECK_FAILED: 'E_APP_UPDATE_CHECK_FAILED',
  APP_UPDATE_ASSET_NOT_FOUND: 'E_APP_UPDATE_ASSET_NOT_FOUND',
  APP_UPDATE_DOWNLOAD_FAILED: 'E_APP_UPDATE_DOWNLOAD_FAILED',

  // DSH 版本变更 / 流式传输
  VERSION_UPGRADE_FAILED: 'E_VERSION_UPGRADE_FAILED',
  VERSION_INSTALL_FAILED: 'E_VERSION_INSTALL_FAILED',
  VERSION_ROLLBACK_FAILED: 'E_VERSION_ROLLBACK_FAILED',
  STREAM_INTERRUPTED: 'E_STREAM_INTERRUPTED',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/** 判断一段原始错误文本是否为结构化错误码（可携带 `::detail`）。 */
export function isErrorCode(raw: string): raw is ErrorCode {
  return /^E_[A-Z0-9_]+(::.*)?$/.test(raw);
}

/** 从错误码字符串中拆出 code 与动态 detail（无 detail 时返回 undefined）。 */
export function splitErrorCode(raw: string): { code: string; detail?: string } {
  const idx = raw.indexOf('::');
  if (idx < 0) return { code: raw };
  return { code: raw.slice(0, idx), detail: raw.slice(idx + 2) };
}
