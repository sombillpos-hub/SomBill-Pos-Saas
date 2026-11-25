#!/usr/bin/env node
/**
 * One-command frontend setup for Windows, macOS and Linux (Node.js 22+).
 *
 *   node scripts/setup-frontend.mjs           install the dashboards workspace and the website, create .env.local
 *   node scripts/setup-frontend.mjs --build   also run both production builds (type-check included)
 *
 * The dashboards run on Supabase today. Put your project's URL and anon key in
 * frontend/apps/dashboards/.env.local (or set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before running this
 * script and they are written for you). Existing .env.local files are never overwritten.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FRONTEND = path.join(ROOT, "frontend");
const DASHBOARDS = path.join(FRONTEND, "apps", "dashboards");
const WEBSITE = path.join(FRONTEND, "apps", "website");
const args = new Set(process.argv.slice(2));
const isWindows = process.platform === "win32";

const step = (msg) => console.log(`\n\x1b[1m→ ${msg}\x1b[0m`);
const ok = (msg) => console.log(`  \x1b[32m✓\x1b[0m ${msg}`);
const warn = (msg) => console.log(`  \x1b[33m!\x1b[0m ${msg}`);
const fail = (msg) => {
  console.error(`\n\x1b[31m✗ ${msg}\x1b[0m`);
  process.exit(1);
};
const npm = (cwd, ...a) =>
  spawnSync("npm", a, { cwd, stdio: "inherit", shell: isWindows }).status === 0;

step("Checking Node.js and npm");
const major = Number(process.versions.node.split(".")[0]);
if (major < 22)
  fail(
    `Node.js 22 or newer is required (found ${process.versions.node}). Install it from https://nodejs.org`,
  );
const npmVersion = spawnSync("npm", ["--version"], {
  shell: isWindows,
  encoding: "utf8",
});
if (npmVersion.status !== 0)
  fail("npm was not found. It is installed together with Node.js.");
ok(`Node.js ${process.versions.node}, npm ${npmVersion.stdout.trim()}`);

step("Dashboards environment (frontend/apps/dashboards/.env.local)");
const envLocal = path.join(DASHBOARDS, ".env.local");
let needsSupabase = false;
if (existsSync(envLocal)) {
  ok(".env.local already exists (kept)");
  needsSupabase = /YOUR-PROJECT|YOUR-ANON-KEY/.test(
    readFileSync(envLocal, "utf8"),
  );
} else {
  const url =
    process.env.VITE_SUPABASE_URL ?? "https://YOUR-PROJECT.supabase.co";
  const key = process.env.VITE_SUPABASE_ANON_KEY ?? "YOUR-ANON-KEY";
  needsSupabase = url.includes("YOUR-PROJECT") || key === "YOUR-ANON-KEY";
  const example = readFileSync(path.join(DASHBOARDS, ".env.example"), "utf8")
    .replace(/^VITE_SUPABASE_URL=.*$/m, `VITE_SUPABASE_URL=${url}`)
    .replace(/^VITE_SUPABASE_ANON_KEY=.*$/m, `VITE_SUPABASE_ANON_KEY=${key}`)
    // Local backend (node scripts/setup-backend.mjs): API gateway on :4000. No Socket.IO server exists yet.
    .replace(
      /^VITE_API_BASE_URL=.*$/m,
      "VITE_API_BASE_URL=http://localhost:4000/api/v1",
    )
    .replace(/^VITE_SOCKET_URL=.*$/m, "VITE_SOCKET_URL=");
  writeFileSync(envLocal, example);
  ok(
    ".env.local created from .env.example (API: http://localhost:4000/api/v1)",
  );
}
if (needsSupabase) {
  warn(
    "Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in frontend/apps/dashboards/.env.local",
  );
  warn(
    "(Supabase → Project Settings → API). Until then the dashboards open, but sign-in cannot work.",
  );
}

step("Installing the dashboards workspace (frontend: npm ci)");
if (!npm(FRONTEND, "ci"))
  fail("npm ci in frontend/ failed (see the output above).");
ok("dashboards, role apps and shared packages installed");

step("Installing the public website (frontend/apps/website: npm ci)");
if (!npm(WEBSITE, "ci")) fail("npm ci in frontend/apps/website failed.");
ok(
  "website installed (it has its own dependencies: React 19, Tailwind 4, Vite 8)",
);

if (args.has("--build")) {
  step("Building the dashboards (type-check + production build)");
  if (!npm(FRONTEND, "run", "build:dashboards"))
    fail("dashboards build failed.");
  ok("frontend/apps/dashboards/dist");
  step("Building the website");
  if (!npm(FRONTEND, "run", "build:website")) fail("website build failed.");
  ok("frontend/apps/website/dist");
}

console.log(`
\x1b[1;32mFrontend ready.\x1b[0m

  Website + dashboards (one port):     cd frontend && npm run dev   →  http://localhost:3000
  Tests:                               npm --prefix frontend test
`);
