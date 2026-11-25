# MANAGER_TEST_REPORT — SomBill Manager Dashboard

> **Path note (22 Nov 2026):** this document predates the feature-based layout. Application code now lives in `frontend/dashboards/src/`: `manager/`, `waiter/`, `cashier/` → `src/features/<name>/`; `routing/` → `src/app/`; `shared/auth/` → `src/features/auth/` (+ `src/contexts/AuthContext.tsx`); `shared/pos/`, `shared/components/pos/`, `shared/layouts/PosShell.tsx`, `shared/pages/ProfilePage.tsx` → `src/features/pos/`; every other `shared/x` → `src/x`; full list in `documentation/project/FRONTEND_STACK_REPORT.md`. Database and Edge Function paths are under `backend/supabase/`; `npm run test:db` now runs from `backend/` (or the project root), and `manageStaff.test.ts` is now `backend/supabase/tests/functions/manage-staff.test.ts`. See `documentation/architecture/system-architecture.md`.

_Run date: 21 Nov 2026 · Node 22 · PostgreSQL 16_

## Results
| Suite | Command | Result |
|---|---|---|
| TypeScript strict | `npm run typecheck` | ✅ 0 errors |
| ESLint | `npm run lint` | ✅ 0 errors, 0 warnings |
| Frontend tests | `npm test` | ✅ **84 / 84** across 9 files |
| Database tests | `npm run test:db` | ✅ **112 / 112** assertions, plus a migration idempotency re-run |
| Production build | `npm run build` | ✅ |

No errors were suppressed: no `@ts-ignore`, no `eslint-disable` for real issues (only two documented
`exhaustive-deps` exceptions and one `no-control-regex` for the sanitiser), and no skipped tests.

## Coverage against the acceptance list
| Required test | Where | Notes |
|---|---|---|
| Login | `auth.test.tsx` | validation, success and redirect, wrong-credentials message |
| Logout | `auth.test.tsx` | confirmation dialog, then `signOut` |
| Manager access | `auth.test.tsx`, `authProvider.test.tsx` | signed-out redirect; waiter, cashier and suspended users blocked; no-restaurant goes to setup; real `AuthProvider` role resolution |
| Staff account creation | `manageStaff.test.ts`, `managerWorkflows.test.tsx` | invite flow, no password ever sent, duplicates 409, role/suspend, self-demotion and last-manager guards, redirect allowlist, reset email |
| Product CRUD | `managerWorkflows.test.tsx`, DB tests | create, duplicate SKU, archive (no delete), availability, price snapshot, price-change audit |
| Category CRUD | `managerWorkflows.test.tsx`, DB tests | validation, case-insensitive duplicates, edit, archive |
| Table CRUD | `managerWorkflows.test.tsx`, DB tests | duplicate number, create, derived status transitions |
| Customer CRUD | `managerWorkflows.test.tsx`, DB tests | phone/email validation in UI and DB, create |
| Inventory operations | `managerWorkflows.test.tsx`, DB tests | opening movement, receive with weighted average cost, wastage, signed adjustment, transfer, negative-stock block, direct quantity edits blocked, immutability |
| Supplier operations | `managerWorkflows.test.tsx`, DB tests | create, isolation |
| Purchase order receiving | `managerWorkflows.test.tsx`, DB tests | draft can't be received, lines lock, partial and final receipt, over-receipt blocked, **duplicate key ignored**, same key reused on retry |
| Expense management | `managerWorkflows.test.tsx`, DB tests | future date blocked, separate from payments, approval workflow, direct approval blocked |
| Report calculations | `reports.test.ts`, DB `sales_summary` | sales vs collected vs refunds vs outstanding, time-zone bucketing, weekly/monthly, product/category/staff/table, profit estimate (partial or no cost), valuation |
| CSV exports | `csv.test.ts`, `managerWorkflows.test.tsx` | RFC 4180 escaping, formula-injection guard, download triggered |
| Realtime updates | `managerWorkflows.test.tsx` | per-restaurant filter, debounced refresh, channel removed on unmount |
| RLS isolation | DB tests | other restaurant's rows invisible; cross-tenant insert, update and RPC rejected; cross-tenant foreign-key smuggling blocked; storage folder isolation |
| Invalid input | `schemas.test.ts`, DB CHECKs | every form schema, plus negative price and bad email/phone at the DB level |
| Unauthorized access | DB tests, `manageStaff.test.ts` | waiter/cashier/suspended/anon denied; forged audit logs, direct stock movements and internal RPCs denied; order sequence not writable |
| Every sidebar route works | `managerNavigation.test.tsx` | all 13 modules render their page and query data; logout present; 404 handled |

## Defects found and fixed during testing
1. **Purchase-order receiving failed partway.** A nested trigger reset the internal "trusted operation" flag to off.
   All functions now restore the previous value instead. Caught by the DB tests.
2. **Clients could hit silent no-op deletes.** With no delete policy, a delete affected 0 rows without any error.
   DELETE is now revoked on historical tables, so clients get an explicit permission error.
3. **Supabase query builder returned from an `async` helper** in Orders would have run the query early, because the
   builder is thenable. It is now wrapped so it can't execute until intended.
4. **`ExpenseStatusBadge` crashed** on a row without a status. It now falls back safely.
5. Reference-check triggers ran with caller privileges after helper EXECUTE was revoked. They are now SECURITY
   DEFINER.

## What these tests do not cover
- Running against the hosted Supabase project, the Deno Edge Function runtime, live Realtime fan-out, real Storage,
  and a visual browser check. See PROJECT_STATUS.md for the verification plan.
- The database tests use a local shim for Supabase's `auth` and `storage` schemas. Supabase's own platform
  policies on those schemas aren't included.
