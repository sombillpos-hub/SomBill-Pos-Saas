# SomBill Dashboards shell (`frontend/apps/dashboards/`)

**SomBill Restaurant POS · SomLink Technology · Trusted Hospitality Partner · Hargeisa, Somaliland**

This folder is the shell of the SomBill dashboards (**Manager**, **Waiter**, **Cashier** and **Super Admin**): the entry
point, the routes, the role guards and the sign-in. The dashboards themselves live in `../manager`, `../waiter`,
`../cashier` and `../super-admin`, and the shared code in `../../packages/` (see [`../../README.md`](../../README.md)).
Together they are one React application. The database, RLS and Edge Function it
talks to live in [`../../backend/`](../../../backend/README.md); the module guides and test reports live in
[`../../documentation/project/dashboards/`](../../../documentation/project/dashboards/).
After sign-in, `/` sends each person to the dashboard for their role:

| Dashboard       | Routes                              | Who                   | Sections                                                                                                                                      |
| --------------- | ----------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Manager**     | `/dashboard`, `/orders`, `/menu`, … | manager               | 13 modules: dashboard, orders, menu, categories, tables, staff, customers, inventory, suppliers, purchase orders, expenses, reports, settings |
| **Waiter POS**  | `/waiter/*`                         | waiter (and manager)  | 9 sections: dashboard, tables, new order, my orders, menu, kitchen status, bills, notifications, profile                                      |
| **Cashier POS** | `/cashier/*`, `/cashier-print/*`    | cashier (and manager) | 10 sections: dashboard, new sale, active orders, bills, payment processing, transactions, receipts, refunds, shift management, profile        |

There is no other dashboard in the project. The **kitchen** role exists in the database (preparation-status rules)
but has no screen yet; kitchen users see "Not available for your role".

## Folder structure

```text
frontend/apps/dashboards/        the shell (this folder)
├── index.html                   loads /src/app/main.tsx
├── public/branding/             static files served at / (put sombill-logo.png here)
├── e2e/                         real-Chrome checks: tablet layout, Super Admin HQ, sign-in, 80mm receipt
├── src/
│   ├── app/                     main.tsx, App.tsx (all routes, lazy-loaded), providers/, router/ProtectedRoute.tsx
│   ├── features/auth/           sign-in, reset password, restaurant setup, access denied (+ tests)
│   ├── pages/NotFoundPage.tsx
│   ├── styles/                  index.css (Tailwind base + component classes), auth.css (sign-in look)
│   └── vite-env.d.ts
└── package.json · vite.config.ts · tsconfig*.json · tailwind.config.js · postcss.config.js

frontend/apps/{manager,cashier,waiter,super-admin}/src/    one folder per dashboard
├── pages/ · components/ · layouts/ (AppLayout + navigation.ts) · hooks/ · services/ · features/ · styles/ · assets/
└── __tests__/

frontend/packages/<name>/src/    shared code (see ../../README.md for the list)
```

**Rules the structure follows**

- A dashboard imports from itself and from `@sombill/*` packages. **No dashboard imports another dashboard, and
  packages never import dashboards** (ESLint `no-restricted-imports`).
- Only this shell knows about every dashboard.
- In the shell, `@/` is `apps/dashboards/src/`. Everything else is `@sombill/<name>/<file>`.
- API logic stays out of components: pages call `services/` or `@sombill/api-client`, never `fetch` directly.
- Styling is Tailwind utility classes plus CSS under `packages/shared-ui/src/styles/design-system/`; the Super Admin and
  sign-in screens add `apps/super-admin/src/styles/superadmin.css` and `src/styles/auth.css`.

## Technology stack

| Area          | Technology                                                               | Where                                                                                                |
| ------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| UI            | React 18, TypeScript (strict), HTML5, CSS3                               | everywhere                                                                                           |
| Styling       | Tailwind CSS 3, Framer Motion, Lucide React                              | `tailwind.config.js`, `packages/shared-ui/src/motion/`, `styles/`                                    |
| Routing       | React Router DOM 6, protected and role-based routes                      | `app/App.tsx`, `app/router/ProtectedRoute.tsx`                                                       |
| Client state  | Zustand, React Context                                                   | `packages/api-client/src/sessionStore.ts`, `packages/shared-hooks/src/AuthContext.tsx`, `cart.tsx`   |
| Server state  | TanStack Query                                                           | `packages/api-client/src/queryClient.ts`, `src/app/providers/AppProviders.tsx`                       |
| API           | Axios, JWT access token + refresh token, REST                            | `packages/api-client/src/httpClient.ts`, `packages/shared-config/src/env.ts`                         |
| Backend today | Supabase JS (Auth, PostgREST, RPC, Realtime, Storage)                    | `packages/api-client/src/supabase.ts`, `packages/shared-hooks/src/AuthContext.tsx`, `useRealtime.ts` |
| Real-time     | Socket.IO client (API Gateway), Supabase Realtime (current screens)      | `packages/api-client/src/socket.ts`, `packages/shared-hooks/src/useSocketEvent.ts`                   |
| Forms         | React Hook Form + Zod                                                    | `packages/shared-types/src/schemas.ts`, dashboard pages                                              |
| Data          | Recharts, TanStack Table, date-fns                                       | installed for new modules (see `documentation/architecture/frontend-architecture.md`)                |
| Quality       | ESLint (0 warnings), Prettier, Vitest + Testing Library, Playwright-core | `eslint.config.js`, `../.prettierrc.json`                                                            |

The existing screens keep running on Supabase. The Axios, Socket.IO and TanStack Query layer is wired into the app and
tested, and it is ready for the SomBill API Gateway (`VITE_API_BASE_URL`). See
[`documentation/architecture/frontend-architecture.md`](../../../documentation/architecture/frontend-architecture.md).

## Security and access (unchanged)

Role checks happen in `src/app/router/ProtectedRoute.tsx` for navigation, and in the database for everything else (RLS on
every table, SECURITY DEFINER functions for orders, payments, refunds, shifts and receipts). The service-role key is
used only inside the `manage-staff` Edge Function and never in the frontend.

## Setup

1. **Install:** `npm install` in `frontend/` (workspace)
2. **Backend first.** Set up the Supabase database, migrations, `manage-staff` Edge Function and Auth settings as
   described in [`backend/README.md`](../../../backend/README.md).
3. **Environment:** copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (and the `VITE_API_*` / `VITE_SOCKET_*` values once the API Gateway is live).
   Never put the service-role key in the frontend.
4. **Logo:** put the official logo at `public/branding/sombill-logo.png`. Until then a text wordmark is shown.
5. **Run:** `npm run dev`

**First manager:** create the owner's user in Supabase Auth (Invite user). When they sign in, the app asks them to
create their restaurant, and they become its manager. They then invite waiters and cashiers from **Staff Management**.

## Scripts

| Command                                   | What it does                                                                                                                                               |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                             | Development server, dashboards alone (http://localhost:3000)                                                                                               |
| `npm run build`                           | Type-check (strict) and production build                                                                                                                   |
| `npm run typecheck`                       | TypeScript only                                                                                                                                            |
| `npm run lint`                            | (run in `frontend/`) ESLint over apps and packages, zero warnings                                                                                          |
| `npm run format` / `npm run format:check` | Prettier: write / verify formatting                                                                                                                        |
| `npm test`                                | Unit, component and workflow tests for every app and package (Vitest, 24 files, 299 tests)                                                                 |
| `npm run test:tablet`                     | Checks every Waiter and Cashier page in real Chrome at tablet and desktop sizes, and measures the 80mm receipt PDF (`CHROME_PATH` to override the browser) |

## Documentation

Module guides and test reports: [`documentation/project/dashboards/`](../../../documentation/project/dashboards/).
Project status and known limitations: [`documentation/project/PROJECT_STATUS.md`](../../../documentation/project/PROJECT_STATUS.md).
Database and staff function tests (`npm run test:db`, `npm test` in `backend/`): [`backend/README.md`](../../../backend/README.md).
