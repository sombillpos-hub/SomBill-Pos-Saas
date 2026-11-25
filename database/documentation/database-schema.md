# Database schema

SomBill's new backend keeps **one PostgreSQL database per module**, so a module can never read another module's tables. The current live system (Supabase) is documented separately in [`../supabase/README.md`](../supabase/README.md).

Generated from the Prisma schemas in [`../prisma/`](../prisma/); regenerate this file when a schema changes.

## Identity module — `sombill_identity`

Schema: [`prisma/schema.prisma`](../prisma/schema.prisma) · migrations: `prisma/migrations/identity/`

| Model            | Table              | Purpose (columns) |
| ---------------- | ------------------ | ----------------- |
| `User`           | `users`            | 12 columns        |
| `Permission`     | `permissions`      | 2 columns         |
| `Role`           | `roles`            | 8 columns         |
| `RolePermission` | `role_permissions` | 2 columns         |
| `Membership`     | `memberships`      | 8 columns         |
| `KnownBranch`    | `known_branches`   | 3 columns         |
| `Session`        | `user_sessions`    | 9 columns         |
| `RefreshToken`   | `refresh_tokens`   | 6 columns         |
| `AuditLog`       | `audit_logs`       | 10 columns        |
| `OutboxEvent`    | `outbox_events`    | 9 columns         |
| `ProcessedEvent` | `processed_events` | 3 columns         |

Enums: `user_status` (ACTIVE, SUSPENDED)

## Organization module — `sombill_organization`

Schema: [`prisma/organization.prisma`](../prisma/organization.prisma) · migrations: `prisma/migrations/organization/`

| Model            | Table              | Purpose (columns) |
| ---------------- | ------------------ | ----------------- |
| `Organization`   | `organizations`    | 11 columns        |
| `Branch`         | `branches`         | 15 columns        |
| `BranchSettings` | `branch_settings`  | 8 columns         |
| `Subscription`   | `subscriptions`    | 10 columns        |
| `AuditLog`       | `audit_logs`       | 10 columns        |
| `OutboxEvent`    | `outbox_events`    | 9 columns         |
| `ProcessedEvent` | `processed_events` | 3 columns         |

Enums: `organization_status` (ACTIVE, SUSPENDED), `branch_status` (ACTIVE, INACTIVE), `subscription_status` (TRIALING, ACTIVE, PAST_DUE, CANCELED)

## Shared conventions

- Primary keys are UUIDs (`gen_random_uuid()` via Prisma `uuid()`), except catalogue keys such as `permissions.code`.
- All timestamps are `timestamptz`; columns are `snake_case` in SQL, `camelCase` in code (`@map`).
- Each database has its own `outbox_events` (transactional outbox) and `processed_events` (consumer idempotency) tables, plus an `audit_logs` table.
- Cross-module references (e.g. `memberships.organization_id`) are plain UUID columns, **not** foreign keys: the two rows live in different databases and stay consistent through events (`organization.created`, `branch.created`).
