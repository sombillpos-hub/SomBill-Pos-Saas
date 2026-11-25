# API documentation

> **Structure update (22 Nov 2026).** The identity and organization services now run as two *modules* of one process, `backend/apps/main-api` (one PostgreSQL database per module, same events and API contract). Shared code was split into `backend/packages/{database,authentication,authorization,validation,logger,cache,messaging,email,storage,shared-types,shared-utils}`; `supabase/` moved to `database/`, `infrastructure/` and `scripts/` to the project root, and these documents to `documentation/`. Text below that still says "identity-service" / "organization-service" describes the same code under its former name; a full rewrite is a follow-up.

**Base URL:** `https://api.sombill.com/api/v1` (locally `http://localhost/api/v1` through Nginx).
**Interactive docs:** `GET /api/docs` (Swagger UI, one spec per service, generated from the same Zod schemas that
validate requests, so docs and validation cannot drift).

## Conventions

| Topic         | Rule                                                                                          |
| ------------- | --------------------------------------------------------------------------------------------- |
| Versioning    | URL prefix `/api/v1`. Breaking changes ship as `/api/v2` alongside v1                         |
| Auth          | `Authorization: Bearer <access token>` (RS256 JWT, 15 min). Refresh with `POST /auth/refresh` |
| Success       | `{ "data": … }`; lists `{ "data": [...], "meta": { page, pageSize, total, totalPages } }`     |
| Errors        | `{ "error": { "code", "message", "details?", "requestId" } }` with a meaningful HTTP status   |
| Pagination    | `?page=1&pageSize=20` (max 100)                                                               |
| Filtering     | explicit query parameters (`status`, `search`, `organizationId`, …), all validated            |
| Money / rates | decimal **strings** (`"5.1250"`), never floats                                                |
| Request ids   | send `X-Request-Id` or receive one; it appears in logs, errors and events (`correlationId`)   |
| Idempotency   | `Idempotency-Key` header is reserved for payment and refund endpoints (Phase 5)               |

Common error codes: `VALIDATION_ERROR` (400), `TOKEN_MISSING` / `TOKEN_INVALID` / `TOKEN_EXPIRED` (401),
`INVALID_CREDENTIALS` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` and specific conflicts (409),
`RATE_LIMITED` (429), `UPSTREAM_UNAVAILABLE` (502).

## Identity: `/auth`, `/users`, `/roles`, `/permissions`

| Method & path                    | Auth           | Description                                                                                   |
| -------------------------------- | -------------- | --------------------------------------------------------------------------------------------- |
| `POST /auth/register`            | public         | `{ email, password (10–128), fullName, phone? }` → 201 session                                |
| `POST /auth/login`               | public         | `{ email, password }` → session. Rate limited; same 401 for wrong password and unknown e-mail |
| `POST /auth/refresh`             | refresh cookie | rotates the refresh token → new session. Reuse ⇒ `REFRESH_REUSED` and the session ends        |
| `POST /auth/logout`              | refresh cookie | ends the session (works with an expired access token)                                         |
| `POST /auth/logout-all`          | bearer         | ends every session of the user                                                                |
| `POST /auth/change-password`     | bearer         | `{ currentPassword, newPassword }`; other sessions end                                        |
| `GET /auth/me`                   | bearer         | user + current memberships                                                                    |
| `GET /users?organizationId=`     | `user.read`    | staff of an organization (branch managers see their branch). `search`, pagination             |
| `POST /users/memberships`        | `role.assign`  | `{ organizationId, branchId?, email, role }`. Privilege-escalation guard                      |
| `DELETE /users/memberships/{id}` | `role.assign`  | removes a role (never the last owner)                                                         |
| `GET /roles?organizationId=`     | `role.read`    | system and organization roles with permissions                                                |
| `GET /permissions`               | bearer         | permission catalogue                                                                          |

**Session response** (`register`, `login`, `refresh`):

```json
{
  "data": {
    "accessToken": "eyJ…",
    "tokenType": "Bearer",
    "expiresIn": 900,
    "user": {
      "id": "…",
      "email": "amina@sombill.com",
      "fullName": "Amina Yusuf",
      "phone": null,
      "status": "ACTIVE",
      "createdAt": "…"
    },
    "memberships": [
      { "organizationId": "…", "branchId": null, "role": "owner", "permissions": ["organization.read", "…"] }
    ]
  }
}
```

The refresh token is set as cookie `sombill_rt` (`HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth`).
Non-browser clients send `X-Token-Transport: body` to receive it as `data.refreshToken`, and send it back in the body.

## Organization: `/organizations`, `/branches`

| Method & path                                    | Permission                               | Description                                                                                                                                          |
| ------------------------------------------------ | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /organizations`                            | signed in                                | `{ name, legalName?, slug?, country, currency, timezone }` → 201 with trial subscription. Owner granted asynchronously; refresh the token afterwards |
| `GET /organizations`                             | signed in                                | organizations the caller belongs to                                                                                                                  |
| `GET /organizations/{id}`                        | `organization.read`                      |                                                                                                                                                      |
| `PATCH /organizations/{id}`                      | `organization.update`                    | `name`, `legalName`, `timezone`                                                                                                                      |
| `GET /organizations/{id}/subscription`           | `subscription.read`                      | plan, status, `maxBranches`, period                                                                                                                  |
| `POST /organizations/{id}/branches`              | `branch.create` (org-wide)               | `{ code, name, phone?, email?, address…, country?, timezone?, currency? }`. `PLAN_LIMIT_REACHED`, `BRANCH_CODE_TAKEN`                                |
| `GET /organizations/{id}/branches`               | `branch.read`                            | `status`, `search`, pagination; branch staff see only theirs                                                                                         |
| `GET /branches/{id}` · `PATCH /branches/{id}`    | `branch.read` · `branch.update`          | other organizations get 404                                                                                                                          |
| `GET /branches/{id}/settings` · `PUT …/settings` | `branch.read` · `branch.settings.manage` | `taxRate`, `serviceChargeRate` (decimal strings 0–100), `pricesIncludeTax`, receipt texts                                                            |

## Frontend integration

The dashboards' Axios client (`frontend/packages/api-client/src/httpClient.ts`) targets this contract: base URL from
`VITE_API_BASE_URL`, cookie refresh at `POST /auth/refresh` reading `data.accessToken`, retry after a single refresh,
and `ApiError` built from `error.code` / `error.message`.

## API standards (Phase 2, 23 Nov 2026)

| Topic | Rule |
| --- | --- |
| Base URL and version | `https://<host>/api/v1/...` through the API gateway. The version is in the URL; every versioned response also carries `API-Version: 1`. A breaking change gets `/api/v2` next to v1. |
| Resource paths | Plural nouns, kebab-case: `GET /orders`, `GET /orders/:id`, `POST /orders`, `PATCH /orders/:id`, `DELETE /orders/:id`. Sub-resources are nested once (`/organizations/:id/branches`). Actions that are not CRUD are sub-paths with a verb (`POST /orders/:id/cancel`). |
| Status codes | 200 read/update, 201 created, 204 no body, 400 validation, 401 not signed in / bad token, 403 signed in but not allowed, 404 not found **or another organization's resource**, 409 conflict / business rule, 413 too large, 415 unsupported file type, 429 rate limited, 500 unexpected (no internals), 502/504 upstream down/slow. |
| Success body | `{ "data": <object or array> }` |
| Lists | `?page=1&pageSize=20` (max 100) → `{ "data": [...], "meta": { "page", "pageSize", "total", "totalPages" } }` |
| Errors | `{ "error": { "code": "UPPER_SNAKE", "message": "readable text", "details"?: ..., "requestId": "..." } }`; validation errors list `details: [{ path, message }]`. |
| Money and rates | Decimal strings (`"12.5000"`), never floats. |
| Dates | ISO-8601 UTC strings. |
| Authentication | `Authorization: Bearer <access token>` (RS256 JWT, 15 min). Refresh token: httpOnly cookie on `/api/v1/auth` (or body with `X-Token-Transport: body`). |
| Authorization | Checked in services against the permission catalogue (`@sombill/shared-types`), per organization and branch. |
| Idempotency | Money-moving `POST`s accept `Idempotency-Key` (as the Supabase RPCs do today). |
| Tracing | Send or receive `X-Request-Id`; it is in every log line and error body. |
| Uploads | `POST /files` multipart (see `backend/apps/main-api/src/modules/files/README.md`). |
| Docs | Swagger UI at `GET /api/docs`; machine-readable specs at `/api/docs/identity.json` and `/api/docs/organization.json`. |

Implementation layering (every module): routes → controllers → services → repositories, with Zod validators and view
models. See `documentation/project/PHASE_2_BACKEND_FOUNDATION_REPORT.md`.
