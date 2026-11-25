# Phase 2: backend foundation report (23 Nov 2026)

## Decision recorded

The **Node.js backend** (`backend/`: Express 5, TypeScript, PostgreSQL + Prisma, Zod, JWT, pino, Redis) is the system
of record for SomBill going forward (Phase 2 brief). This resolves the open question in
`PHASE_0_AUDIT_REPORT.md` §12.

**Supabase stays live** for the current dashboards until each module is ported (later phases). Until then:

- New business features are built in `backend/apps/main-api/src/modules/<module>`, using the layering below.
- The dashboards switch from `supabase-js` to `@sombill/api-client` (the axios client already in the frontend) one
  module at a time.

## What was built or changed

| # | Requirement | Where | State |
| --- | --- | --- | --- |
| 1 | Application setup | `apps/main-api/src/app.ts` (`buildMainApi`), `config/runtime.ts` (wiring: databases, RabbitMQ, outbox jobs, token issuer, storage) | existed, extended (storage) |
| 2 | HTTP server | `apps/*/src/server.ts` → `startHttpServer` (`packages/shared-utils/src/app.ts`) | existed |
| 3 | Environment variables | `apps/*/src/config/env.ts`, Zod-validated, `*_FILE` secret support, fails fast with every problem listed; new `STORAGE_DRIVER`, `STORAGE_LOCAL_DIR`, `UPLOAD_MAX_BYTES` | extended |
| 4 | PostgreSQL via Prisma | `packages/database` (two clients); schemas/migrations in `database/prisma`; new model `StoredFile` + migration `20261123000000_stored_files` | extended |
| 5 | Centralized error handling | `packages/shared-utils/src/errors.ts` (`AppError`, `errorHandler`, `notFoundHandler`); Zod, malformed JSON, Prisma and upload errors mapped; unknown errors → 500 without internals | existed, upload errors added |
| 6 | Request validation | `packages/validation` (`validate({ body, query, params })`), Zod schemas in each module's `validators/` | existed |
| 7 | Response standard | **new** `packages/shared-utils/src/response.ts`: `sendOk`, `sendCreated`, `sendNoContent`, `sendPage` | new |
| 8 | Structured logging | `packages/logger` (pino, JSON, secret redaction); request logs with request id (`pino-http`) | existed |
| 9 | Security middleware | helmet (CSP, HSTS, nosniff, frame options), `x-powered-by` off, trusted proxy hops, JSON body limit 100 kB, gateway JWT pre-check, file type sniffing | existed + uploads |
| 10 | Rate limiting | gateway, Redis-backed (`packages/cache`): credentials 10/15 min, refresh 60/15 min, global 300/min per client | existed |
| 11 | CORS | allow-list from `CORS_ORIGINS`, credentials, exposed headers incl. `API-Version` | existed, header added |
| 12 | Request logging | `pino-http` on gateway and main API (health probes not logged) | existed |
| 13 | Health checks | gateway: `/health/live`, `/health/ready` (Redis + main API); main API: `/health/ready` (both databases, storage, RabbitMQ) | extended (storage) |
| 14 | API versioning | URL prefix `/api/v1` at the gateway; **new** `API-Version: 1` header on every versioned response | extended |
| 15 | Graceful shutdown | SIGTERM/SIGINT: stop accepting connections, stop outbox jobs, close RabbitMQ, disconnect databases/Redis | existed |
| 16 | File uploads | **new** `modules/files` + `packages/storage` (`LocalDiskStorage`, key safety, content sniffing) + `middleware/upload.ts` (multer, memory, size limit) | new |
| 17 | Swagger/OpenAPI | `GET /api/docs` (gateway Swagger UI); specs from the main API at `/openapi/{identity,organization}.json`; Files documented | extended |

### Layering applied to every implemented module

- **routes:** wiring only (path + validator + controller method).
- **controllers:** read the validated request, call the service, write the standard response.
- **services:** business rules, authorization, transactions, audit and events.
- **repositories:** every Prisma call.
- **models:** API view mappers.
- **validators:** Zod schemas.

Modules refactored to this layering:

- **auth:** `AuthController`, `AuthRepository`.
- **users:** `UserController`, `UserRepository`.
- **roles:** `RoleController`, `RoleRepository`, routes moved out of users.
- **permissions:** `PermissionController`, routes moved out of users.
- **organizations:** `OrganizationController`, `OrganizationRepository`.
- **branches:** `BranchController`, `BranchRepository`.
- **files:** new, built in this layering from the start.

Services now call Prisma only through repositories. `$transaction` stays in services because a transaction is a
business decision.

### Files module (new; documented reason in `modules/files/README.md`)

| Endpoint | Rule |
| --- | --- |
| `POST /api/v1/files` (multipart: `file`, `organizationId`, `purpose`, `branchId?`) | Permission by purpose: MENU_IMAGE → `catalog.manage`; EXPENSE_ATTACHMENT → `expense.create`; BRANDING → `organization.update` (or `branch.settings.manage` for a branch); DOCUMENT → `organization.update` / `branch.update`. Type detected from the bytes: PNG, JPEG, WebP, plus PDF for attachments and documents. SVG is refused. Size ≤ `UPLOAD_MAX_BYTES`. |
| `GET /api/v1/files` | Paged. Expense attachments are listed only for `expense.create` / `expense.approve` holders. |
| `GET /api/v1/files/:id`, `GET /api/v1/files/:id/content` | Members of other organizations get 404, not 403. Downloads send the stored type, `nosniff`, an ETag, `private` caching, and a safe file name. |
| `DELETE /api/v1/files/:id` | Same permission as upload. The row and audit entry are written in one transaction, then the stored bytes are removed. |

Also added:

- Uploads write the bytes first. If the metadata transaction fails, the bytes are removed, so nothing is orphaned.
- Every upload and delete is audited.
- Nginx accepts up to 6 MB on `/api/v1/files` only.
- The Docker image has a writable `/app/storage`, and Compose has an `uploads-data` volume.

## Verification (run here, 23 Nov 2026)

**Static checks and tests:**

- `pnpm install --frozen-lockfile`, `tsc` for every package and app, ESLint (0 warnings), Prettier and `pnpm build`
  all pass.
- Tests on real PostgreSQL 16, Redis and RabbitMQ: **72 passed**.
  - main API 42, of which 4 are new file tests: upload/list/download/delete, type sniffing (SVG and PDF-as-image
    refused), the 413 size limit, missing fields, malformed multipart, and permissions by purpose and organization.
  - end-to-end through the gateway 8, gateway 4.
  - packages 18, of which 3 are new storage tests.

**Live run of the compiled servers** (`node dist/server.js`, both services, fresh databases with all migrations
applied):

| Check | Result |
| --- | --- |
| Liveness / readiness (gateway and main API: Redis, both databases, storage, RabbitMQ) | 200 `ready` |
| Swagger UI, organization spec incl. `/files` paths | 200 |
| Register → login → `/auth/me` | 201 / 200 / 200; refresh cookie `HttpOnly; SameSite=Strict; Path=/api/v1/auth` |
| Create organization → RabbitMQ `organization.created` → refresh token now carries the `owner` membership | ✅ (event round trip) |
| Create branch, list branches (paged `meta`), update settings | 201 / 200 / 200 |
| Upload PNG, download (same bytes, `image/png`, `nosniff`, ETag), SVG refused (415), delete (204) | ✅ |
| Missing token 401, bad UUID 400 with field details, unknown route 404, malformed JSON 400, all in the standard error shape with `requestId` | ✅ |
| CORS preflight: allowed origin echoed with credentials; unknown origin gets no CORS header | ✅ |
| Security headers: CSP, HSTS, nosniff, frame options; no `X-Powered-By` | ✅ |
| `API-Version: 1` and `RateLimit` headers | ✅ |
| Credentials rate limit: 401 ×7 then 429 (10 attempts per window incl. earlier logins) | ✅ |
| SIGTERM to both processes: "shutting down" logged, both exit | ✅ |
| Logs: no passwords; `authorization` and `cookie` headers `[REDACTED]` | ✅ |

**Not run here:**

- Docker image builds (no Docker daemon in this environment).
- `prisma migrate diff` drift check, because the Prisma schema engine can't be downloaded here. The new migration SQL
  was written to match Prisma's output and was applied with `psql`.

## Deviations and notes

- **Rate limiting is applied at the gateway only.** The gateway is the single public entry point. The main API is
  reachable only on the internal Docker network, so it has no limiter of its own.
- **`modules/files` was added** next to the 35 business modules, because uploads are shared by several of them (see its
  README).
- **The storage port no longer has `signedUrl`.** Downloads go through the authorized `/files/:id/content` endpoint
  instead. An object-store provider can add pre-signed URLs later.
- **Applications no longer emit `.d.ts` files** (`apps/*/tsconfig.build.json`). Nothing imports them, and Prisma
  repository return types can't be named in declarations.
- **`changePassword` for a missing user now returns 401** instead of an unhandled 500.

## Next phase

Port the restaurant modules to the main API in dependency order:

1. categories / products / menu
2. tables
3. customers
4. orders + pos + kitchen
5. payments + cash-management + invoices
6. inventory + purchasing + suppliers
7. expenses
8. reports

Each module gets a Prisma schema, the same database rules the Supabase RPCs enforce today, tests, and OpenAPI docs.
Then switch the matching dashboard pages to `@sombill/api-client`. The website lead endpoint and the kitchen display
follow the same pattern.
