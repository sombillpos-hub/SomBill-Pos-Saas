# WAITER_MODULES — SomBill Waiter POS

> **Path note (22 Nov 2026):** this document predates the feature-based layout. Application code now lives in `frontend/dashboards/src/`: `manager/`, `waiter/`, `cashier/` → `src/features/<name>/`; `routing/` → `src/app/`; `shared/auth/` → `src/features/auth/` (+ `src/contexts/AuthContext.tsx`); `shared/pos/`, `shared/components/pos/`, `shared/layouts/PosShell.tsx`, `shared/pages/ProfilePage.tsx` → `src/features/pos/`; every other `shared/x` → `src/x`; full list in `documentation/project/FRONTEND_STACK_REPORT.md`. Database and Edge Function paths are under `backend/supabase/`; `npm run test:db` now runs from `backend/` (or the project root), and `manageStaff.test.ts` is now `backend/supabase/tests/functions/manage-staff.test.ts`. See `documentation/architecture/system-architecture.md`.

The Waiter POS lives in the same app as the Manager dashboard, on the same shared SomBill database. After sign-in,
`/` sends each person to their own app: waiters go to `/waiter`, managers to `/dashboard`. Managers can also open
the Waiter POS, for example when covering a shift. Cashier and kitchen accounts see a "use your own app" page.

Legend: ✅ implemented and covered by automated tests

| # | Section | Route | Status |
|---|---|---|---|
| 1 | Dashboard | `/waiter` | ✅ |
| 2 | Tables | `/waiter/tables` | ✅ |
| 3 | New Order | `/waiter/new-order` | ✅ |
| 4 | My Orders (+ details) | `/waiter/orders`, `/waiter/orders/:id` | ✅ |
| 5 | Menu | `/waiter/menu` | ✅ |
| 6 | Kitchen Status | `/waiter/kitchen` | ✅ |
| 7 | Bills | `/waiter/bills` | ✅ |
| 8 | Notifications | `/waiter/notifications` | ✅ |
| 9 | My Profile | `/waiter/profile` | ✅ |
| 10 | Logout | sidebar and profile | ✅ asks for confirmation and clears the unsent draft |

## 1. Dashboard
Waiter name and **current shift**, with start/end and a live duration (stored in `staff_shifts`). Figures, all
calculated from database rows: my active orders, completed today (with sales), available and occupied tables, ready
orders, orders pending in the kitchen, bill requests and my open balance. Also shows orders ready for pickup and
recent activity from my notifications. Quick actions: New Order, View Tables, View My Orders, Request Bill.

## 2. Tables
Touch-friendly floor plan, filterable by section. Each tile shows number, name, seats, live status, order number,
waiter, amount due and how long the table has been occupied. Status is never set by hand: it comes from
`table_status_v` (Available, Occupied, Bill Requested, Payment Pending). The table panel offers:
- **Start new order** on available tables.
- **Add items** to your own unpaid order.
- **View order** and **Bill**.
- **Table history**: the last 20 orders.

Colleagues' tables are view-only unless the manager enables "Waiters can add items to colleagues' orders". Updates
arrive live, and a Refresh button is available too.

## 3. New Order (POS)
- **Left:** category chips with category search, product search, and a compact product grid (56px images, name,
  price, quantity badge). Unavailable products are disabled. Archived products and inactive categories are hidden.
- **Right:**
  - Table selector, showing only free tables.
  - Guest count.
  - Customer search, or a new customer if the manager allows it.
  - Line items with −/+ (whole numbers 1–999), remove, per-item notes and special instructions.
  - Live subtotal, tax and total, using the same formula as the database.
  - **Send order** (orange).
- **Add items mode:** opened from Tables or My Orders. Shows the items already sent and the estimated new total, and
  sends with `add_order_items`.
- **Safe submission:** `submit_waiter_order` runs as one transaction. It locks the table row, rejects a second
  active order on the table (`TABLE_OCCUPIED`), re-checks availability and **every price** (`PRICE_CHANGED`),
  computes totals on the server, stores the waiter, restaurant and table IDs, and notifies the kitchen and cashier.
  Any failure rolls everything back, so the table is never left half-occupied.
- **Double-tap protection:** an in-flight guard in the app, plus an idempotency key per draft that is reused on
  retries. The database records each key once and returns the original order for repeats.
- **Price changes:** if the manager changes a price mid-order, the app refreshes the prices, explains what changed
  and asks the waiter to review before sending again.
- **Tablet layout:**
  - The sidebar auto-compacts below 1280px.
  - The product grid never gets narrower than readable cards.
  - Portrait tablets get a sticky "Review & send" bar with the live total.

## 4. My Orders
Filters: Active, Pending, Preparing, Ready, Served, Completed, Cancelled, each with a count. Search by order number,
table, customer or item. Date range. Columns: order number, table, customer, date, time, items, total, status and
payment status. The details page shows a preparation progress bar, items with notes, special instructions,
totals, bill state, and **order history** (each round of items sent, bill request, completion). From there the
waiter can mark a Ready order served, add items to an eligible order, or open the bill.

## 5. Menu
The manager's live products: category, image, name, description, price and availability. Search, category
filters, a product details modal, and **Add to order**, which goes into the current draft. Updates live through
Realtime.

## 6. Kitchen Status
Read-only board with New, Accepted, Preparing, Ready and Served columns. Cards show order number, table, items,
quantities, notes, special instructions and time since ordering. "My orders" or "All orders" toggle. **Waiters
cannot change preparation status.** The only action is **Mark served**, on their own orders once the kitchen marks
them Ready. This is enforced by the database.

## 7. Bills
Open bills with their states: not requested, requested, cashier processing, partially paid, paid, closed. The bill
view shows items, quantities, unit prices, subtotal, authorised discounts, tax, grand total, payments recorded and
remaining balance.
- **Request bill:** `request_bill` notifies cashiers and managers in realtime.
- **Cancel bill request:** `cancel_bill_request`, only before the cashier starts and before any payment, and only if
  the manager allows it.
- **Receipt:** once fully paid, the app shows the receipt as available and offers Print receipt.

Waiters can never record, edit or delete payments.

## 8. Notifications
Stored in the database (`notifications`) and generated by server triggers:

| Notification | Who gets it |
|---|---|
| New order | Kitchen and cashier |
| Order accepted, preparing, ready or cancelled | The order's waiter |
| Bill requested | Cashier and manager |
| Bill acknowledged | The order's waiter |
| Payment completed | The order's waiter |
| Table now available | The order's waiter |

The page has All and Unread tabs, timestamps, tap-to-open (marks read), mark all read, and clear read. Unread
notifications can't be cleared. A badge in the sidebar and header, plus a live toast, appears for new
notifications.

## 9. My Profile
Name, email, phone, restaurant, role, account status and member-since date. Waiters can edit name and phone
(validated), and the database grants only those columns. They can change their password through Supabase Auth.
Logout asks for confirmation. Email, role and restaurant are manager-controlled.

## Realtime and reconnection
Subscriptions cover products, categories, tables, orders, order items, payments and notifications. Notifications
are filtered to the user, everything else to the restaurant. After a dropped connection the app reconnects with
backoff and **resyncs** once reconnected, when the browser comes back online, and when the tab becomes visible
again. A header indicator shows Live, Connecting or Reconnecting.

## Permissions (enforced in the database)
| Action | Waiter | Kitchen | Cashier | Manager |
|---|---|---|---|---|
| View menu, tables, orders of own restaurant | ✅ | ✅ | ✅ | ✅ |
| Create orders (`submit_waiter_order`) | ✅ | ❌ | ✅ | ✅ |
| Add items | own unpaid orders, no bill requested (colleagues' only if allowed) | ❌ | ✅ | ✅ |
| Edit or void submitted items | ❌ | ❌ | ✅ | ✅ |
| Accepted / Preparing / Ready | ❌ | ✅ | ❌ | ✅ |
| Mark Served | own Ready orders | ✅ | ✅ | ✅ |
| Complete orders | ❌ | ❌ | ✅ | ✅ |
| Request bill / cancel request | own orders (cancel only before processing) | ❌ | ✅ | ✅ |
| Acknowledge bill, record payments, refunds, discounts | ❌ | ❌ | ✅ | ✅ |
| Prices, products, settings, staff, financial admin | ❌ | ❌ | ❌ | ✅ |

## New manager settings
Under **Settings → Tables, orders & stock** and **Staff permissions**:
- Allow multiple open orders per table (default off).
- Waiters can add items to colleagues' orders (default off).
- Waiters can cancel unprocessed bill requests (default on).

Staff Management also gains the **Kitchen** role.
