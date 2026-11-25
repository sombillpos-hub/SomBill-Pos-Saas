-- =====================================================================
-- SomBill Super Admin (group owner) – database tests with real records.
-- Owner = implicit manager of every branch; group-wide read models; central
-- menu push; broadcast; tax filing register; isolation between groups.
-- =====================================================================
\set ON_ERROR_STOP 1
set client_min_messages = warning;
\o /dev/null
reset role;
select count(*) as before_count from tests.results \gset

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000008a1', 'owner@hq.test',  '{"full_name":"Group Owner"}'),
  ('00000000-0000-0000-0000-0000000008b1', 'mgr-b@hq.test',  '{"full_name":"Berbera Manager"}'),
  ('00000000-0000-0000-0000-0000000008c1', 'waiter-a@hq.test','{"full_name":"Hargeisa Waiter"}'),
  ('00000000-0000-0000-0000-0000000008d1', 'cashier-a@hq.test','{"full_name":"Hargeisa Cashier"}'),
  ('00000000-0000-0000-0000-0000000009a1', 'rival@other.test','{"full_name":"Rival Owner"}');
\set OW '00000000-0000-0000-0000-0000000008a1'
\set MB '00000000-0000-0000-0000-0000000008b1'
\set WA '00000000-0000-0000-0000-0000000008c1'
\set CA '00000000-0000-0000-0000-0000000008d1'
\set RV '00000000-0000-0000-0000-0000000009a1'

set role authenticated;
-- The owner starts as the manager of the first branch, Hargeisa, then turns it into a group.
select set_config('request.jwt.claim.sub', :'OW', false);
select public.create_restaurant('Hargeisa Main', 'USD', 'Africa/Mogadishu') as ra \gset
select set_config('request.jwt.claim.sub', :'MB', false);
select public.create_restaurant('Berbera Marina', 'USD', 'Africa/Mogadishu') as rb \gset
select set_config('request.jwt.claim.sub', :'RV', false);
select public.create_restaurant('Rival Cafe', 'USD', 'Africa/Mogadishu') as rr \gset
reset role;
insert into public.restaurant_members (restaurant_id, user_id, role) values
  (:'ra', :'WA', 'waiter'), (:'ra', :'CA', 'cashier');
update public.restaurants set tax_rate = 0.05 where id in (:'ra', :'rb', :'rr');

set role authenticated;
select set_config('request.jwt.claim.sub', :'OW', false);
select public.create_organization('Horn Hospitality Group') as org \gset
select tests.ok((select organization_id from public.restaurants where id = :'ra') = :'org', 'create_organization links the branches the caller already manages');
select tests.ok((select organization_id from public.restaurants where id = :'rb') is null, 'branches managed by someone else are not linked');
select tests.throws($$select public.create_organization('Second Group')$$, 'already own', 'a person owns at most one organization');
select tests.ok(public.is_org_owner(:'org') and public.is_manager(:'ra') and public.member_role(:'ra') = 'manager', 'owner is an implicit manager of the linked branch');
select tests.ok(not public.is_manager(:'rb') and not public.is_member(:'rb'), 'owner has no access to a branch outside the group');

-- Platform operator attaches Berbera to the group (an owner cannot claim someone else's restaurant).
reset role;
update public.restaurants set organization_id = :'org' where id = :'rb';
update public.organizations set max_branches = 3 where id = :'org';
set role authenticated;
select set_config('request.jwt.claim.sub', :'OW', false);
select tests.ok(public.is_manager(:'rb') and (select count(*) from public.restaurants where organization_id = :'org') = 2, 'owner manages both branches after linking');
select tests.throws(format($$update public.restaurants set organization_id = null where id = %L$$, :'ra'), 'permission denied', 'owner cannot detach or move a branch by direct update');

-- Add a third branch through the function; the fourth hits the plan limit.
select public.org_create_branch(:'org', 'Burao Hub', 'USD', 'Africa/Mogadishu', 'Burao', '+252633000111', 0.05) as rc \gset
select tests.ok((select organization_id from public.restaurants where id = :'rc') = :'org' and public.is_manager(:'rc'), 'org_create_branch adds a branch owned by the group');
select tests.throws(format($$select public.org_create_branch(%L, 'Borama Majlis')$$, :'org'), 'BRANCH_LIMIT', 'plan branch limit is enforced');
select set_config('request.jwt.claim.sub', :'MB', false);
select tests.throws(format($$select public.org_create_branch(%L, 'Sneaky')$$, :'org'), 'FORBIDDEN', 'a branch manager cannot add branches to the group');

-- Real activity in Hargeisa: menu, an order, a cashier payment.
select set_config('request.jwt.claim.sub', :'OW', false);
insert into public.categories (restaurant_id, name) values (:'ra', 'Mains') returning id as cat \gset
insert into public.products (restaurant_id, category_id, name, price) values (:'ra', :'cat', 'Goat Meat', 10.00) returning id as pa \gset
insert into public.restaurant_tables (restaurant_id, table_number) values (:'ra', 1) returning id as ta \gset
insert into public.inventory_items (restaurant_id, name, unit, quantity, min_stock, unit_cost) values (:'ra', 'Rice', 'kg', 2, 10, 1.5);
select set_config('request.jwt.claim.sub', :'MB', false);
insert into public.categories (restaurant_id, name) values (:'rb', 'Mains') returning id as catb \gset
insert into public.products (restaurant_id, category_id, name, price) values (:'rb', :'catb', 'goat meat ', 12.00);

select set_config('request.jwt.claim.sub', :'WA', false);
select (public.submit_waiter_order(:'ra', :'ta', format('[{"product_id":"%s","quantity":2,"unit_price":10}]', :'pa')::jsonb, null, null, 3, gen_random_uuid()) ->> 'order_id') as o1 \gset
select set_config('request.jwt.claim.sub', :'CA', false);
select public.open_cashier_shift(:'ra', 50, null) as shift1 \gset
select public.record_payments(:'o1', '[{"method":"cash","amount":10.50,"amount_received":20},{"method":"zaad","amount":10,"reference":"ZAAD-1"}]'::jsonb, gen_random_uuid()) as pay1 \gset

-- Group read models
select set_config('request.jwt.claim.sub', :'OW', false);
select tests.ok((select orders_count = 1 and gross = 21.00 and tax = 1.00 and guests = 3 and open_orders = 1 and tables_total = 1 and tables_occupied = 1
                   and open_cashier_shifts = 1 and staff_active = 3
                   from public.org_branch_summary(:'org', now() - interval '1 day', now() + interval '1 day') where restaurant_id = :'ra'),
  'branch summary: orders, gross, tax, guests, occupancy, open shifts, staff');
select tests.ok((select count(*) from public.org_branch_summary(:'org', now() - interval '1 day', now() + interval '1 day')) = 3, 'branch summary lists all three branches');
select tests.ok((select sum(gross) from public.org_revenue_series(:'org', now() - interval '1 day', now() + interval '1 day', 'day')) = 21.00, 'revenue series sums to the branch total');
select tests.ok((select count(*) from public.org_revenue_series(:'org', now() - interval '1 day', now() + interval '1 day', 'hour')) = 1, 'hourly buckets work');
select tests.throws(format($$select * from public.org_revenue_series(%L, now() - interval '1 day', now(), 'week')$$, :'org'), 'Bucket', 'unknown bucket is rejected');
select tests.ok((select sum(amount) from public.org_payment_mix(:'org', now() - interval '1 day', now() + interval '1 day') where method = 'zaad' and kind = 'payment') is not null
                and (select sum(amount) from public.org_payment_mix(:'org', now() - interval '1 day', now() + interval '1 day') where method = 'cash' and kind = 'payment') = 10.50,
  'payment mix groups money by method');
select tests.ok((select low_stock = 1 and items = 1 from public.org_inventory_summary(:'org') where restaurant_id = :'ra'), 'inventory summary counts low stock');
select tests.ok((select count(*) from public.org_low_stock(:'org', 10) where name = 'Rice') = 1, 'low stock list names the item');

-- Isolation: another group (or a branch manager) sees nothing of the group read models
select set_config('request.jwt.claim.sub', :'RV', false);
select tests.throws(format($$select * from public.org_branch_summary(%L, now() - interval '1 day', now())$$, :'org'), 'FORBIDDEN', 'outsider cannot read group summary');
select tests.throws(format($$select * from public.org_menu_matrix(%L)$$, :'org'), 'FORBIDDEN', 'outsider cannot read the group menu');
select tests.ok((select count(*) from public.orders where restaurant_id = :'ra') = 0 and (select count(*) from public.organizations) = 0, 'outsider sees no orders and no organizations');
select set_config('request.jwt.claim.sub', :'MB', false);
select tests.throws(format($$select * from public.org_payment_mix(%L, now() - interval '1 day', now())$$, :'org'), 'FORBIDDEN', 'a branch manager is not a group owner');
select tests.throws(format($$select public.org_broadcast(%L, null, 'Hello')$$, :'org'), 'FORBIDDEN', 'a branch manager cannot broadcast group-wide');
select set_config('request.jwt.claim.sub', :'WA', false);
select tests.ok(not public.is_manager(:'ra'), 'staff roles are unchanged by the owner change');

-- Central menu push
select set_config('request.jwt.claim.sub', :'OW', false);
select tests.ok((select count(*) from public.org_menu_matrix(:'org') where lower(trim(name)) = 'goat meat') = 2, 'menu matrix lists the dish once per branch that has it');
select public.org_push_menu_item(:'org', 'Goat Meat', array[:'ra', :'rb', :'rc']::uuid[], 55.00, null, false, null) as push1 \gset
select tests.ok((select count(*) from jsonb_array_elements(:'push1'::jsonb) e where e ->> 'status' = 'updated') = 2
            and (select count(*) from jsonb_array_elements(:'push1'::jsonb) e where e ->> 'status' = 'missing') = 1, 'push updates matching dishes (case-insensitive) and reports missing ones');
select tests.ok((select price from public.products where id = :'pa') = 55.00
            and (select price from public.products where restaurant_id = :'rb' and lower(trim(name)) = 'goat meat') = 55.00, 'new price is live in both branches');
select tests.ok((select count(*) from public.audit_logs where action in ('menu_push', 'price_change') and restaurant_id = :'ra') >= 1, 'price change is audited');
select public.org_push_menu_item(:'org', 'Goat Meat', array[:'rc']::uuid[], 55.00, true, true, 'Mains') as push2 \gset
select tests.ok((select count(*) from public.products where restaurant_id = :'rc' and name = 'Goat Meat' and price = 55.00) = 1
            and (select count(*) from public.categories where restaurant_id = :'rc' and name = 'Mains') = 1, 'create_missing adds the dish and its category');
select tests.throws(format($$select public.org_push_menu_item(%L, 'Goat Meat', array[%L]::uuid[], 1)$$, :'org', :'rr'), 'does not belong', 'cannot push to a branch outside the group');
select tests.throws(format($$select public.org_push_menu_item(%L, 'Goat Meat', array[%L]::uuid[])$$, :'org', :'ra'), 'Nothing to push', 'a push must change something');
select tests.throws(format($$select public.org_push_menu_item(%L, 'Goat Meat', array[%L]::uuid[], -1)$$, :'org', :'ra'), 'out of range', 'negative price is rejected');

-- Broadcast
select tests.ok(public.org_broadcast(:'org', null, 'Fire drill at 15:00', 'All branches', null) = 4, 'broadcast reaches every active member of every branch');
select tests.ok(public.org_broadcast(:'org', :'ra', 'Cashiers: float check', null, array['cashier']::public.app_role[]) = 1, 'broadcast can target one branch and one role');
select tests.throws(format($$select public.org_broadcast(%L, %L, 'Hello all')$$, :'org', :'rr'), 'does not belong', 'broadcast to a foreign branch is rejected');
select tests.throws(format($$select public.org_broadcast(%L, null, 'x')$$, :'org'), 'Title must be', 'a broadcast needs a real title');
select set_config('request.jwt.claim.sub', :'WA', false);
select tests.ok((select count(*) from public.notifications where user_id = :'WA'::uuid and type = 'broadcast') = 1, 'the waiter receives the broadcast');
select set_config('request.jwt.claim.sub', :'OW', false);

-- Tax register
select tests.ok((select tax_collected = 1.00 and orders_count = 1 and filing_id is null
                   from public.org_tax_due(:'org', (now() at time zone 'Africa/Mogadishu')::date - 1, (now() at time zone 'Africa/Mogadishu')::date) where restaurant_id = :'ra'), 'tax due is computed from orders');
select tests.throws(format($$select public.org_record_tax_filing(%L, %L, current_date, current_date + 30)$$, :'org', :'ra'), 'not ended', 'a period still running cannot be filed');
select public.org_record_tax_filing(:'org', :'ra', current_date - 30, current_date - 1, 'MOF-2026-10', 'Filed in person') as f1 \gset
select tests.ok((select tax_collected = 0 and reference = 'MOF-2026-10' from public.tax_filings where id = :'f1'), 'filing stores the server-computed amount, not a client value');
select tests.throws(format($$select public.org_record_tax_filing(%L, %L, current_date - 30, current_date - 1)$$, :'org', :'ra'), 'already recorded', 'a period is filed once per branch');
select tests.throws(format($$insert into public.tax_filings (organization_id, restaurant_id, period_from, period_to, tax_collected, currency) values (%L, %L, current_date - 90, current_date - 61, 0, 'USD')$$, :'org', :'ra'), 'permission denied', 'filings cannot be inserted directly');
select set_config('request.jwt.claim.sub', :'RV', false);
select tests.ok((select count(*) from public.tax_filings) = 0, 'other groups do not see the filing register');
select set_config('request.jwt.claim.sub', :'OW', false);

-- Settings
select public.org_update_settings(:'org', 'Horn Hospitality Group', 'USD', '{"SLS": 11800}'::jsonb);
select tests.ok((select settings -> 'fx_rates' ->> 'SLS' = '11800' and settings ->> 'reporting_currency' = 'USD' from public.organizations where id = :'org'), 'exchange rate saved');
select tests.throws(format($$select public.org_update_settings(%L, 'Group', 'USD', '{"SLS": 0}'::jsonb)$$, :'org'), 'greater than 0', 'zero exchange rate is rejected');
select tests.throws(format($$select public.org_update_settings(%L, 'Group', 'usd', '{}'::jsonb)$$, :'org'), '3-letter', 'currency must be an ISO-style code');
select public.org_apply_branch_defaults(:'org', array[:'ra', :'rb', :'rc']::uuid[], '{"tax_rate": 0.07, "permissions": {"cashier_can_refund": true}}'::jsonb) as applied \gset
select tests.ok(:'applied'::int = 3
            and (select count(*) from public.restaurants where organization_id = :'org' and tax_rate = 0.07 and (settings -> 'permissions' ->> 'cashier_can_refund')::boolean) = 3
            and (select (settings -> 'permissions' ->> 'cashier_can_create_customers')::boolean from public.restaurants where id = :'ra'), 'defaults applied to all branches without wiping other permissions');
select tests.throws(format($$select public.org_apply_branch_defaults(%L, array[%L]::uuid[], '{"order_seq": 0}'::jsonb)$$, :'org', :'ra'), 'cannot be applied', 'counters cannot be changed group-wide');

-- Reviews of flagged events
insert into public.audit_reviews (organization_id, event_key, status, note) values (:'org', 'audit:1', 'investigating', 'Calling the cashier');
update public.audit_reviews set status = 'cleared', note = 'Explained' where organization_id = :'org' and event_key = 'audit:1';
select tests.ok((select status = 'cleared' and reviewed_by = :'OW'::uuid from public.audit_reviews where event_key = 'audit:1'), 'owner reviews a flagged event');
select tests.throws(format($$insert into public.audit_reviews (organization_id, event_key, status, reviewed_by) values (%L, 'audit:2', 'cleared', %L)$$, :'org', :'MB'), 'row-level security', 'review cannot be attributed to someone else');
select set_config('request.jwt.claim.sub', :'RV', false);
select tests.throws(format($$insert into public.audit_reviews (organization_id, event_key, status) values (%L, 'audit:3', 'cleared')$$, :'org'), 'row-level security', 'outsider cannot review events of another group');

-- Owner works as a manager inside a branch, with the audit trail showing who acted
select set_config('request.jwt.claim.sub', :'OW', false);
update public.restaurants set phone = '+252634555555' where id = :'rb';
select tests.ok((select count(*) from public.audit_logs where restaurant_id = :'rb' and actor_id = :'OW'::uuid and action = 'update') >= 1, 'owner edits inside a branch are audited under the owner');
select tests.ok((select count(*) from public.profiles where id in (:'WA', :'CA', :'MB')) = 3, 'owner can see the profiles of staff in every branch');
select tests.ok((select count(*) from public.profiles where id = :'RV'::uuid) = 0, 'owner cannot see profiles outside the group');
reset role;

select count(*) - :before_count as passed from tests.results \gset
\o
\echo '==> super admin assertions passed:' :passed
