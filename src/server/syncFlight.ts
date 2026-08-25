// 同步单飞（single-flight）守卫：手动同步与定时调度共用同一把锁，
// 保证同一时刻最多只有一个同步动作在操作共享 `.git`。
// 与 Rust `src-tauri/src/sync_guard.rs` 语义一致（进程级互斥）。

let inFlight = false;

/** 尝试获取同步执行权；已有同步在跑时返回 false（本次跳过）。 */
export function tryAcquireSyncFlight(): boolean {
  if (inFlight) return false;
  inFlight = true;
  return true;
}

export function releaseSyncFlight(): void {
  inFlight = false;
}
