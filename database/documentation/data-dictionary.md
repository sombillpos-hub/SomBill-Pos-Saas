# Data dictionary

Every column of the new backend's tables, generated from the Prisma schemas. Types are Prisma types (`String @db.Uuid` = `uuid`, `DateTime @db.Timestamptz(6)` = `timestamptz`).

## Identity (`sombill_identity`)

### `users` (model `User`)

| Column                | Type              | Null | Notes                         |
| --------------------- | ----------------- | ---- | ----------------------------- |
| `id`                  | Uuid              | no   | primary key, default `uuid()` |
| `email`               | String            | no   | unique                        |
| `full_name`           | String            | no   |                               |
| `phone`               | String            | yes  |                               |
| `password_hash`       | String            | no   |                               |
| `status`              | UserStatus (enum) | no   | default `ACTIVE`              |
| `failed_login_count`  | Int               | no   | default `0`                   |
| `locked_until`        | Timestamptz(6)    | yes  |                               |
| `last_login_at`       | Timestamptz(6)    | yes  |                               |
| `password_changed_at` | Timestamptz(6)    | yes  |                               |
| `created_at`          | Timestamptz(6)    | no   | default `now()`               |
| `updated_at`          | Timestamptz(6)    | no   | updated automatically         |

### `permissions` (model `Permission`)

| Column        | Type   | Null | Notes       |
| ------------- | ------ | ---- | ----------- |
| `code`        | String | no   | primary key |
| `description` | String | no   |             |

### `roles` (model `Role`)

| Column            | Type           | Null | Notes                         |
| ----------------- | -------------- | ---- | ----------------------------- |
| `id`              | Uuid           | no   | primary key, default `uuid()` |
| `scope_key`       | String         | no   |                               |
| `organization_id` | Uuid           | yes  |                               |
| `code`            | String         | no   |                               |
| `name`            | String         | no   |                               |
| `is_system`       | Boolean        | no   | default `false`               |
| `created_at`      | Timestamptz(6) | no   | default `now()`               |
| `updated_at`      | Timestamptz(6) | no   | updated automatically         |

`@@unique([scopeKey, code])`

### `role_permissions` (model `RolePermission`)

| Column            | Type   | Null | Notes |
| ----------------- | ------ | ---- | ----- |
| `role_id`         | Uuid   | no   |       |
| `permission_code` | String | no   |       |

`@@id([roleId, permissionCode])`

### `memberships` (model `Membership`)

| Column               | Type           | Null | Notes                         |
| -------------------- | -------------- | ---- | ----------------------------- |
| `id`                 | Uuid           | no   | primary key, default `uuid()` |
| `user_id`            | Uuid           | no   |                               |
| `organization_id`    | Uuid           | no   |                               |
| `branch_id`          | Uuid           | yes  |                               |
| `branch_scope`       | String         | no   |                               |
| `role_id`            | Uuid           | no   |                               |
| `created_by_user_id` | Uuid           | yes  |                               |
| `created_at`         | Timestamptz(6) | no   | default `now()`               |

`@@unique([userId, organizationId, branchScope, roleId])`

`@@index([organizationId])`

### `known_branches` (model `KnownBranch`)

| Column            | Type           | Null | Notes           |
| ----------------- | -------------- | ---- | --------------- |
| `id`              | Uuid           | no   | primary key     |
| `organization_id` | Uuid           | no   |                 |
| `created_at`      | Timestamptz(6) | no   | default `now()` |

`@@index([organizationId])`

### `user_sessions` (model `Session`)

| Column           | Type           | Null | Notes                         |
| ---------------- | -------------- | ---- | ----------------------------- |
| `id`             | Uuid           | no   | primary key, default `uuid()` |
| `user_id`        | Uuid           | no   |                               |
| `user_agent`     | String         | yes  |                               |
| `ip_address`     | String         | yes  |                               |
| `created_at`     | Timestamptz(6) | no   | default `now()`               |
| `last_used_at`   | Timestamptz(6) | no   | default `now()`               |
| `expires_at`     | Timestamptz(6) | no   |                               |
| `revoked_at`     | Timestamptz(6) | yes  |                               |
| `revoked_reason` | String         | yes  |                               |

`@@index([userId])`

### `refresh_tokens` (model `RefreshToken`)

| Column       | Type           | Null | Notes                         |
| ------------ | -------------- | ---- | ----------------------------- |
| `id`         | Uuid           | no   | primary key, default `uuid()` |
| `session_id` | Uuid           | no   |                               |
| `token_hash` | String         | no   | unique                        |
| `created_at` | Timestamptz(6) | no   | default `now()`               |
| `expires_at` | Timestamptz(6) | no   |                               |
| `used_at`    | Timestamptz(6) | yes  |                               |

`@@index([sessionId])`

### `audit_logs` (model `AuditLog`)

| Column            | Type           | Null | Notes                         |
| ----------------- | -------------- | ---- | ----------------------------- |
| `id`              | Uuid           | no   | primary key, default `uuid()` |
| `occurred_at`     | Timestamptz(6) | no   | default `now()`               |
| `actor_user_id`   | Uuid           | yes  |                               |
| `organization_id` | Uuid           | yes  |                               |
| `action`          | String         | no   |                               |
| `target_type`     | String         | yes  |                               |
| `target_id`       | String         | yes  |                               |
| `ip_address`      | String         | yes  |                               |
| `user_agent`      | String         | yes  |                               |
| `metadata`        | Json           | yes  |                               |

`@@index([organizationId, occurredAt])`

`@@index([actorUserId, occurredAt])`

### `outbox_events` (model `OutboxEvent`)

| Column          | Type           | Null | Notes           |
| --------------- | -------------- | ---- | --------------- |
| `id`            | Uuid           | no   | primary key     |
| `event_type`    | String         | no   |                 |
| `event_version` | Int            | no   |                 |
| `payload`       | Json           | no   |                 |
| `occurred_at`   | Timestamptz(6) | no   |                 |
| `available_at`  | Timestamptz(6) | no   | default `now()` |
| `published_at`  | Timestamptz(6) | yes  |                 |
| `attempts`      | Int            | no   | default `0`     |
| `last_error`    | String         | yes  |                 |

`@@index([publishedAt, availableAt])`

### `processed_events` (model `ProcessedEvent`)

| Column         | Type           | Null | Notes           |
| -------------- | -------------- | ---- | --------------- |
| `event_id`     | Uuid           | no   |                 |
| `consumer`     | String         | no   |                 |
| `processed_at` | Timestamptz(6) | no   | default `now()` |

`@@id([eventId, consumer])`

## Organization (`sombill_organization`)

### `organizations` (model `Organization`)

| Column               | Type                      | Null | Notes                         |
| -------------------- | ------------------------- | ---- | ----------------------------- |
| `id`                 | Uuid                      | no   | primary key, default `uuid()` |
| `name`               | String                    | no   |                               |
| `legal_name`         | String                    | yes  |                               |
| `slug`               | String                    | no   | unique                        |
| `country`            | Char(2)                   | no   |                               |
| `currency`           | Char(3)                   | no   |                               |
| `timezone`           | String                    | no   |                               |
| `status`             | OrganizationStatus (enum) | no   | default `ACTIVE`              |
| `created_by_user_id` | Uuid                      | no   |                               |
| `created_at`         | Timestamptz(6)            | no   | default `now()`               |
| `updated_at`         | Timestamptz(6)            | no   | updated automatically         |

### `branches` (model `Branch`)

| Column            | Type                | Null | Notes                         |
| ----------------- | ------------------- | ---- | ----------------------------- |
| `id`              | Uuid                | no   | primary key, default `uuid()` |
| `organization_id` | Uuid                | no   |                               |
| `code`            | String              | no   |                               |
| `name`            | String              | no   |                               |
| `phone`           | String              | yes  |                               |
| `email`           | String              | yes  |                               |
| `address_line1`   | String              | yes  |                               |
| `address_line2`   | String              | yes  |                               |
| `city`            | String              | yes  |                               |
| `country`         | Char(2)             | no   |                               |
| `timezone`        | String              | no   |                               |
| `currency`        | Char(3)             | no   |                               |
| `status`          | BranchStatus (enum) | no   | default `ACTIVE`              |
| `created_at`      | Timestamptz(6)      | no   | default `now()`               |
| `updated_at`      | Timestamptz(6)      | no   | updated automatically         |

`@@unique([organizationId, code])`

`@@index([organizationId, status])`

### `branch_settings` (model `BranchSettings`)

| Column                | Type           | Null | Notes                 |
| --------------------- | -------------- | ---- | --------------------- |
| `branch_id`           | Uuid           | no   | primary key           |
| `tax_rate`            | Decimal        | no   | default `0`           |
| `service_charge_rate` | Decimal        | no   | default `0`           |
| `prices_include_tax`  | Boolean        | no   | default `false`       |
| `receipt_header`      | String         | yes  |                       |
| `receipt_footer`      | String         | yes  |                       |
| `updated_by_user_id`  | Uuid           | yes  |                       |
| `updated_at`          | Timestamptz(6) | no   | updated automatically |

### `subscriptions` (model `Subscription`)

| Column                 | Type                      | Null | Notes                         |
| ---------------------- | ------------------------- | ---- | ----------------------------- |
| `id`                   | Uuid                      | no   | primary key, default `uuid()` |
| `organization_id`      | Uuid                      | no   | unique                        |
| `plan`                 | String                    | no   |                               |
| `status`               | SubscriptionStatus (enum) | no   |                               |
| `max_branches`         | Int                       | no   |                               |
| `trial_ends_at`        | Timestamptz(6)            | yes  |                               |
| `current_period_start` | Timestamptz(6)            | no   |                               |
| `current_period_end`   | Timestamptz(6)            | no   |                               |
| `created_at`           | Timestamptz(6)            | no   | default `now()`               |
| `updated_at`           | Timestamptz(6)            | no   | updated automatically         |

### `audit_logs` (model `AuditLog`)

| Column            | Type           | Null | Notes                         |
| ----------------- | -------------- | ---- | ----------------------------- |
| `id`              | Uuid           | no   | primary key, default `uuid()` |
| `occurred_at`     | Timestamptz(6) | no   | default `now()`               |
| `actor_user_id`   | Uuid           | yes  |                               |
| `organization_id` | Uuid           | yes  |                               |
| `action`          | String         | no   |                               |
| `target_type`     | String         | yes  |                               |
| `target_id`       | String         | yes  |                               |
| `ip_address`      | String         | yes  |                               |
| `user_agent`      | String         | yes  |                               |
| `metadata`        | Json           | yes  |                               |

`@@index([organizationId, occurredAt])`

### `outbox_events` (model `OutboxEvent`)

| Column          | Type           | Null | Notes           |
| --------------- | -------------- | ---- | --------------- |
| `id`            | Uuid           | no   | primary key     |
| `event_type`    | String         | no   |                 |
| `event_version` | Int            | no   |                 |
| `payload`       | Json           | no   |                 |
| `occurred_at`   | Timestamptz(6) | no   |                 |
| `available_at`  | Timestamptz(6) | no   | default `now()` |
| `published_at`  | Timestamptz(6) | yes  |                 |
| `attempts`      | Int            | no   | default `0`     |
| `last_error`    | String         | yes  |                 |

`@@index([publishedAt, availableAt])`

### `processed_events` (model `ProcessedEvent`)

| Column         | Type           | Null | Notes           |
| -------------- | -------------- | ---- | --------------- |
| `event_id`     | Uuid           | no   |                 |
| `consumer`     | String         | no   |                 |
| `processed_at` | Timestamptz(6) | no   | default `now()` |

`@@id([eventId, consumer])`
