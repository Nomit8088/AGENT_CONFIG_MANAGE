// 应用本体在线更新（cc-switch 风格）— Web 开发模式后端，与 src-tauri/src/app_update.rs 行为对齐。
// 路由见 vite.config.ts 的 /api/app/update/*。
import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';
import net from 'net';
import tls from 'tls';
import { spawn } from 'child_process';
import { URL } from 'url';
import { getAppDataDir } from './localApi';
import { detectSystemProxy } from './gitSyncUtil';
import type { AppUpdateCheck, AppUpdateDownload } from '../types';

// 需与 package.json / Cargo.toml / tauri.conf.json 保持一致。
const APP_VERSION = '1.0.0';
const UPDATE_REPO = 'Nomit8088/AGENT_CONFIG_MANAGE';
const UPDATE_API_URL = `https://api.github.com/repos/${UPDATE_REPO}/releases/latest`;
const USER_AGENT = 'AgentHub';

interface ProxyTarget {
  host: string;
  port: number;
}

function proxyTarget(): ProxyTarget | null {
  const p = detectSystemProxy();
  if (!p) return null;
  try {
    const u = new URL(p);
    return {
      host: u.hostname,
      port: Number(u.port) || (u.protocol === 'https:' ? 443 : 80),
    };
  } catch {
    return null;
  }
}

/** 通过 HTTP 代理建立到目标 HTTPS 主机的 CONNECT 隧道，返回可升级为 TLS 的裸 socket。 */
function tunnelToTarget(u: URL, proxy: ProxyTarget): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const socket = net.connect(proxy.port, proxy.host);
    const targetHost = `${u.hostname}:${u.port || 443}`;

    socket.once('error', reject);
    socket.once('connect', () => {
      socket.write(
        `CONNECT ${targetHost} HTTP/1.1\r\nHost: ${targetHost}\r\nProxy-Connection: keep-alive\r\n\r\n`,
      );
    });

    let buf = Buffer.alloc(0);
    const onData = (chunk: Buffer) => {
      buf = Buffer.concat([buf, chunk]);
      const idx = buf.indexOf('\r\n\r\n');
      if (idx < 0) return;

      const head = buf.slice(0, idx).toString();
      const statusMatch = head.match(/^HTTP\/1\.[01]\s+(\d+)/);
      if (!statusMatch || statusMatch[1] !== '200') {
        socket.destroy();
        reject(new Error('代理隧道建立失败: ' + head.split('\r\n')[0]));
        return;
      }

      socket.off('data', onData);
      const leftover = buf.slice(idx + 4);
      if (leftover.length) socket.unshift(leftover);
      resolve(socket);
    };
    socket.on('data', onData);
  });
}

class ProxiedHttpsAgent extends https.Agent {
  private tunnel: net.Socket;
  private host: string;

  constructor(tunnel: net.Socket, host: string) {
    super({ keepAlive: false, maxSockets: 1 });
    this.tunnel = tunnel;
    this.host = host;
  }

  createConnection(_opts: any, callback?: any): any {
    const tlsSocket = tls.connect({ socket: this.tunnel, servername: this.host });
    if (callback) {
      tlsSocket.once('secureConnect', () => callback(null, tlsSocket));
      tlsSocket.once('error', (err: any) => callback(err, tlsSocket));
    }
    return tlsSocket;
  }
}

/** 发起一次 HTTPS GET，返回响应流（已处理系统代理）。 */
async function httpsGet(
  urlStr: string,
  headers: Record<string, string>,
): Promise<http.IncomingMessage> {
  const u = new URL(urlStr);
  const proxy = proxyTarget();
  const agent = proxy ? new ProxiedHttpsAgent(await tunnelToTarget(u, proxy), u.hostname) : undefined;

  return new Promise<http.IncomingMessage>((resolve, reject) => {
    const req = https.request(
      {
        hostname: u.hostname,
        port: Number(u.port) || 443,
        path: u.pathname + u.search,
        method: 'GET',
        headers,
        agent,
      },
      (res) => resolve(res),
    );
    req.on('error', reject);
    req.end();
  });
}

async function readBody(res: http.IncomingMessage): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let data = '';
    res.on('data', (c) => (data += c));
    res.on('end', () => resolve(data));
    res.on('error', reject);
  });
}

function versionParts(v: string): number[] {
  return v
    .trim()
    .replace(/^v/, '')
    .split(/[^0-9]+/)
    .filter(Boolean)
    .map((n) => parseInt(n, 10) || 0);
}

function versionNewer(latest: string, current: string): boolean {
  const a = versionParts(latest);
  const b = versionParts(current);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av !== bv) return av > bv;
  }
  return false;
}

function candidateExtensions(): string[] {
  if (process.platform === 'win32') return ['.exe', '.msi'];
  if (process.platform === 'darwin') return ['.dmg', '.app.tar.gz'];
  return ['.deb', '.AppImage', '.rpm'];
}

interface PickedAsset {
  name: string;
  url: string;
  size: number;
}

function pickAsset(assets: unknown[]): PickedAsset | null {
  if (!Array.isArray(assets)) return null;
  for (const ext of candidateExtensions()) {
    const a = assets.find(
      (x) =>
        x &&
        typeof (x as any)?.name === 'string' &&
        (x as any).name.toLowerCase().endsWith(ext) &&
        typeof (x as any)?.browser_download_url === 'string',
    );
    if (a) {
      const item = a as any;
      return { name: item.name, url: item.browser_download_url, size: Number(item.size) || 0 };
    }
  }
  return null;
}

export async function checkAppUpdate(): Promise<AppUpdateCheck> {
  const current = APP_VERSION;
  try {
    const res = await httpsGet(UPDATE_API_URL, {
      'User-Agent': USER_AGENT,
      Accept: 'application/vnd.github+json',
    });
    if (res.statusCode !== 200) {
      return {
        currentVersion: current,
        latestVersion: '',
        updateAvailable: false,
        releaseNotes: '',
        error: `GitHub Releases 返回 HTTP ${res.statusCode}`,
      };
    }
    const body = await readBody(res);
    const release = JSON.parse(body);
    const latest = String(release?.tag_name || '').trim().replace(/^v/, '');
    const asset = pickAsset(release?.assets);

    return {
      currentVersion: current,
      latestVersion: latest || current,
      updateAvailable: !!latest && versionNewer(latest, current),
      releaseNotes: String(release?.body || ''),
      publishedAt: release?.published_at ? String(release.published_at) : undefined,
      downloadUrl: asset?.url,
      assetName: asset?.name,
      assetSize: asset?.size,
    };
  } catch (e: any) {
    return {
      currentVersion: current,
      latestVersion: '',
      updateAvailable: false,
      releaseNotes: '',
      error: e?.message || '检查更新失败',
    };
  }
}

/** 下载安装包到临时目录，实时回调进度（支持 302 跳转与系统代理）。 */
async function downloadToFile(
  initialUrl: string,
  dest: string,
  onProgress: (downloaded: number, total: number) => void,
): Promise<void> {
  let current = initialUrl;
  for (let hop = 0; hop < 5; hop++) {
    const u = new URL(current);
    const proxy = proxyTarget();
    const agent = proxy ? new ProxiedHttpsAgent(await tunnelToTarget(u, proxy), u.hostname) : undefined;

    const outcome = await new Promise<{ redirect?: string; done: boolean }>((resolve, reject) => {
      const req = https.request(
        {
          hostname: u.hostname,
          port: Number(u.port) || 443,
          path: u.pathname + u.search,
          method: 'GET',
          headers: { 'User-Agent': USER_AGENT },
          agent,
        },
        (res) => {
          const status = res.statusCode || 0;
          if ([301, 302, 303, 307, 308].includes(status)) {
            const loc = res.headers.location;
            res.resume();
            resolve({ redirect: loc ? new URL(loc, current).toString() : undefined, done: false });
            return;
          }
          if (status !== 200) {
            res.resume();
            reject(new Error(`下载返回 HTTP ${status}`));
            return;
          }

          const total = Number(res.headers['content-length'] || 0);
          let received = 0;
          const file = fs.createWriteStream(dest);
          res.on('data', (chunk) => {
            received += chunk.length;
            file.write(chunk);
            onProgress(received, total);
          });
          res.on('end', () => file.end(() => resolve({ done: true })));
          res.on('error', reject);
        },
      );
      req.on('error', reject);
      req.end();
    });

    if (outcome.done) return;
    if (outcome.redirect) {
      current = outcome.redirect;
      continue;
    }
  }
  throw new Error('下载重定向次数过多');
}

export async function downloadAppUpdate(
  onProgress: (downloaded: number, total: number) => void,
): Promise<AppUpdateDownload> {
  const info = await checkAppUpdate();
  if (!info.downloadUrl) {
    throw new Error(info.error || '未找到可下载的安装包资产');
  }

  const dir = path.join(getAppDataDir(), 'updates');
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, info.assetName || `AgentHub-${info.latestVersion}-setup.exe`);

  await downloadToFile(info.downloadUrl, dest, onProgress);
  return {
    ok: true,
    path: dest,
    fileName: path.basename(dest),
    size: info.assetSize || 0,
  };
}

export function installAppUpdate(installPath: string): void {
  if (!fs.existsSync(installPath)) {
    throw new Error('安装包不存在，请先重新下载');
  }

  if (process.platform === 'win32') {
    const lower = installPath.toLowerCase();
    if (lower.endsWith('.msi')) {
      spawn('msiexec', ['/i', installPath, '/qn', '/norestart'], {
        detached: true,
        stdio: 'ignore',
      }).unref();
    } else {
      spawn(installPath, ['/S'], { detached: true, stdio: 'ignore' }).unref();
    }
  } else {
    spawn(installPath, [], { detached: true, stdio: 'ignore' }).unref();
  }
}
