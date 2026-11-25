# SomBill

**Restaurant POS and Hospitality OS · SomLink Technology · Hargeisa, Somaliland**

SomBill has two frontend applications and a backend:

| Part | Folder | What it is | Stack |
|---|---|---|---|
| Public website | `frontend/apps/website/` | Marketing site: product, solution, pricing, resources and company pages, interactive simulators, chatbot | React 19, Vite 8, Tailwind CSS 4, TypeScript 7 |
| Dashboards | `frontend/apps/dashboards/` (shell) + `frontend/apps/{manager,waiter,cashier,super-admin}` + `frontend/packages/` | One app holding the **Manager** dashboard, **Waiter POS**, **Cashier POS** and the **Super Admin (Group HQ)** dashboard. After sign-in, `/` sends each person to the app for their role | React 18, Vite 5, Tailwind CSS 3, TypeScript 5.6, Supabase JS |
| Backend: gateway + main API | `backend/apps/`, `backend/packages/` | API Gateway and one main API with identity and organization modules (Phases 1–2 of the backend plan); RabbitMQ events, transactional outbox | Node.js 22, Express 5, TypeScript, PostgreSQL 16 + Prisma 7, Redis, RabbitMQ, pnpm workspace |
| Backend: current (live) | `database/supabase/` | Supabase schema, row-level security, business-logic SQL functions, `manage-staff` Edge Function, 303 SQL tests. Serves today's dashboards until the microservices reach parity | PostgreSQL 16, Supabase, Deno |

Today the dashboards talk to Supabase directly (authorization in the database through RLS and `SECURITY DEFINER`
functions). The new Node backend is being built in phases behind an API Gateway at `/api/v1`, and the dashboards
already contain its client (Axios + JWT refresh, TanStack Query, Socket.IO). Screens move over as each service reaches
parity. The website is static and makes no backend calls. Backend details: [`backend/README.md`](backend/README.md).

## Folder structure

```text
SomBill/
├── frontend/                     npm workspace (dashboards + packages); the website is a standalone app inside it
│   ├── README.md                 How apps/ and packages/ relate, import rules, commands
│   ├── package.json              Workspace root (apps/dashboards, apps/manager, cashier, waiter, super-admin, packages/*)
│   ├── tsconfig.base.json        Shared compiler options and the @sombill/* path aliases
│   ├── eslint.config.js          One ESLint config for apps + packages, with import-boundary rules
│   ├── apps/
│   │   ├── website/              Public website (independent Vite app: React 19, Tailwind 4)
│   │   ├── dashboards/           Dashboards shell: entry point, routes, role guards, sign-in, e2e, Vite/Tailwind/test config
│   │   ├── manager/              Manager dashboard (13 modules): pages/, components/, layouts/, __tests__/
│   │   ├── cashier/              Cashier POS: pages/, components/, hooks/, services/, features/, layouts/
│   │   ├── waiter/               Waiter POS: pages/, layouts/
│   │   └── super-admin/          Super Admin / Group HQ: pages/, components/, hooks/, services/, features/, layouts/, styles/
│   └── packages/
│       ├── shared-ui/            UI kit (ui/), shell, motion, POS building blocks, design-system CSS
│       ├── shared-hooks/         useQuery, useRealtime, useSbTheme, AuthContext, POS cart
│       ├── shared-utils/         format, dates, csv, reports, cn, POS rules, testing/ (test helpers)
│       ├── shared-types/         database row types, zod schemas
│       ├── api-client/           Supabase client, Axios, Socket.IO, TanStack Query client, session store, data access
│       └── shared-config/        typed env variables, default settings
├── backend/                      pnpm workspace
│   ├── apps/
│   │   ├── api-gateway/          Public entry: src/{config,middleware,routes,proxies,security}, app.ts, server.ts (security headers, CORS, Redis rate limits, JWT check, routing, Swagger)
│   │   └── main-api/             src/{modules,middleware,config,routes,events,jobs,websocket,utils}, app.ts, server.ts (identity + organization modules)
│   ├── packages/                 database (Prisma), authentication, authorization, validation, logger, cache, messaging, email, storage, shared-types, shared-utils
│   └── tests/                    e2e/ (through the gateway) and support/ (test helpers)
├── infrastructure/               docker/ (backend + frontend Dockerfiles), nginx/, deployment/{development,staging,production}, postgres/, redis/, rabbitmq/, monitoring/, secrets/ (git-ignored)
├── database/                     prisma/ (schemas, migrations, seed/), backups/, documentation/ (schema, relationships, data dictionary), supabase/ (current live backend)
├── tests/                        Index of every test suite and how to run it (README.md); home for cross-project tests
├── documentation/
│   ├── architecture/             system-, frontend- and backend-architecture.md
│   ├── api/                      api-documentation.md
│   ├── database/                 database-design.md
│   ├── security/                 security-guidelines.md
│   ├── deployment/               deployment-guide.md
│   ├── user-guides/              super-admin, manager, cashier and waiter guides
│   ├── project/                  PROJECT_STATUS.md, reports, dashboards/ (module specs, test reports), history/ (archive/ = local backups)
│   └── README.md                 index of every document
├── scripts/                      verify-all.sh (every quality gate), generate-jwt-keys.sh
├── .github/workflows/            backend-ci.yml, frontend-ci.yml (GitHub requires this location)
├── .env.example                  Every environment variable in one place (documentation only)
├── .gitignore
├── docker-compose.yml            `docker compose up` from the root (includes infrastructure/deployment/development)
├── package.json                  Convenience scripts only (no dependencies, no workspaces)
├── LICENSE                       Placeholder proprietary notice: replace with your licence
└── README.md
```

## Requirements

- Node.js 22 or newer, npm 10, and pnpm 10 for the backend (`corepack enable`)
- Backend microservices: PostgreSQL 16, Redis 7 and RabbitMQ 3.13 (all provided by the Docker Compose stack)
- Current backend: a Supabase project, plus the Supabase CLI to apply migrations and deploy the Edge Function
- For `npm run test:db`: PostgreSQL 16 server binaries (`initdb`, `pg_ctl`, `psql`), Linux or macOS
- For `npm run test:tablet`: Google Chrome or Chromium (`CHROME_PATH` to override)

## Installation

Each app has its own `package.json` and lockfile and is installed separately. They are deliberately not an npm
workspace: the website uses React 19 and the dashboards React 18, so hoisting shared dependencies would break one of them.

```bash
npm run install:all          # npm ci in both frontends, pnpm install in backend
```

Or install each one yourself: `npm ci` in `frontend/apps/website` and in `frontend` (workspace), `pnpm install` in `backend`.

## Environment configuration

| App | File | Variables |
|---|---|---|
| Dashboards | `frontend/apps/dashboards/.env.local` (copy `.env.example`) | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (the **public anon key only**, never the service-role key); `VITE_API_BASE_URL` (e.g. `https://api.sombill.com/api/v1`), `VITE_API_REFRESH_PATH`, `VITE_API_TIMEOUT_MS`, `VITE_SOCKET_URL`, `VITE_SOCKET_PATH` |
| Website | `frontend/apps/website/.env.local` (copy `.env.example`, optional) | `VITE_SITE_URL`, `VITE_DEFAULT_THEME`, `VITE_DEFAULT_LANGUAGE`, `VITE_DEFAULT_EXCHANGE_RATE` |
| Edge Function | Supabase secrets (`supabase secrets set`) | `ALLOWED_ORIGINS` (e.g. `https://app.sombill.com,http://localhost:3000`); `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` come from the platform |

`frontend/apps/dashboards/.env.e2e` holds fake values used only by the offline tablet test. It contains no secrets.

## Development

```bash
npm run dev                  # website + all dashboards on http://localhost:3000 (one port)
npm run dev:backend          # gateway :4000, main API :4001
```

New backend setup: [`backend/README.md`](backend/README.md) and [`documentation/deployment/deployment-guide.md`](documentation/deployment/deployment-guide.md).
Current Supabase backend (inspect the existing database, apply the 7 migrations, deploy `manage-staff`, configure
Auth): [`database/supabase/README.md`](database/supabase/README.md).

## Build and quality gates

| Command (from the project root) | What it runs |
|---|---|
| `npm run build` | Production builds of the website, the dashboards and every backend package and service |
| `npm run typecheck` | `tsc` for website, dashboards and backend |
| `npm run lint` | ESLint on the dashboards and the backend (zero warnings allowed) |
| `npm run format` / `npm run format:check` | Prettier on website, dashboards and backend |
| `npm test` | Vitest: dashboards (200), current backend's Edge Function (9), new backend (65: unit, integration and end-to-end against real PostgreSQL, Redis, RabbitMQ) |
| `npm run test:db` | Applies all migrations to a throwaway PostgreSQL 16 twice, runs 303 SQL assertions and the concurrency tests |
| `npm run test:tablet` | Waiter and Cashier pages in real Chrome at tablet and desktop sizes, and the 80mm receipt PDF |
| `npm run verify` | All of the above except `test:tablet`, stopping at the first failure (`scripts/verify-all.sh`; `SKIP_DB=1`, `SKIP_SERVICES=1` to skip database-dependent steps) |

Each app's own `npm run …` scripts still work from inside its folder.

## How frontend and backend connect

- The dashboards create one Supabase client in `frontend/packages/api-client/src/supabase.ts` from
  `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Sessions are stored by Supabase Auth, and the JWT is attached to
  every request automatically.
- Reads and simple writes go through PostgREST on the tables. Every table has RLS enabled and forced.
- Money, stock, orders, refunds, shifts and receipts change only through SQL functions called with `supabase.rpc(…)`,
  e.g. `submit_waiter_order`, `record_payments`, `process_refund` and `close_cashier_shift`.
- Staff invitations and role changes go through the `manage-staff` Edge Function (`supabase.functions.invoke`). The
  service-role key stays on the server. CORS is controlled by `ALLOWED_ORIGINS`.
- Live updates use Supabase Realtime channels (`packages/shared-hooks/src/useRealtime.ts`). File uploads use Supabase Storage with
  restaurant-prefixed paths (`packages/api-client/src/storage.ts`).
- The restructure did not change any endpoint, table, function signature or response shape.

The full list of tables and functions is in [`database/supabase/README.md`](database/supabase/README.md).

**New API (`/api/v1` via the gateway):** the dashboards' Axios client (`packages/api-client/src/httpClient.ts`) sends the access token
as `Authorization: Bearer`, keeps it in memory only, and renews it through the httpOnly refresh cookie at
`POST /auth/refresh`. The contract is in [`documentation/api/api-documentation.md`](documentation/api/api-documentation.md).

## Documentation

- [`documentation/architecture/system-architecture.md`](documentation/architecture/system-architecture.md): structure and the reasoning behind it
- [`documentation/architecture/frontend-architecture.md`](documentation/architecture/frontend-architecture.md): frontend technology stack, API/real-time layer, what is wired and what is ready
- [`documentation/project/PROJECT_STATUS.md`](documentation/project/PROJECT_STATUS.md): what is done, what is verified, known limitations
- [`documentation/project/RESTRUCTURE_REPORT.md`](documentation/project/RESTRUCTURE_REPORT.md): every file move and config change in this restructure
- [`documentation/project/BACKEND_PHASE_1_2_REPORT.md`](documentation/project/BACKEND_PHASE_1_2_REPORT.md): backend phases 1–2: what was built, decisions, test results
- [`documentation/`](documentation/README.md): index of all documentation, including the user guides for each role
- [`documentation/project/dashboards/`](documentation/project/dashboards/): Manager, Waiter and Cashier module guides and test reports
