# Phase 0 – Technical audit of SomBill (22 Nov 2026)

Scope: the whole repository as it is on disk after the 22 Nov restructure. Everything below was checked in the code,
migrations or configuration; nothing is assumed from documentation alone. Nothing was changed during the audit.

Companion files:

- [`PHASE_0_IMPLEMENTATION_CHECKLIST.md`](PHASE_0_IMPLEMENTATION_CHECKLIST.md): feature → module checklist (35 backend modules).
- [`PHASE_0_UI_INVENTORY.md`](PHASE_0_UI_INVENTORY.md): every dashboard file with its buttons, forms, modals, tables, charts,
  selects, inputs, and the tables / RPCs it calls.

---

## 1. Executive summary

1. **The four dashboards are real, working software, not mock-ups.** Every page reads and writes a live database. A scan
   of all dashboard code found no mock data, no `TODO`/`FIXME`, no empty click handlers and no "coming soon" buttons.
   Test suites: 299 frontend tests, 357 SQL assertions, 10 Edge Function tests, 65 Node backend tests.
2. **They run on Supabase, not on the Node backend.** The 30 tables/views, 39 RPCs, the `manage-staff` Edge Function and
   3 storage buckets the dashboards use all exist in `database/supabase/migrations` (31 tables + 1 view in total). None of the dashboards call the Node API
   (`backend/`); its HTTP client and Socket.IO client are wired but unused.
3. **There are two parallel backends with two identity models.** That is the main architectural problem.
   - **Supabase** (live): Supabase Auth; roles `manager`, `cashier`, `waiter`, `kitchen`; `organizations` → `restaurants`.
   - **Node** (`backend/`, ~20 endpoints): its own users, JWTs, 8 roles, 38 permissions; `organizations` → `branches`.

   The data is not shared, and an account in one does not exist in the other. **A decision is needed before Phase 1**
   (section 12).
4. **The biggest product gaps:**
   - The **hotel side** (rooms, reservations, housekeeping) does not exist anywhere, although the website sells it.
   - There is **no Kitchen display**: kitchen accounts are turned away at sign-in.
   - There is **no platform-level super admin** (SomBill staff managing all tenants and subscriptions). Today's "Super
     Admin" is a multi-branch *owner*.
   - Accounting, payroll, departments, reservations, invoices, loyalty, menu modifiers, and external notifications (SMS,
     email, WhatsApp) are missing.
   - No payment provider is integrated.
5. **The public website's forms are fake.** Demo request, consultation, contact and newsletter forms show a success toast
   ("Demo & 14-Day Free Trial activated…") and send nothing. There is no link from the website to the dashboard sign-in.

---

## 2. Current architecture

```text
 Website (static Vite app, no backend)          Dashboards SPA (one sign-in, 4 role apps)
                                                    │  supabase-js (anon key + user JWT)
                                                    ▼
                                         ┌──────────────────────────────────────┐
                                         │ Supabase (LIVE)                      │
                                         │ Auth · Postgres 31 tables · RLS on   │
                                         │ all · 107 SQL functions · Realtime · │
                                         │ Storage (3 buckets) · Edge Fn        │
                                         └──────────────────────────────────────┘

 (not connected to any UI)
 Nginx → API Gateway (:4000) → Main API (:4001: auth, users, roles, organizations, branches)
          Redis rate limits       PostgreSQL ×2 (identity, organization) · RabbitMQ events (outbox)
```

- **Dashboards shell** (`frontend/apps/dashboards`): sign-in, password reset by email code, optional Google sign-in
  (hidden unless enabled), role-based landing (`RoleHome`), route guards, and a temporary-session option.
- **Business logic lives in SQL.** Money, stock, orders, refunds, shifts and receipts change only through
  `SECURITY DEFINER` functions with a fixed `search_path`; RLS is forced on every table. This layer is strong and tested.

## 3. Folder structure (verified)

| Path | Content | State |
| --- | --- | --- |
| `frontend/apps/website` | public site, 16 files / 9.3k lines (React 19, Tailwind 4, Vite 8, own lockfile) | static, forms not wired |
| `frontend/apps/dashboards` | shell: entry, router, auth pages, e2e scripts, Vite/Tailwind/test config | working |
| `frontend/apps/manager` | 27 files / 9.1k lines, 13 pages + details | working on Supabase |
| `frontend/apps/cashier` | 28 files / 6.0k lines, 10 pages + print page | working on Supabase |
| `frontend/apps/waiter` | 16 files / 3.6k lines, 9 pages | working on Supabase |
| `frontend/apps/super-admin` | 37 files / 5.5k lines, 13 pages | working on Supabase |
| `frontend/packages/*` | shared-ui (34), shared-utils (15), api-client (10), shared-hooks (9), shared-types (4), shared-config (2) | working |
| `backend/apps/api-gateway` | proxy, CORS, Redis rate limits, JWT pre-check, Swagger | working, unused by UI |
| `backend/apps/main-api` | 35 module folders: 6 with code (auth, users, roles, organizations, branches, audit-logs), 29 skeletons | partial |
| `backend/packages/*` | database, authentication, authorization, validation, logger, cache, messaging, shared-types, shared-utils (real); email, storage (interfaces only) | |
| `database/supabase` | 8 migrations, RLS, Edge Function, SQL tests | live backend |
| `database/prisma` | 2 schemas (identity, organization), migrations, seeds | Node backend only |
| `infrastructure/` | Dockerfiles, Compose (dev/staging/prod), Nginx, Redis, RabbitMQ, Postgres init | untested images |

The folder structure matches the targets set on 22 Nov. **No change is recommended.**

## 4. Technology stack

| Layer | Technology |
| --- | --- |
| Dashboards | React 18.3, TypeScript (strict), Vite 5, Tailwind 3, react-router 6, TanStack Query 5 / Table / Virtual, react-hook-form + zod 3, Radix UI, framer-motion, recharts 3, sonner, zustand, cmdk, dnd-kit, supabase-js 2.119, axios + socket.io-client (installed, unused) |
| Website | React 19, Tailwind 4, Vite 8, TypeScript 7 (separate install) |
| Live backend | Supabase: Postgres 16, RLS, plpgsql RPCs, Realtime, Storage, Edge Function (Deno) |
| Node backend | Node 22, Express 5, TypeScript, Prisma 7 (pg adapter), zod 4, jose (RS256), Argon2id, ioredis, express-rate-limit, amqplib, pino, OpenAPI (zod-to-openapi + Swagger UI), pnpm 10 |
| Tests | Vitest (frontend + backend), Testing Library, Playwright-core (tablet/HQ layout runs), SQL assertion suite on Postgres 16 |
| Ops | Docker (backend/frontend Dockerfiles), Compose, Nginx, GitHub Actions (frontend-ci, backend-ci) |

## 5. Frontend feature inventory (per dashboard)

The element counts per page are in `PHASE_0_UI_INVENTORY.md`. The module specifications are in
`documentation/project/dashboards/*_MODULES.md`; the code matches them.

### Manager (`/dashboard` …, 13 routes)

| Area | What works today |
| --- | --- |
| Dashboard | KPIs, sales trend chart, payment mix, recent orders and transactions, popular items, low stock, activity feed, date presets, realtime refresh |
| Orders | status tabs with counts, search and filters, pagination, CSV; detail page with audit history, cancel (with reason) and refund through RPCs |
| Menu, Categories | create, edit, archive/restore, images, availability toggle, recipe editor with food-cost %, price history |
| Tables | floor grid and list views, derived status (`table_status_v`), cleaning flag |
| Staff | invite, change role, suspend/reactivate, password reset (Edge Function), activity modal |
| Customers, Suppliers | create, edit, archive; profiles with order and purchase history |
| Inventory | receive, wastage, adjust and transfer through RPCs; movement log; low-stock and expiry alerts |
| Purchase orders | draft → ordered → (partially) received through an idempotent RPC; supplier payment field |
| Expenses | create and edit, attachments in a private bucket, approval workflow |
| Reports | 15 reports with CSV and print; profit labelled as an estimate |
| Settings | restaurant profile, currency, time zone, tax, receipt, operations, staff permission toggles |

### Cashier (`/cashier`, 10 routes + print)

Dashboard, New Sale (dine-in, takeaway, delivery), Active Orders, Bills (5 tabs), Payment Processing (split payments in
cash, card or EVC/Zaad/Somtel, with idempotency keys), Transactions, Receipts (80 mm, counted reprints, ESC/POS
encoder), Refunds (with limits and manager approval), Shift Management (open, pay-in/out, close with counted cash),
and Profile.

### Waiter (`/waiter`, 9 routes)

Dashboard with shift, tables floor plan, New Order (one-transaction submit, price re-check, double-tap protection),
My Orders with history, Menu, Kitchen Status (read-only plus "Mark served"), Bills (request and cancel), Notifications
(generated by database triggers), Profile.

### Super Admin / Group HQ (`/dashboard/super-admin`, 13 routes)

Overview, Multi-Branch Fleet, Active POS Fleet, Global Revenues, Tax Filings, Mobile Money Portals, SaaS Subscription
(read-only), Central Menu Push, Global Staff & RBAC, Master Supply Chain, Audit & Anti-Fraud (rule-based), Cloud
Telemetry (database round-trip and browser status only), Platform Controls. All of them use `org_*` RPCs and the
`manage-staff` Edge Function.

### Website

Marketing pages: Home, Products, Solutions, Pricing, Company, Resources. It has a rule-based chatbot (`chatData.js`, no AI
service behind it) and interactive simulators. **The demo, consultation, contact and newsletter forms are fake: they only
call `setSubmitted(true)` and show a toast.**

## 6. Backend feature inventory

| Capability | Supabase (live) | Node `main-api` |
| --- | --- | --- |
| Sign-in, sessions, password reset | Supabase Auth (email/password, email OTP recovery, optional Google) | register, login, refresh rotation, logout, logout-all, me; Argon2id; lockout |
| Roles, permissions | fixed `app_role` enum + database-enforced setting toggles | 8 system roles, 38 permissions, memberships per organization/branch |
| Organizations, branches | `organizations`, `organization_members`, `restaurants` (branch) + `org_*` RPCs | organizations, branches, branch settings, trial subscription |
| Restaurant operations (orders, POS, payments, stock, purchasing, expenses, shifts, receipts, refunds, notifications, reports) | **complete** (tables, triggers, RPCs, RLS, tests) | **none** |
| Events | Realtime (Postgres changes) | RabbitMQ + transactional outbox (only `organization.created`, `branch.created`) |
| Audit | `audit_logs`, `audit_reviews` | `audit_logs` per database |
| Files | Storage: menu-images, branding, expense-attachments | `storage` interface only |
| Email | Supabase Auth emails only | `email` interface only |

## 7. Database

- **Supabase:** 31 tables plus the `table_status_v` view, 107 functions, and RLS enabled and forced on every table.
  Every `SECURITY DEFINER` function has a fixed `search_path`.
  - Money, stock, shifts and receipts are append-only or guarded by triggers.
  - Idempotency keys protect payments, refunds, orders and purchase-order receipts.
  - The order status trigger enforces valid transitions per role.
- **Prisma (Node):** `sombill_identity` (users, roles, permissions, memberships, sessions, refresh tokens, audit, outbox)
  and `sombill_organization` (organizations, branches, settings, subscriptions, audit, outbox).
- **Not modelled anywhere:** hotels, rooms, room types and rates, reservations (rooms or tables), guests and stays,
  housekeeping, departments, employee HR records, payroll, chart of accounts / journal, invoices and credit notes,
  loyalty, menu modifiers / variants / combos, delivery dispatch, and platform-level tenants / billing.

## 8. API requirements

The dashboards need **no new API to keep working**: they are complete against Supabase. New API work is needed for:

1. **Missing modules:** kitchen display actions, rooms, reservations, departments, employees/HR, payroll, accounting,
   invoices, notifications delivery, subscriptions/billing, platform admin. The endpoints are listed per module in
   the checklist.
2. **External integrations:** a mobile-money provider (EVC Plus / Zaad / e-Dahab) for automatic verification, card
   terminals, SMS/WhatsApp/email delivery, and website lead capture.
3. **Whichever backend strategy is chosen in section 12.** For the Node path that means porting each Supabase RPC
   (39 used by the UI) to a REST endpoint with the same rules.

## 9. Authentication and authorization requirements

- **Live today (Supabase):**
  - Email/password sign-in; recovery with an emailed one-time code.
  - Temporary (non-remembered) sessions; suspended accounts blocked.
  - Role landing for manager, cashier and waiter. Kitchen is defined but has no app.
  - Group owner → HQ.
  - Permissions are enforced in RLS and RPCs, not only in the UI.
- **Required:**
  1. **One identity system** for website sign-up, dashboards and any future mobile app (decision in section 12).
  2. **A platform admin role** (SomBill staff) above tenants.
  3. **A kitchen role app.**
  4. **Finer, configurable permissions** (the Node permission catalogue already models 38 permissions).
  5. **Hosted security settings:** MFA for owners and managers, and session/device management (Node has logout-all;
     Supabase sessions are not listed in the UI).
  6. **Verification of the hosted Supabase Auth settings:** password policy, rate limits, and the reset-password
     template containing `{{ .Token }}`.

## 10. Missing functionality

| Priority | Missing | Where it shows |
| --- | --- | --- |
| P0 | Decision and plan: one backend, one identity | everything below depends on it |
| P0 | Migration `20261122000008_super_admin.sql` applied to the hosted Supabase, `manage-staff` redeployed, reset email template | Group HQ and password reset don't work on the hosted project until done (from PROJECT_STATUS) |
| P0 | Website forms send nothing but claim success | demo, consultation, contact, newsletter |
| P1 | Kitchen display (accept → preparing → ready) | kitchen accounts see "use your own app"; today only managers can move statuses |
| P1 | Platform admin console (tenants, plans, billing, suspension) | "Super Admin" is a branch owner today |
| P1 | Hotel module: rooms, room types/rates, reservations, check-in/out, folios, housekeeping | advertised on the website, absent in the code |
| P1 | Table reservations | absent |
| P2 | Mobile-money and card provider integration | payments are manually verified or cashier-confirmed |
| P2 | Invoices (tax invoice, B2B, credit note) | only POS receipts exist |
| P2 | Notifications beyond in-app (SMS, WhatsApp, email, push) | only database notifications |
| P2 | Supplier payment ledger | `purchase_orders.amount_paid` is edited directly from the browser |
| P2 | Employees/HR, departments, payroll (`staff_shifts` already records hours) | absent |
| P2 | Accounting (chart of accounts, journal, P&L, balance sheet) | only the profit *estimate* report |
| P3 | Menu modifiers / variants / combos, loyalty, delivery dispatch, offline POS | absent |
| P3 | Monitoring: metrics, alerting, error tracking | health endpoints and logs only |

## 11. Bugs, risks and technical debt

| # | Severity | Finding | Evidence |
| --- | --- | --- | --- |
| 1 | High (architecture) | Two backends, two user stores, two role models (Supabase: 4 roles; Node: 8 roles); the Node API has no UI consumer | sections 2, 6 |
| 2 | High (trust) | Website forms report success while sending nothing ("Demo & 14-Day Free Trial activated") | `layouts/SomBillWebsite.tsx:133`, `pages/Home/HomePage.tsx:185`, `pages/Company/CompanyDetailPage.tsx:37`, `components/footer/Footer.jsx:110` |
| 3 | Medium | Supplier payments: the browser computes and writes `amount_paid` (lost update with two managers, no per-payment history) | `manager/.../PurchaseOrderDetailPage.tsx:482` |
| 4 | Medium | Hosted Supabase not verified with migration 000008 (per PROJECT_STATUS); HQ depends on it | `documentation/project/PROJECT_STATUS.md` |
| 5 | Medium | Hand-written database row types can drift from the schema | `frontend/packages/shared-types/src/types.ts` |
| 6 | Medium | Reports compute in the browser from all rows (paged with `fetchAll`); fine for one restaurant, slow for large histories or HQ | `packages/api-client/src/queries.ts` |
| 7 | Low | axios HTTP client, session store and Socket.IO client are bundled but unused (dead code until the Node API is used) | `packages/api-client/src/httpClient.ts`, `socket.ts` |
| 8 | Low | Docker images, Prisma drift check and production TLS were never run in this environment | `infrastructure/`, `backend-ci.yml` |
| 9 | Low | Frontend nginx config sets no Content-Security-Policy | `infrastructure/docker/nginx/spa.conf` |
| 10 | Low | ESC/POS printing untested on hardware; the official logo file is missing (wordmark fallback) | PROJECT_STATUS |
| 11 | Low | Website has no link to the dashboard sign-in, and its chatbot is a scripted FAQ | `website/src/services/chatData.js` |
| 12 | Low | `backend-architecture.md` still describes "identity-service / organization-service" in places (banner explains) | documentation |
| 13 | Info | Two zod majors (frontend 3, backend 4) and two React majors (website 19, dashboards 18): intentional, but shared code cannot cross them | package.json files |

No security vulnerability was found in the live data layer:

- RLS is forced on all 31 tables.
- No `SECURITY DEFINER` function lacks `search_path`.
- Payments can't be edited, even by the service role.
- The Edge Function checks the origin against an allow-list, and the service-role key stays server-side.

## 12. Decision required before Phase 1

| Option | What it means | Effort | Risk |
| --- | --- | --- | --- |
| **A. Supabase as the system of record** (recommended for speed) | Build missing modules as SQL tables + RPCs + RLS like the existing ones; use Edge Functions / the Node backend only for integrations (payments, SMS, email, website leads, billing webhooks). Retire or narrow the Node identity/organization modules. | lowest; reuses 357 tested SQL rules | vendor dependency on Supabase |
| **B. Node backend as the system of record** | Port all 39 RPCs, triggers and RLS rules to `main-api` modules, migrate users from Supabase Auth, switch every dashboard page from `supabase-js` to the REST client. | highest (rewrite of the working data layer) | regression risk in money/stock rules |
| **C. Hybrid with a clear boundary** | Supabase keeps restaurant operations; Node owns platform concerns (tenants, billing, integrations, notifications, hotel module) and trusts Supabase JWTs. | medium | two databases to keep consistent |

## 13. Recommended implementation sequence

1. **Decide A, B or C** (section 12) and the identity model. Record it in `documentation/architecture/system-architecture.md`.
2. **Stabilise what exists:**
   - Apply migration 000008 and the Edge Function to hosted Supabase staging, then run the smoke test from PROJECT_STATUS.
   - Generate database types.
   - Replace the supplier `amount_paid` edit with a payment ledger and an RPC.
3. **Make the website honest:**
   - Wire the demo, consultation, contact and newsletter forms to a real endpoint (a `leads` table + notification), or
     change the success text.
   - Add the dashboard sign-in link.
4. **Kitchen display:** a new role app `frontend/apps/kitchen` reusing the existing kitchen rules (accept / preparing /
   ready), with realtime.
5. **Platform admin:** tenants, plans, subscription limits and suspension; this is the "super admin" the business needs
   above the branch owner.
6. **Hotel core:** room types, rooms, rates, reservations, check-in/out, folio charges to the existing payments, and
   housekeeping status. Then table reservations.
7. **Money integrations:** mobile-money provider verification, invoices, supplier payments, accounting journal.
8. **People:** departments, employees, attendance (from `staff_shifts`), payroll.
9. **Notifications delivery:** email, SMS and WhatsApp through the `notifications` module and the `email` port.
10. **Quality and operations:**
    - Playwright end-to-end tests against staging.
    - CSP, monitoring and alerting.
    - Docker image builds in CI, and a production TLS rehearsal.

Each step keeps the existing UI, design system and folder structure. New screens reuse `@sombill/shared-ui` and the
current layouts.
