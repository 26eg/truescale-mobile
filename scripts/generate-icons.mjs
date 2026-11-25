import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const iconsDir = path.resolve(__dirname, '../public/icons');
const svgPath = path.resolve(__dirname, './icon-master.svg');
const CHROME_BIN = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const CDP_PORT = 9245;
const USER_DATA_DIR = `/tmp/truescale-icons-${Date.now()}`;

fs.mkdirSync(iconsDir, { recursive: true });
fs.mkdirSync(USER_DATA_DIR, { recursive: true });

const svgMarkup = fs.readFileSync(svgPath, 'utf8');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function cdpCall(ws, method, params = {}) {
  const id = Math.floor(Math.random() * 1e9);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout on ${method}`)), 20000);
    const handler = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id === id) {
        clearTimeout(timer);
        ws.removeEventListener('message', handler);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function waitForPageTarget() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json`);
      const targets = await res.json();
      const page = targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      // retry until Chrome opens debugger port
    }
    await sleep(150);
  }
  throw new Error('Could not connect to Chrome CDP for icon generation');
}

const chrome = spawn(
  CHROME_BIN,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${USER_DATA_DIR}`,
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank',
  ],
  { stdio: 'ignore' },
);

try {
  const wsUrl = await waitForPageTarget();
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve);
    ws.addEventListener('error', reject);
  });

  await cdpCall(ws, 'Runtime.enable');
  const expr = `(async () => {
    const svg = ${JSON.stringify(svgMarkup)};
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    });

    const out = {};
    for (const size of [16, 32, 48, 128]) {
      const c = document.createElement('canvas');
      c.width = size;
      c.height = size;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, size, size);
      out['icon' + size] = c.toDataURL('image/png').split(',')[1];

      const imgData = ctx.getImageData(0, 0, size, size);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        const a = d[i + 3];
        if (a === 0) continue;
        const lum = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
        const muted = Math.min(255, Math.round(lum * 0.72 + 52));
        d[i] = muted;
        d[i + 1] = muted;
        d[i + 2] = muted;
        d[i + 3] = Math.round(a * 0.76);
      }
      ctx.putImageData(imgData, 0, 0);
      out['icon' + size + '-gray'] = c.toDataURL('image/png').split(',')[1];
    }
    return JSON.stringify(out);
  })()`;

  const res = await cdpCall(ws, 'Runtime.evaluate', {
    expression: expr,
    awaitPromise: true,
    returnByValue: true,
  });

  const icons = JSON.parse(res.result.value);
  for (const [name, b64] of Object.entries(icons)) {
    const outPath = path.join(iconsDir, `${name}.png`);
    const buf = Buffer.from(b64, 'base64');
    fs.writeFileSync(outPath, buf);
    console.log(`Generated ${outPath} (${buf.length} bytes)`);
  }
  ws.close();
} finally {
  chrome.kill('SIGKILL');
  fs.rmSync(USER_DATA_DIR, { recursive: true, force: true });
}
