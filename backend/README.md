# SomBill backend

Node.js + Express + TypeScript on PostgreSQL (Prisma), Redis and RabbitMQ: an **API gateway** in front of one
**main API** that hosts the business modules (identity, organization, and the next ones). Built in phases
([`SYSTEM_ARCHITECTURE`](../documentation/backend/SYSTEM_ARCHITECTURE.md) §6). **Phases 1 and 2 are done.**

| Status         | Part                                                                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| ✅ Phase 1     | pnpm monorepo, shared packages, event bus (RabbitMQ, retry, dead-letter, outbox, idempotent consumers), Docker, Compose, Nginx, CI         |
| ✅ Phase 2     | API Gateway · Identity & Authentication module · Organization & Branch module                                                              |
| ⏳ Phases 3–10 | Catalog, inventory, POS, payments, kitchen, workforce, finance, reporting, notifications, digital ordering (each becomes a `modules/` dir) |
| 🟢 Live today  | [`../database/supabase/`](../database/supabase/): the backend the current dashboards use, until this API reaches feature parity            |

## Layout

```text
backend/
├── apps/
│   ├── api-gateway/                 public entry point (:4000)
│   │   └── src/{config,middleware,routes,proxies,security}/  app.ts  server.ts
│   └── main-api/                    identity + organization modules (:4001)
│       ├── src/{modules,middleware,config,routes,events,jobs,websocket,utils}/  app.ts  server.ts
│       │   ├── modules/               35 business modules (auth, users, roles, … settings) + files (uploads)
│       │   ├── config/                env.ts (validated settings) and runtime.ts (wiring)
│       │   ├── routes/                one router per module
│       │   ├── events/                RabbitMQ consumers
│       │   ├── jobs/                  outbox relays (background publishing)
│       │   └── websocket/             real-time channel (placeholder, not built yet)
│       └── tests/{identity,organization}/
├── packages/
│   ├── database/                    Prisma clients + configs (schemas, migrations, seeds: ../database/prisma)
│   ├── authentication/              JWT verify/issue (RS256), refresh tokens, Argon2id passwords
│   ├── authorization/               organization isolation, branch access, permission checks
│   ├── validation/                  request validation middleware, shared zod fields
│   ├── logger/                      pino logger with secret redaction
│   ├── cache/                       Redis connection and Redis-backed rate limiting
│   ├── messaging/                   versioned events, RabbitMQ bus, transactional outbox
│   ├── storage/                     storage port + local-disk provider, key safety, file-type sniffing
│   ├── email/                       port only (no provider integrated yet)
│   ├── shared-types/                permissions, roles, JWT claims, response envelopes
│   └── shared-utils/                Express app factory, errors, pagination, OpenAPI, environment loading
├── tests/
│   ├── e2e/                         gateway + main API with real PostgreSQL, RabbitMQ, Redis
│   └── support/                     test helpers (@sombill/testing)
└── package.json   pnpm-workspace.yaml   tsconfig.base.json   vitest.shared.ts   eslint.config.js
```

Outside `backend/`: [`../database/`](../database/) (Supabase), [`../infrastructure/`](../infrastructure/) (Docker, Nginx,
secrets), [`../scripts/`](../scripts/) (JWT key generator), [`../documentation/backend/`](../documentation/backend/).

## Quick start (local development)

Requirements: Node.js 22+ and, for the databases, Docker Desktop (or your own PostgreSQL 16, Redis 7, RabbitMQ 3.13).
From the **project root** (Windows, macOS or Linux):

```bash
node scripts/setup-backend.mjs --infra     # keys, .env files, pnpm install, Prisma, build, Docker infra, migrations
cd backend
corepack pnpm dev                          # gateway :4000 + main API :4001 with reload
```

Open http://localhost:4000/api/docs. Optional demo data: set `SEED_ADMIN_PASSWORD` and run the script with `--seed`.
Without Docker: run the script without `--infra`, edit `apps/main-api/.env` and `apps/api-gateway/.env` to point at
your servers, then `node scripts/setup-backend.mjs --migrate`. Full stack in Docker:
[`../documentation/deployment/deployment-guide.md`](../documentation/deployment/deployment-guide.md).

## Commands

| Command                                    | What it does                                                                      |
| ------------------------------------------ | --------------------------------------------------------------------------------- |
| `pnpm verify`                              | format check → lint → Prisma generate → typecheck → all tests                     |
| `pnpm test`                                | package and app tests, then end-to-end (needs local PostgreSQL, Redis, RabbitMQ)  |
| `pnpm smoke [http://localhost:4000]`       | live check of every API route against a running backend (creates throw-away data) |
| `pnpm build`                               | compile every package and app to `dist/`                                          |
| `pnpm lint` / `pnpm format`                | ESLint (zero warnings) / Prettier                                                 |
| `pnpm prisma:generate`                     | generate both Prisma clients into `packages/database/src/<module>/generated`      |
| `pnpm db:migrate`                          | apply pending migrations to the identity and organization databases               |
| `pnpm db:seed`                             | admin, roles, permissions, demo restaurant and staff (see ../database/README.md)  |
| `pnpm --filter @sombill/database db:check` | proves migrations match the schemas (needs the `*_SHADOW_DATABASE_URL` variables) |

Test infrastructure defaults to `127.0.0.1`. Override with `TEST_DATABASE_ADMIN_URL`, `RABBITMQ_URL` and `REDIS_URL`.

## API conventions

- Versioned under `/api/v1` (gateway), `API-Version: 1` header on every response.
- Success `{ "data": … }` (200/201), lists `{ "data": [...], "meta": { page, pageSize, total, totalPages } }`,
  no body 204, errors `{ "error": { code, message, details?, requestId } }`. Helpers: `sendOk`, `sendCreated`,
  `sendNoContent`, `sendPage` (`@sombill/shared-utils`).
- Module layering: routes (wiring) → controllers (HTTP) → services (rules, authorization, transactions) →
  repositories (Prisma). Validators are Zod schemas; models map rows to API views.
- Full standards: [`../documentation/api/api-documentation.md`](../documentation/api/api-documentation.md).

## Adding a module

1. Fill `apps/main-api/src/modules/<name>/` (routes, service, schemas) and add a router (and OpenAPI registry) in `src/routes/`.
2. Mount it in `src/app.ts` and add its URL prefixes to `apps/api-gateway/src/routes/routeTable.ts`.
3. If it owns data, add a schema in `../database/prisma/`, migrations in `../database/prisma/migrations/<name>/`, a client in `packages/database/src/<name>/`, plus a database in
   `infrastructure/postgres/init/`.

## Documentation

[`../documentation/backend/`](../documentation/backend/): SYSTEM_ARCHITECTURE · MICROSERVICES · DATABASE_ARCHITECTURE ·
API_DOCUMENTATION · EVENT_ARCHITECTURE · SECURITY · DEPLOYMENT_GUIDE. Live API docs: `GET /api/docs`.
