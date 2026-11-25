# Manager guide

For restaurant managers using the **Manager dashboard** (`/dashboard`). Sign in with the email and password from your
invitation; managers land on the dashboard automatically. Technical details of every screen:
[`../project/dashboards/MANAGER_MODULES.md`](../project/dashboards/MANAGER_MODULES.md).

## First day: set up the restaurant

1. **Settings → Restaurant:** name, logo, address, phone, email, **currency** and **time zone** (the time zone decides
   which day a sale belongs to in reports).
2. **Settings → Tax & receipt:** tax label and rate, inclusive or exclusive, receipt header and footer. Each order keeps
   the rate it was created with, so changing it later does not alter old bills.
3. **Settings → Operations / Staff permissions:** stock deduction rule, negative-stock policy, expense approval, and what
   cashiers and waiters may do (refunds, discounts, cancelling, creating customers). The database enforces these.
4. **Categories**, then **Menu:** add products with price, cost price, tax category, image and preparation station. Add a
   recipe (ingredients per unit sold) if you want stock deducted automatically and food-cost % shown.
5. **Tables:** build the floor plan per floor (number, seats, section, shape, position).
6. **Staff:** invite each employee with name, email, phone and role (manager, cashier, waiter, kitchen). They receive an
   email and choose their own password.

## Every day

| Task | Where | Notes |
| --- | --- | --- |
| See how the day is going | **Dashboard** | sales, payments collected, refunds, open orders, tables in use, low-stock alerts; pick the date range at the top |
| Follow and manage orders | **Orders** | tabs by status, search, filters, CSV; open an order for items, payments and its change history |
| Cancel an order | order details → **Cancel** | a reason is required; not possible once money has been collected (refund instead) |
| Refund | order details → **Refund** | up to the collected amount; optionally put ingredients back into stock |
| Approve cashier refunds | notification / **Orders** | refunds above the cashier limit wait for you; no money moves before approval |
| Take availability off a dish | **Menu** → availability toggle | it disappears from the waiter and cashier POS at once |

## Stock and purchasing

- **Inventory:** every change needs a reason: **Receive**, **Wastage**, **Adjustment** or **Transfer**. Each one is kept in
  the movement history; stock can never be edited silently.
- **Suppliers** and **Purchase orders:** create a PO, place it, then **Receive** it (fully or partly). Stock changes only
  when goods are received, and the same delivery can't be received twice.
- **Expenses:** record category, amount, method, date and an optional attachment. With approval switched on, new
  expenses wait for your approval.

## Reports

**Reports** has 15 reports (daily, weekly, monthly, custom range, products, categories, cashiers, waiters, tables,
payment methods, refunds, expenses, inventory, stock movements, profit estimate), each with CSV export and a print
layout. Revenue counts only successful payments; unpaid balances and refunds are shown separately. Profit is always
labelled **ESTIMATE** and depends on cost prices being filled in.

## Good to know

- Orders, payments and stock movements are never deleted; archive menu items, tables, customers and suppliers instead.
- You cannot demote or suspend yourself, and the last active manager can't be removed.
- If you own several branches, the **Group HQ** link takes you to the Super Admin dashboard
  ([super-admin guide](super-admin-guide.md)).
