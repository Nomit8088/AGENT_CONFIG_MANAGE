// CI-A 冒烟断言（B-M9.1 Node 端数据目录 + B-M2.2 Node 端链接策略）。
// 在 CI 上由 `npx tsx scripts/ci-a-test.ts` 运行；本地亦可直接跑。
import os from 'node:os';
import path from 'node:path';
import { getAppDataDir } from '../src/server/appPaths';
import { linkStrategyFor, linkOpFor, usesHardlinkTree } from '../src/shared/linkStrategy';

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    console.error('❌ ' + msg);
    process.exit(1);
  }
}

// B-M9.1：应用数据目录 = <平台基目录>/AgentHub
const dir = getAppDataDir();
assert(path.basename(dir) === 'AgentHub', `数据目录应以 AgentHub 结尾，实际 ${dir}`);
if (process.platform === 'win32') {
  const appdata = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  assert(dir.startsWith(appdata), `Windows 数据目录应位于 %APPDATA% 下，实际 ${dir}`);
} else if (process.platform === 'darwin') {
  const base = path.join(os.homedir(), 'Library', 'Application Support');
  assert(dir.startsWith(base), `macOS 数据目录应位于 ~/Library/Application Support 下，实际 ${dir}`);
} else {
  const base = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  assert(dir.startsWith(base), `Linux 数据目录应位于 $XDG_CONFIG_HOME/~/.config 下，实际 ${dir}`);
}

// B-M2.2：链接策略决策（与 Rust link_op_for 对齐，另由 CI 对拍 diff 双保险）
assert(usesHardlinkTree('antigravity'), 'antigravity 应走 hardlinkTree');
assert(!usesHardlinkTree('cursor'), 'cursor 应走 default');
assert(linkStrategyFor('antigravity') === 'hardlinkTree', 'antigravity 策略应为 hardlinkTree');
assert(linkStrategyFor('cursor') === 'default', 'cursor 策略应为 default');
assert(linkOpFor('antigravity', 'darwin').primary === 'hardlink-tree', 'antigravity 主策略应为 hardlink-tree');
assert(linkOpFor('cursor', 'windows').primary === 'junction', 'cursor windows 主策略应为 junction');
assert(linkOpFor('cursor', 'darwin').primary === 'symlink', 'cursor darwin 主策略应为 symlink');

console.log('✅ CI-A Node 断言全部通过');
