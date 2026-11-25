# Backend architecture

_Combined on 22 Nov 2026 from: SYSTEM_ARCHITECTURE.md, MICROSERVICES.md, EVENT_ARCHITECTURE.md._

## Contents

- System architecture
- Microservices
- Event architecture

## System architecture

> **Structure update (22 Nov 2026).** The identity and organization services now run as two *modules* of one process, `backend/apps/main-api` (one PostgreSQL database per module, same events and API contract). Shared code was split into `backend/packages/{database,authentication,authorization,validation,logger,cache,messaging,email,storage,shared-types,shared-utils}`; `supabase/` moved to `database/`, `infrastructure/` and `scripts/` to the project root, and these documents to `documentation/`. Text below that still says "identity-service" / "organization-service" describes the same code under its former name; a full rewrite is a follow-up.

### 1. Overview

```text
 Browser / POS tablet / mobile
        │ HTTPS
        ▼
 ┌──────────────┐     ┌────────────────────────────────────────────────────────────┐
 │    Nginx     │────▶│ API Gateway  (helmet, CORS, Redis rate limits, JWT check,  │
 │ TLS, :80/443 │     │               routing, aggregated OpenAPI)                 │
 └──────────────┘     └───────┬──────────────────────────┬─────────────────────────┘
                              │ /auth /users /roles       │ /organizations /branches
                              ▼                           ▼
                   ┌────────────────────┐      ┌───────────────────────┐
                   │ identity-service   │      │ organization-service  │
                   │ Postgres: identity │      │ Postgres: organization│
                   └─────────┬──────────┘      └──────────┬────────────┘
                             │  outbox → RabbitMQ topic exchange "sombill.events"  │
                             └────────────────────────◀▶────────────────────────────┘
```

- **Public entry:** only Nginx is exposed. The gateway is the only HTTP client of the services. Databases, Redis and
  RabbitMQ live on internal networks.
- **Database per service:** each service owns its PostgreSQL database and roles. No service reads or writes another's
  data. Data another service needs arrives through events (e.g. identity keeps `known_branches` from `branch.created`).
- **Stateless services:** JWT access tokens carry identity and memberships, so any instance can serve any request.
  Rate-limit counters live in Redis, so limits hold across gateway instances.

### 2. Technology

| Concern                 | Choice                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------- |
| Runtime / framework     | Node.js 22, Express 5, TypeScript 5.9 (strict, `noUncheckedIndexedAccess`)            |
| Database / ORM          | PostgreSQL 16, Prisma 7 (`prisma-client` generator, `pg` driver adapter)              |
| Cache / rate limiting   | Redis 7 (`express-rate-limit` + `rate-limit-redis`)                                   |
| Messaging               | RabbitMQ 3.13 (`amqplib`): topic exchange, publisher confirms, retry queues, DLQs     |
| Auth                    | JWT RS256 (`jose`), rotating refresh tokens, Argon2id (`argon2`)                      |
| Validation / docs       | Zod 4, OpenAPI 3.1 generated from the same Zod schemas (`zod-to-openapi`), Swagger UI |
| Security headers / CORS | Helmet, `cors` allow-list                                                             |
| Logging                 | pino + pino-http, JSON, request ids, secret redaction                                 |
| Tests                   | Vitest, Supertest, against real PostgreSQL, RabbitMQ and Redis                        |
| Quality                 | ESLint (typescript-eslint, zero warnings), Prettier                                   |
| Delivery                | pnpm workspaces, Docker multi-stage, Docker Compose, Nginx, GitHub Actions            |

### 3. Request lifecycle

1. Nginx sets `X-Forwarded-For` (replacing any client value) and `X-Request-Id`.
2. The gateway assigns or keeps the request id, applies CORS and rate limits, and verifies the JWT for any non-public
   route (unauthenticated traffic never reaches a service). It strips `/api/v1` and proxies the request.
3. The service verifies the JWT again (zero trust between hops), validates input with Zod, authorizes with
   `assertCan(principal, permission, { organizationId, branchId })`, and runs the business change in one database
   transaction together with its audit row and outbox event.
4. Errors leave as `{ error: { code, message, details?, requestId } }`. Unknown errors become a generic 500 with no
   internals.

### 4. Module structure inside a service

```text
src/
  config/env.ts        Zod-validated environment (fails fast at start-up)
  db/prisma.ts         Prisma client with the pg adapter
  modules/<feature>/   *.schemas.ts (Zod) · *.service.ts (domain logic) · *.routes.ts (HTTP)
  events/              consumers (idempotent)
  middleware/ utils/   service-specific helpers
  openapi.ts           API description built from the same schemas
  app.ts               Express app (pure, testable)
  runtime.ts           wires DB, RabbitMQ, outbox relay and app (shared by server and tests)
  server.ts            starts HTTP + graceful shutdown
```

Domain-Driven Design is applied pragmatically: each service is one bounded context, owns its data and language, and
talks to other contexts only through published events and their public API.

### 5. Relationship with the current Supabase backend

The Manager, Waiter and Cashier dashboards run on Supabase today (`database/supabase`). It stays in production while
the Node services are built. The dashboards already include the client side for the new API (Axios with JWT refresh,
TanStack Query, Socket.IO client; see `documentation/architecture/frontend-architecture.md`). Each screen moves to the gateway
when its service reaches parity: identity and organization now, catalog and POS in phases 3–5.

### 6. Phase plan

| Phase | Scope                                                       | Status                                     |
| ----- | ----------------------------------------------------------- | ------------------------------------------ |
| 1     | Foundation and infrastructure                               | ✅                                         |
| 2     | API Gateway, Identity, Authentication, Organization         | ✅                                         |
| 3     | Catalog and Inventory                                       | next                                       |
| 4     | Restaurant POS and Order Management                         |                                            |
| 5     | Payment and Kitchen                                         |                                            |
| 6     | Hotel Management and Reservations                           | on hold: the frontend brief excluded hotel |
| 7     | Housekeeping and Workforce                                  |                                            |
| 8     | Finance and Accounting                                      |                                            |
| 9     | Reporting, Notifications (Socket.IO), Digital Ordering      |                                            |
| 10    | Integration testing, security review, production deployment |                                            |

## Microservices

> **Structure update (22 Nov 2026).** The identity and organization services now run as two *modules* of one process, `backend/apps/main-api` (one PostgreSQL database per module, same events and API contract). Shared code was split into `backend/packages/{database,authentication,authorization,validation,logger,cache,messaging,email,storage,shared-types,shared-utils}`; `supabase/` moved to `database/`, `infrastructure/` and `scripts/` to the project root, and these documents to `documentation/`. Text below that still says "identity-service" / "organization-service" describes the same code under its former name; a full rewrite is a follow-up.

Each service has one responsibility, owns one database, and publishes facts as events. Services that do not exist yet
are listed with their planned ownership, so boundaries are settled before the code.

| #   | Service                                            | Owns                                                                                                                | Status           |
| --- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------- |
| 1   | **API Gateway** (`apps/api-gateway`)               | nothing persistent; rate-limit counters in Redis                                                                    | ✅               |
| 2   | **Identity & Authentication** (`identity-service`) | users, sessions, refresh tokens, permissions, roles, memberships, identity audit                                    | ✅               |
| 3   | **Organization & Branch** (`organization-service`) | organizations, branches, branch settings, subscriptions, org audit                                                  | ✅               |
| 4   | Catalog & Product                                  | products, categories, variants, menus, menu items                                                                   | Phase 3          |
| 5   | Inventory                                          | stock items, locations, balances, movements, suppliers, purchase orders, goods receipts, transfers, counts, recipes | Phase 3          |
| 6   | Restaurant POS & Orders                            | tables, table sessions, orders, order items, status history                                                         | Phase 4          |
| 7   | Payments                                           | payments, transactions, allocations, refunds, cash registers and sessions, reconciliation                           | Phase 5          |
| 8   | Kitchen                                            | stations, tickets, ticket items, preparation status history                                                         | Phase 5          |
| 9   | Hotel                                              | guests, rooms, rates, reservations, stays, folios                                                                   | Phase 6, on hold |
| 10  | Housekeeping & Maintenance                         | tasks, room statuses, inspections, maintenance, lost and found                                                      | Phase 7          |
| 11  | Workforce                                          | employees, departments, positions, attendance, shifts, leave, schedules                                             | Phase 7          |
| 12  | Finance & Accounting                               | chart of accounts, fiscal periods, journals (double entry), expenses, tax, budgets, bank                            | Phase 8          |
| 13  | Reporting & Analytics                              | read models / summaries built from events                                                                           | Phase 9          |
| 14  | Notification                                       | notifications, templates, deliveries, Socket.IO fan-out                                                             | Phase 9          |
| 15  | Digital Ordering (QR/NFC)                          | QR codes, NFC tags, digital menus, sessions, orders                                                                 | Phase 9          |

### API Gateway (port 4000)

- Routes `/api/v1/<prefix>` to the owning service (`src/routes/routeTable.ts`); unknown paths → JSON 404.
- **JWT pre-check** on every non-public route (public: register, login, refresh, logout).
- **Rate limits in Redis:** credential endpoints 10 per 15 min per client IP, refresh 60 per 15 min, everything else
  300/min. All configurable.
- Helmet headers, CORS allow-list with credentials, request ids, `X-Forwarded-*` set by the gateway only.
- `GET /api/docs`: Swagger UI over every service's OpenAPI. `GET /health/live|ready` (ready checks Redis and every
  upstream).
- Upstream down → `502 UPSTREAM_UNAVAILABLE`; timeout → `504 UPSTREAM_TIMEOUT`.

### Identity & Authentication (port 4001)

- Registration, login, logout, logout-all, change-password, `me`.
- Argon2id hashing, account lock-out after repeated failures, timing-safe answers for unknown e-mails.
- RS256 access tokens (15 min) with embedded memberships; refresh tokens rotate on every use, and reuse of a rotated
  token revokes the session.
- RBAC: 8 system roles, 38 permissions, organization-wide or branch-scoped memberships, privilege-escalation guard,
  last-owner protection.
- Consumes `organization.created` (grants owner) and `branch.created` (records the branch).
  Publishes `user.registered`, `role.assigned`, `role.revoked`.

### Organization & Branch (port 4002)

- Organizations (slug, country, currency, time zone), 14-day trial subscription with a branch limit.
- Branches with organization defaults, per-branch settings (tax %, service charge %, receipt texts) as exact decimals.
- Branch-scoped staff only see their branches. Plan limits hold under concurrency (row lock).
- Publishes `organization.created`, `organization.updated`, `branch.created`, `branch.updated`.

### Adding a service (checklist)

1. Copy `organization-service` as a template: config, `db/`, `runtime.ts`, `server.ts`, Dockerfile, tests.
2. Write `prisma/schema.prisma` and the first migration, including `outbox_events`, `processed_events` and
   `audit_logs`.
3. Add its permissions to `packages/shared-types` (identity syncs them at start-up) and its events to
   `packages/messaging`.
4. Add its prefixes to the gateway route table and its spec to the docs list.
5. Add the service to Compose (`<svc>-migrate` + `<svc>`), to the Postgres init script (two roles) and to the CI
   matrix.

## Event architecture

> **Structure update (22 Nov 2026).** The identity and organization services now run as two *modules* of one process, `backend/apps/main-api` (one PostgreSQL database per module, same events and API contract). Shared code was split into `backend/packages/{database,authentication,authorization,validation,logger,cache,messaging,email,storage,shared-types,shared-utils}`; `supabase/` moved to `database/`, `infrastructure/` and `scripts/` to the project root, and these documents to `documentation/`. Text below that still says "identity-service" / "organization-service" describes the same code under its former name; a full rewrite is a follow-up.

### Topology

- One durable **topic exchange** `sombill.events`. Routing key = event type (`organization.created`).
- Each consumer owns a durable queue (e.g. `identity-service.events`) bound to the types it needs.
- Per consumer: retry queues `<queue>.retry.<delay>ms` (TTL, dead-lettered back to the main queue) and a dead-letter
  queue `<queue>.dlq`.

### Envelope and versioning

```json
{
  "id": "uuid",
  "type": "organization.created",
  "version": 1,
  "occurredAt": "2026-11-22T10:00:00.000Z",
  "source": "organization-service",
  "correlationId": "request id",
  "causationId": "id of the triggering event",
  "data": { "organizationId": "…", "ownerUserId": "…", "name": "…", "currency": "USD", "timezone": "Africa/Mogadishu" }
}
```

Contracts live in `packages/messaging/src/contracts.ts` as Zod schemas per `(type, version)`. Publishers
validate before storing, and consumers validate on receipt. A breaking change adds `version: 2`; both versions are
published until every consumer has moved over.

### Guarantees

| Problem                                      | Mechanism                                                                                                                                     |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Change saved but event lost (or the reverse) | **Transactional outbox:** the event is inserted into `outbox_events` in the same transaction as the change. A relay publishes it after commit |
| Several service instances                    | relay claims rows with `FOR UPDATE SKIP LOCKED`, in `occurred_at` order                                                                       |
| Broker down                                  | relay keeps rows unpublished, backs off per row (≤ 60 s) and stops the batch to keep order                                                    |
| Publish not durable                          | publisher confirms: a publish succeeds only after the broker has persisted it                                                                 |
| Duplicate delivery (at-least-once)           | **idempotent consumers:** `processed_events (event_id, consumer)` is inserted in the handler's transaction; duplicates are no-ops             |
| Transient handler failure                    | retry with delays (default 1 s, 5 s, 30 s), up to 5 attempts                                                                                  |
| Poison message / contract violation          | moved to `<queue>.dlq` with the reason in headers; never blocks the queue                                                                     |

All of these are tested against a real RabbitMQ: delivery to bound queues only, retry then success, dead-lettering
after max attempts, contract violations, outbox draining exactly once, duplicate-delivery idempotency.

### Current events

| Event                               | Producer     | Consumers                   |
| ----------------------------------- | ------------ | --------------------------- |
| `user.registered` v1                | identity     | (notification, Phase 9)     |
| `organization.created` v1           | organization | identity → grants owner     |
| `organization.updated` v1           | organization | (reporting)                 |
| `branch.created` v1                 | organization | identity → `known_branches` |
| `branch.updated` v1                 | organization | (catalog, POS)              |
| `role.assigned` / `role.revoked` v1 | identity     | (notification, workforce)   |

Reserved for later phases: `product.created`, `order.created`, `order.status_changed`, `payment.completed`,
`payment.refunded`, `kitchen.ticket_updated`, `stock.low`, `expense.created`.

### Operating

- RabbitMQ UI (Compose): `http://localhost:15672`. Watch `*.dlq` depths; anything there needs a look.
- Replay a dead-lettered message: shovel it back to the main queue after fixing the cause. Idempotency makes replays
  safe.
- Unpublished backlog: `SELECT count(*), max(attempts), max(last_error) FROM outbox_events WHERE published_at IS NULL;`
