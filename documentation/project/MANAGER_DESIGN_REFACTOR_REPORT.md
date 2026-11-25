# Manager dashboard: design refactor report (22 Nov 2026)

Scope: visual design only. No routes, state, data queries, permissions or page logic were changed. See
`documentation/architecture/frontend-architecture.md` for how the system works.

## What changed
- **Light by default, dark on request (follow-up):** the Manager now opens in a light version of the same shell. A sun/moon toggle in the topbar (also in the Ctrl/⌘+K palette) switches to the dark Obsidian Ruby theme; the choice is saved in `localStorage` (`sombill.theme`) and applied before first paint. Print is unaffected. Both themes are covered by contrast tests and shell tests.
- **Design system** added in `frontend/dashboards/src/styles/design-system/` (tokens, motion, Obsidian theme, shell).
- **Shell rebuilt:** floating glass sidebar with section headings and a glowing active state, aurora-stripe topbar,
  live clock in the restaurant's time zone, real connection badge, notification bell, avatar pill, breathing footer.
  `AppLayout` was split into reusable pieces under `src/components/shell/`.
- **Components restyled** through the theme: cards (glass, shimmer, corner orb), buttons (flame gradient / outline),
  inputs, tables (headers, row hover with an accent bar), status pills with glowing dots, modals, toasts, skeletons.
- **Charts:** the SVG bar chart now has gradient bars, themed grid and axes, hover highlight and a glass tooltip.
  Series colours changed from navy/orange to red/orange so they read on dark.
- **Fonts:** Outfit and JetBrains Mono, self-hosted.

## Small additions beyond pure styling
- **Ctrl/⌘ + K command palette** (jump to any of the 13 pages). The search pill needed something real behind it. It only
  navigates.
- **Notification bell** shows tables with a bill request or pending payment, from the same `table_status_v` view the
  Tables page uses, refreshed through realtime. Read-only.
- **Sidebar section headings** (`group` field on `NAV_ITEMS`). Routes and labels are unchanged.

## Where this differs from the brief, and why
| Brief | Done | Reason |
|---|---|---|
| "14ms LAN Sync" badge | Real state: Live sync / Connecting / Offline | No latency is measured; a fixed number would be false |
| Table header text at 32% white, "scale(1.002)" row hover | 55% white, accent bar on the row's left edge | 32% fails contrast; scaled rows blur text |
| Every card lifts 5px and scales on hover | Only KPI cards lift; panels and tables glow | Lifting a full-width table is jarring |
| `backdrop-filter` on all cards, `!important` rules | Blur only on overlapping surfaces, no `!important` on cards | Cost with no visible gain on a flat background; specificity is enough |
| `Outfit` / `JetBrains Mono` names | Fontsource families `Outfit Variable` / `JetBrains Mono Variable` | Names the self-hosted fonts register |
| Table cell padding 14×20 | 13×16 | 20px made the Orders table overflow at 1440px |
| Recharts area/line gradients | Gradients applied to the existing SVG bar chart | The Manager charts are bars, not Recharts |

## Checks
Typecheck, ESLint, Prettier, unit tests and production build all pass (see PROJECT_STATUS). New tests: 14 contrast
checks, 8 shell behaviour tests. The Waiter and Cashier tablet check (real Chrome, 61 checks, 80mm receipt PDF) still
passes. Printing a Manager page was checked: it stays black on white with no sidebar.

Not verified: real Supabase data (screenshots use stubbed data), Safari/Firefox, and the official logo (not supplied;
`BrandMark` shows a flame tile with the wordmark until `public/branding/sombill-logo.png` exists).
