# Cashier guide

For cashiers using the **Cashier POS** (`/cashier`). Sign in with your own account; cashiers land on the POS
automatically. Technical details: [`../project/dashboards/CASHIER_MODULES.md`](../project/dashboards/CASHIER_MODULES.md).

## Start of shift

1. Open **Shift Management** and **open a shift** with the cash in the drawer (opening float). Unless the manager turned
   it off, you cannot take payments or refunds without an open shift.
2. Check **Active Orders** and **Bills** for anything left from earlier.

## Taking a payment

1. Open **Payment Processing** (requested bills appear at the top, and the waiter sees "Cashier processing" once you
   open one), or open the bill from **Bills**.
2. Add one or more payments (split payment is allowed):

   | Method | What you enter | Result |
   | --- | --- | --- |
   | Cash | amount, and the amount received | paid immediately; change is calculated |
   | Card | amount, terminal transaction ID, and tick that the terminal shows **APPROVED** | paid (confirmed by you; there is no terminal integration) |
   | EVC Plus / Zaad / Somtel Money | amount and the transaction reference | **pending** until verified: a typed reference is not proof of payment |

3. **Confirm.** Pressing twice cannot charge twice. Overpayment is refused.
4. Mobile money: when the money has arrived, press **Verified** (or **Not received**). Only then does it count as paid.
5. The order closes and the table frees when the bill is fully paid **and** the food is ready or served.

## Counter sales

**New Sale:** choose dine-in (free table), takeaway or delivery, tap products, add a customer if needed, send, then take
payment. Prices always come from the manager's menu. Discounts need a reason, are capped (10% unless the manager
changed it) and are only possible before any payment.

## Receipts, refunds, transactions

- **Receipts:** issue and print an 80 mm receipt after payment. Reprints are counted and marked **REPRINT**.
- **Refunds:** find the order or transaction, choose the amount or the items. If your refund is above your limit, it
  waits for a manager; nothing is paid out before approval. The original payment is never changed.
- **Transactions:** every payment and refund, kept permanently, with search and filters.

## End of shift

**Shift Management → Close shift:** count the drawer and enter the counted cash. The POS shows the expected cash
(opening float + cash sales − cash refunds ± pay-ins/pay-outs) and the difference; a note is required when the
difference isn't zero. Closed shifts can't be changed.

## Good to know

- You only see your restaurant's data. You can't edit prices, menu or settings.
- **Logout** asks for confirmation and clears any unsaved sale on this device.
