# Super Admin / Group HQ: build report (22 Nov 2026)

New dashboard for a multi-branch owner, at `/dashboard/super-admin`. It was built from scratch on the existing group
model, with real data only. See `documentation/architecture/frontend-architecture.md` for the shared shell.

## What you get
- **Sign-in:** a user who owns a group (`organization_members`) lands on HQ. The owner can enter any branch of the group
  ("Switch to Branch View") and then uses the normal Manager pages as that branch's manager; the **Group HQ** link in the
  Manager sidebar returns to HQ. A manager with no group can create one from **Settings → Group HQ**; every restaurant they
  manage joins it.
- **Shell:** collapsible glass sidebar (272 ↔ 84 px) with a revolving gold crown and four groups (Global command,
  Consolidated finance, Central operations, Security & infra), 68 px aurora topbar, branch quick-switcher that filters every
  page, live "N registers open" pill, USD/SLS rate pill, Broadcast button, light/dark toggle (light by default), Ctrl/⌘+K
  palette, sign-out confirmation, breathing footer. Lower-priority topbar items fold away on narrower screens.
- **Overview:** time-aware Somali greeting with floating orbs; six count-up KPIs (revenue with trend, guests, registers
  and staff on duty, tax, payment mix, live alerts); multi-branch Area/Bar chart with Today / Week / MTD / Year; branch
  performance cards; anti-fraud stream with Approve / Investigate / Escalate and a note; central menu and price sync.
- **Pages:** Multi-Branch Fleet (add and edit branches, plan limit), Active POS Fleet, Global Revenues (CSV), Tax
  Filings (tax due per branch and month, record a filing, register, CSV), Mobile Money Portals (takings per method and
  branch, verify or reject pending payments), SaaS Subscription (plan, usage, expiry), Central Menu Push (master dish list,
  price differences, push history), Global Staff & RBAC (roles, suspend, reset password, add staff), Master Supply Chain,
  Audit & Anti-Fraud (filters, CSV, risk rules), Cloud Telemetry, Platform Controls (group name, reporting currency,
  exchange rates, apply defaults to branches).

## Backend (migration `20261122000008_super_admin.sql`, must be applied to Supabase)
Tables `organizations`, `organization_members`, `tax_filings`, `audit_reviews`, `restaurants.organization_id`. The owner is an
implicit manager of the group's branches through the extended `is_manager`, `is_member`, `has_role`, `member_role` and
`shares_restaurant_with` helpers, so existing RLS, RPCs and Manager pages work in branch view. New RPCs (all
ownership-checked, not callable by `anon`): `create_organization`, `org_create_branch`, `org_branch_summary`,
`org_revenue_series`, `org_payment_mix`, `org_inventory_summary`, `org_low_stock`, `org_push_menu_item`, `org_menu_matrix`,
`org_broadcast`, `org_tax_due`, `org_record_tax_filing`, `org_update_settings`, `org_apply_branch_defaults`. The
`manage-staff` function also accepts the group owner, for that owner's branches only.

## Where the result differs from the brief, and why
| Brief | Result | Reason |
|---|---|---|
| Dark only, `--sa-bg #080305` | Light default, dark switch; `--sa-*` tokens kept | Your instruction that dashboards open light with a dark option |
| `.jsx` files | TypeScript under `features/superadmin/` | The app is TypeScript strict |
| Terminals, "synchronized with N nodes" LAN mesh, offline heartbeat | Registers = open cashier shifts; staff on duty = open staff shifts. Sync message reports real branches updated and real elapsed ms | There are no terminal agents or LAN mesh; claiming them would be false |
| MOF VAT sync, ZAAD HQ wallets, e-Dahab | Tax due and filing register kept by the owner; mobile money shown from recorded payments with manual verification | No integration with the tax authority or mobile money APIs exists |
| Emergency lockdown | Broadcast message to staff (notification plus audit entry) | There is no remote lockout mechanism in the system |
| USD/SLSH rate "live" | Owner-set rate in Platform Controls | No exchange-rate feed. Amounts in a currency with no rate are listed separately, never added silently |
| Licenses and billing | Read-only plan, usage and expiry | Plans and payment are handled by SomBill, not by the owner |
| Trend arrows | Shown only against a real previous period | No invented percentages |
| Fraud AI | Fixed, visible rules (delete; drawer difference ≥ 5%; refund ≥ 100; discount ≥ 15% / 30%; cancel) | Rules can be checked and explained |
| Several groups per owner | One group per owner | Keeps the model and the switcher simple |
| Linking branches | A branch joins when the operator links it or the owner creates it in HQ | Owners cannot change `restaurants.organization_id` themselves |

## Defects found and fixed while building
- `ManagerRoute` allowed owners without a selected branch, so an owner could reach branch pages with no branch. It now sends them to HQ.
- Form fields without `id` or `name` had labels not tied to their control. `Input`, `Select`, `Textarea` and `Checkbox` now generate an id.

## Verification
TypeScript, ESLint (0 warnings), Prettier, `vite build`. Vitest: 24 files, 299 tests (289 dashboards incl. 12 library tests and
10 Super Admin tests, 10 backend). Database: 357 SQL assertions on PostgreSQL 16 (114 Manager, 91 Waiter, 98 Cashier,
54 Super Admin) plus concurrency tests. Real Chrome (`e2e/hq.mjs`): 13 pages × phone 390, tablet 820, laptop 1280, desktop 1600,
light and dark: no horizontal overflow, correct theme, no runtime errors. The Waiter/Cashier tablet check still passes (78 / 78).
Not verified: the migration on the hosted Supabase project, and HQ with real multi-branch data.
