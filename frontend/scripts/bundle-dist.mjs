#!/usr/bin/env node
/**
 * Unified static deployment bundler for SomBill Frontend (Vercel / CDN).
 *
 * Combines the production build of `apps/website` (React 19 + Tailwind 4 + Vite 8)
 * and `apps/dashboards` (React 18 + Tailwind 3 + Vite 5) into `frontend/dist/`:
 *   - Website HTML -> dist/index.html
 *   - Dashboards HTML -> dist/app.html
 *   - Website & Dashboards static assets (/assets/*, /images/*, /branding/*, /sw.js, /manifest.webmanifest) -> dist/*
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FRONTEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(FRONTEND, 'dist');
const WEBSITE_DIST = path.join(FRONTEND, 'apps', 'website', 'dist');
const DASHBOARDS_DIST = path.join(FRONTEND, 'apps', 'dashboards', 'dist');

if (!fs.existsSync(WEBSITE_DIST)) {
  console.error('Missing website build output at apps/website/dist. Run npm run build:website first.');
  process.exit(1);
}
if (!fs.existsSync(DASHBOARDS_DIST)) {
  console.error('Missing dashboards build output at apps/dashboards/dist. Run npm run build:dashboards first.');
  process.exit(1);
}

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

// 1. Copy public website build (dist/index.html, dist/assets/*, dist/images/*)
fs.cpSync(WEBSITE_DIST, DIST, { recursive: true });

// 2. Copy dashboards build (assets/*, branding/*, manifest.webmanifest, sw.js) and write its HTML shell to dist/app.html
for (const entry of fs.readdirSync(DASHBOARDS_DIST)) {
  const srcPath = path.join(DASHBOARDS_DIST, entry);
  if (entry === 'index.html') {
    fs.copyFileSync(srcPath, path.join(DIST, 'app.html'));
  } else {
    fs.cpSync(srcPath, path.join(DIST, entry), { recursive: true });
  }
}

console.log('✓ Unified SomBill deployment bundle created in frontend/dist (index.html + app.html)');
