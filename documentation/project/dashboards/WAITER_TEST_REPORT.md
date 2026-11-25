# WAITER_TEST_REPORT — SomBill Waiter POS

> **Path note (22 Nov 2026):** this document predates the feature-based layout. Application code now lives in `frontend/dashboards/src/`: `manager/`, `waiter/`, `cashier/` → `src/features/<name>/`; `routing/` → `src/app/`; `shared/auth/` → `src/features/auth/` (+ `src/contexts/AuthContext.tsx`); `shared/pos/`, `shared/components/pos/`, `shared/layouts/PosShell.tsx`, `shared/pages/ProfilePage.tsx` → `src/features/pos/`; every other `shared/x` → `src/x`; full list in `documentation/project/FRONTEND_STACK_REPORT.md`. Database and Edge Function paths are under `backend/supabase/`; `npm run test:db` now runs from `backend/` (or the project root), and `manageStaff.test.ts` is now `backend/supabase/tests/functions/manage-staff.test.ts`. See `documentation/architecture/system-architecture.md`.

_Run date: 21 Nov 2026 · Node 22 · PostgreSQL 16 · Chrome for Testing 153_

## Results
| Suite | Command | Result |
|---|---|---|
| TypeScript strict | `npm run typecheck` | ✅ 0 errors |
| ESLint (zero warnings) | `npm run lint` | ✅ |
| Frontend tests, whole app | `npm test` | ✅ **132 / 132**: 48 Waiter tests in 4 files, 84 Manager tests; 10 consecutive full runs all green after a timing race was fixed |
| Database tests | `npm run test:db` | ✅ **203 / 203**: 90 Waiter assertions, 113 Manager assertions; migrations also re-applied for idempotency |
| Real-browser tablet check | `npm run test:tablet` | ✅ 9 pages × 3 viewports (768×1024, 1024×768, 1440×900) |
| Production build | `npm run build` | ✅ |

No tests were skipped or weakened to pass. Two Manager database assertions were **updated to the new, stricter
rules**: waiters can no longer set bill flags or complete orders directly. The updated tests now assert that
those attempts are refused.

## Final acceptance workflow, run on real database records
`backend/supabase/tests/02_waiter_rules.test.sql`, Part 1. Five real role accounts (manager, two waiters, cashier,
kitchen) plus a second restaurant, run through RLS as `authenticated` users:

| Step | Evidence (assertion) | Result |
|---|---|---|
| 1 Waiter logs in | session resolves to an active waiter membership | ✅ |
| 2 Sees available tables | 3 available tables in `table_status_v` | ✅ |
| 3 Selects Table 04 | Table 04 available | ✅ |
| 4 Views categories | the manager's 2 active categories load | ✅ |
| 5–8 Two products, quantities, instructions, submit | `submit_waiter_order` with 2× Bariis (“No onions”) and 3× Shaah (“Extra sugar”), order note, 4 guests | ✅ |
| 9 Stored in Supabase | order row has restaurant, table, waiter and notes; both items stored with quantities and notes; subtotal 28.50, VAT 2.40, total 30.90 calculated on the server | ✅ |
| 10 Table occupied | Table 04 Occupied, with order, waiter and balance 30.90 | ✅ |
| 11 Cashier receives order | cashier can read it and got a `new_order` notification | ✅ |
| 12 Kitchen updates status | kitchen account moves Accepted → Preparing → Ready | ✅ |
| 13 Waiter sees Ready | status Ready; waiter notified accepted → preparing → ready | ✅ |
| 14 Waiter serves | waiter marks Served | ✅ |
| 15 Waiter requests bill | `request_bill`; table shows Bill Requested | ✅ |
| 16 Cashier processes payment | cashier notified; acknowledges; records 30.90 mobile-money payment; completes order | ✅ |
| 17 Waiter sees payment completion | order paid and completed; waiter notified of bill acknowledged, payment completed and table available; Table 04 available again | ✅ |

The same flow is exercised through the UI in `waiterWorkflows.test.tsx`: the POS builds exactly that order and
shows **$28.50 / $2.40 / $30.90**, which is the same calculation as the database.

## Coverage against the required list
| Required test | Where | Notes |
|---|---|---|
| Waiter login | `auth.test.tsx`, `waiterNavigation.test.tsx` | validation, success, wrong credentials; waiter lands in the Waiter POS (never `/dashboard` or `/reports`) |
| Logout | `waiterNavigation.test.tsx` | confirmation, sign-out, unsent draft cleared |
| Protected routes | `waiterNavigation.test.tsx` | signed-out users go to login; kitchen and cashier refused; managers allowed; all 9 pages open and query data |
| Table selection | `waiterWorkflows` Tables | start order on available table (preselected in POS); own table → add items; colleague's table view-only |
| Table availability | DB + UI | archived and other-restaurant tables refused; failed submits leave the table free |
| Duplicate order prevention | DB + UI | same-key resubmit returns the existing order; second order on occupied table refused (RPC and direct insert); double tap sends one request; multiple orders only when enabled |
| Product loading / categories / availability | `waiterWorkflows` POS + Menu | real categories; inactive categories and archived products hidden; unavailable disabled; DB refuses unavailable or archived |
| Product search | `waiterWorkflows` POS | search and category filter |
| Quantity calculations | `pos.test.ts`, `cart.test.tsx`, UI | +/−, clamped 1–999, whole numbers; DB rejects 0, 1.5 and 1000 |
| Order creation / item persistence | DB acceptance 5–9, UI payload test | |
| Existing order updates | DB + UI | add to own unpaid order; same key ignored; colleague blocked unless permitted; blocked after bill request or payment; submitted items can't be edited or voided by waiters |
| Tax calculations | `pos.test.ts`, DB | exclusive, inclusive, exempt, discount; preview matches the SQL |
| Kitchen status updates | DB + UI | waiters can't accept, prepare, ready or complete; serve only Ready; kitchen limited to status; no backwards moves |
| Bill requests | DB + UI | request, duplicate refused, cancel before processing, cancel refused once processing, colleague blocked |
| Payment status sync | DB + UI | waiter can't insert, edit or delete payments; partial payment shows Payment Pending; Paid shown live after a realtime event |
| Restaurant isolation | DB | other restaurant's waiter sees nothing and can't submit, request bills or use foreign products or tables |
| RLS permissions | DB | prices, products, settings, staff, financial tables, notifications (own only, read-state only, no forging), shifts, profile columns |
| Tablet responsiveness | `e2e/tablet.mjs` in real Chrome | 0px horizontal overflow on every page and viewport; on touch viewports no control under 32px; POS Send ≥ 48px, product cards ≥ 160px wide and 96px tall, quantity buttons 44px, food images ≤ 56px |
| Realtime | `waiterWorkflows` Realtime | per-restaurant and per-user filters; resubscribe after errors with resync; online-event resync; cleanup on unmount |

## Defects found and fixed during testing
1. **Infinite recursion in realtime reconnection.** Found only in the real-browser run, which logged "Maximum call
   stack size exceeded". `removeChannel()` emits `CLOSED` synchronously, which re-entered the error handler. A
   network drop in the restaurant would have triggered it. It's fixed, and a regression test fails without the fix
   and passes with it.
2. **POS unusable on 1024px landscape tablets.** Product cards were squeezed to about 100px and their names were
   truncated. The sidebar now auto-compacts on the POS below 1280px, and cards have a readable minimum width. The
   tablet check now enforces card width ≥ 160px.
3. **Portrait tablets hid the order panel** below the entire menu. A sticky "Review & send" bar with the live total
   was added.
4. **Orange action buttons rendered red** because of a CSS utility conflict. A proper `orange` button variant was
   added.
5. **Undersized touch targets:** pagination arrows, card header links and kitchen order links were below 32px.
   They've been enlarged, and the tablet check now fails on any undersized control.
6. **Duplicate label** "Ready to serve" (stat card and section title) made the dashboard ambiguous. Renamed.
7. **Cart price refresh** read changed products inside a lazy React state updater, so the list could come back
   empty. Now computed synchronously.
8. **Role checks with NULL roles** (`v_role not in (...)`) evaluated to NULL rather than true, so the checks
   wouldn't fire. Made explicit; service-role (no user) calls are treated as trusted.
9. **Flaky navigation test (pre-existing, Manager suite).** About 1 in 10 runs failed because a test checked for a database call
   before React had run the effect that starts it. The test now waits for the query; 10/10 consecutive runs pass.

## What these tests do not cover
- **No hosted Supabase project was available.** The database tests run on PostgreSQL 16 with a shim for Supabase's
  `auth.uid()`, roles and storage. The live Realtime fan-out between devices, Supabase Auth emails and the hosted
  Edge Function runtime still need a staging check.
- **The Cashier POS and a Kitchen display app are not built yet.** Their steps in the acceptance workflow (receive
  order, acknowledge bill, record payment, change preparation status) were verified at the database level with real
  cashier and kitchen accounts. Managers can already change preparation status from the Manager dashboard.
- The tablet check uses a real browser but stubbed API responses, so it verifies layout and rendering, not network
  behaviour.
