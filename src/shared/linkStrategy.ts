// 链接策略（能力枚举 × 平台 → 具体操作 + fallback 链）。
// 单一事实源，供服务端（localApi.ts / vite.config.ts）与 UI 组件（AgentCard / AgentDetailModal）共用；
// 与 Rust 端 src-tauri/src/fs_junction.rs 的 LinkStrategy / link_strategy_for 保持对齐。
// 见 PLAN_WI011_MULTI_PLATFORM.md §4.2.2。
export type LinkStrategy = 'default' | 'hardlinkTree' | 'copy';

const HARD_LINK_TREE_AGENTS = new Set(['antigravity']);

/** Agent 能力枚举 → 链接策略（当前唯一特例：antigravity 走 hardlink-tree）。 */
export function linkStrategyFor(agentId: string): LinkStrategy {
  return HARD_LINK_TREE_AGENTS.has(agentId) ? 'hardlinkTree' : 'default';
}

/** 是否走 hardlink-tree（不产生 junction/symlink）。 */
export function usesHardlinkTree(agentId: string): boolean {
  return linkStrategyFor(agentId) === 'hardlinkTree';
}

/** 平台 → 具体链接操作（primary）+ fallback 链（B-M2.2 跨语言对拍用，与 Rust link_op_for 对齐）。 */
export interface LinkOp {
  primary: string;
  fallback: string;
}

export function linkOpFor(agentId: string, platform: string): LinkOp {
  const strategy = linkStrategyFor(agentId);
  if (strategy === 'hardlinkTree') {
    return { primary: 'hardlink-tree', fallback: 'copy' };
  }
  if (strategy === 'copy') {
    return { primary: 'copy', fallback: '' };
  }
  return {
    primary: platform === 'windows' ? 'junction' : 'symlink',
    fallback: 'hardlink-tree>copy',
  };
}
