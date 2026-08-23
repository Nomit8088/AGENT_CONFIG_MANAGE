#!/usr/bin/env node
// 校验版本号一致（R14）：package.json / Cargo.toml / tauri.conf.json / src/types/index.ts APP_VERSION 必须全等，
// 防止 5 处硬编码漂移导致在线更新判定失效。CI 与本地均可 `node scripts/check-version-sync.mjs` 运行。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fail(msg) {
  console.error('❌ 版本号不一致: ' + msg);
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const cargo = fs.readFileSync(path.join(root, 'src-tauri', 'Cargo.toml'), 'utf8');
const tauriConf = JSON.parse(fs.readFileSync(path.join(root, 'src-tauri', 'tauri.conf.json'), 'utf8'));
const typesTs = fs.readFileSync(path.join(root, 'src', 'types', 'index.ts'), 'utf8');

const versions = {
  'package.json': pkg.version,
  'Cargo.toml': cargo.match(/^version\s*=\s*"([^"]+)"/m)?.[1],
  'tauri.conf.json': tauriConf.version,
  'src/types/index.ts APP_VERSION': typesTs.match(/APP_VERSION\s*=\s*['"]([^'"]+)['"]/)?.[1],
};

const missing = Object.entries(versions).filter(([, v]) => !v);
if (missing.length) {
  fail('解析失败: ' + JSON.stringify(Object.fromEntries(missing)));
}

const uniq = new Set(Object.values(versions));
if (uniq.size !== 1) {
  fail(JSON.stringify(versions));
}

console.log('✅ 版本号一致: ' + versions['package.json']);
