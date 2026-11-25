# System architecture

_Combined on 22 Nov 2026 from: ARCHITECTURE.md._


_22 Nov 2026. Written after a full inspection of every file, import and configuration in the project._

## 1. The system in one picture

```text
                 ┌────────────────────────┐
  Visitors ───▶  │ frontend/apps/website  │  static marketing site (no backend calls)
                 └────────────────────────┘

                 ┌────────────────────────┐   supabase-js (anon key + user JWT)
  Staff    ───▶  │ apps/dashboards (shell)│ ─────────────────────────────────────┐
  (manager,      │  src/app → role guard  │                                      ▼
   waiter,       │  manager waiter cashier│        ┌──────────────────────────────────────────┐
   cashier)      │  super-admin + packages│        │ database/supabase                          │
                 └────────────────────────┘        │  PostgREST (tables, RLS forced)           │
                                                   │  RPC (SECURITY DEFINER business logic)    │
                                                   │  Realtime · Storage · Auth                │
                                                   │  Edge Function manage-staff (service role)│
                                                   └──────────────────────────────────────────┘
```

## 2. Top level

| Folder | Holds | Why it is separate |
|---|---|---|
| `frontend/` | The browser applications (`apps/`) and the code they share (`packages/`) | Everything that ships to a browser, and nothing that holds privileges |
| `backend/` | The Supabase project: SQL, Edge Function, database tests | Everything that defines data, permissions and privileged operations. Deployed with the Supabase CLI, not with Vite |
| `documentation/` | Architecture, project status, restructure history, module guides, test reports | One place to look. Each app keeps only its own `README.md` |
| `scripts/` | `verify-all.sh` | Cross-project tooling that belongs to no single app |
| root files | `README.md`, `package.json` (scripts only), `.gitignore` | The entry point to the whole repository |

**Root folders added later:** `infrastructure/`, `database/` and `tests/` are index folders (README only) that point at where
the Docker, Nginx, Supabase and test files live today; see `project/ROOT_STRUCTURE_REPORT.md`. Inside `frontend/`, the
shared code the dashboards use lives in `frontend/packages/` (section 3.2). The website shares nothing with them.

## 3. Frontend

### 3.1 Two apps, not one and not four

| | Website | Dashboards |
|---|---|---|
| React | 19 | 18 |
| Vite | 8 | 5 |
| Tailwind | 4 (`@tailwindcss/vite`, `@theme` in CSS) | 3 (`tailwind.config.js`, PostCSS) |
| TypeScript | 7 | 5.6 |
| Routing | Custom `history.replaceState` router (`src/utils/routes.ts`) | React Router 6 with role guards |
| Data | Static content in `src/services/` | Supabase |

The stacks differ in every major dependency, so the two apps keep separate `package.json` files and lockfiles and are
**not** an npm workspace, which would hoist one React version over the other. The root `package.json` only forwards
commands with `npm --prefix`.

The Manager, Waiter and Cashier dashboards stay **one** app because they share sign-in, session, role routing and
about 40 shared modules, and a manager uses all three. Splitting them would duplicate that code or need a library build,
and would break the `/` role redirect.

### 3.2 Inside `frontend/apps/` and `frontend/packages/`

```text
apps/dashboards/src/app/        main.tsx, App.tsx (all routes), providers/, router/ (role guards)
apps/dashboards/src/features/   auth/ (sign-in)
apps/{manager,cashier,waiter,super-admin}/src/   pages/ components/ layouts/ hooks/ services/ features/ styles/ __tests__/
packages/shared-ui/             ui/ shell/ motion/ pos/ styles/design-system/
packages/shared-hooks/          useQuery, useRealtime, useSbTheme, AuthContext, POS cart
packages/shared-utils/          format, dates, csv, reports, POS rules, testing/
packages/shared-types/          row types, zod schemas
packages/api-client/            supabase, httpClient, socket, queryClient, sessionStore, data access
packages/shared-config/         env, settings
```

The dependency rules, enforced by ESLint (`no-restricted-imports`) and the layering below:

1. A dashboard imports from itself and from `@sombill/*` packages. **No dashboard imports another dashboard.**
2. Packages never import dashboards.
3. Package layering: `shared-types` → `shared-config` → `shared-utils` → `api-client` → `shared-hooks` → `shared-ui`.
4. Only `apps/dashboards` (the shell) imports every dashboard.
5. Imports use `@sombill/<package>/<file>` aliases (tsconfig `paths` + Vite `resolve.alias`); inside the shell `@/` is its own `src/`.

See `frontend/README.md` for the workspace set-up and `project/FRONTEND_APPS_REPORT.md` for the old-to-new path of every file.

### 3.3 Inside `frontend/apps/website/`

A standard Vite `src/` layout: `pages/<Area>/` (Home, Products, Solutions, Pricing, Resources, Company), `layouts/`
(navbar and mega-menu shell), `components/ui/` (premium primitives), `sections/` (hero showcase, simulators),
`components/footer/` and `components/chatbot/` (self-contained, with their own scoped CSS), `hooks/`, `services/`
(site config and content), `utils/` (currency, routes), `styles/`, `assets/`. It is not part of the npm workspace
(different React, Tailwind and Vite majors) and keeps its own lockfile.

## 4. Backend

`backend/` is a pnpm workspace with two parts that run side by side.

**New: Node.js microservices** (backend brief, phases 1–2 done). They follow the brief's layout:

```text
apps/api-gateway/                    public entry point
apps/services/<service>/             src/{config,modules,middleware,events,utils} app.ts server.ts · prisma/ · tests/ · Dockerfile
packages/{shared-types,shared-config,shared-utils,event-contracts}   (+ testing, dev only)
infrastructure/{docker,nginx} · scripts/ · docs/ · tests/e2e/
```

Each service owns one PostgreSQL database (Prisma), publishes events to RabbitMQ through a transactional outbox, and
verifies RS256 JWTs issued by the identity service. Full design: `documentation/architecture/backend-architecture.md`.

**Current: Supabase** (`database/supabase/`, workspace package `@sombill/supabase-legacy`). It serves today's dashboards
until the microservices reach parity. Its "layers" are database objects:

| Layer | Implementation |
|---|---|
| Schema / models | Tables, enums and constraints in migrations 000001, 000004 and 000006 |
| Business logic | SQL functions and triggers in 000002, 000005 and 000007. Money and stock change only through recorded movements |
| Authorization | RLS on every table, forced. Membership and role helpers. `SECURITY DEFINER` functions with explicit checks |
| Privileged ops | `functions/manage-staff`: logic in `handler.ts` (pure TypeScript, unit-tested), Deno wiring in `index.ts` |
| Tests | `supabase/tests/` (SQL plus concurrency, on real PostgreSQL 16, and `tests/functions/` with Vitest) |

`database/supabase/` keeps the layout the Supabase CLI expects (`migrations/`, `functions/<name>/`), so
`supabase db push` and `supabase functions deploy` work when run from `backend/`.

### Why the backend moved out of the dashboards folder

Before: `backend/` was empty and the whole database lived at `frontend/SomBill-Dashboards/supabase/`. The
frontend folder therefore held the security model, the migrations and a server-side function. The only code
coupling was one unit test (`manager/__tests__/manageStaff.test.ts`) importing `handler.ts` across that boundary.
The test moved with the code it tests, first to `backend/tests/functions/` and then, when `backend/` became a pnpm
workspace, to `database/supabase/tests/functions/manage-staff.test.ts`.

## 5. Documentation

| Folder | Contents |
|---|---|
| `documentation/architecture/` | This file and `FRONTEND_STACK.md` (technology stack, API and real-time layer) |
| `documentation/project/` | `PROJECT_STATUS.md` (living status), `RESTRUCTURE_REPORT.md` (this restructure), `history/` (earlier reports, kept verbatim) |
| `documentation/project/dashboards/` | `MANAGER_` / `WAITER_` / `CASHIER_` `MODULES.md` and `TEST_REPORT.md` |
| `documentation/architecture/` | `WEBSITE_ARCHITECTURE.md` |

The module guides and test reports were written before the move to `src/`. Their path note at the top maps the old
paths to the layout of that time (`frontend/dashboards/src/`; today see `project/FRONTEND_APPS_REPORT.md`). Each one starts with a
note saying so, and its `supabase/…` references now read `database/supabase/…`.

## 6. Conventions kept

- Existing names were kept: page and component file names, `__tests__/` folders, the `@/` alias, migration
  filenames (timestamps fix their order) and the Edge Function name (it is the deployed URL).
- The app folders were renamed `SomBill-Website` → `website` and `SomBill-Dashboards` → `dashboards`. The parent
  folder already says "frontend", and nothing referenced the old names except documentation, which was updated.

## Decision: Node backend is the system of record (23 Nov 2026)

The Node.js backend (`backend/`: API gateway + main API, PostgreSQL/Prisma, Redis, RabbitMQ) is the target platform for
all SomBill features. Supabase (`database/supabase`) stays live for the current dashboards until each module is ported
to the main API; dashboard pages then switch from `supabase-js` to `@sombill/api-client`, module by module. Details and
the port order: `documentation/project/PHASE_2_BACKEND_FOUNDATION_REPORT.md`; the reasoning and options:
`documentation/project/PHASE_0_AUDIT_REPORT.md` §12.
