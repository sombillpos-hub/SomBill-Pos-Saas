# Waiter floor app: design refactor report (22 Nov 2026)

Scope: visual design and touch ergonomics only. No order states, table assignment, cart, order sending, realtime
subscriptions, routes or permissions were changed. Navigation labels, headings, accessible names and test ids are
unchanged. See `documentation/architecture/frontend-architecture.md`.

## What changed
- **Shell:** the Waiter uses the shared "Obsidian Ruby" shell (`PosShell` with `themed`). Light by default; the sun/moon
  switch turns dark on request and the choice is shared with the Manager and Cashier (`sombill.theme`).
- **Topbar (56px on phones and tablets):** aurora stripe, app name, live amber monospace clock, connection beacon
  (dot only on small screens), theme switch, notification bell with count, waiter badge with gradient border.
- **Floating bottom dock (below 1024px):** glass bar, 26px radius, 12px above the bottom edge. Tables, My Orders,
  Kitchen Status, More (opens the full 9-section menu) and a raised flame New Order button showing the draft item
  count. On wide screens the usual sidebar remains.
- **Tables:** cards coloured by status. Available = emerald, Occupied = crimson with an amber monospace timer and running
  balance, Bill requested = 2px amber border, pulsing halo and a flashing "Bill requested" strip, Payment pending = red,
  Cleaning = sky. Round tables keep a rounder shape. Status counters get a coloured dot.
- **New Order:** same 58/42 viewport-fitted layout as the Cashier (menu scrolls inside, ticket stays visible), glass
  tiles, flame steppers, glowing total. On phones the existing "Review & send" bar becomes a glass bar floating above the dock.
- **Kitchen Status:** ticket cards with a coloured left ribbon per stage; Preparing has an amber glow, Ready pulses emerald
  with the "Mark served" button, Served is faded. The My/All toggle is a flame segmented control.
- **Offline banner:** a red banner slides under the topbar when the browser goes offline and clears when it returns.

## Where the result differs from the brief, and why
| Brief | Result | Reason |
|---|---|---|
| Dark only | Light default, dark switch | Your instruction that dashboards open light with a dark option |
| Filter pills All / My Tables / Free / Occupied / Bill Ready | Existing status counters, styled | Pills that filter would add new logic; you asked not to change data flow. The Section selector remains |
| Waiter avatar with zone, "Call Captain" buzzer | Waiter badge only | The app has no zone or captain-call feature. A button that does nothing would mislead |
| Offline text "Local LAN Mesh Active, orders fire directly to kitchen" | "You are offline. Orders and payments can't be sent until the connection returns." | Orders go through the server; claiming a LAN mesh would be false |
| Somali title + English subtitle on dishes | English names as stored | The menu data has one name per item |
| Order summary slide-up drawer with drag handle | Existing Review & send bar and order panel | A new drawer would duplicate cart logic. The bar scrolls to the existing panel |
| "READY TO SERVE 🔔", "Mark Collected" | Ready column, ribbon pulse, existing "Mark served" | Those are the real statuses and action names; renaming would change behaviour and tests |
| Kitchen pickup board as a separate view | Existing Kitchen Status page restyled | Same data and permissions |
| Dock with Floor / Menu / Order FAB / Pickups / Profile | Tables / My Orders / **New Order** / Kitchen / More | Keeps the 9 real sections reachable; the rest sit under More |

## Verification
Typecheck, ESLint (0 warnings), Prettier, `vite build`, Vitest 21 files / 276 tests (incl. new `waiterShell.test.tsx`:
light default, toggle and cleanup, dock links and More menu, no dock on wide screens, offline banner), contrast tests,
and the real-Chrome check at phone 390, tablet portrait/landscape and desktop in both themes (no overflow, controls ≥ 44px).
