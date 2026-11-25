# CASHIER_TEST_REPORT — SomBill Cashier POS

> **Path note (22 Nov 2026):** this document predates the feature-based layout. Application code now lives in `frontend/dashboards/src/`: `manager/`, `waiter/`, `cashier/` → `src/features/<name>/`; `routing/` → `src/app/`; `shared/auth/` → `src/features/auth/` (+ `src/contexts/AuthContext.tsx`); `shared/pos/`, `shared/components/pos/`, `shared/layouts/PosShell.tsx`, `shared/pages/ProfilePage.tsx` → `src/features/pos/`; every other `shared/x` → `src/x`; full list in `documentation/project/FRONTEND_STACK_REPORT.md`. Database and Edge Function paths are under `backend/supabase/`; `npm run test:db` now runs from `backend/` (or the project root), and `manageStaff.test.ts` is now `backend/supabase/tests/functions/manage-staff.test.ts`. See `documentation/architecture/system-architecture.md`.

_Run on 22 Nov 2026 in the build workspace. Every number below comes from a run of the command shown, not an estimate._

## Results

| Gate | Command | Result |
|---|---|---|
| TypeScript strict | `npx tsc -b --noEmit` | ✅ 0 errors |
| ESLint (zero warnings) | `npx eslint . --max-warnings=0` | ✅ 0 problems |
| Vitest: whole app (Manager, Waiter, Cashier) | `npx vitest run` ×3 (flakiness check) | ✅ 16 files, **198 tests**, passed in all 3 runs |
| · of which Cashier | `cashier/__tests__/*` | 65 tests: 24 logic, 27 UI workflows, 14 routing/guards |
| Database tests on real PostgreSQL 16 | `backend/supabase/tests/run_db_tests.sh` | ✅ **303 assertions** (Manager 114, Waiter 91, **Cashier 98**) |
| Concurrency (parallel sessions) | `backend/supabase/tests/concurrency_payments.sh` | ✅ 9 / 9 checks |
| Real Chrome: layout and touch targets | `npm run test:tablet` | ✅ 57 / 57 page × viewport checks (9 Waiter + 10 Cashier pages × 3 sizes) |
| Real Chrome: 80mm receipt PDF | same run | ✅ receipt **80.09 mm × 176 mm, 1 page**; bill **80.09 mm × 129.1 mm, 1 page** |
| Production build | `npm run build` | ✅ |

**"Real Supabase records"**: the database tests run every migration on a real PostgreSQL 16 server, with a shim that
emulates Supabase's `auth.uid()`, the `anon` / `authenticated` / `service_role` roles and storage. They then act as
real manager, waiter, kitchen and cashier accounts, so RLS, triggers and functions behave as they will on Supabase.
**I had no credentials for your hosted Supabase project, so nothing has been run against it yet** (see "Not
verified" below).

## Final acceptance workflow (real database records, `03_cashier_rules.test.sql` part 1)

Each step is an assertion against the rows actually written. The Waiter POS and kitchen steps use their real
functions under their own accounts.

| # | Step | Evidence |
|---|---|---|
| 1 | Cashier logs in | session resolves to an active **cashier** membership |
| 2 | Sees the manager's menu | 2 available, unarchived products visible |
| 3 | Receives the waiter's order | `submit_waiter_order` (2 × 12 "No onions", 3 × 1.50) → cashier gets a `new_order` notification |
| 4 | Opens the active order | listed as active |
| 5 | Views details | 2 items, notes intact |
| 6 | Opens the bill | 28.50 + VAT 2.40 = **30.90**, nothing paid. Kitchen marks it ready, the waiter serves and requests the bill, and the cashier opens shift (float 100) |
| 7–8 | Chooses methods, enters amounts | split: **cash 20 (received 50)** + **EVC Plus 10.90 ref EVC-55120** |
| 9 | Validates / change | change **30.00** |
| 10 | Records | **two separate payment rows**. EVC Plus is `pending` / verification `pending`, **not counted as paid** |
| 11 | Outstanding balance | **10.90** outstanding, order `partial` |
| 12 | Paid only when fully settled | still `served` until verified. After `verify_payment` (EVC statement seen): **paid, completed, amount_paid 30.90** |
| 13 | Receipt | receipt **#1**. Issuing again returns #1 |
| 14 | Print | print count 1 → 2 (reprint counted) |
| 15 | Transaction history | both rows numbered and stamped with the cashier and shift |
| 16 | Manager sees sales | `sales_summary`: collected **30.90**, outstanding **0** |
| 17 | Waiter sees payment | order `paid`. The waiter was notified *bill acknowledged* and *payment completed* |
| 18 | Table available | Table 04 → `available` |

## Coverage against the required list

| Requirement | Database (real PostgreSQL) | Frontend (Vitest) / browser |
|---|---|---|
| Cashier login / role permissions | acceptance 1; waiter/kitchen/other-restaurant cashier refused for payments, receipts, verification, refund approval | `/` → `/cashier`; manager pages and Waiter POS refused; waiters, kitchen and signed-out users kept out of `/cashier/*` and print routes; managers allowed |
| Product loading / search | acceptance 2 | archived, unavailable and hidden-category items excluded; search |
| New sale | takeaway 12 + 1.20 = 13.20; dine-in needs table; delivery needs customer; takeaway can't occupy a table; `PRICE_CHANGED` | totals; table/customer rules; **Charge creates the order once on double-click**, then opens payment |
| Waiter order reception | acceptance 3–5 | waiter order listed; **realtime event adds a newly submitted order** |
| Bill / tax / discount | 10% discount taxed on the discounted base (10.80 + 1.08 = 11.88); `DISCOUNT_LIMIT`; reason required; direct edits blocked; manager beyond the limit; cannot exceed subtotal | 25.50 / 2.40 / 27.90 → discount 2 → 25.71; limit message at 10% (2.55); bill tabs; balance from payments; `apply_discount` and its error |
| Cash change | acceptance 9; received < amount rejected | change preview 6.90; short cash refused |
| Card | terminal ID required; explicit approval confirmation required | Confirm disabled until ID **and** APPROVED tick; payload `terminal_confirmed: true` |
| EVC Plus / Zaad / Somtel Money | reference required; pending; duplicate reference (case-insensitive) blocked; resubmission allowed after rejection | each method recorded as awaiting verification, never "verified"; duplicate-reference message |
| Verification | waiter can't verify; rejection needs a reason; rejected money doesn't count and the balance reopens; decisions final; manager-only mode; manager verification settles | *Not received* demands a reason; *Verified* confirm; manager-only badge when cashiers may not verify |
| Partial / split | acceptance 7–11; partial recorded once | split cash 10 + card 13.10, remaining 0.00; previous partial honoured |
| Duplicate / concurrent payments | same key → one row; pending reserves balance (`ALREADY_SETTLED`); overpayment rejected; rejected attempts leave no rows | double-click → one RPC call |
| — concurrency (8 parallel sessions) | **1 payment succeeds**, 7 get `ALREADY_SETTLED`; **6 calls with one key → 1 row**; **6 parallel refunds → 1 succeeds**, 5 get `REFUND_EXCEEDS` | — |
| Outstanding balance | acceptance 11–12 | unit tests (pending reserved, refunds net, never negative) |
| Immutable payments | cashier cannot edit or delete; verified payments immutable **even for the service role** | — |
| Refunds | approval workflow; no money before approval; duplicate ignored; eligibility shrinks 20 − 12 − 3 = 5; quantities not refunded twice; non-cash needs a reference; item restock 0.25 kg; net collected recalculated; records immutable; pending/failed not refundable | over-limit becomes an approval request; amount capped to eligible; items-value suggestion; manager approve/reject; cashier sees no approve buttons |
| Receipts | no receipt before a confirmed payment; waiter can't issue; reprints counted | 80mm preview; issue then mark printed; print iframe path; "not tested on a physical printer" notice |
| 80mm layout | — | every text line ≤ 48 columns; voided items omitted; unverified mobile money shown and excluded from "paid"; bill marked NOT A RECEIPT; reprint marker; **Chrome PDF 80.09 mm wide, single page** |
| ESC/POS | — | init / cut bytes; ASCII replacement (bytes only) |
| CSV export | — | header and rows, filtered by status |
| Shift opening / closing / reconciliation | one open shift; pay-out can't exceed drawer; expected = opening + cash sales − cash refunds + pay-ins − pay-outs; difference needs a note (expected 125, counted 120, −5); closed shift immutable (service role too); cash movements immutable; payments need a new shift after closing; manager sees audit | opening float validation; expected 73.10 vs counted 70 → "−$3.10 short"; note demanded; confirm dialog; cash movement needs a reason |
| Realtime updates | tables in the `supabase_realtime` publication | channel events reload Active Orders. The Waiter POS realtime and reconnect tests also cover the shared hook |
| RLS | other restaurant's cashier sees **no** orders, payments, refunds or receipts | — |
| Dashboard | — | collected excludes pending mobile money and unpaid orders |

## Defects found and fixed while building the Cashier POS

1. **Payments could still be inserted directly** by older code paths after the guard was added. All Manager and
   Waiter tests now pay through `record_payments` (with a cashier shift). The old direct insert now fails with
   `permission denied`, which the tests assert.
2. **Setting `cashier_id` on a completed order raised an error** inside the payment function. Fixed: it is only set
   while the order is still open.
3. **The concurrency script aborted early**: an amount was hard-coded as 11 where the test restaurant has no tax
   (10), and a `grep` with no match killed the script under `pipefail`. Both fixed. The script now reports every check.
4. **The expense and refund form schemas rejected the new mobile money methods.** They now share one `PAYMENT_METHODS`
   list.
5. **Real Chrome found two touch targets under the size threshold on the Cashier Dashboard** ("Manage shift" and
   "View all" links). Fixed to 44 px, and the re-run passed.
6. **The manager-guard test expected cashiers to see "Not available for your role".** That was correct before a
   Cashier POS existed. Cashiers are now routed to `/cashier`. The test was updated to that intended behaviour and
   extended (kitchen still refused; waiters kept out of `/cashier`; managers allowed).
7. Test mistakes corrected, with no change to product behaviour: a refund test asked for more than the eligible
   amount (the server rightly refused); a "too short" terminal ID was actually long enough; jsdom's `Blob` lacks
   `.text()` (it now reads via `FileReader`); one test expected a disabled button where the dialog shows a reason
   error instead.

No test was skipped, disabled or weakened to make it pass.

## Not verified, and why

- **Your hosted Supabase project:** no credentials were available here. Apply migrations 000006–000007 to a staging
  branch first, then repeat the acceptance workflow there with real accounts.
- **Card terminals and mobile money providers:** there is no integration. Card approval is cashier-confirmed, and
  mobile money is verified manually. This is intentional and labelled in the UI. Automatic verification would need
  the provider's merchant API, credentials and a server-side webhook.
- **Physical thermal printers:** browser printing produced a correct 80 mm PDF in Chrome, but no physical printer was
  attached. ESC/POS bytes are unit-tested only. Test both on your printer model before relying on them.
- **Live realtime across devices:** the subscriptions are tested with a mocked client and the publication is
  configured. Check with two tablets on staging.
- **Deployment check:** the functions rely on the definer (`postgres`) role bypassing RLS inside SECURITY DEFINER
  code, which is the Supabase default. Confirm it if your project uses a custom owner.
