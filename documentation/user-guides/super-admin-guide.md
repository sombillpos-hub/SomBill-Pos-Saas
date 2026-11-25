# Super admin (Group HQ) guide

For owners of several branches using **Group HQ** (`/dashboard/super-admin`). An owner of a group lands on HQ after
sign-in. Technical details: [`../project/SUPER_ADMIN_REPORT.md`](../project/SUPER_ADMIN_REPORT.md).

## Getting started

- **Create the group:** a manager without a group opens **Settings → Group HQ** in the Manager dashboard and creates one;
  every restaurant they manage joins it. New branches can then be added from **Multi-Branch Fleet** (within the plan
  limit).
- **Platform Controls:** group name, reporting currency and exchange rates (you set the rates; there is no live feed),
  and default settings you can apply to all branches.

## Daily overview

- **Overview:** revenue with trend, guests, registers and staff on duty, tax, payment mix and live alerts; branch
  comparison chart (Today / Week / MTD / Year) and branch performance cards.
- The **branch switcher** in the top bar filters every page to one branch or the whole group.
- **Switch to Branch View** opens a branch with the normal Manager pages as its manager; **Group HQ** in the Manager
  sidebar brings you back.

## Pages

| Page | Use it to |
| --- | --- |
| Multi-Branch Fleet | add and edit branches |
| Active POS Fleet | see which registers (open cashier shifts) are running |
| Global Revenues | compare revenue across branches, export CSV |
| Tax Filings | see tax due per branch and month, record filings |
| Mobile Money Portals | review mobile-money takings, verify or reject pending payments |
| SaaS Subscription | see your plan, usage and expiry (read-only; billing is handled by SomBill) |
| Central Menu Push | keep one master dish list, see price differences per branch, push changes |
| Global Staff & RBAC | add staff, change roles, suspend, send password resets |
| Master Supply Chain | stock and low-stock across branches |
| Audit & Anti-Fraud | alerts from fixed rules (deletions, cash-drawer difference ≥ 5%, large refunds or discounts, cancellations): Approve, Investigate or Escalate with a note |
| Cloud Telemetry | system health |
| Broadcast | send a message to staff (recorded in the audit log) |

## Good to know

- One group per owner. A branch joins when you create it in HQ or when SomBill links it for you.
- Amounts in a currency without an exchange rate are listed separately, never added silently.
- Light theme by default, dark theme in the top bar; **Ctrl/⌘ + K** opens the command palette.
