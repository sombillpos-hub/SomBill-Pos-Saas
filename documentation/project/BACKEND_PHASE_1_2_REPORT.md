# BACKEND_PHASE_1_2_REPORT: SomBill backend, phases 1 and 2

_22 Nov 2026. Applies the "SomBill – Backend Technology Stack & Development" brief, phases 1 (foundation and
infrastructure) and 2 (API Gateway, Identity, Authentication, Organization)._

## 1. What was built

| Area | Delivered |
| --- | --- |
| Monorepo | `backend/` pnpm workspace: `apps/api-gateway`, `apps/services/*`, `packages/{shared-types,shared-config,shared-utils,event-contracts,testing}`, `infrastructure/`, `scripts/`, `docs/`, `tests/` |
| Shared packages | permission catalogue (38) and system roles (8); Zod env loading with Docker `*_FILE` secrets; Express app factory (Helmet, CORS, request ids, pino logs with redaction, health); standard errors; validation; RBAC helpers; pagination; OpenAPI 3.1 from Zod |
| Events | versioned contracts, RabbitMQ topic exchange with publisher confirms, retry queues and dead-letter queues, transactional outbox relay (`FOR UPDATE SKIP LOCKED`), idempotent consumers |
| API Gateway | routing table, JWT pre-check, Redis rate limits (credentials 10/15 min/IP, refresh 60, global 300/min), CORS allow-list, aggregated Swagger UI, readiness of Redis and upstreams, 502/504 JSON errors |
| Identity service | register, login (Argon2id, lock-out, no user enumeration), RS256 access tokens, rotating refresh tokens with reuse detection, logout / logout-all / change-password / me, memberships (organization-wide or branch), privilege-escalation guard, last-owner rule, append-only audit, consumers for `organization.created` and `branch.created` |
| Organization service | organizations with slug, ISO codes, time zone; 14-day trial subscription with branch limit (safe under concurrency); branches; branch settings as exact decimals; branch-scoped visibility; audit; events |
| Database | one database per service; Prisma 7 schemas; migrations with extra `CHECK` constraints and append-only audit triggers; Postgres init script creating migrator (DDL) and app (DML-only) roles per service |
| Infrastructure | Dockerfiles (build, migrate and runtime stages, non-root, tini, health check); Docker Compose (9 services, internal networks, Docker secrets); Nginx reverse proxy with TLS template; JWT key script |
| CI/CD | `.github/workflows/backend-ci.yml` (format, lint, typecheck, migration drift check, tests on real PostgreSQL/Redis/RabbitMQ, build, Docker images, Supabase SQL tests), `.github/workflows/frontend-ci.yml` |
| Docs | `backend/README.md` and `documentation/`: SYSTEM_ARCHITECTURE, MICROSERVICES, DATABASE_ARCHITECTURE, API_DOCUMENTATION, EVENT_ARCHITECTURE, SECURITY, DEPLOYMENT_GUIDE |
| Frontend alignment | dashboards' refresh handler reads the gateway's `{ data: { accessToken } }` envelope (test updated) |

The existing Supabase backend became the workspace package `@sombill/supabase-legacy` in `database/supabase/`. Its
Edge Function test moved next to it (one import path changed). Nothing else in it changed, and it remains the live
backend for today's dashboards.

## 2. Test results

| Suite | Result |
| --- | --- |
| shared-config (env, secrets files) | ✅ 4 |
| shared-utils (RBAC scoping, errors, token parsing) | ✅ 6 |
| event-contracts (real RabbitMQ: routing, retry, DLQ, contract violations) | ✅ 5 |
| api-gateway (routing table, config) | ✅ 4 |
| identity-service (real PostgreSQL: auth, rotation, theft detection, races, lock-out, RBAC, events, audit immutability) | ✅ 26 |
| organization-service (isolation, branch scope, plan limit under concurrency, decimals, outbox → RabbitMQ) | ✅ 12 |
| end-to-end through the gateway (all services, PostgreSQL, RabbitMQ, Redis) | ✅ 8 |
| **New backend total** | ✅ **65** |
| Supabase backend: Edge Function / SQL + concurrency | ✅ 9 / 303 assertions + 9 concurrency checks |
| Frontend dashboards (after the refresh change) | ✅ API layer 11/11, type-check and lint clean |
| Format, lint (0 warnings), strict type-check, production build | ✅ |
| Smoke test: compiled services (`node dist/server.js`) over HTTP: register → organization → owner via RabbitMQ → branch → docs | ✅ |
| Database least privilege (app role cannot DDL or reach other databases) | ✅ |
| Nginx config (`nginx -t`), Docker Compose (`docker compose config`) | ✅ valid |

## 3. Decisions

1. **Phases 1–2 only.** The brief asks to build in controlled phases. Catalog and inventory (phase 3) come next.
2. **Hotel (phase 6) is on hold.** The frontend brief excluded hotel. The backend brief includes it, so please confirm
   before phase 6.
3. **The Supabase backend stays live** until each new service reaches parity. Switching the dashboards before then
   would break working screens.
4. **Microservices start with two services plus the gateway**, as the brief advises ("start manageable"), with the
   other 12 boundaries documented in `MICROSERVICES.md`.
5. **Refresh token in an httpOnly cookie, access token in memory**, matching the frontend client that already exists.

## 4. Not verified here (environment limits)

- **Docker image builds and `docker compose up`.** This build environment could not pull images from Docker Hub. The
  CI job builds all three images.
- **`prisma migrate deploy` and the drift check.** The environment could not download Prisma's migration engine
  (policy-blocked host). The migration SQL was written to Prisma's conventions and applied with the same files in
  every test. CI runs `prisma migrate diff --exit-code` to prove it matches the schemas.
- TLS, and deployment to a real host.
