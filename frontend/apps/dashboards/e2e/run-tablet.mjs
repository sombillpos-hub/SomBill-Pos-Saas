// Starts `vite preview` on dist-e2e, runs the Waiter/Cashier tablet check, the Super Admin check, the sign-in check
// and the route check (every route, every role), then stops the server.
// CHROME_PATH overrides the browser (auto-detects Chrome/Edge on Windows & Linux). THEME=dark checks the dark theme.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const viteBin = path.resolve(dir, '../../../node_modules/vite/bin/vite.js');
const port = 4179;
const baseUrl = `http://127.0.0.1:${port}`;
const CANDIDATES = [
  process.env.CHROME_PATH,
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean);
const chrome = CANDIDATES.find((p) => fs.existsSync(p)) ?? '/usr/bin/google-chrome';

const server = spawn(
  process.execPath,
  [viteBin, 'preview', '--host', '127.0.0.1', '--outDir', 'dist-e2e', '--port', String(port), '--strictPort'],
  { stdio: 'ignore' },
);

for (let i = 0; i < 40; i++) {
  try {
    const res = await fetch(baseUrl);
    if (res.ok) break;
  } catch {
    /* server still starting */
  }
  await new Promise((r) => setTimeout(r, 250));
}

const run = (script, out) =>
  new Promise((resolve) =>
    spawn(process.execPath, [script, baseUrl, chrome, out], { stdio: 'inherit' }).on('exit', (c) => resolve(c ?? 1)),
  );

const a = await run('e2e/tablet.mjs', 'e2e/screens');
const b = await run('e2e/hq.mjs', 'e2e/screens-hq');
const c = await run('e2e/login.mjs', 'e2e/screens-login');
const d = await run('e2e/routes.mjs', '');
server.kill();
process.exit(a || b || c || d ? 1 : 0);
