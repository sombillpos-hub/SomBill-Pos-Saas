# Database architecture

> **Structure update (22 Nov 2026).** The identity and organization services now run as two *modules* of one process, `backend/apps/main-api` (one PostgreSQL database per module, same events and API contract). Shared code was split into `backend/packages/{database,authentication,authorization,validation,logger,cache,messaging,email,storage,shared-types,shared-utils}`; `supabase/` moved to `database/`, `infrastructure/` and `scripts/` to the project root, and these documents to `documentation/`. Text below that still says "identity-service" / "organization-service" describes the same code under its former name; a full rewrite is a follow-up.

## Principles

- **One PostgreSQL database per service** (`sombill_identity`, `sombill_organization`, …), each with two roles:
  - `<svc>_migrator` owns the database and runs migrations (DDL);
  - `<svc>_app` is used by the running service: `SELECT/INSERT/UPDATE/DELETE` only, no DDL, no access to other
    databases. Verified: the app role cannot create, alter or drop tables, nor connect to another service's database.
- **Cross-service references are plain UUIDs without foreign keys** (e.g. `memberships.organization_id`). Consistency
  across services comes from events, not from joins.
- **Conventions:** UUID primary keys; `TIMESTAMPTZ(6)` for every time; snake_case tables and columns mapped to
  camelCase in Prisma; ISO codes stored as `CHAR(2)` / `CHAR(3)` and checked; money and precise quantities as
  `NUMERIC(19,4)` (rates as `NUMERIC(7,4)`), always returned to clients as strings; explicit currency codes on every
  monetary record.
- **Integrity in the database, not only in code:** unique keys, foreign keys inside a service, `CHECK` constraints
  (formats, ranges, consistency rules) and append-only triggers on audit logs.
- **Every service has** `audit_logs` (append-only), `outbox_events` (transactional outbox) and `processed_events`
  (idempotent consumers).

## Migrations

Prisma Migrate. `prisma/migrations/*/migration.sql` files are applied in order by `prisma migrate deploy` (the
`<svc>-migrate` job in Compose). Rules:

1. Never edit an applied migration; add a new one.
2. Expand → migrate → contract for breaking changes (add the new column, backfill, switch code, drop later).
3. CI runs `prisma migrate diff --from-migrations … --to-schema … --exit-code` to prove the SQL matches the schema.
   `CHECK` constraints and triggers are added in SQL because Prisma cannot express them, and Prisma ignores them when
   diffing.

## identity database

| Table                                               | Purpose                                                  | Key rules                                                                                                            |
| --------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `users`                                             | accounts                                                 | e-mail unique and stored lower-case (`CHECK`); Argon2id `password_hash`; lock-out counters                           |
| `permissions`                                       | catalogue (`resource.action`)                            | synced from `shared-types` at start-up                                                                               |
| `roles`                                             | system (`scope_key='system'`) and per-organization roles | unique `(scope_key, code)`; scope consistency `CHECK`                                                                |
| `role_permissions`                                  | role ↔ permission                                        | composite PK, cascades                                                                                               |
| `memberships`                                       | user's role in an organization, optionally one branch    | unique `(user, org, branch_scope, role)`; `branch_scope` is `'*'` or the branch id (NULL-safe uniqueness, `CHECK`ed) |
| `known_branches`                                    | branch ids replicated from `branch.created`              | validates branch-scoped roles                                                                                        |
| `user_sessions`                                     | one per login (refresh-token family)                     | absolute expiry, revocation reason                                                                                   |
| `refresh_tokens`                                    | SHA-256 hashes only                                      | unique hash; `used_at` marks rotation (reuse ⇒ session revoked)                                                      |
| `audit_logs` · `outbox_events` · `processed_events` |                                                          | append-only trigger on audit                                                                                         |

## organization database

| Table                                               | Purpose               | Key rules                                                                               |
| --------------------------------------------------- | --------------------- | --------------------------------------------------------------------------------------- |
| `organizations`                                     | tenant                | unique slug (`CHECK` format); ISO country/currency `CHECK`s                             |
| `branches`                                          | locations             | unique `(organization_id, code)`; code format `CHECK`; FK → organizations (restrict)    |
| `branch_settings`                                   | 1:1 with branch       | tax and service charge `NUMERIC(7,4)` within 0–100 (`CHECK`)                            |
| `subscriptions`                                     | 1:1 with organization | `max_branches ≥ 1`; period end after start (`CHECK`); row-locked when creating branches |
| `audit_logs` · `outbox_events` · `processed_events` |                       |                                                                                         |

## Domains of later phases

The domains in the backend brief (catalog, inventory, payments, kitchen, workforce, finance, reporting, notifications,
digital ordering, and hotel/housekeeping if resumed) get their own databases when their phase starts. Each will be
normalized from real workflows at that point, with the same conventions: `NUMERIC(19,4)` money with currency,
double-entry journals where debits = credits (enforced by constraint and test), and reversal records instead of updates
for anything financial.
