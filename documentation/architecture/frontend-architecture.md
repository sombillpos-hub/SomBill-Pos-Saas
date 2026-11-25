# Frontend architecture

_Combined on 22 Nov 2026 from: FRONTEND_STACK.md, WEBSITE_ARCHITECTURE.md, DESIGN_SYSTEM.md._

## Contents

- SomBill frontend technology stack
- SomBill Website Architecture & Module Guide
- SomBill design system: "Obsidian Ruby"

## SomBill frontend technology stack

_22 Nov 2026. Applies the "SomBill – Frontend Technology Stack & Implementation" brief to the existing frontend.
Hotel management is out of scope by decision. The backend stack will be defined separately._

### 1. Stack by area

| Area (brief §) | Technology | Dashboards (`frontend/apps/dashboards`) | Website (`frontend/apps/website`) |
| --- | --- | --- | --- |
| Core (§1) | React, TypeScript, JavaScript ES6+, HTML5, CSS3 | ✅ React 18 · TS 5.6 strict | ✅ React 19 · TS 7 |
| Styling (§2) | Tailwind CSS | ✅ v3 (`tailwind.config.js`) | ✅ v4 (`@theme` in `globals.css`) |
| | Framer Motion | ✅ installed and configured (`MotionConfig`, `components/motion/`) | ✅ already in use |
| | Lucide React | ✅ in use | ✅ in use |
| | Responsive design | ✅ checked in real Chrome at tablet and desktop sizes | ✅ |
| Routing (§3) | React Router DOM, protected routes, role-based navigation | ✅ `app/App.tsx`, `app/router/ProtectedRoute.tsx`, per-role `navigation.ts` | Custom history router (`src/routes/routes.ts`), see §5 |
| State (§4) | Zustand | ✅ `stores/sessionStore.ts` | not needed |
| | TanStack Query | ✅ `api/queryClient.ts`, provider in `app/providers/` | not needed (static site) |
| | React Context | ✅ `contexts/AuthContext.tsx`, `features/pos/context/cart.tsx`, Toast | ✅ |
| API (§5) | Axios, REST, JWT, refresh token | ✅ `api/httpClient.ts` | not needed (no backend calls) |
| | Env-based base URL (`https://api.sombill.com/api/v1`) | ✅ `VITE_API_BASE_URL` in `config/env.ts` / `.env.example` | n/a |
| Forms (§6) | React Hook Form + Zod | ✅ `schemas/schemas.ts` + feature forms | n/a |
| Data viz (§7) | Recharts, TanStack Table, date-fns | ✅ installed, for new modules (§4) | n/a |
| Real-time (§8) | Socket.IO client | ✅ `api/socket.ts`, `hooks/useSocketEvent.ts` | n/a |
| Quality (§13) | ESLint | ✅ 0 warnings, Prettier-compatible | ⏳ blocked: `typescript-eslint` supports TypeScript < 6.1, and the website uses TS 7. Type safety is enforced by `tsc`. Add ESLint when `typescript-eslint` supports TS 7 |
| | Prettier | ✅ shared config `frontend/.prettierrc.json`, whole codebase formatted | ✅ same config, whole codebase formatted |

Installed versions (dashboards): framer-motion 14, zustand 5, @tanstack/react-query 5, @tanstack/react-table 9,
axios 1, socket.io-client 4, recharts 3, date-fns 4, prettier 3, eslint-config-prettier 10. All declare React 18 support.

### 2. How the API layer works

```text
component ──▶ TanStack Query (useQuery / useMutation) ──▶ feature service function ──▶ httpClient (Axios)
                                                                                      │  Authorization: Bearer <access token>  (Zustand, memory only)
                                                                                      │  withCredentials: refresh-token cookie (httpOnly)
                                                                                      ▼
                                                                         VITE_API_BASE_URL  (e.g. https://api.sombill.com/api/v1)
```

- **Access token:** kept in memory in the Zustand `sessionStore`, never in localStorage.
- **Refresh token:** expected as an **httpOnly cookie** set by the API Gateway, sent with `withCredentials`.
- **401 handling:** the client calls `POST {VITE_API_REFRESH_PATH}` (default `/auth/refresh`) once, even when several
  requests fail together, then retries them. It reads the gateway's `{ data: { accessToken } }` envelope (bare `{ accessToken }` / `{ access_token }` also accepted).
- **Refresh failure:** the session is marked expired, `sombill:session-expired` fires, and `AppProviders` clears the
  TanStack Query cache so no stale data stays on screen.
- **Errors:** every failure becomes an `ApiError { message, status, code, details }`. TanStack Query does not retry 4xx
  errors and retries server or network errors twice.
- Requests that must not refresh (login) pass `{ skipAuthRefresh: true }`.

These choices follow the brief (§5, §12) and match the backend's identity service (`documentation/api/api-documentation.md`):
refresh at `POST /auth/refresh`, httpOnly `sombill_rt` cookie, `{ data: { accessToken } }` response.

**Pattern for a new feature:**

```ts
// src/features/kitchen/services/kitchenApi.ts
import { httpClient } from '@/api/httpClient';
export const fetchTickets = (restaurantId: string) =>
  httpClient.get<KitchenTicket[]>(`/restaurants/${restaurantId}/kitchen/tickets`).then((r) => r.data);

// src/features/kitchen/hooks/useTickets.ts
import { useQuery } from '@tanstack/react-query';
export const useTickets = (restaurantId: string) =>
  useQuery({ queryKey: ['kitchen', 'tickets', restaurantId], queryFn: () => fetchTickets(restaurantId) });
```

### 3. Real-time (Socket.IO)

`api/socket.ts` creates one shared socket that does not connect on its own (`connectSocket(restaurantId)` connects
and joins the restaurant room). It sends the current access token on every (re)connect, so a refreshed token is picked
up. Events are typed:

| Event | Brief §8 item |
| --- | --- |
| `order:created` | New restaurant orders |
| `order:status` | Kitchen order statuses |
| `table:status` | Table availability |
| `payment:updated` | Payment updates |
| `notification` | Important notifications |

Room, reservation and housekeeping events are not included, because hotel management is out of scope. Components
subscribe with `useSocketEvent('order:created', handler)` and usually invalidate a TanStack Query key in the handler.

The current Manager, Waiter and Cashier screens use **Supabase Realtime** (`hooks/useRealtime.ts`). It stays in place
until the backend decision is made, so nothing that works today was switched off.

### 4. What is wired now and what is ready for new modules

| Piece | Status |
| --- | --- |
| TanStack Query provider, Framer Motion config, session-expiry handling | Wired into `main.tsx` for the whole app |
| Axios client, Socket.IO client, session store | Built and unit-tested (11 tests). Used by new modules once the API Gateway exists |
| Recharts, TanStack Table, date-fns | Installed. Existing screens keep their working in-house `BarChart`, `DataTable` and `dates.ts` (brief §14: don't rebuild working pages). New modules (Kitchen, Inventory, HR, Finance) use these libraries |
| Existing screens (Manager 13 modules, Waiter 9, Cashier 10) | Unchanged in behaviour. Still on Supabase |

### 5. Decisions

1. **Supabase stays the live backend for existing screens** until the backend stack is defined. Replacing it before
   then would break every working screen without a target to move to.
2. **The website keeps its custom router.** It is a static marketing site whose router already handles deep links
   (`/product/:slug`, `/pricing`, …). Moving to React Router would mean rewriting the 52 KB layout for no user-visible
   gain (brief §14.3). Authentication pages for staff live in the dashboards app (`/login`, `/reset-password`).
3. **No `any`:** the ESLint rule `no-explicit-any: error` stays on, and all new code passes it.
4. **Prettier formatted the entire codebase once.** Afterwards both production builds were compared with the
   pre-format builds. The only differences are how JSX text is split into string literals (e.g. `"due "` vs
   `"due", " "`), which renders identical text. CSS output is byte-identical.

## SomBill Website Architecture & Module Guide

### 1. Entry & State Ownership
- `src/main.tsx`: Mounts React root and imports `src/styles/globals.css`.
- `src/App.tsx`: Owns top-level website preferences (`darkMode = false` default Light Mode, `lang = 'en' | 'so'`, `exchangeRate = 11801`, toast feedback) and renders `<SomBillWebsite />` + `<ChatBotWidget />`.

### 2. Routing & Navigation (`src/routes/routes.ts`, `src/layouts/SomBillWebsite.tsx`)
- `SomBillWebsite` manages active `WebsitePageRoute` state (`home`, `pricing`, `product`, `solution`, `resource`, `company`), syncs browser URL via `window.history.replaceState`, and broadcasts `sombill-route-change` events so `ChatBotWidget` serves page-aware suggestion chips.
- Custom event `sombill-ai-navigate` allows in-chat links (`/pricing`, `/contact`, `/demo`, `/`) and CTA actions to trigger smooth SPA transitions without reloading.

### 3. Page Modules (`src/pages/`)
- `Home/HomePage.tsx`: Hero with 5-device 3D showcase, Dual POS+KDS Simulator (`#live-simulator`), 6-pillar & 13-module showcase, Interactive NFC Phone Simulator, Dual-Currency ROI Calculator, industry solutions grid, Horn of Africa trust venues, pricing teaser, and Glass FAQ accordion.
- `Products/ProductDetailPage.tsx`: Dynamic spec-driven landing pages for all 13 `PRODUCT_PAGES` slugs.
- `Solutions/SolutionDetailPage.tsx`: Industry blueprints for all 7 `SOLUTION_PAGES` slugs.
- `Pricing/PricingPage.tsx`: Pricing tiers, currency switcher (`USD` / `SLSH`), multi-branch terminal cost estimator, comparison matrix, and setup FAQs.
- `Resources/ResourceDetailPage.tsx`: Interactive Blog reader, Help Center, Documentation chapters, Video Tutorials showcase, Case Studies, and Product Updates.
- `Company/CompanyDetailPage.tsx`: About Us, Why SomBill, Contact form, Partner Network, Careers, and Partner Commission calculator.

### 4. Shared Design System & Simulators (`src/components/`, `src/styles/`)
- `components/ui/PremiumPrimitives.tsx`: Scroll progress bar, particles, typewriter, animated counters, section headers, and the 8 SomBill card archetypes.
- `components/sections/HeroEcosystemShowcase.tsx`: Interactive 5-device 3D composition.
- `components/sections/WebsiteInteractiveSimulators.tsx`: Interactive Dual POS+KDS, NFC Phone, and ROI Calculator components.
- `components/footer/`: Standalone `Footer.jsx` + `CompanyModal.jsx` and scoped `.pf-*` / `.cm-*` stylesheets.
- `components/chatbot/`: Standalone `ChatBotWidget.jsx`, `useChatBot.js`, `chatData.js`, and scoped `.lcb-*` stylesheet.
- `styles/globals.css`: Tailwind CSS v4 `@theme` design tokens, typography helpers, light/dark theme overrides, navbar/mega-menu CSS, and hero effects.

## SomBill design system: "Obsidian Ruby"

Dark, glassy, flame-gradient look used by the **Manager dashboard**. Waiter, Cashier and the sign-in pages keep their
current light look until they opt in.

### How it is wired
| Piece | Where | Purpose |
|---|---|---|
| Tokens | `frontend/packages/shared-ui/src/styles/design-system/tokens.css` | `--sb-*` CSS variables (colours, gradients, fonts, shell metrics, text levels, status colours) |
| Motion | `.../motion.css` | Keyframes; every animation is switched off under `prefers-reduced-motion` |
| Theme | `.../obsidian.css` | Restyles shared components and remaps the old light utility classes. Active only under `<html data-sb-theme="obsidian">` and only on screen (`@media screen`), so printouts stay black on white |
| Shell | `.../shell.css` | Sidebar, topbar, command palette, popover, footer (`sb-*` and `df-*` classes) |
| Light theme | `.../light.css` | Light shell colours (the default) plus light polish for cards, buttons and tables. Active under `<html data-sb-theme="light">`, screen only |
| Switch | `packages/shared-hooks/src/useSbTheme.ts` | `useSbTheme()` returns `{ mode, setMode, toggle }`. Default is **light**; the choice is saved in `localStorage` (`sombill.theme` = `light` or `dark`) and applied before first paint, so there is no flash. It sets `data-sb-theme` to `light` or `obsidian` on `<html>` while the layout is mounted and removes it on unmount. Because it lives on `<html>`, portalled UI (modals, toasts, popovers) is themed too |
| Toggle | `packages/shared-ui/src/shell/ThemeToggle.tsx` | Sun/moon button in the topbar (`aria-label="Dark mode"`, `aria-pressed`). The Ctrl/⌘+K palette also has an "Appearance" entry |
| POS skin | `.../pos.css` | 54px POS topbar (56px with a dock), bottom status bar, menu tiles, ticket panel, totals, payment buttons, Waiter table cards, kitchen ribbons, floating dock, offline banner. Same rules in both themes; only the `--pos-*` variables change. Active under `.pos-root` |
| Shell components | `packages/shared-ui/src/shell/` | `ShellSidebar`, `ShellTopbar`, `ShellFooter`, `CommandPalette`, `BrandMark`, `ShellClock`, `ConnectionBadge`, `ThemeToggle`, `PosTopbar`, `PosStatusBar`, `PosDock`, `OfflineBanner` |
| POS shell | `packages/shared-ui/src/pos/PosShell.tsx` | `themed` prop switches the shared POS shell to this design (Cashier and Waiter use it). `topbarExtra` and `statusBar` take app-specific content; `dock` adds the floating bottom dock below 1024px |

Shared UI (`Button`, `Badge`, `Modal`, `Toast`, `StatCard`) only gained `data-*` attributes (`data-variant`, `data-tone`,
`data-sb`, `data-kind`) that the theme styles. Without the theme attribute they look exactly as before.

### Using it in another app (Waiter, Cashier)
1. Call `const { mode, toggle } = useSbTheme()` in the layout and put `<ThemeToggle mode={mode} onToggle={toggle} />` in the topbar.
2. Reuse `ShellSidebar`, `ShellTopbar`, `ShellFooter` with that app's nav items.
3. Add a `group` to each nav item if you want section headings.
4. Check pages in a browser (`e2e/manager-shots.mjs` is a template): any hard-coded light colour that the theme does not
   remap will show up there.

### Rules
- Text on dark uses `--sb-text-1 … --sb-text-5`. White text below 50% opacity is not allowed (a test enforces this and
  checks WCAG AA contrast for every text token and status pill).
- Metric cards (`.card-glass-archetype`) lift on hover. Panels and tables only glow, because lifting or scaling a full
  table shifts text and blurs it.
- `backdrop-filter` is used only where a surface overlaps other content (sidebar, topbar, dialogs, popovers, footer,
  KPI cards), not on every panel.
- Numbers use JetBrains Mono (tabular), everything else Outfit. Both are self-hosted through Fontsource.

### Review tools
- `node e2e/manager-shots.mjs <baseUrl> <chrome> <outDir>` screenshots all 13 Manager pages against stubbed data
  (build first with `vite build --outDir dist-e2e --mode e2e` and serve it with `vite preview`).
  `FULL=1` adds full-page shots, `ONLY=orders,tables` limits pages.

### POS terminals (Cashier and Waiter)
- Pass `themed` to `PosShell` (plus `topbarExtra` and `statusBar` if the app has them). That turns on the light/dark
  theme, the floating sidebar with count badges, the 54px topbar and the status bar.
- Styling hooks are `data-*` attributes (`data-sb="product-card"`, `cat-chip`, `dining-tab`, `ticket-row`, `stepper`,
  `totals`, `grand-total`, `pay-method` + `data-method`, `quick-bill`, `change-due`). `ProductCard` and `CatChip` are
  shared with the Waiter, so both apps get the same tiles. Waiter-only hooks: `table-card` + `data-state` (`available`, `occupied`, `bill_requested`, `payment_pending`, `cleaning`) and `data-shape`, `status-pill`, `table-no/timer/total`, `kitchen-ticket` + `data-state`, `seg`/`seg-btn`.
- The on-screen receipt preview (`.receipt`) stays white paper in dark mode. Printing is never themed.

### Super Admin / Group HQ
Uses the same shell (`ShellSidebar` with `crown`, `ShellTopbar` `actions`, `ShellFooter` `extra`) and the same light default with
a dark switch. Its own tokens and classes live in `styles/design-system/superadmin.css`: `--sa-*` colours, `.sa-kpi`,
`.sa-branch`, `.sa-gauge`, `.sa-table`, `.sa-stat`, `.sa-seg`, chart tooltip and legend. Topbar items fold away below 1536 px
(pills, clock, search text, Broadcast label), 1280 px (user text) and 768 px (connection badge) so the bar never overflows.
Charts read `--sa-axis` and `--sa-grid`. See `documentation/project/SUPER_ADMIN_REPORT.md`.
