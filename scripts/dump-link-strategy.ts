// B-M2.2 跨语言对拍：dump Node 端链接策略决策表（与 Rust fs_junction.rs::dump_link_strategy_table 对齐）。
// 运行：npx tsx scripts/dump-link-strategy.ts
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { linkOpFor } from '../src/shared/linkStrategy';

const agents = [
  'antigravity', 'claude-code', 'codex', 'copilot', 'cursor', 'dsh', 'hermes', 'kimi',
  'kiro', 'mimocode', 'openclaw', 'pi', 'trae', 'windsurf', 'workbuddy', 'zcode',
  '', 'custom-agent',
];
const platforms = ['windows', 'darwin', 'linux'];

const lines: string[] = [];
for (const a of agents) {
  for (const p of platforms) {
    const op = linkOpFor(a, p);
    lines.push(`${a}|${p}|${op.primary}|${op.fallback}`);
  }
}
lines.sort();

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'src-tauri', 'target', 'link-strategy-table.node.txt');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, lines.join('\n') + '\n');
console.log('✅ Node link strategy table dumped to ' + out);
