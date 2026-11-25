#!/usr/bin/env node
/**
 * SomBill frontend dev server: ONE port for everything (default 3000).
 *
 *   cd frontend
 *   npm run dev        ->  http://localhost:3000/
 *
 * The public website (Vite 8, React 19, Tailwind 4) and the dashboards (Vite 5, React 18, Tailwind 3) both run
 * inside this single Node process in Vite "middleware mode", so neither of them opens a port of its own.
 * Hot reload for both apps also goes over port 3000 (two WebSocket paths on the same server).
 *
 * The dashboards' modules are served under /_app/ so their files (/src/..., /node_modules/.vite/...) can never
 * be mixed up with the website's files of the same name. Each app gets its own HTML page, its own CSS and its own
 * React, which keeps the two designs from bleeding into each other.
 *
 * Routing:
 *   /_app/*                         dashboards modules and assets
 *   /login, /manager, /waiter, ...  dashboards page (React Router takes it from there)
 *   /branding/*                     dashboards public folder (logo)
 *   everything else                 website (/, /pricing, /about, /product/<slug>, ...)
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const FRONTEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEBSITE_DIR = path.join(FRONTEND, 'apps', 'website');
const DASHBOARDS_DIR = path.join(FRONTEND, 'apps', 'dashboards');

const PORT = Number(process.env.PORT) || 3000;
const DASHBOARDS_BASE = '/_app/';
const BACKEND_ORIGIN = (process.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');

function proxyToBackend(req, res) {
  let target;
  try {
    target = new URL(req.url ?? '/', BACKEND_ORIGIN);
  } catch {
    res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ error: 'Invalid backend gateway URL', target: BACKEND_ORIGIN }));
  }

  const upstream = http.request(
    {
      hostname: target.hostname,
      port: target.port || (target.protocol === 'https:' ? 443 : 80),
      path: target.pathname + target.search,
      method: req.method,
      headers: { ...req.headers, host: target.host },
    },
    (upRes) => {
      res.writeHead(upRes.statusCode ?? 502, upRes.headers);
      upRes.pipe(res, { end: true });
    },
  );

  upstream.on('error', (err) => {
    if (res.headersSent) return res.end();
    res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(
      JSON.stringify({
        error: 'Backend API gateway unreachable',
        target: BACKEND_ORIGIN,
        detail: err.message,
      }),
    );
  });

  req.pipe(upstream, { end: true });
}

// First path segments that belong to the dashboards app. Keep in sync with apps/dashboards/src/app/App.tsx.
const DASHBOARD_ROUTES = [
  'login',
  'reset-password',
  'forgot-password',
  'table-menu',
  'manager',
  'dashboard',
  'waiter',
  'cashier',
  'cashier-print',
  'super-admin',
  'orders',
  'menu',
  'categories',
  'tables',
  'staff',
  'customers',
  'inventory',
  'suppliers',
  'purchase-orders',
  'expenses',
  'reports',
  'settings',
];

// Files the dashboards code references by absolute path (served from apps/dashboards/public).
const DASHBOARD_PUBLIC_PREFIXES = ['/branding/', '/manifest.webmanifest', '/sw.js'];

function isDashboardRoute(pathname) {
  const first = pathname.toLowerCase().split('/')[1] ?? '';
  return DASHBOARD_ROUTES.includes(first);
}

/** Imports the copy of Vite that is installed for `appDir` (each app has its own Vite major version). */
async function loadVite(appDir) {
  let dir = appDir;
  for (;;) {
    const pkgFile = path.join(dir, 'node_modules', 'vite', 'package.json');
    if (fs.existsSync(pkgFile)) {
      const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
      const exp = pkg.exports?.['.'];
      const entry =
        typeof exp === 'string' ? exp : (exp?.import?.default ?? exp?.import ?? exp?.default ?? 'dist/node/index.js');
      return { vite: await import(pathToFileURL(path.join(path.dirname(pkgFile), entry)).href), version: pkg.version };
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(
        `Vite is not installed for ${path.relative(FRONTEND, appDir)}.\n` +
          '  Run in the frontend folder:  npm install  &&  npm install --prefix apps/website',
      );
    }
    dir = parent;
  }
}

function hasFileExtension(pathname) {
  const ext = path.extname(pathname);
  return ext !== '' && ext !== '.html';
}

async function sendIndexHtml(server, appDir, req, res) {
  const template = fs.readFileSync(path.join(appDir, 'index.html'), 'utf8');
  const html = await server.transformIndexHtml(req.url ?? '/', template, req.originalUrl);
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
  res.end(req.method === 'HEAD' ? undefined : html);
}

function sendNotFound(res) {
  if (res.headersSent) return res.end();
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
}

function sendError(res, err) {
  console.error(err);
  if (res.headersSent) return res.end();
  res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(String(err?.stack ?? err));
}

async function main() {
  const httpServer = http.createServer();

  const [{ vite: websiteVite }, { vite: dashboardsVite }] = await Promise.all([
    loadVite(WEBSITE_DIR),
    loadVite(DASHBOARDS_DIR),
  ]);

  // Website: Vite 8 configures the HMR socket under `server.ws`.
  const website = await websiteVite.createServer({
    root: WEBSITE_DIR,
    configFile: path.join(WEBSITE_DIR, 'vite.config.ts'),
    appType: 'custom',
    base: '/',
    server: { middlewareMode: true, ws: { server: httpServer, path: '/__website_hmr' } },
  });

  // Dashboards: Vite 5 configures the HMR socket under `server.hmr`. Its socket path becomes /_app/__hmr.
  const dashboards = await dashboardsVite.createServer({
    root: DASHBOARDS_DIR,
    configFile: path.join(DASHBOARDS_DIR, 'vite.config.ts'),
    appType: 'custom',
    base: DASHBOARDS_BASE,
    server: { middlewareMode: true, hmr: { server: httpServer, path: '__hmr' } },
  });

  httpServer.on('request', (req, res) => {
    const url = req.url ?? '/';
    let pathname;
    try {
      pathname = decodeURIComponent(url.split('?')[0]);
    } catch {
      return sendNotFound(res);
    }
    const isPage = (req.method === 'GET' || req.method === 'HEAD') && !hasFileExtension(pathname);
    const fail = (err) => (err ? sendError(res, err) : sendNotFound(res));

    // Backend API Gateway proxy: /api/* and /health/* -> http://localhost:4000
    if (
      pathname === '/api' ||
      pathname.startsWith('/api/') ||
      pathname === '/health' ||
      pathname.startsWith('/health/')
    ) {
      return proxyToBackend(req, res);
    }

    // Dashboards modules and assets.
    if (pathname.startsWith(DASHBOARDS_BASE)) {
      return dashboards.middlewares(req, res, fail);
    }
    if (pathname === '/_app') {
      res.writeHead(302, { Location: '/login' });
      return res.end();
    }

    // Dashboards pages: /login, /manager/..., /waiter/..., /cashier/..., /super-admin/...
    if (isDashboardRoute(pathname)) {
      if (!isPage) return sendNotFound(res);
      return sendIndexHtml(dashboards, DASHBOARDS_DIR, req, res).catch((err) => sendError(res, err));
    }

    // Dashboards public files referenced by absolute path (e.g. /branding/sombill-logo.png).
    if (DASHBOARD_PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
      req.url = DASHBOARDS_BASE.slice(0, -1) + url;
      return dashboards.middlewares(req, res, fail);
    }

    // Website: its own modules and public files first, then its page for every other path.
    return website.middlewares(req, res, (err) => {
      if (err) return sendError(res, err);
      if (!isPage) return sendNotFound(res);
      return sendIndexHtml(website, WEBSITE_DIR, req, res).catch((e) => sendError(res, e));
    });
  });

  const shutdown = async () => {
    console.log('\nStopping SomBill dev server...');
    await Promise.allSettled([website.close(), dashboards.close()]);
    httpServer.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  httpServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(
        `\n  Port ${PORT} is already in use. Stop the other program that uses it (for example an older "npm run dev")\n` +
          '  and run "npm run dev" again.\n',
      );
    } else {
      console.error(err);
    }
    process.exit(1);
  });

  httpServer.listen(PORT, () => {
    const u = `http://localhost:${PORT}`;
    const g = (s) => `\x1b[32m${s}\x1b[0m`;
    const c = (s) => `\x1b[36m${s}\x1b[0m`;
    const b = (s) => `\x1b[1m${s}\x1b[0m`;
    console.log(`
  ${b(g('SomBill'))} ${b('frontend')}  (one server, one port)

  ${g('➜')}  ${b('Local:')}        ${c(`${u}/`)}

     Website        ${u}/
     Sign in        ${u}/login
     Reset password ${u}/reset-password
     Manager        ${u}/manager
     Waiter POS     ${u}/waiter
     Cashier POS    ${u}/cashier
     Super Admin    ${u}/super-admin
     Backend Proxy  ${u}/api  ->  ${BACKEND_ORIGIN}

  Press Ctrl+C to stop.
`);
  });
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});
