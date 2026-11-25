# Phase 0 – Feature → module implementation checklist (22 Nov 2026)

How to read this:

- **One row per backend module** (`backend/apps/main-api/src/modules/`, 35 modules).
- **Supabase today** is the live implementation the dashboards use. **Node today** is `main-api`.
- **UI** lists the dashboard pages that already need the module.
- **Status:**
  - ✅ complete
  - 🟡 partial
  - ❌ missing
  - 🔒 needs the backend decision first (audit report §12)
- **To do** is the work in the recommended sequence (audit report §13). Under option A ("Supabase is the system of
  record"), "Supabase today ✅" means **no Node work is needed** beyond integrations.

| # | Module | UI that uses it | Supabase today | Node today | Status | To do |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | auth | dashboards shell: login, reset password, Google (optional), temporary session | Supabase Auth, email-OTP recovery, `touch_last_login` | register, login, refresh rotation, logout(-all), me | ✅ / 🔒 | pick one identity; MFA for owner/manager; session list |
| 2 | users | Manager › Staff, HQ › Global Staff, Profile pages | `profiles`, `restaurant_members`, `manage-staff` Edge Fn | `/users`, memberships | ✅ / 🔒 | none for the dashboards; platform-admin user list (step 5) |
| 3 | roles | role landing, Staff role picker | `app_role` enum: manager, cashier, waiter, kitchen + group owner | 8 system roles | 🟡 🔒 | align role sets; add platform admin; kitchen app (step 4) |
| 4 | permissions | Settings › Staff permissions toggles | toggles in `restaurants.settings`, enforced in RLS/RPCs | catalogue of 38 permissions | 🟡 | decide whether toggles stay or custom roles are needed |
| 5 | organizations | Group HQ (all pages), Settings › Group HQ | `organizations`, `organization_members`, `org_*` RPCs | organizations + trial subscription | ✅ / 🔒 | apply migration 000008 to hosted Supabase |
| 6 | restaurants | every dashboard (a restaurant = branch) | `restaurants`, `create_restaurant` | — | ✅ | none |
| 7 | hotels | website only | ❌ | ❌ | ❌ | property profile, hotel type flag on `restaurants`/branch (step 6) |
| 8 | branches | HQ › Multi-Branch Fleet, branch switcher | `org_create_branch`, `org_branch_summary` | branches + settings | ✅ / 🔒 | none for the dashboards |
| 9 | employees | Manager › Staff (accounts only) | members + profiles; `staff_shifts` (hours) | — | 🟡 | HR record (contract, salary, documents), attendance view (step 8) |
| 10 | departments | — | ❌ | ❌ | ❌ | departments + assignment of employees (step 8) |
| 11 | tables | Manager › Tables, Waiter › Tables, Cashier › New Sale | `restaurant_tables`, `table_status_v` | — | ✅ | none |
| 12 | rooms | — | ❌ | ❌ | ❌ | room types, rooms, rates, status, housekeeping (step 6) |
| 13 | reservations | — | ❌ | ❌ | ❌ | room reservations (availability, deposit, check-in/out) and table reservations (step 6) |
| 14 | customers | Manager › Customers, POS customer picker | `customers` | — | ✅ | guest profile fields for hotels (step 6); loyalty later |
| 15 | suppliers | Manager › Suppliers | `suppliers` | — | ✅ | none |
| 16 | categories | Manager › Categories, POS chips | `categories` | — | ✅ | none |
| 17 | products | Manager › Menu, POS grids, recipes | `products`, `product_recipe_items` | — | ✅ | modifiers / variants / combos (P3) |
| 18 | menu | Waiter › Menu, HQ › Central Menu Push | products + categories; `org_menu_matrix`, `org_push_menu_item` | — | 🟡 | time-based menus, modifiers (P3) |
| 19 | inventory | Manager › Inventory, HQ › Supply Chain | `inventory_items`, `stock_movements`, `adjust_stock`, `transfer_stock` | — | ✅ | none |
| 20 | purchasing | Manager › Purchase orders | `purchase_orders(_items/_receipts)`, `receive_purchase_order` | — | 🟡 | **supplier payment ledger + RPC** replacing the browser-side `amount_paid` edit (step 2) |
| 21 | orders | Manager › Orders, Waiter, Cashier | `orders`, `order_items`, `submit_waiter_order`, `add_order_items`, `cancel_order`, `close_paid_order` | — | ✅ | none |
| 22 | kitchen | Waiter › Kitchen Status (read-only) | kitchen-role rules and status guard exist and are tested | — | 🟡 | **Kitchen display app** (`frontend/apps/kitchen`): queue, accept, preparing, ready, per station, realtime (step 4) |
| 23 | pos | Waiter › New Order, Cashier › New Sale | `submit_pos_order`, `apply_discount`, idempotency keys | — | ✅ | offline mode (P3) |
| 24 | payments | Cashier › Payments, Transactions; HQ › Mobile Money | `payments`, `record_payments`, `verify_payment`, `payment_requests` | — | 🟡 | **provider integration** (EVC Plus / Zaad / e-Dahab callbacks, card terminal) (step 7) |
| 25 | invoices | Cashier › Receipts | `receipts`, `issue_receipt`, `mark_receipt_printed` | — | 🟡 | tax invoices, B2B invoices, credit notes, hotel folio invoices (step 7) |
| 26 | expenses | Manager › Expenses | `expenses`, `review_expense`, private bucket | — | ✅ | none |
| 27 | cash-management | Cashier › Shift | `cashier_shifts`, `cash_movements`, open/close/summary RPCs | — | ✅ | none |
| 28 | accounting | Reports › profit estimate | ❌ (estimate only) | — | ❌ | chart of accounts, journal from sales/expenses/purchases, P&L, balance sheet (step 7) |
| 29 | payroll | — | ❌ (`staff_shifts` gives hours) | — | ❌ | pay rates, periods, payslips, payroll expense posting (step 8) |
| 30 | notifications | Waiter › Notifications, badges, toasts | `notifications` + triggers, Realtime | — | 🟡 | delivery channels: email, SMS, WhatsApp, push; website lead alerts (steps 3, 9) |
| 31 | reports | Manager › Reports (15), Cashier dashboard, HQ revenue/tax | `sales_summary`, `org_revenue_series`, `org_tax_due`, browser aggregation | — | ✅ | move heavy reports into SQL when volumes grow (P3) |
| 32 | analytics | Manager dashboard, HQ overview charts | same sources as reports | — | 🟡 | period comparison, forecasting (P3) |
| 33 | subscriptions | HQ › SaaS Subscription (read-only) | plan fields on organizations | trial subscription table | 🟡 🔒 | **platform admin**: plans, limits, billing, suspension (step 5) |
| 34 | audit-logs | Order history, HQ › Audit & Anti-Fraud | `audit_logs`, `audit_reviews` | `audit_logs` (identity, organization) | ✅ | none |
| 35 | settings | Manager › Settings, HQ › Platform Controls | `restaurants.settings`, `org_update_settings`, `org_apply_branch_defaults` | branch settings | ✅ | none |

## Cross-cutting items (not tied to one module)

| Item | Status | To do |
| --- | --- | --- |
| Website demo / consultation / contact / newsletter forms | ❌ fake success | `leads` storage + notification, honest messages (step 3) |
| Website → dashboard sign-in link | ❌ | add link to the configured dashboards URL (step 3) |
| Hosted Supabase: migration 000008, `manage-staff` deploy, reset-email `{{ .Token }}` | ❌ not done | step 2 |
| Generated database types instead of hand-written `types.ts` | ❌ | step 2 |
| Content-Security-Policy for the dashboards | ❌ | step 10 |
| Monitoring (metrics, alerts, error tracking) | 🟡 health + logs only | step 10 |
| Playwright end-to-end tests against staging | ❌ | step 10 |
| Docker images built in CI, production TLS rehearsal | 🟡 configured, not run | step 10 |
| Official logo file | ❌ wordmark fallback | supply `frontend/apps/dashboards/public/branding/sombill-logo.png` |

## Definition of done per module

Each module is complete when it has:

1. Tables or a schema with constraints.
2. Server-side rules: RLS + RPCs, or REST + an authorization check.
3. Audit entries.
4. Realtime where screens show live data.
5. UI using `@sombill/shared-ui`.
6. Unit tests and database/API tests.
7. Documentation updated in `documentation/`.
