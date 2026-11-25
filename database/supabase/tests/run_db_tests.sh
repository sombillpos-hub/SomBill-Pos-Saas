#!/usr/bin/env bash
# Spins up a throwaway PostgreSQL 16 cluster, applies the Supabase shim +
# all migrations, then runs every supabase/tests/*.test.sql file.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin | sort -V | tail -1)}"
WORK="$(mktemp -d)"
PORT="${PGPORT_TEST:-55432}"
cleanup() { "$PGBIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT
"$PGBIN/initdb" -D "$WORK/data" -U postgres -A trust >/dev/null
"$PGBIN/pg_ctl" -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses=''" -l "$WORK/log" start >/dev/null
export PGOPTIONS="-c client_min_messages=warning"
PSQL=(psql -h "$WORK" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q -X)
"${PSQL[@]}" -c "create database sombill_test" >/dev/null
"${PSQL[@]}" -d sombill_test -f "$ROOT/supabase/tests/supabase_shim.sql"
for m in "$ROOT"/supabase/migrations/*.sql; do
  echo "→ applying $(basename "$m")"
  "${PSQL[@]}" -d sombill_test -f "$m"
done
echo "→ re-applying migrations (idempotency check)"
for m in "$ROOT"/supabase/migrations/*.sql; do "${PSQL[@]}" -d sombill_test -f "$m" >/dev/null; done
FAIL=0
for t in "$ROOT"/supabase/tests/*.test.sql; do
  echo "→ running $(basename "$t")"
  if ! "${PSQL[@]}" -d sombill_test -f "$t"; then FAIL=1; echo "✗ FAILED: $(basename "$t")"; fi
done
echo "→ running concurrency_payments.sh"
if ! bash "$ROOT/supabase/tests/concurrency_payments.sh" "${PSQL[@]}" -d sombill_test; then FAIL=1; fi
if [ "$FAIL" -ne 0 ]; then echo "DATABASE TESTS FAILED"; exit 1; fi
echo "ALL DATABASE TESTS PASSED"
