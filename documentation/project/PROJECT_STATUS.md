# PROJECT_STATUS — SomBill (Manager Dashboard + Waiter POS + Cashier POS + Super Admin HQ)

_Last updated: 22 Nov 2026 (sign-in redesign and Super Admin / Group HQ added; Obsidian Ruby design system, light default + dark switch)_

## Summary
- **Super Admin / Group HQ:** 13 pages at `/dashboard/super-admin` for a multi-branch owner, with branch view into the Manager app. See SUPER_ADMIN_REPORT.md.
- **Manager dashboard:** all 13 sidebar modules plus Logout. See MANAGER_MODULES.md.
- **Waiter POS:** all 9 sections plus Logout, at `/waiter`. See WAITER_MODULES.md and WAITER_TEST_REPORT.md.
- **Cashier POS:** all 10 sections plus Logout, at `/cashier`. It covers split payments (cash, card, EVC Plus, Zaad,
  Somtel Money), manual mobile money verification, refunds with approval, cash shifts with reconciliation, and 80mm
  receipts. See CASHIER_MODULES.md and CASHIER_TEST_REPORT.md.

**Project layout (22 Nov 2026):** one repository with `frontend/apps/website/` (public site), `frontend/apps/dashboards/`
(the dashboards shell plus `apps/{manager,waiter,cashier,super-admin}` and `packages/*`; see FRONTEND_APPS_REPORT.md), `backend/`
(Supabase migrations, RLS, Edge Function, database tests) and `documentation/`. See the root `README.md`,
`documentation/architecture/system-architecture.md`, `documentation/architecture/frontend-architecture.md` and
`documentation/project/RESTRUCTURE_REPORT.md`.

All three run on the shared Supabase database with server-side authorization (RLS and SECURITY DEFINER functions), audit
logging and realtime updates. After sign-in, `/` routes each person to the app for their role. All local quality
gates pass.

| Gate | Result |
|---|---|
| TypeScript strict (`tsc -b`) | ✅ 0 errors |
| ESLint (`--max-warnings=0`, `no-explicit-any: error`) | ✅ 0 problems |
| Prettier (`format:check`, website + dashboards) | ✅ |
| Vitest: 25 files, 309 tests (299 dashboards incl. API/socket layer, design checks, Super Admin and sign-in, 10 backend) | ✅ all pass |
| Database tests: 357 SQL assertions on PostgreSQL 16 (114 Manager, 91 Waiter, 98 Cashier, 54 Super Admin, including the 17- and 18-step acceptance workflows) | ✅ all pass |
| Concurrency tests (parallel sessions: payments, idempotency keys, refunds) | ✅ 9 / 9 |
| Real-browser tablet check (Chrome, 4 viewports incl. a 390px phone, 9 Waiter + 10 Cashier pages) and 80mm receipt PDF measurement | ✅ 78 / 78, light and dark, PDF 80.09 mm wide |
| Real-browser Super Admin check (`e2e/hq.mjs`: 13 pages × 4 viewports, light and dark) | ✅ 52 / 52 each theme |
| Real-browser sign-in check (`e2e/login.mjs`: 4 viewports, forgot flow, Arabic RTL) | ✅ 32 / 32 |
| Migrations re-applied twice (idempotency) | ✅ |
| Production build (`vite build`) | ✅ |

## Starting point
The project folder was **empty** when work began: there was no existing code, schema or data to preserve. The
migrations are therefore written to be **idempotent and non-destructive** (`create … if not exists`, no drops of
tables or columns). `database/supabase/inspect_existing_schema.sql` is provided so the shared SomBill database can be checked
before the migrations are applied.

## Verified here vs. needs verification on your Supabase project
**Verified locally:**
- Schema, constraints, triggers, RPCs and **RLS isolation**: executed on real PostgreSQL 16 through a small shim
  that emulates Supabase's `auth.uid()`, `anon`/`authenticated` roles and `storage.objects`
  (`database/supabase/tests/supabase_shim.sql`).
- All frontend modules: rendered and exercised against an in-memory Supabase client mock.
- Staff-provisioning authorization logic (`database/supabase/functions/manage-staff/handler.ts`, tested by `database/supabase/tests/functions/manage-staff.test.ts`): unit-tested.

**Not yet verified (no Supabase credentials or Deno runtime were available):**
- Applying the migrations to the real hosted project, especially if it already contains SomBill tables.
- The Deno entrypoint `database/supabase/functions/manage-staff/index.ts` running on Supabase (invite emails, CORS, secrets).
- Card terminals, mobile money provider APIs and physical thermal printers. None is integrated or attached here (see
  CASHIER_TEST_REPORT.md).
- Live Realtime delivery between the Manager, Waiter and Cashier apps. The subscription code is unit-tested, and the
  migration adds the tables to the `supabase_realtime` publication.
- Storage uploads against real buckets.
- Manager dashboard pages with real data. Waiter and Cashier pages are checked in real Chrome at tablet and desktop
  sizes by `npm run test:tablet`. The Manager pages are screenshotted in real Chrome with stubbed data
  (`e2e/manager-shots.mjs`, a review aid rather than an automated check).

## Migration plan for an existing shared database
1. Run `inspect_existing_schema.sql` and compare the result with `20261121000001_core_schema.sql`.
2. If tables exist under the same names with compatible columns, the `if not exists` guards skip them, but **missing
   columns will not be added automatically**. Write `ALTER TABLE … ADD COLUMN` statements for each gap.
3. If existing columns have different names, add a view or a renaming migration with a deprecation window. Never
   rename in place while the Waiter and Cashier apps depend on them.
4. Back up first (`pg_dump`), and apply to a staging branch before production.

## Security model
- **RLS is enabled and forced on every table.** Every policy checks the caller's active membership of the row's
  restaurant (`is_member` / `is_manager` / `has_role` / `has_permission`).
- Clients have **no DELETE privilege** on historical tables: orders, payments, products, customers and the rest.
  Orders, payments and stock movements also block deletes and updates by trigger, **even for the service role**.
- Money and stock are trigger-maintained: order totals, payment state, server-side price snapshots and stock
  quantities can only change through recorded movements.
- Staff provisioning runs in the `manage-staff` Edge Function with the service-role key held server-side. Managers
  never set or see passwords: new staff get an email invitation, and resets send a one-time link.
- Storage paths are prefixed by restaurant ID, and storage RLS restricts writes to that restaurant's managers.
  Expense attachments live in a private bucket served through 5-minute signed URLs.
- CSV export neutralises spreadsheet formula injection.
- Internal "trusted operation" flags use transaction-local settings, which only SECURITY DEFINER code can set.
  `pg_catalog.set_config` is not exposed over PostgREST.

## Waiter POS additions (migrations 000004–000005)
- New order status **Accepted** and staff role **Kitchen**.
- `submit_waiter_order` and `add_order_items`: atomic, idempotent, lock the table, validate prices and availability.
- A role-based status-transition guard. Waiters may only serve their own Ready orders.
- Bill workflow: `request_bill`, `cancel_bill_request`, `acknowledge_bill_request`.
- Stored `notifications`, filled by triggers.
- `staff_shifts`, with `start_shift` / `end_shift`.
- Profile edits restricted to name and phone at the column level.

The changes are additive. The Manager dashboard learned the Accepted status, the Kitchen role and three new
settings.

## Cashier POS additions (migrations 000006–000007)
- Payment methods `evc_plus`, `zaad`, `somtel_money`.
- `record_payments`: atomic, idempotent and order-locked. It handles split lines, cash change, card terminal ID plus
  approval confirmation, and mobile money references as **pending verification**. It blocks overpayment, duplicate
  references and payments without an open shift.
- `verify_payment` (manual verification, never automatic), `apply_discount` (cashier % limit), and
  `submit_pos_order` (counter sales).
- New tables: `refunds` with `process_refund` / `decide_refund` (approval above the cashier limit, item-level
  restock), `cashier_shifts` / `cash_movements` with `open_cashier_shift`, `add_cash_movement`,
  `cashier_shift_summary` and `close_cashier_shift` (reconciliation; closed shifts immutable), and `receipts` with
  `issue_receipt` / `mark_receipt_printed`.
- **Payments are now write-protected**: clients can no longer insert, update or delete them directly. The Manager
  and Waiter test suites were moved to the payment functions accordingly. No Manager or Waiter screen wrote payments
  directly, so no screen changed.
- Manager Settings gained four cashier permissions. The Waiter POS shell and product components were moved to
  `frontend/packages/` for reuse, with no behaviour change (all Waiter tests pass unchanged).

## Sign-in redesign (22 Nov 2026)
`/login` and `/reset-password` use the dark Obsidian Ruby two-column card with a language switch (EN / SO / AR), email domain
chips, Caps Lock warning, a working "Remember me", and a forgot-password flow with a 6-digit code inside the same card.
Authentication logic is unchanged. **Needs setup:** add `{{ .Token }}` to the Supabase "Reset Password" e-mail template for the code to
arrive. PIN login, passkeys, a PWA manifest and a public customer menu do not exist yet, so they are not shown. See
`documentation/project/LOGIN_REDESIGN_REPORT.md`.

## Super Admin additions (migration 000008)
- Group model: `organizations` (plan, limits, license, exchange rates), `organization_members`, `tax_filings`, `audit_reviews`,
  `restaurants.organization_id`. The group owner acts as manager of the group's branches through the extended role helpers.
- 14 owner-only RPCs for consolidated summaries, revenue series, payment mix, inventory, central menu push, broadcast, tax
  filing and group settings; `manage-staff` also accepts the group owner for that group's branches.
- Frontend in `frontend/apps/super-admin/src/`; `ProtectedRoute` gained `OwnerRoute`; Manager Settings gained a
  **Group HQ** tab. Fixed: owners without a selected branch could reach Manager pages; form labels now tie to their fields.
- **Migration 000008 must be applied to Supabase before HQ works.** Deviations from the brief are in SUPER_ADMIN_REPORT.md.

## Frontend stack (22 Nov 2026)
The full frontend stack from the brief is installed: Framer Motion, Zustand, TanStack Query, Axios, Socket.IO client,
Recharts, TanStack Table, date-fns, Prettier. TanStack Query and Framer Motion are wired app-wide. The Axios client
(JWT + single-flight refresh) and the Socket.IO client are built and unit-tested, ready for the SomBill API Gateway
(`VITE_API_BASE_URL`). Existing screens still run on Supabase until the backend stack is defined. Hotel management is
out of scope. See `documentation/architecture/frontend-architecture.md`.

## Design-system packages and Manager design refactor (22 Nov 2026)
Packages for the premium design system are installed in `frontend/apps/dashboards` (Radix, `class-variance-authority`,
`tailwind-merge` v2, `sonner`, `cmdk`, `vaul`, `@number-flow/react`, `@dnd-kit/*`, `react-hotkeys-hook`, self-hosted
Outfit and JetBrains Mono, and others; stack stays React 18 + Tailwind 3.4 + Vite 5). `npm audit` still reports 4 high
findings in older dependencies (`zod` 3.x, `@remix-run/router`); they are not fixed yet.

The **Manager dashboard** now uses the "Obsidian Ruby" design: floating glass sidebar, aurora topbar with live clock,
connection badge, attention bell and Ctrl/⌘+K page palette, glass cards, flame-gradient buttons, themed tables, pills,
dialogs and charts, and a breathing footer. It is visual only: routes, data and permissions are unchanged. The theme is
applied per app (`data-sb-theme` on `<html>`, removed when the app unmounts). The Manager opens **light by default**; a sun/moon button in the topbar (and the Ctrl/⌘+K palette)
switches to the dark Obsidian Ruby theme and the choice is remembered (`sombill.theme`). See `documentation/architecture/frontend-architecture.md` and `documentation/project/MANAGER_DESIGN_REFACTOR_REPORT.md`
(including where the result differs from the design brief, and why). The **Cashier POS** has the same design (light by default, dark switch): terminal topbar and status bar, viewport-fitted New Sale, themed payment buttons; see `documentation/project/CASHIER_DESIGN_REFACTOR_REPORT.md`. The **Waiter floor app** has it too (light by default, dark switch): 56px topbar, floating bottom dock with a centre New Order button on phones and portrait tablets, table cards coloured by status, kitchen board ribbons and an offline banner; see `documentation/project/WAITER_DESIGN_REFACTOR_REPORT.md`.

## Backend microservices (22 Nov 2026)
Phases 1–2 of the backend brief are built in `backend/` (pnpm workspace): API Gateway, Identity & Authentication and
Organization & Branch services on Node.js 22, Express 5, TypeScript, PostgreSQL 16 + Prisma 7, Redis and RabbitMQ,
with Docker, Compose, Nginx and GitHub Actions. 65 tests pass against real PostgreSQL, Redis and RabbitMQ (including
end-to-end tests through the gateway). The Supabase backend above stays live until the services reach parity. Hotel
(phase 6) is on hold pending confirmation. See `documentation/project/BACKEND_PHASE_1_2_REPORT.md` and `documentation/`.

## Known limitations and decisions
- **A Kitchen display is not built yet.** Kitchen-role database rules exist and are tested. Managers can change
  preparation status in the Manager dashboard meanwhile.
- **No card terminal or mobile money provider integration.** Card approval is cashier-confirmed and labelled that way.
  Mobile money stays "awaiting verification" until someone checks the merchant statement.
- **ESC/POS printing is untested on hardware.** Browser printing at 80 mm is the supported path.
- Fine-grained permissions are limited to the toggles enforced in the database. Role-level rules are fixed.
- Supplier payments are tracked as `amount_paid` on each purchase order, with no per-payment ledger.
- Reports compute in the browser from fetched rows, except the SQL `sales_summary`. This suits single-restaurant
  volumes. For very large histories, move heavy reports into SQL functions.
- TypeScript row types are hand-written in `frontend/packages/shared-types/src/types.ts`. Once the project is linked, replace them with
  `supabase gen types typescript`.
- The official logo file was not supplied. Put it at `frontend/apps/dashboards/public/branding/sombill-logo.png`; until then a wordmark is
  shown.

## Suggested next steps
1. Apply all eight migrations to a Supabase staging branch and deploy `manage-staff`.
2. Run a manual smoke test with real accounts (manager, cashier, waiter) and check realtime across two browsers.
   Repeat the Cashier acceptance workflow there and print a receipt on the actual thermal printer.
3. Generate database types and replace `frontend/packages/shared-types/src/types.ts`.
4. Add Playwright end-to-end tests against staging.
