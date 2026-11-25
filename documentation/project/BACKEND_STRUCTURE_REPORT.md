# Backend structure report (22 Nov 2026)

`backend/` was reorganised into the tree requested by the project owner. Nothing was deleted: the previous layout is
kept in `documentation/project/history/archive/_backup_before_backend_structure_2026-11-22/`.

## Result

```text
backend/
├── apps/
│   ├── api-gateway/src/{config,middleware,routes,proxies,security}/  app.ts  server.ts
│   └── main-api/src/{modules,middleware,config,routes,events,jobs,websocket,utils}/  app.ts  server.ts
├── packages/{database,authentication,authorization,validation,logger,cache,messaging,email,storage,shared-types,shared-utils}/
├── tests/{e2e,support}/
└── package.json
```

Also moved out of `backend/` to the project root (the root layout requested earlier): `supabase/` → `database/supabase/`,
`infrastructure/` → `infrastructure/`, `scripts/` → `scripts/`, `docs/` → `documentation/backend/`.

## Verification

| Check                                          | Result                                                                                    |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`               | ✅ (lockfile regenerated once for the new package names; no dependency version changed)    |
| `tsc` for every package, app and test          | ✅                                                                                        |
| ESLint (0 warnings), Prettier                  | ✅                                                                                        |
| Tests (real PostgreSQL 16, Redis, RabbitMQ)    | ✅ 65 of 65: gateway 4, main API 38, e2e through the gateway 8, packages 15              |
| `pnpm build` (all packages and apps)           | ✅                                                                                        |
| `docker compose config` from the project root  | ✅ (services: postgres, redis, rabbitmq, main-api-migrate, main-api, api-gateway, nginx)  |
| Supabase package on its own (`npm test`, tsc)  | ✅ 10 Edge Function tests                                                                 |
| Docker image builds, Prisma drift check in CI  | ⚠️ not run here (no Docker daemon / Prisma engine download); updated in the CI file       |

## What changed, and why

1. **Two services became one process.** `identity-service` and `organization-service` are now the modules
   `main-api/src/modules/identity` and `.../organization`. The HTTP API, event contracts, permissions and database
   schemas are unchanged. Each module still has its **own PostgreSQL database** (`IDENTITY_DATABASE_URL`,
   `ORGANIZATION_DATABASE_URL`), because both schemas have tables with the same names (`outbox_events`, `audit_logs`)
   and the Compose init script gives each module its own least-privilege roles.
2. **Gateway** now has one upstream, `MAIN_API_URL` (was `IDENTITY_SERVICE_URL` + `ORGANIZATION_SERVICE_URL`). The route
   table still names the owning module (`identity` / `organization`), so adding a module is one line.
3. **`packages/shared-utils` was split** by responsibility: `authentication` (JWT verify/issue, passwords),
   `authorization` (can / branch access), `validation`, `logger`; what remains (app factory, errors, pagination, OpenAPI)
   plus the former `shared-config` (environment loading, `src/config.ts`) stays in `shared-utils`.
4. **Renamed:** `event-contracts` → `messaging`; `testing` → `tests/support` (`@sombill/testing`, name kept).
5. **New:** `cache` (Redis connection + rate limiter, moved out of the gateway), `database` (Prisma clients + migrations for
   both modules), `email` and `storage` (ports/interfaces only; no provider is integrated), `main-api/src/websocket`
   (placeholder interface; real-time is not built).
6. **Express request fields** (`req.principal`, `req.valid`) are now declared by the package that sets them
   (`authentication`, `validation`) instead of the shared barrel.
7. **Prisma**: clients are generated into `packages/database/src/<module>/generated`; commands are
   `pnpm prisma:generate`, `pnpm db:migrate`, `pnpm --filter @sombill/database db:check`.
8. **Docker/CI:** one `infrastructure/docker/backend.Dockerfile` (`APP` build arg; targets `migrate` and `runtime`; moved there on 22 Nov, see infrastructure/README.md), updated Compose file
   (`infrastructure/docker/`), `backend-ci.yml` (drift check over both schemas, image matrix, Supabase job without pnpm).
9. **`database/supabase`** is no longer a member of the backend pnpm workspace; it is a standalone npm package
   (`npm run test:legacy`, `npm run test:db` from the project root).

## Deviations and follow-ups (honest list)

- **Event `source` name.** Events now carry `source: "main-api"` (was `identity-service` / `organization-service`).
  Consumers do not filter on it; nothing else in the repo reads it.
- **Queue name.** The RabbitMQ queue is now `main-api.events` (was `identity-service.events`). A deployment that already
  has messages in the old queue must drain it first; there is no production deployment yet.
- **Environment variables changed** (`.env.example`, Compose and CI updated): `DATABASE_URL` →
  `IDENTITY_DATABASE_URL` / `ORGANIZATION_DATABASE_URL`; the gateway's two service URLs → `MAIN_API_URL`; the main API needs
  both JWT keys. OpenAPI specs are served at `/openapi/<module>.json` on the main API (the gateway's `/api/docs` is unchanged).
- **`backend/docs` text** (now `documentation/backend/`) still describes "services" in places; each file has a banner
  explaining the new structure. Rewriting them is a follow-up.
- **Dockerfiles and Prisma drift check** are untested in this environment (see table above).
- **`documentation/project/PROJECT_STATUS.md`** on disk is write-locked (open in another app); the Frontend/Backend structure
  sections still need to be added by hand or after closing it.

## Old → new location of every moved file

See `documentation/project/BACKEND_STRUCTURE_MAP.md`. Files that were **replaced** rather than moved (their content now
lives in the hand-written files named here):

| Old (per service)                                                                    | Replaced by                                                         |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| `*/src/app.ts` (identity, organization)                                              | `main-api/src/app.ts`, `src/routes/{identity,organization}.routes.ts` |
| `*/src/runtime.ts`, `*/src/server.ts`                                                | `main-api/src/config/runtime.ts`, `src/server.ts`                   |
| `*/src/config/env.ts`                                                                | `main-api/src/config/env.ts` (one merged schema)                    |
| `*/package.json`, `tsconfig*.json`, `vitest.config.ts`, `Dockerfile`, `.env.example` | same files under `apps/main-api/`                                   |
| `*/prisma.config.ts`                                                                 | `packages/database/prisma.{identity,organization}.config.ts`        |
| `api-gateway/src/app.ts`, `runtime.ts`, `middleware/rateLimit.ts`                    | split into `security/`, `proxies/`, `middleware/`, `config/runtime.ts`, `packages/cache` |
| `shared-utils/src/auth.ts`                                                           | `packages/authentication/src/jwt.ts`, `packages/authorization/src/index.ts` |
| `shared-config/` (package)                                                           | `packages/shared-utils/src/config.ts`                               |
