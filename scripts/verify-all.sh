#!/usr/bin/env bash
# Runs every SomBill quality gate from the project root and stops at the first failure.
# Usage: bash scripts/verify-all.sh                 (all gates)
#        SKIP_DB=1 bash scripts/verify-all.sh        (skip the Supabase SQL tests)
#        SKIP_SERVICES=1 bash scripts/verify-all.sh  (skip tests needing PostgreSQL/Redis/RabbitMQ)
# Install dependencies first: npm run install:all
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

step() { printf '\n\033[1m→ %s\033[0m\n' "$1"; }

# ---- Frontend --------------------------------------------------------------------------------------
step "Website: type-check";             npm --prefix frontend/apps/website run lint
step "Website: formatting (Prettier)";  npm --prefix frontend/apps/website run format:check
step "Website: production build";       npm --prefix frontend/apps/website run build
step "Dashboards: type-check";          npm --prefix frontend run typecheck:dashboards
step "Dashboards + packages: lint";      npm --prefix frontend run lint
step "Frontend: formatting (Prettier)";  npm --prefix frontend run format:check
step "Dashboards: tests";               npm --prefix frontend run test
step "Dashboards: production build";    npm --prefix frontend/apps/dashboards run build

# ---- Backend (pnpm workspace) ----------------------------------------------------------------------
# Backend tests need PostgreSQL 16, Redis and RabbitMQ on localhost
# (or TEST_DATABASE_ADMIN_URL / REDIS_URL / RABBITMQ_URL).
PNPM="corepack pnpm --dir backend"
step "Backend: formatting (Prettier)";  $PNPM format:check
step "Backend: lint";                   $PNPM lint
step "Backend: Prisma client";          $PNPM prisma:generate
step "Backend: type-check";             $PNPM typecheck
step "Database: current Supabase backend (Edge Function tests)"; npm --prefix database/supabase test
if [ "${SKIP_SERVICES:-0}" = "1" ]; then
  echo "(skipping microservice tests: SKIP_SERVICES=1)"
else
  step "Backend: gateway, main API and packages (unit, integration, end-to-end)"; $PNPM test
fi
step "Backend: build";                  $PNPM build
if [ "${SKIP_DB:-0}" = "1" ]; then
  echo "(skipping Supabase SQL tests: SKIP_DB=1)"
else
  step "Database: Supabase SQL tests (PostgreSQL 16)"
  bash database/supabase/tests/run_db_tests.sh
fi

printf '\n\033[1;32mALL GATES PASSED\033[0m\n'
