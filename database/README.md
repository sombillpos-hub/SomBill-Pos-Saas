# database/

Everything about SomBill's data layer.

```text
database/
├── prisma/
│   ├── schema.prisma            identity module (users, roles, permissions, memberships, sessions, audit)
│   ├── organization.prisma      organization module (organizations, branches, settings, subscriptions, audit)
│   ├── migrations/
│   │   ├── identity/            applied to sombill_identity
│   │   └── organization/        applied to sombill_organization
│   └── seed/
│       ├── admin.seed.ts        first account (SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD)
│       ├── roles.seed.ts        system roles + their permissions
│       ├── permissions.seed.ts  permission catalogue
│       ├── restaurants.seed.ts  demo restaurant (organization, trial subscription, MAIN branch)
│       ├── demo-data.seed.ts    demo staff: manager, cashier, waiter, kitchen (never in production)
│       └── index.ts             runs them in order
├── backups/                     local pg_dump files (git-ignored)
├── documentation/
│   ├── database-schema.md       databases, tables, conventions
│   ├── relationships.md         foreign keys + links between databases (with ER diagram)
│   └── data-dictionary.md       every column
├── supabase/                    current live backend (migrations, RLS, Edge Function, SQL tests)
└── README.md
```

## Commands (run in `backend/`)

| Command                                    | What it does                                                                       |
| ------------------------------------------ | ---------------------------------------------------------------------------------- |
| `pnpm prisma:generate`                     | generates both clients into `backend/packages/database/src/<module>/generated`     |
| `pnpm db:migrate`                          | applies `prisma/migrations/identity` and `.../organization` to their databases     |
| `pnpm db:seed`                             | runs `prisma/seed/index.ts` with `apps/main-api/.env` (idempotent: safe to repeat) |
| `pnpm --filter @sombill/database db:check` | proves the migrations match the schemas (needs the `*_SHADOW_DATABASE_URL` vars)   |

Seed variables: `SEED_ADMIN_EMAIL` (default `admin@sombill.local`), `SEED_ADMIN_PASSWORD` (12+ characters, required to
create the admin), `SEED_ADMIN_NAME`, `SEED_RESTAURANT_NAME`, `SEED_RESTAURANT_SLUG`, `SEED_DEMO_PASSWORD` (demo staff
are skipped when unset). The admin becomes the restaurant's owner when the main API runs and delivers the
`organization.created` event.

## Why two schema files

Each module has its **own PostgreSQL database** (least-privilege roles per module, see
`infrastructure/postgres/init/`). Prisma allows one database per schema file, so `schema.prisma` is the identity
(main) database and `organization.prisma` is the organization database. New modules either add a schema file next to
these or, if they share a database, add models to an existing one.

## Current live database (Supabase)

`supabase/` is what the dashboards use today: migrations (`2026…_*.sql`), RLS, business-logic SQL functions, the
`manage-staff` Edge Function and the SQL test suite. From the project root: `npm run test:db` (SQL tests) and
`npm run test:legacy` (Edge Function tests). Details: [`supabase/README.md`](supabase/README.md).
