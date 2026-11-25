# Cashier POS: design refactor report (22 Nov 2026)

Scope: visual design only. No cart logic, payment calls (`record_payments`, `submit_pos_order`, …), calculations,
routes, permissions or realtime subscriptions were changed. Cashier navigation, headings, accessible names and test
ids are unchanged. See `documentation/architecture/frontend-architecture.md`.

## What changed
- **Shell:** the Cashier now uses the shared "Obsidian Ruby" shell (`PosShell` with `themed`): floating glass sidebar
  with live count badges (New Sale items, Bills, Payment Processing), a 54px status topbar (aurora border, app name,
  restaurant pill, live clock with date, connection badge, open-shift chip, theme switch, notification bell, cashier
  badge) and a 32px bottom status bar.
- **Light by default, dark on request:** the same switch as the Manager (sun/moon button). The choice is shared with
  the Manager and remembered (`sombill.theme`). Dark uses the brief's palette.
- **New Sale:** viewport-fitted terminal (menu scrolls inside its column, ticket stays visible), 58/42 split, omni-search
  with a barcode icon, flame category pills, glass menu tiles with the diagonal light-beam hover, amber monospace
  prices, dining-type tabs, amber table pill, ticket rows with flame steppers, totals box with a glowing grand total.
- **Payments:** method buttons are large gradient tiles (Zaad crimson, EVC Plus orange, Cash emerald, Card slate,
  Somtel teal), cash quick-amounts are pills, change due is an emerald callout.
- **All other Cashier pages** (Dashboard, Active Orders, Bills, Transactions, Receipts, Refunds, Shift, Profile) get the
  theme through the shared components. The receipt preview stays paper-white in dark mode.

## Where the result differs from the brief, and why
| Brief | Result | Reason |
|---|---|---|
| Dark only | Light default, dark switch | Your instruction that dashboards open light with a dark option |
| Full-screen lockdown (`100vw/100vh`, `overflow:hidden`, `user-select:none`) | Only New Sale is viewport-fitted (≥1024px); other pages scroll; text stays selectable | Locking every page would cut off long tables and block copying order and reference numbers |
| `Terminal #02`, `Hargeisa Main Branch` | App title "Cashier POS" and the restaurant name | The app has no terminal number; the branch name is real data |
| `LAN 14ms Connected` | Real status: Live sync / Connecting… / Offline | No latency is measured |
| `1 USD = 11,800 SLSH` ticker, dual SLSH/USD grand total | Omitted | The app stores one currency and no exchange rate |
| Shift Lock button | Read-only shift chip linking to Shift Management | Locking a terminal is a new feature, not styling |
| Logo in the topbar | Logo stays in the sidebar | One brand mark; no duplicate |
| Category pills in a horizontal scroller | Pills wrap onto rows | Every category stays visible without swiping |
| Barcode handling | Decorative scan icon; search by name or SKU as before | The app has no scanner handler to preserve |
| 28px steppers | 44px glass steppers | Touch targets; the tablet check requires 44px |
| Tax 4.8% MOF VAT and a service-charge row | The restaurant's real tax label and rate; no service-charge row | Values come from settings; there is no service charge in the data |
| ZAAD / e-Dahab / Cash triple block | Five real methods styled per method | The app records Cash, Card, EVC Plus, Zaad, Somtel Money; e-Dahab is not a method |
| Lighter gradient stops | Slightly deeper stops for orange, emerald, teal | White labels were below 3:1 on the brief's stops |
| ZAAD live-push modal with PIN-waiting spinner | Not built | Mobile money is recorded as "awaiting verification" by design; there is no push flow |
| Fixed quick bills 50K, 100K, $10… | The existing bill-based suggestions, styled as pills | Suggestions are computed from the amount due |
| Status bar: shift orders, shift total, "POS Engine v3.2", "Mesh Sync 100%", "MOF VAT Certified", ESN | Cashier, shift start, live-update state, tax rule, currency | The others are not data the app has, and a certification claim must not be invented |
| Status bar text 40% white | 58% | Below 50% fails the contrast rule (a test enforces it) |

## Verification
TypeScript, ESLint, Prettier, the production build and 264 dashboard tests pass (24 new: Cashier shell, theme switch,
light and dark contrast). The real-browser tablet check (Chrome, 3 viewports, 9 Waiter + 10 Cashier pages) passes at
61/61 in light and in dark, and the 80mm receipt PDFs measure 80.09mm. The Waiter is not themed (test). Screenshots use
stubbed data. Not tested: real hardware (scanner, printer) and Safari or Firefox.

Known limitation: white labels on the payment gradients are 3.5–5.5:1 (bold 14px), under the 4.5:1 target for the
lightest stop; deepen the stops if your users report glare.
