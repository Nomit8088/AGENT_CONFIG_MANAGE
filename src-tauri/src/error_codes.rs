//! 双端共享错误码（与前端 `src/shared/errorCodes.ts` 100% 对齐）。
//! 约定：Rust 端把错误码作为 `Err(String)` 返回（可选携带动态信息，形如 `E_XXX::detail`），
//! 前端 `translateError` 识别 `E_` 前缀后查语言包，并把 `::detail` 拼到本地化文案之后。
//! 进程原始输出（git stderr / pnpm 日志等）不是错误码，继续原样透传，不在此列。

pub const E_SYNC_NOT_INITIALIZED: &str = "E_SYNC_NOT_INITIALIZED";
pub const E_SYNC_NO_REMOTE: &str = "E_SYNC_NO_REMOTE";
pub const E_SYNC_BRANCH_MISSING: &str = "E_SYNC_BRANCH_MISSING";
pub const E_SYNC_DIRTY: &str = "E_SYNC_DIRTY";
pub const E_SYNC_PULL_FAILED: &str = "E_SYNC_PULL_FAILED";
pub const E_SYNC_PUSH_FAILED: &str = "E_SYNC_PUSH_FAILED";
pub const E_SYNC_FETCH_FAILED: &str = "E_SYNC_FETCH_FAILED";
pub const E_SYNC_CONNECT_FAILED: &str = "E_SYNC_CONNECT_FAILED";
pub const E_SYNC_BUSY: &str = "E_SYNC_BUSY";
pub const E_SYNC_SCHEDULE_UNSUPPORTED: &str = "E_SYNC_SCHEDULE_UNSUPPORTED";

pub const E_GIT_NOT_FOUND: &str = "E_GIT_NOT_FOUND";
pub const E_GIT_TIMEOUT: &str = "E_GIT_TIMEOUT";
pub const E_PNPM_NOT_FOUND: &str = "E_PNPM_NOT_FOUND";
pub const E_NPM_NOT_FOUND: &str = "E_NPM_NOT_FOUND";

pub const E_PLUGIN_KEY_UNKNOWN: &str = "E_PLUGIN_KEY_UNKNOWN";
pub const E_PROFILE_DIR_MISSING: &str = "E_PROFILE_DIR_MISSING";
pub const E_PROFILE_PKG_MISSING: &str = "E_PROFILE_PKG_MISSING";
pub const E_PKG_NAME_EMPTY: &str = "E_PKG_NAME_EMPTY";
pub const E_PKG_NAME_INVALID: &str = "E_PKG_NAME_INVALID";
pub const E_PKG_NOT_INSTALLED: &str = "E_PKG_NOT_INSTALLED";
pub const E_ADOPT_LINK_TARGET: &str = "E_ADOPT_LINK_TARGET";
pub const E_ADOPT_NOT_LINK: &str = "E_ADOPT_NOT_LINK";
pub const E_ADOPT_NO_PKG_JSON: &str = "E_ADOPT_NO_PKG_JSON";
pub const E_ADOPT_NAME_MISMATCH: &str = "E_ADOPT_NAME_MISMATCH";
pub const E_RECOVERY_UNKNOWN: &str = "E_RECOVERY_UNKNOWN";

pub const E_CONFIG_SAVE_FAILED: &str = "E_CONFIG_SAVE_FAILED";
pub const E_REPO_VALIDATE_FAILED: &str = "E_REPO_VALIDATE_FAILED";

pub const E_APP_UPDATE_CHECK_FAILED: &str = "E_APP_UPDATE_CHECK_FAILED";
pub const E_APP_UPDATE_ASSET_NOT_FOUND: &str = "E_APP_UPDATE_ASSET_NOT_FOUND";
pub const E_APP_UPDATE_DOWNLOAD_FAILED: &str = "E_APP_UPDATE_DOWNLOAD_FAILED";

pub const E_VERSION_UPGRADE_FAILED: &str = "E_VERSION_UPGRADE_FAILED";
pub const E_VERSION_INSTALL_FAILED: &str = "E_VERSION_INSTALL_FAILED";
pub const E_VERSION_ROLLBACK_FAILED: &str = "E_VERSION_ROLLBACK_FAILED";
pub const E_STREAM_INTERRUPTED: &str = "E_STREAM_INTERRUPTED";

/// 拼接动态详情：`E_XXX::detail`（无 detail 时就是纯 code）。
pub fn coded(code: &str, detail: impl std::fmt::Display) -> String {
    format!("{}::{}", code, detail)
}
