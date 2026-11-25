# MANAGER_MODULES — SomBill Manager Dashboard

> **Path note (22 Nov 2026):** this document predates the feature-based layout. Application code now lives in `frontend/dashboards/src/`: `manager/`, `waiter/`, `cashier/` → `src/features/<name>/`; `routing/` → `src/app/`; `shared/auth/` → `src/features/auth/` (+ `src/contexts/AuthContext.tsx`); `shared/pos/`, `shared/components/pos/`, `shared/layouts/PosShell.tsx`, `shared/pages/ProfilePage.tsx` → `src/features/pos/`; every other `shared/x` → `src/x`; full list in `documentation/project/FRONTEND_STACK_REPORT.md`. Database and Edge Function paths are under `backend/supabase/`; `npm run test:db` now runs from `backend/` (or the project root), and `manageStaff.test.ts` is now `backend/supabase/tests/functions/manage-staff.test.ts`. See `documentation/architecture/system-architecture.md`.

Legend: ✅ implemented and covered by automated tests · 🟡 implemented, needs live Supabase verification (see PROJECT_STATUS.md)

| # | Module | Route | Status |
|---|---|---|---|
| 1 | Dashboard | `/dashboard` | ✅ |
| 2 | Orders (+ details) | `/orders`, `/orders/:id` | ✅ |
| 3 | Menu Management | `/menu` | ✅ |
| 4 | Categories | `/categories` | ✅ |
| 5 | Tables & Floor Plans | `/tables` | ✅ |
| 6 | Staff Management | `/staff` | ✅ UI and authorization logic · 🟡 Edge Function on Supabase |
| 7 | Customers (+ profile) | `/customers`, `/customers/:id` | ✅ |
| 8 | Inventory | `/inventory` | ✅ |
| 9 | Suppliers (+ detail) | `/suppliers`, `/suppliers/:id` | ✅ |
| 10 | Purchase Orders (+ detail) | `/purchase-orders`, `/purchase-orders/:id` | ✅ |
| 11 | Expenses | `/expenses` | ✅ |
| 12 | Reports | `/reports` | ✅ |
| 13 | Settings | `/settings` | ✅ |
| 14 | Logout | sidebar button | ✅ |

Every route renders a working, data-backed page. This is asserted for all 13 routes in `managerNavigation.test.tsx`.

---

## 1. Dashboard
- Cards: gross sales, payments collected (with net of refunds), outstanding balances, refunds, total, completed,
  pending and cancelled orders, average order value, and tables in use vs. available.
- Sales trend chart (daily, weekly or monthly), sales by payment method, recent orders, recent transactions,
  popular products, low-stock alerts and business activity (audit feed).
- Date filter with presets in the restaurant's time zone. Money totals come from the SQL `sales_summary` RPC.
- Realtime: refreshes on changes to orders, payments, order items, tables and inventory.

## 2. Orders
- Status tabs with live counts: All, New, Pending, Preparing, Ready, Served, Completed, Cancelled.
- Search by order number or customer name/phone. Filters: date range, table, waiter, payment status. Sortable,
  server-side pagination (25 per page) and CSV export.
- Details page: items (voided lines struck through, with reason), totals with tax, payments and refunds, table,
  waiter, cashier, customer, stock-deduction timestamps, **modification history** from the audit log, and
  print/receipt layout.
- Actions: advance status; **cancel with a mandatory reason** (`cancel_order` RPC, blocked while money is
  collected); **refund** up to the collected amount, with optional ingredient restock (`refund_order` RPC).
- Orders and payments can never be deleted.

## 3. Menu Management
- Create and edit: name, description, SKU, barcode, category, image (Storage), selling price, cost price, tax
  category, availability, stock tracking, preparation station, and an optional direct stock link.
- Recipe editor: ingredients and quantities per unit sold, with live food-cost %.
- Search, category filter, Available/Unavailable/Archived views, sorting, pagination, preview modal, one-click
  availability toggle.
- Archive and restore (no physical delete). Duplicate SKU and barcode are checked in the UI and enforced by unique
  indexes. **Price-change history** comes from the audit log.
- Active, available products sync to POS through the shared table and Realtime.

## 4. Categories
- Create, edit, archive and restore; image, description, display order and active toggle; search; product counts
  (available/total).
- Case- and space-insensitive duplicate names are blocked by a unique index and in the UI.

## 5. Tables & Floor Plans
- Visual 12-column floor grid per floor, with square, round and long shapes, plus a list view. Create, edit,
  archive and restore: number, name, seats, section, floor and grid position.
- **Status is derived** in the `table_status_v` view from active orders and payments: Available, Occupied, Bill
  requested, Payment pending, and Cleaning (when enabled).
- Each table shows its active order, balance due, assigned waiter and how long it has been occupied (updated
  every minute and on realtime changes).
- Duplicate active table numbers are blocked. A table with an open order can't be archived.

## 6. Staff Management
- Invite staff (name, email, phone, role) through the `manage-staff` Edge Function. Employees receive an email and
  set their own password.
- Change role, suspend or reactivate (suspension needs a reason), send a password-reset email.
- Last-login display, an activity modal (audit actions, orders as waiter, payments handled), and a summary of role
  permissions.
- Safeguards: a manager can't demote or suspend themselves, the last active manager can't be removed, and redirect
  URLs are checked against an allowlist.

## 7. Customers
- Create, edit, archive and restore. Name, phone and email are validated (in the UI and by database CHECK
  constraints). Address and notes.
- List columns: order count, total purchases (payments net of refunds), outstanding balance, last order. Search,
  filters (active / with balance / archived), sorting, pagination, CSV.
- Profile page: contact details, stats and full order history.

## 8. Inventory
- Items: name, SKU, category, unit, quantity, weighted average cost, minimum stock, supplier, expiry date and
  location.
- Stock operations through RPCs only: **receive** (updates the weighted average cost), **wastage**, **signed
  adjustment** and **transfer** (same unit). Each requires a reason.
- Every change, including opening stock, sales and reversals, creates an immutable `stock_movements` row.
- Negative stock is blocked unless allowed in Settings. Low-stock and out-of-stock alerts, valuation, expiry
  badges.
- Movement history tab with date, item and type filters, plus CSV export.
- Sales deduct recipe stock when an order completes; authorised refunds can reverse it.

## 9. Suppliers
- Create, edit, archive and restore: contact person, phone, email, address, notes, active flag.
- Detail page: purchase history, received value, amount paid, outstanding balance.

## 10. Purchase Orders
- Create with supplier, expected date, notes and lines (item, quantity, unit cost); subtotal and total are computed
  in the database. Save as draft or place the order. Lines lock once ordered.
- **Receive stock**, full or partial, through `receive_purchase_order`, which is capped at the outstanding quantity.
  An idempotency key blocks duplicate receipts, even on network retries.
- Inventory changes **only** on receipt. Receiving history, supplier payments, cancellation, print.

## 11. Expenses
- Create and edit: category (with suggestions), description, amount, payment method, date (not in the future),
  reference, supplier, attachment (private bucket).
- Optional approval workflow: when enabled, new expenses start as pending and are approved or rejected with a
  reason through `review_expense`. Archive (soft delete).
- Filters, search, totals, category breakdown, CSV. Stored in a separate table and never mixed with sales.

## 12. Reports
All 15 reports: daily, weekly, monthly, custom range, product performance, category performance, cashier
performance, waiter performance, table performance, payment methods, refunds, expenses, inventory, stock movements,
and profit estimate. Each has summary cards, a chart where meaningful, a detail table, CSV export and a print
layout. Collected revenue comes only from successful payments. Unpaid balances and refunds are shown separately.
Profit is labelled **ESTIMATE**, reports cost coverage %, and shows "not available" when no cost data exists.

## 13. Settings
- Restaurant: name, logo, address, phone, email, **currency** (configurable, used everywhere) and time zone (defines
  report business days).
- Tax and receipt: label, rate, inclusive/exclusive, header and footer. Orders snapshot the rate at creation.
- Operations: cleaning status, default order type, stock deduction rule, negative-stock policy, expense approval.
- Staff permissions: toggles that the database enforces.

## Permissions matrix (server-enforced)
| Action | Manager | Cashier | Waiter |
|---|---|---|---|
| Manager dashboard | ✅ | ❌ | ❌ |
| Read menu, tables, orders | ✅ | ✅ | ✅ |
| Edit menu, categories, tables, inventory | ✅ | ❌ | ❌ (can toggle "needs cleaning") |
| Create orders and items | ✅ | ✅ | ✅ |
| Take payments | ✅ | ✅ | ❌ |
| Cancel orders | ✅ | toggle | ❌ |
| Refunds | ✅ | toggle | ❌ |
| Create customers | ✅ | toggle (on by default) | toggle (off by default) |
| Suppliers, POs, expenses, audit, stock movements | ✅ | ❌ | ❌ |
| Manage staff | ✅ (Edge Function) | ❌ | ❌ |
