#!/usr/bin/env bash
# Real concurrency test: parallel database sessions released simultaneously by an
# advisory-lock barrier. Called by run_db_tests.sh with PSQL connection args.
set -euo pipefail
PSQL=("$@")
q() { "${PSQL[@]}" -tA -c "$1"; }

# --- fixtures (superuser) ---
q "insert into auth.users (id, email) values
   ('00000000-0000-0000-0000-0000000007a1','m@r7.test'),('00000000-0000-0000-0000-0000000007c1','ca@r7.test'),('00000000-0000-0000-0000-0000000007c2','cb@r7.test')" >/dev/null
as() { echo "set role authenticated; select set_config('request.jwt.claim.sub', '$1', false);"; }
M=00000000-0000-0000-0000-0000000007a1; CA=00000000-0000-0000-0000-0000000007c1; CB=00000000-0000-0000-0000-0000000007c2
R=$("${PSQL[@]}" -tA -c "$(as $M) select public.create_restaurant('Concurrency Café','USD','Africa/Mogadishu');" | tail -1)
q "insert into public.restaurant_members (restaurant_id,user_id,role) values ('$R','$CA','cashier'),('$R','$CB','cashier')" >/dev/null
P=$("${PSQL[@]}" -tA -c "$(as $M) insert into public.products (restaurant_id,name,price) values ('$R','Shaah',2.00) returning id;" | tail -1)
"${PSQL[@]}" -tA -c "$(as $CA) select public.open_cashier_shift('$R', 0);" >/dev/null
"${PSQL[@]}" -tA -c "$(as $CB) select public.open_cashier_shift('$R', 0);" >/dev/null
new_order() { "${PSQL[@]}" -tA -c "$(as $CA) select public.submit_pos_order('$R','takeaway',null,'[{\"product_id\":\"$P\",\"quantity\":5,\"unit_price\":2}]'::jsonb,null,null,null,0,null,gen_random_uuid()) ->> 'order_id';" | tail -1; }

barrier_run() { # $1 = number of workers, $2 = SQL generator function
  local n=$1 gen=$2 dir; dir=$(mktemp -d)
  "${PSQL[@]}" -tA -c "select pg_advisory_lock(777); select pg_sleep(1.5);" >/dev/null &
  local holder=$!; sleep 0.3
  for i in $(seq 1 "$n"); do
    ( "${PSQL[@]}" -tA -v ON_ERROR_STOP=1 -c "select pg_advisory_lock_shared(777);" -c "$($gen "$i")" >"$dir/$i.out" 2>"$dir/$i.err" && echo ok >"$dir/$i.status" || echo err >"$dir/$i.status" ) &
  done
  wait
  OK=$(cat "$dir"/*.status | grep -c ok || true); ERRS=$(cat "$dir"/*.err | grep -o 'ERROR:  [A-Z_]*' | sort | uniq -c | tr -s ' ' | tr '\n' ';' || true)
  rm -rf "$dir"
}
fail=0
check() { if [ "$1" = "$2" ]; then echo "  ok - $3"; else echo "  FAIL - $3 (got $1, want $2)"; fail=1; fi; }

echo "→ concurrency: 8 cashiers pay the full balance of one order at the same instant"
O1=$(new_order)
gen1() { local who=$CA; [ $(( $1 % 2 )) -eq 0 ] && who=$CB; echo "$(as $who) select public.record_payments('$O1','[{\"method\":\"cash\",\"amount\":10.00}]'::jsonb, gen_random_uuid(), false);"; }
barrier_run 8 gen1
check "$OK" "1" "exactly one payment succeeded (errors: $ERRS)"
check "$(q "select count(*) from public.payments where order_id='$O1'")" "1" "exactly one payment row"
check "$(q "select amount_paid || '/' || payment_status from public.orders where id='$O1'")" "10.00/paid" "order paid once, never overpaid"

echo "→ concurrency: the same submission (same idempotency key) sent 6 times at once"
O2=$(new_order); KEY=$(q "select gen_random_uuid()")
gen2() { echo "$(as $CA) select public.record_payments('$O2','[{\"method\":\"cash\",\"amount\":4.00}]'::jsonb, '$KEY', false) ->> 'duplicate';"; }
barrier_run 6 gen2
check "$OK" "6" "all 6 calls returned (one original, five duplicates)"
check "$(q "select count(*) from public.payments where order_id='$O2'")" "1" "only one payment row for the key"
check "$(q "select amount_paid from public.orders where id='$O2'")" "4.00" "amount recorded once"

echo "→ concurrency: 6 simultaneous full refunds of one transaction"
PAY=$(q "select id from public.payments where order_id='$O1'")
gen3() { echo "$(as $M) select public.process_refund('$PAY', 10.00, 'cash', 'Concurrent test', null, '[]'::jsonb, false, gen_random_uuid()) ->> 'status';"; }
barrier_run 6 gen3
check "$OK" "1" "exactly one refund succeeded (errors: $ERRS)"
check "$(q "select count(*) from public.refunds where payment_id='$PAY'")" "1" "one refund record"
check "$(q "select amount_refunded from public.orders where id='$O1'")" "10.00" "refunded exactly once"

if [ "$fail" -ne 0 ]; then echo "CONCURRENCY TESTS FAILED"; exit 1; fi
echo "CONCURRENCY TESTS PASSED"
