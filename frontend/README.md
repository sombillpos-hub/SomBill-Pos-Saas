# SomBill frontend

```text
frontend/
├── apps/
│   ├── website/        Public website (React 19, Vite 8, Tailwind 4). Standalone: its own node_modules and lockfile.
│   ├── dashboards/     Dashboards shell (React 18, Vite 5, Tailwind 3): entry point, router, role guards, sign-in, e2e, configs.
│   ├── manager/        Manager dashboard: pages/ (13 modules), components/, layouts/
│   ├── cashier/        Cashier POS: pages/, components/, hooks/, services/, features/, layouts/
│   ├── waiter/         Waiter POS: pages/, layouts/
│   └── super-admin/    Super Admin / Group HQ: pages/, components/, hooks/, services/, features/, layouts/, styles/
├── packages/
│   ├── shared-ui/      UI kit (ui/), shell/, motion/, pos/ (POS shell + product UI), styles/design-system/
│   ├── shared-hooks/   useQuery, useRealtime, useSocketEvent, useSbTheme, AuthContext, POS cart
│   ├── shared-utils/   format, dates, csv, reports, cn, POS rules, testing/ (test helpers)
│   ├── shared-types/   database row types, zod schemas, nav item type
│   ├── api-client/     Supabase client, Axios client, Socket.IO client, TanStack Query client, session store, data access
│   └── shared-config/  typed environment variables, default restaurant settings
├── package.json        npm workspace root and the frontend commands
├── tsconfig.base.json  compiler options + the @sombill/* path aliases
├── eslint.config.js    one ESLint config (zero warnings) with import-boundary rules
└── .prettierrc.json    one Prettier config for every app
```

## Setup (one command)

From the project root (Windows, macOS or Linux, Node.js 22+):

```bash
node scripts/setup-frontend.mjs          # npm ci for the dashboards workspace and the website, creates .env.local
cd frontend
npm run dev                              # http://localhost:3000 (website + sign-in + all dashboards)
```

`npm run dev` runs the website and the dashboards in one process on **one port, 3000** (`scripts/dev.mjs`). No other
port is opened: both Vite servers run in middleware mode and hot reload goes over port 3000 too. The dashboards'
modules are served under `/_app/`, so the two apps never mix files or styles. Pages: `/` (website), `/login`,
`/reset-password`, `/manager` (or `/dashboard`), `/waiter`, `/cashier`, `/super-admin`. Set `PORT` to use another port.

Put your Supabase URL and anon key in `apps/dashboards/.env.local` (the dashboards run on Supabase today). Add
`--build` to also run both production builds.

## How the pieces fit

- **`apps/dashboards` is the shell.** The Manager, Waiter, Cashier and Super Admin apps still share one sign-in, one
  Supabase session and one role-routing layer, exactly as before. The shell owns `main.tsx`, `App.tsx` (all routes),
  `ProtectedRoute` (role guards and the `/` redirect) and the sign-in feature, and mounts the four role apps. The four
  role folders hold only their own screens, so each one already has the layout you want when it is split into its own
  deployable app later (that step needs a decision about sign-in and role routing, and was left out on purpose).
- **Apps import packages, never each other.** `apps/manager` may import `@sombill/shared-*` and `@sombill/api-client`,
  not `@sombill/cashier`. Packages never import apps. ESLint enforces both (`no-restricted-imports`).
- **Package layering (lowest to highest):** `shared-types` → `shared-config` → `shared-utils` → `api-client` →
  `shared-hooks` → `shared-ui`. A package imports only from packages to its left. The one exception is
  `shared-utils/src/testing/`, which are test helpers and may import any package.
- **Imports use aliases, not packages to build.** `@sombill/<name>/<file>` points at `<folder>/src/<file>` through
  `tsconfig.base.json` (`paths`) and `apps/dashboards/vite.config.ts` (`resolve.alias`). Keep the two lists in sync.
  Inside the shell, `@/` still means `apps/dashboards/src/`. Packages are source-only: nothing is compiled or published.
- **Tests live next to the code** (`__tests__/` folders) and run together from the shell: `npm test` finds
  `apps/*/src/**/*.test.*` and `packages/*/src/**/*.test.*`.

## Why the website is not part of the workspace

The website and the dashboards run different major versions of React (19 vs 18), Tailwind (4 vs 3), Vite (8 vs 5) and
TypeScript. Putting them in one workspace would force one hoisted version of each and risk two copies of React. The
website therefore keeps its own `package.json`, lockfile and `node_modules` in `apps/website/`, and shares no code
with the dashboards (an import check found none that could be shared). The colours, tokens and components of the two
apps are different on purpose.

## Commands (run in `frontend/`)

| Command                                          | What it does                                                                                                |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `npm ci`                                         | Installs the workspace (dashboards shell, role apps, packages). The website: `npm ci --prefix apps/website` |
| `npm run dev`                                    | Website + dashboards together on http://localhost:3000 (one port)                                           |
| `npm run dev:dashboards` / `npm run dev:website` | One app alone, also on port 3000 (stop `npm run dev` first)                                                 |
| `npm run typecheck`                              | Website `tsc` + dashboards `tsc -b` (covers every app and package)                                          |
| `npm run lint`                                   | ESLint over `apps/` and `packages/`, zero warnings, import boundaries                                       |
| `npm test`                                       | Vitest: 24 files, 299 tests                                                                                 |
| `npm run build`                                  | Website and dashboards production builds                                                                    |
| `npm run test:tablet`                            | Real-Chrome checks (Waiter/Cashier tablet, Super Admin HQ, sign-in); `CHROME_PATH` overrides the browser    |
| `npm run format` / `npm run format:check`        | Prettier                                                                                                    |

The technology stack and where each library lives are described in
[`documentation/architecture/frontend-architecture.md`](../documentation/architecture/frontend-architecture.md). The record of this
restructure, with the old-to-new path of every file, is
[`documentation/project/FRONTEND_APPS_REPORT.md`](../documentation/project/FRONTEND_APPS_REPORT.md).
