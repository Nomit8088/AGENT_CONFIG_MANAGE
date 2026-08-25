//! 同步单飞（single-flight）守卫：手动同步与定时调度共用同一把锁，
//! 保证同一时刻最多只有一个同步动作在操作共享 `.git`。
//! 守卫为进程级（跨模块全局），动作结束（含 panic 展开）自动释放。

use std::sync::atomic::{AtomicBool, Ordering};

static IN_FLIGHT: AtomicBool = AtomicBool::new(false);

/// RAII 守卫：`acquire()` 成功拿到锁，drop 时自动释放。
pub struct SyncFlightGuard;

impl SyncFlightGuard {
    /// 尝试获取同步执行权；已有同步在跑时返回 `None`（本次跳过）。
    pub fn acquire() -> Option<Self> {
        match IN_FLIGHT.compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire) {
            Ok(_) => Some(Self),
            Err(_) => None,
        }
    }
}

impl Drop for SyncFlightGuard {
    fn drop(&mut self) {
        IN_FLIGHT.store(false, Ordering::Release);
    }
}
