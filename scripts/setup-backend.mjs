#!/usr/bin/env node
/**
 * One-command backend setup for Windows, macOS and Linux (only Node.js 22+ is required; Docker for --infra).
 *
 *   node scripts/setup-backend.mjs              install dependencies, generate Prisma clients, build, create keys and .env files
 *   node scripts/setup-backend.mjs --infra      also start PostgreSQL, Redis and RabbitMQ in Docker and apply migrations
 *   node scripts/setup-backend.mjs --migrate    apply migrations to already running databases
 *   node scripts/setup-backend.mjs --seed       also run the seeds (set SEED_ADMIN_PASSWORD first)
 *
 * Safe to run again: existing keys and .env files are never overwritten.
 */
import { spawnSync } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { createConnection } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BACKEND = path.join(ROOT, "backend");
const DEV = path.join(ROOT, "infrastructure", "deployment", "development");
const SECRETS = path.join(ROOT, "infrastructure", "secrets");
const PNPM_VERSION = "10.28.0";
const args = new Set(process.argv.slice(2));
const isWindows = process.platform === "win32";

const step = (msg) => console.log(`\n\x1b[1m→ ${msg}\x1b[0m`);
const ok = (msg) => console.log(`  \x1b[32m✓\x1b[0m ${msg}`);
const fail = (msg) => {
  console.error(`\n\x1b[31m✗ ${msg}\x1b[0m`);
  process.exit(1);
};

function run(cmd, cmdArgs, opts = {}) {
  const r = spawnSync(cmd, cmdArgs, {
    stdio: "inherit",
    shell: isWindows,
    cwd: BACKEND,
    ...opts,
  });
  return r.status === 0;
}

function readEnv(file) {
  const out = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

function writeIfMissing(file, content, label) {
  if (existsSync(file)) return ok(`${label} already exists (kept)`);
  writeFileSync(file, content);
  ok(`${label} created`);
}

/** pnpm through Corepack (ships with Node), falling back to npx when Corepack is unavailable. */
function pnpmRunner() {
  const probe = spawnSync("corepack", ["pnpm", "--version"], {
    shell: isWindows,
    encoding: "utf8",
    cwd: BACKEND,
  });
  if (probe.status === 0) return { cmd: "corepack", pre: ["pnpm"] };
  return { cmd: "npx", pre: ["-y", `pnpm@${PNPM_VERSION}`] };
}

function waitForPort(port, timeoutMs) {
  const until = Date.now() + timeoutMs;
  return new Promise((resolve) => {
    const tryOnce = () => {
      const s = createConnection({ host: "127.0.0.1", port });
      s.once("connect", () => {
        s.end();
        resolve(true);
      });
      s.once("error", () => {
        s.destroy();
        if (Date.now() > until) resolve(false);
        else setTimeout(tryOnce, 1000);
      });
    };
    tryOnce();
  });
}

// ---------------------------------------------------------------------------------------------------------------
step("Checking Node.js");
const major = Number(process.versions.node.split(".")[0]);
if (major < 22)
  fail(
    `Node.js 22 or newer is required (found ${process.versions.node}). Install it from https://nodejs.org`,
  );
ok(`Node.js ${process.versions.node}`);
const pnpm = pnpmRunner();
const p = (...a) => run(pnpm.cmd, [...pnpm.pre, ...a]);
ok(`pnpm via ${pnpm.cmd}`);

step("JWT signing keys (infrastructure/secrets)");
mkdirSync(SECRETS, { recursive: true });
const priv = path.join(SECRETS, "jwt-private.pem");
const pub = path.join(SECRETS, "jwt-public.pem");
if (existsSync(priv) && existsSync(pub)) ok("key pair already exists (kept)");
else {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 3072,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  writeFileSync(priv, privateKey, { mode: 0o600 });
  writeFileSync(pub, publicKey);
  ok("RS256 key pair created (keep jwt-private.pem secret; it is git-ignored)");
}

step("Environment files");
const devEnvFile = path.join(DEV, ".env");
if (!existsSync(devEnvFile)) {
  copyFileSync(path.join(DEV, ".env.example"), devEnvFile);
  ok(
    "infrastructure/deployment/development/.env created from .env.example (change the passwords before sharing)",
  );
} else ok("infrastructure/deployment/development/.env already exists (kept)");
const dev = readEnv(devEnvFile);
const enc = encodeURIComponent;
const pg = (user, pw, db) =>
  `postgresql://${user}:${enc(pw)}@localhost:5432/${db}`;
const urls = {
  identityApp: pg(
    "identity_app",
    dev.IDENTITY_DB_APP_PASSWORD,
    "sombill_identity",
  ),
  organizationApp: pg(
    "organization_app",
    dev.ORGANIZATION_DB_APP_PASSWORD,
    "sombill_organization",
  ),
  identityMigrator: pg(
    "identity_migrator",
    dev.IDENTITY_DB_MIGRATOR_PASSWORD,
    "sombill_identity",
  ),
  organizationMigrator: pg(
    "organization_migrator",
    dev.ORGANIZATION_DB_MIGRATOR_PASSWORD,
    "sombill_organization",
  ),
  rabbit: `amqp://${enc(dev.RABBITMQ_USER)}:${enc(dev.RABBITMQ_PASSWORD)}@localhost:5672`,
  redis: `redis://:${enc(dev.REDIS_PASSWORD)}@localhost:6379/0`,
};
writeIfMissing(
  path.join(BACKEND, "apps", "main-api", ".env"),
  `# Local development (created by scripts/setup-backend.mjs). Never commit this file.
PORT=4001
LOG_LEVEL=info
IDENTITY_DATABASE_URL=${urls.identityApp}
ORGANIZATION_DATABASE_URL=${urls.organizationApp}
RABBITMQ_URL=${urls.rabbit}
JWT_PRIVATE_KEY_FILE=../../../infrastructure/secrets/jwt-private.pem
JWT_PUBLIC_KEY_FILE=../../../infrastructure/secrets/jwt-public.pem
COOKIE_SECURE=false
CORS_ORIGINS=http://localhost:3000
STORAGE_LOCAL_DIR=./storage
UPLOAD_MAX_BYTES=5242880
`,
  "backend/apps/main-api/.env",
);
writeIfMissing(
  path.join(BACKEND, "apps", "api-gateway", ".env"),
  `# Local development (created by scripts/setup-backend.mjs). Never commit this file.
PORT=4000
LOG_LEVEL=info
REDIS_URL=${urls.redis}
JWT_PUBLIC_KEY_FILE=../../../infrastructure/secrets/jwt-public.pem
MAIN_API_URL=http://localhost:4001
CORS_ORIGINS=http://localhost:3000
TRUST_PROXY_HOPS=0
DOCS_ENABLED=true
`,
  "backend/apps/api-gateway/.env",
);

step("Installing backend dependencies (pnpm install --frozen-lockfile)");
if (!p("install", "--frozen-lockfile"))
  fail("pnpm install failed (see the output above).");
ok("dependencies installed");

step("Generating Prisma clients");
if (!p("prisma:generate")) fail("prisma generate failed.");
ok("clients generated in backend/packages/database/src/*/generated");

step("Building packages and apps");
if (!p("build")) fail("build failed.");
ok("build complete (dist/ folders)");

if (args.has("--infra")) {
  step("Starting PostgreSQL, Redis and RabbitMQ (Docker)");
  if (
    spawnSync("docker", ["version"], { stdio: "ignore", shell: isWindows })
      .status !== 0
  ) {
    fail(
      "Docker is not running. Start Docker Desktop, or install PostgreSQL 16, Redis 7 and RabbitMQ 3.13 yourself.",
    );
  }
  const compose = [
    "compose",
    "-f",
    path.join(DEV, "docker-compose.yml"),
    "-f",
    path.join(DEV, "docker-compose.local.yml"),
    "--env-file",
    devEnvFile,
    "up",
    "-d",
    "--wait",
    "postgres",
    "redis",
    "rabbitmq",
  ];
  if (!run("docker", compose, { cwd: ROOT })) fail("docker compose up failed.");
  ok(
    "infrastructure running (ports 5432, 6379, 5672 on 127.0.0.1; RabbitMQ UI http://localhost:15672)",
  );
}

if (args.has("--infra") || args.has("--migrate") || args.has("--seed")) {
  step("Applying database migrations");
  if (!(await waitForPort(5432, 60_000)))
    fail("PostgreSQL is not reachable on localhost:5432.");
  const env = {
    ...process.env,
    IDENTITY_DATABASE_URL: urls.identityMigrator,
    ORGANIZATION_DATABASE_URL: urls.organizationMigrator,
  };
  if (!run(pnpm.cmd, [...pnpm.pre, "db:migrate"], { env }))
    fail("migrations failed.");
  ok("identity and organization databases are up to date");
}

if (args.has("--seed")) {
  step("Seeding (admin, roles, permissions, demo restaurant)");
  if (!process.env.SEED_ADMIN_PASSWORD)
    fail("Set SEED_ADMIN_PASSWORD (12+ characters) and run again with --seed.");
  if (!(await waitForPort(5672, 60_000)))
    fail("RabbitMQ is not reachable on localhost:5672.");
  if (!p("db:seed")) fail("seeding failed.");
  ok("seed complete");
}

console.log(`
\x1b[1;32mBackend ready.\x1b[0m

  Start (from backend/):   ${pnpm.cmd} ${pnpm.pre.join(" ")} dev
  API:                     http://localhost:4000/api/v1
  API docs (Swagger):      http://localhost:4000/api/docs
  Health:                  http://localhost:4000/health/ready
${args.has("--infra") ? "" : "\n  Databases not started. Run again with --infra (Docker) or point backend/apps/*/.env at your own servers.\n"}`);
