# tests/

Index of every automated check in the project. Run all of them from the project root with `npm run verify`
(`bash scripts/verify-all.sh`).

| Suite | Where it lives | Run with |
| --- | --- | --- |
| Frontend unit and component tests (Vitest) | `frontend/apps/*/src/**/__tests__/`, `frontend/packages/*/src/**/__tests__/` | `npm test` |
| Dashboards real-Chrome layout checks (tablet, HQ, login) | `frontend/apps/dashboards/e2e/` | `npm run test:tablet` |
| Supabase SQL tests (PostgreSQL 16) | `database/supabase/tests/` | `npm run test:db` |
| Supabase Edge Function tests | `database/supabase/tests/functions/` | `npm run test:legacy` |
| Gateway, main API and package tests | `backend/apps/*/tests/`, `backend/packages/*/tests/` | `corepack pnpm --dir backend test` |
| End-to-end tests through the gateway | `backend/tests/e2e/` | `corepack pnpm --dir backend test` |

Unit tests stay next to the code they test (that is how Vitest and the CI resolve them), so they are not copied here.
Put new cross-project tests (full-stack smoke tests, load tests, accessibility sweeps) in this folder.
