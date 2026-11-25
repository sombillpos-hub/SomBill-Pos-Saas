# Current SomBill backend: Supabase (`database/supabase/`)

The SomBill backend is a **Supabase** project: PostgreSQL 16 with row-level security, business logic in SQL
functions and triggers, Storage, Realtime, and one Deno Edge Function. The Manager, Waiter and Cashier dashboards call
it directly and the database enforces every permission.

> **Status (22 Nov 2026):** this is the live backend of the current dashboards. The new Node.js backend
> (`backend/apps`, see `backend/README.md`) are being built in phases next to it. This package stays in production
> until they reach feature parity. It is a standalone npm package (`@sombill/supabase-legacy`) with its own `npm install`.

This folder used to live inside the dashboards app (`SomBill-Dashboards/supabase/`), while the project's `backend/`
folder was empty. It was moved here unchanged so the frontend/backend boundary matches the folders.

## Layout

```text
database/
├── supabase/                         Supabase CLI project folder (run `supabase …` from database/)
│   ├── migrations/                   Apply in filename order
│   │   ├── 20261121000001_core_schema.sql            tables, enums, constraints, indexes
│   │   ├── 20261121000002_business_logic.sql         triggers and functions: totals, stock, orders, purchasing, audit
│   │   ├── 20261121000003_rls_storage_realtime.sql   RLS policies, grants, storage buckets/policies, realtime publication
│   │   ├── 20261121000004_waiter_enums.sql           Accepted status, Kitchen role (commit before 000005)
│   │   ├── 20261121000005_waiter_pos.sql             waiter orders, bill requests, notifications, staff shifts
│   │   ├── 20261121000006_cashier_enums.sql          EVC Plus, Zaad, Somtel Money (commit before 000007)
│   │   ├── 20261121000007_cashier_pos.sql            payments, refunds, cashier shifts, cash movements, receipts
│   │   └── 20261122000008_super_admin.sql            groups, owner access, consolidated RPCs, menu push, tax filings
│   ├── functions/manage-staff/
│   │   ├── handler.ts                staff provisioning rules (runtime-agnostic, unit-tested)
│   │   └── index.ts                  Deno entrypoint: CORS, service-role client, wires handler.ts
│   ├── tests/
│   │   ├── supabase_shim.sql         emulates auth.uid(), anon/authenticated roles, storage.objects on plain PostgreSQL
│   │   ├── 01_manager_rules.test.sql · 02_waiter_rules.test.sql · 03_cashier_rules.test.sql   (303 assertions)
│   │   ├── concurrency_payments.sh   parallel-session payment, idempotency and refund races
│   │   └── run_db_tests.sh           throwaway PostgreSQL 16 cluster → shim → migrations ×2 → tests
│   └── inspect_existing_schema.sql   run on an existing database BEFORE applying migrations
│   ├── tests/functions/manage-staff.test.ts   Vitest unit tests for handler.ts (9 tests)
│   └── package.json · tsconfig.json · vitest.config.ts   (workspace package @sombill/supabase-legacy)
└── README.md
```

The usual layers of a Node API (controllers, repositories, routes, middleware) map onto Supabase like this:

| Concern                      | Where it lives                                                                                                                               |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Data model / schemas         | `migrations/000001`, `000004`, `000006` (tables, enums, constraints)                                                                         |
| Business logic ("services")  | SQL functions in `000002`, `000005`, `000007` (`record_payments`, `submit_waiter_order`, `process_refund`, …)                                |
| Authorization ("middleware") | RLS policies plus the `is_member`, `is_manager`, `has_role` and `has_permission` helpers in `000003` and later; `SECURITY DEFINER` functions |
| Validation                   | CHECK constraints, triggers (`validate_pos_items`, `orders_discount_guard`, …), zod schemas in the dashboards for UX only                    |
| Privileged operations        | `functions/manage-staff` (the service-role key never reaches a browser)                                                                      |
| API surface ("routes")       | PostgREST on the tables below, `rpc()` on the functions below, and `functions/v1/manage-staff`                                               |

## Setup

1. **Inspect the existing database first.** Run `supabase/inspect_existing_schema.sql` in the Supabase SQL editor.
   If any SomBill tables already exist with different columns, **do not apply the migrations blindly**. Write a
   reconciling migration instead (see `documentation/project/PROJECT_STATUS.md` → Migration plan).
2. **Link the CLI** from this folder: `cd backend && supabase link --project-ref <ref>`. The repository has no
   `supabase/config.toml` yet. `supabase init` creates one, and it will not touch the existing migrations or functions.
3. **Apply the migrations in order** with `supabase db push` or the SQL editor. `000004` must be committed before
   `000005`, and `000006` before `000007`, because new enum values cannot be used in the same transaction.
4. **Deploy the staff function:**
   ```bash
   supabase functions deploy manage-staff
   supabase secrets set ALLOWED_ORIGINS="https://your-domain,http://localhost:5173"
   ```
5. **Auth settings** (Supabase dashboard → Authentication): turn **off** public sign-ups (staff join only by manager
   invitation), and add `https://your-domain/reset-password` (and the localhost equivalent) to the redirect URLs.

## Scripts

| Command                                            | What it does                                                                                                                    |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `npm install` (in `database/supabase/`)             | Installs Vitest and TypeScript (used for the Edge Function logic tests only)                                                    |
| `pnpm test:legacy`                                 | Unit tests for `functions/manage-staff/handler.ts`                                                                              |
| `pnpm --filter @sombill/supabase-legacy typecheck` | Strict `tsc` over `handler.ts` and the tests (the Deno `index.ts` is checked by `deno check` / `supabase functions serve`)      |
| `pnpm test:db`                                     | Needs PostgreSQL 16 server binaries (`PGBIN` to override). Applies every migration twice and runs all SQL and concurrency tests |

## API surface used by the frontend

**Tables (PostgREST, all with RLS forced):** restaurants, profiles, restaurant_members, audit_logs, categories,
suppliers, inventory_items, products, product_recipe_items, restaurant_tables, customers, orders, order_items, payments,
stock_movements, purchase_orders, purchase_order_items, purchase_order_receipts, expenses, notifications, staff_shifts,
pos_requests, cashier_shifts, cash_movements, payment_requests, refunds, receipts.

**RPC functions called by the dashboards:** acknowledge_bill_request, add_cash_movement, add_order_items,
adjust_stock, apply_discount, cancel_order, cashier_shift_summary, close_cashier_shift, close_paid_order,
create_restaurant, decide_refund, issue_receipt, mark_receipt_printed, open_cashier_shift, process_refund,
receive_purchase_order, record_payments, refund_order, review_expense, sales_summary, submit_pos_order,
submit_waiter_order, touch_last_login, transfer_stock, verify_payment.

**Edge Function:** `manage-staff`, called from the Manager → Staff page.

**Storage:** restaurant-prefixed paths. The `expense-attachments` bucket is private and served through 5-minute signed
URLs.

**Realtime (`supabase_realtime` publication):** products, categories, restaurant_tables, orders, order_items, payments,
inventory_items, notifications, staff_shifts, refunds, cashier_shifts, receipts.

None of these changed in the restructure.
