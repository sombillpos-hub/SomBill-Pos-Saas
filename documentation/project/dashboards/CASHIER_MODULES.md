# CASHIER_MODULES — SomBill Cashier POS

> **Path note (22 Nov 2026):** this document predates the feature-based layout. Application code now lives in `frontend/dashboards/src/`: `manager/`, `waiter/`, `cashier/` → `src/features/<name>/`; `routing/` → `src/app/`; `shared/auth/` → `src/features/auth/` (+ `src/contexts/AuthContext.tsx`); `shared/pos/`, `shared/components/pos/`, `shared/layouts/PosShell.tsx`, `shared/pages/ProfilePage.tsx` → `src/features/pos/`; every other `shared/x` → `src/x`; full list in `documentation/project/FRONTEND_STACK_REPORT.md`. Database and Edge Function paths are under `backend/supabase/`; `npm run test:db` now runs from `backend/` (or the project root), and `manageStaff.test.ts` is now `backend/supabase/tests/functions/manage-staff.test.ts`. See `documentation/architecture/system-architecture.md`.

_Last updated: 22 Nov 2026 · Route: `/cashier` · Roles: **cashier** (managers may also use it)_

The Cashier POS is part of the same SomBill app and uses the same Supabase database as the Manager dashboard and
Waiter POS. It does not have its own database. After sign-in, `/` sends a cashier to `/cashier`. Every money
operation is decided **in the database** (SECURITY DEFINER functions plus forced RLS). The screens only collect
input and display results, so the rules below hold even if someone calls the API directly.

## Sidebar

| # | Section | Route | What it does |
|---|---|---|---|
| 1 | Dashboard | `/cashier` | Figures for the selected dates: gross sales, **collected**, cash, card, verified mobile money, money awaiting verification, refunds, average transaction, paid/partial/unpaid/active order counts, recent transactions and orders, and the current shift. "Collected" counts only confirmed payments, never unpaid orders or unverified mobile money. |
| 2 | New Sale | `/cashier/new-sale` | Touch product grid with category chips and search (the manager's menu only, so archived, unavailable or hidden-category products can't be sold). Order type: dine-in (needs a free table), takeaway, or delivery (needs a customer). Customer search and quick create (if permitted), item and order notes, quantity controls, and a discount with a reason within the cashier limit. Shows subtotal, discount, tax and grand total. **Save order** or **Charge**, which goes straight to payment. The cashier never sets prices: the server rejects a stale price with `PRICE_CHANGED` and the screen refreshes prices. Also adds items to an existing order (from Active Orders). |
| 3 | Active Orders | `/cashier/active-orders` | Every open order from waiters and the counter, updated live. Filter by preparation status, payment status and type, and search by order #, table, waiter or item. Details modal: bill breakdown, print order, full bill, add items, take payment, and close a paid order once it is ready or served. Warns when another cashier has already opened the bill. |
| 4 | Bills | `/cashier/bills` | Tabs: **Unpaid · Partially paid · Payment pending** (bill requested, or mobile money unverified) **· Paid · Refunded**. Filter by date and table; search by order #, table or customer. Detail: items, subtotal, discount, tax, grand total, amount paid, outstanding balance (computed from recorded payments), the payment list with verification state, 80mm bill print, an authorised discount (before any payment), and Process payment. |
| 5 | Payment Processing | `/cashier/payments` | Queue of requested bills and all unpaid orders. Opening a requested bill acknowledges it, so the waiter sees "Cashier processing". **Split payment panel**: add any number of Cash / Card / EVC Plus / Zaad / Somtel Money lines. Shows total, previously paid, outstanding, entered, remaining and change. One **Confirm** records all lines in one database transaction. There is also a list of **mobile money awaiting verification**, with *Verified* and *Not received* buttons. |
| 6 | Transactions | `/cashier/transactions` | Every payment and refund, permanently kept. Search by transaction #, order #, reference or customer; filter by method, status (completed / pending / failed / refunds) and date. Shows totals (completed, refunds, net), a details modal and a printable transaction record. **CSV export** is formula-injection safe. |
| 7 | Receipts | `/cashier/receipts` | Paid orders for the selected dates with receipt # and print count. 80mm preview. *Issue & print* or *Reprint*: reprints are counted, audited and marked "REPRINT" on the slip. Optional raw **ESC/POS** output, either as a downloadable file or sent to a USB-serial printer through Web Serial (Chrome/Edge). |
| 8 | Refunds | `/cashier/refunds` | **New refund**: find by order # or transaction #, pick the original transaction (shows the refundable amount), optionally pick items and quantities (suggests their value including tax and discount share), enter amount, method, reference (non-cash), reason, and restock (if the items were deducted from stock). **History**, plus **Approvals** (managers approve or reject with a note). |
| 9 | Shift Management | `/cashier/shift` | Open with the opening float. Live summary: opening cash, cash sales, cash refunds, pay-ins and pay-outs, **expected cash**, non-cash totals by method, mobile money awaiting verification, refunds and transaction count. Record pay-out, safe drop or pay-in with a reason. Close: enter counted cash and see the difference live (balanced / over / short). A difference needs a note. Confirm before closing. Includes shift history. |
| 10 | My Profile | `/cashier/profile` | Shared with the Waiter POS: name, phone, password reset link and sign-in details. |
| — | Logout | sidebar | Asks for confirmation, clears any unsaved sale draft on this device, then signs out. |

Print pages: `/cashier-print/receipt|bill|transaction/:id` render the 80mm document on its own for the browser print
dialog. They use the same role guard as the rest of the Cashier POS.

## Payment methods and the honesty rules

| Method | What the cashier enters | How it is recorded |
|---|---|---|
| **Cash** | Amount, optional amount received (quick-cash buttons) | `succeeded`. Change = received − amount, stored with the payment. Received below the amount is rejected. |
| **Card** | Amount, terminal transaction ID (≥ 4 chars), and a tick confirming the terminal shows **APPROVED** | `succeeded`, with verification `terminal_confirmed`, meaning *cashier-confirmed*. **There is no card-terminal integration.** SomBill never claims the card was charged. It records what the cashier read from the terminal and labels it that way everywhere. |
| **EVC Plus / Zaad / Somtel Money** | Amount and transaction reference | `pending`, with verification `pending`. **A typed reference is not proof of payment.** It is not counted as paid or collected. Its amount is reserved, so the balance can't be paid twice meanwhile. Someone with permission checks the provider's merchant app or statement and presses **Verified** (the order then settles and closes automatically) or **Not received** (a reason is required, and the amount returns to the balance). **No provider API is integrated.** Nothing is ever auto-verified. |

The same reference cannot be used twice for the same method in a restaurant (case-insensitive) unless the earlier
attempt was rejected.

## Guarantees enforced by the database

- **Payments are written only by `record_payments`, `verify_payment`, `process_refund` / `decide_refund` and
  `refund_order`.** Client insert, update and delete privileges on `payments` are revoked. A trigger also blocks any
  change outside these functions, *including the service role*. The only change ever allowed is pending →
  succeeded or failed, with the verification fields. History cannot be deleted.
- **No duplicates:** every Confirm carries an idempotency key, so a repeat submission returns the original result.
  The order row is locked (`FOR UPDATE`), so concurrent cashiers serialise. Overpayment (pending amounts included)
  and an already-settled order are rejected. The button also ignores double clicks.
- **Validation:** positive amounts only, at most 2 decimals, a supported method, card ID plus approval, a mobile
  reference, and cash received ≥ amount.
- **Paid only when fully settled.** The order closes (and the table frees) only when it is fully paid **and** ready or
  served. A paid takeaway still in the kitchen stays open.
- **Prices** always come from the manager's menu (`PRICE_CHANGED` otherwise). **Discounts** go through
  `apply_discount` / `submit_pos_order` only: cashiers are capped at *max discount %* (default 10%), a reason is
  required, discounts are only allowed before any payment, and direct edits are blocked.
- **Refunds** are separate `refunds` records plus a negative ledger row. The original payment is never touched. A
  refund can't exceed the transaction's unrefunded amount, and item quantities can't be refunded twice.
  Idempotency keys stop double submission. A cashier's refund completes immediately only if *cashier can refund* is
  on **and** the amount is ≤ *cashier refund limit* (default 0). Otherwise it waits for a manager, who is notified;
  no money is recorded before approval. Decided refunds are final. Restock is item-level and goes through stock
  movements.
- **Shifts:** one open shift per cashier. With *require open shift* on (the default), a cashier cannot take payments
  or refunds without one. Payments and refunds are stamped with the shift. Pay-outs can't exceed the cash expected
  in the drawer. Closing stores expected, counted, difference and a summary snapshot, and requires a note when the
  difference isn't zero. **Closed shifts and cash movements are immutable**, even for the service role.
- **Receipts** exist only after a confirmed payment. The number is per restaurant, and issuing again returns the
  same number. Every print is counted, and reprints are audited.
- **Isolation:** RLS limits every row to the caller's restaurant. Waiters and kitchen staff cannot take payments,
  verify, refund or issue receipts. Waiters can see that a receipt exists.

## Settings (Manager → Settings → Staff permissions)

| Setting | Default | Effect |
|---|---|---|
| Cashiers can issue refunds without approval | off | Off means every cashier refund needs manager approval |
| Cashier refund limit without approval | 0 | Refunds above it wait for a manager |
| Cashiers can verify mobile money payments | on | Off means only managers press *Verified* / *Not received* |
| Cashiers must open a cash shift before taking payments | on | Enforced by `record_payments` / `process_refund` |
| Maximum cashier discount (% of subtotal) | 10 | Enforced by `apply_discount` / `submit_pos_order` |
| Cashiers can cancel unpaid orders / create customers | as before | Unchanged |

## Realtime

The Cashier POS subscribes (filtered by restaurant) to `orders`, `order_items`, `payments`, `refunds`,
`cashier_shifts`, `receipts`, `products` and `categories`. A waiter's new order, bill request or added items appear
without a refresh. Payments by another cashier update queues, balances and the sidebar badges for requested bills
and mobile money awaiting verification. The Waiter POS and Manager dashboard see completed payments the same way.
The reconnect logic is the one already tested for the Waiter POS.

## Printing

- **Browser printing (works today):** the print page sizes the paper to the slip, `@page { size: 80mm <height>mm;
  margin: 0 }`, measured from the rendered content. It prints through a hidden iframe, so the cashier stays on the
  page. Chrome's PDF output was measured at **80.09 mm wide, one page** (see CASHIER_TEST_REPORT.md). Any thermal
  printer whose OS driver supports 80mm paper can print it.
- **ESC/POS (provided, not hardware-tested):** an Epson-compatible encoder (initialise, alignment, bold, double size,
  feed, partial cut, ASCII-safe text, 48 columns). Output can be a `.bin` download or sent over Web Serial. The bytes
  are unit-tested, but **it has not been tested on a physical printer**, and the UI says so.

## Files

- `backend/supabase/migrations/20261121000006_cashier_enums.sql`: payment methods `evc_plus`, `zaad`, `somtel_money`.
- `backend/supabase/migrations/20261121000007_cashier_pos.sql`: tables `cashier_shifts`, `cash_movements`,
  `payment_requests`, `refunds`, `receipts`; payment columns (transaction #, verification, shift, cash
  received/change); guards; the RPCs listed above; RLS; grants; realtime.
- `cashier/`: `layouts/CashierLayout.tsx`, `navigation.ts`, `components/` (`PaymentPanel`, `BillDetail`,
  `ReceiptView`), `hooks/` (`useShift`, `useReceiptData`), `services/` (`data.ts`, `escpos.ts`), `utilities/`
  (`payment.ts` pure money logic, `stats.ts`, `receiptModel.ts`), and `pages/` (10 pages plus the print page).
- Shared with the Waiter POS, without behaviour change: `shared/layouts/PosShell.tsx` (sidebar shell),
  `shared/components/pos/PosComponents.tsx` (product card, category chip, customer picker), `shared/pos/`
  (cart, POS rules, order queries) and `shared/pages/ProfilePage.tsx`.
