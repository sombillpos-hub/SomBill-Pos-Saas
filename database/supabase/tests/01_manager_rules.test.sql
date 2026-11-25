-- =====================================================================
-- SomBill database tests: RLS isolation, role authorization and the
-- business rules enforced by triggers / RPCs.
-- Run via: npm run test:db  (supabase/tests/run_db_tests.sh)
-- =====================================================================
\set ON_ERROR_STOP 1
set client_min_messages = warning;
\o /dev/null

-- ---------- tiny assertion framework ----------
create schema if not exists tests;
grant usage on schema tests to authenticated, anon;
create table if not exists tests.results (id serial, name text, ok boolean);
grant insert, select on tests.results to authenticated, anon;
grant usage on sequence tests.results_id_seq to authenticated, anon;

create or replace function tests.ok(p_cond boolean, p_name text) returns void language plpgsql as $$
begin
  if p_cond is distinct from true then
    raise exception 'ASSERTION FAILED: %', p_name;
  end if;
  insert into tests.results(name, ok) values (p_name, true);
  raise notice 'ok - %', p_name;
end $$;

create or replace function tests.throws(p_sql text, p_pattern text, p_name text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm ilike '%' || p_pattern || '%' then
      insert into tests.results(name, ok) values (p_name, true);
      raise notice 'ok - % (threw: %)', p_name, sqlerrm;
      return;
    end if;
    raise exception 'ASSERTION FAILED: % – wrong error: %', p_name, sqlerrm;
  end;
  raise exception 'ASSERTION FAILED: % – expected an error matching "%"', p_name, p_pattern;
end $$;

create or replace function tests.affected(p_sql text) returns int language plpgsql as $$
declare n int;
begin
  execute p_sql; get diagnostics n = row_count; return n;
end $$;
grant execute on all functions in schema tests to authenticated, anon;

-- ---------- fixtures (as superuser == service role) ----------
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'manager1@r1.test', '{"full_name":"Amina Manager"}'),
  ('00000000-0000-0000-0000-0000000000c1', 'cashier1@r1.test', '{"full_name":"Cali Cashier"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'waiter1@r1.test',  '{"full_name":"Warsame Waiter"}'),
  ('00000000-0000-0000-0000-0000000000a2', 'manager2@r2.test', '{"full_name":"Other Manager"}'),
  ('00000000-0000-0000-0000-0000000000d1', 'suspended@r1.test', '{"full_name":"Suspended Sam"}');

\set m1 '00000000-0000-0000-0000-0000000000a1'
\set c1 '00000000-0000-0000-0000-0000000000c1'
\set w1 '00000000-0000-0000-0000-0000000000b1'
\set m2 '00000000-0000-0000-0000-0000000000a2'
\set s1 '00000000-0000-0000-0000-0000000000d1'

select tests.ok((select count(*) from public.profiles) = 5, 'profiles auto-created from auth.users');

-- Managers bootstrap their restaurants through the RPC.
set role authenticated;
select set_config('request.jwt.claim.sub', :'m1', false);
select public.create_restaurant('Hargeisa Grill', 'usd', 'Africa/Mogadishu') as r1 \gset
select tests.throws($$select public.create_restaurant('Second', 'USD')$$, 'already belong', 'manager cannot create a second restaurant');
select set_config('request.jwt.claim.sub', :'m2', false);
select public.create_restaurant('Berbera Bites', 'SLS', 'Africa/Mogadishu') as r2 \gset
reset role;

insert into public.restaurant_members (restaurant_id, user_id, role, status) values
  (:'r1', :'c1', 'cashier', 'active'),
  (:'r1', :'w1', 'waiter', 'active'),
  (:'r1', :'s1', 'manager', 'suspended');
update public.restaurants set tax_rate = 0.10 where id = :'r1';

-- =====================================================================
-- Catalogue as manager 1
-- =====================================================================
set role authenticated;
select set_config('request.jwt.claim.sub', :'m1', false);

insert into public.categories (restaurant_id, name, display_order) values (:'r1', 'Mains', 1)
  returning id as cat_mains \gset
select tests.throws(format($$insert into public.categories (restaurant_id, name) values (%L, '  mains ')$$, :'r1'),
  'uq_categories_name', 'duplicate category name rejected (case/space-insensitive)');

insert into public.inventory_items (restaurant_id, name, sku, unit, quantity, unit_cost, min_stock)
  values (:'r1', 'Rice', 'ING-RICE', 'kg', 10, 1.50, 2) returning id as inv_rice \gset
insert into public.inventory_items (restaurant_id, name, sku, unit, quantity, unit_cost, min_stock)
  values (:'r1', 'Goat meat', 'ING-GOAT', 'kg', 1, 8.00, 1) returning id as inv_goat \gset
insert into public.inventory_items (restaurant_id, name, sku, unit, quantity, unit_cost)
  values (:'r1', 'Rice (store room)', 'ING-RICE2', 'kg', 5, 1.50) returning id as inv_rice2 \gset

select tests.ok((select count(*) from public.stock_movements where inventory_item_id = :'inv_rice' and movement_type = 'opening') = 1,
  'opening stock creates a stock movement');

insert into public.products (restaurant_id, category_id, name, sku, price, cost_price, track_stock)
  values (:'r1', :'cat_mains', 'Bariis iyo Hilib Ari', 'P-001', 12.00, 5.00, true) returning id as prod_goat \gset
insert into public.products (restaurant_id, category_id, name, sku, price, cost_price, tax_category)
  values (:'r1', :'cat_mains', 'Water', 'P-002', 1.00, 0.30, 'exempt') returning id as prod_water \gset
insert into public.product_recipe_items (restaurant_id, product_id, inventory_item_id, quantity) values
  (:'r1', :'prod_goat', :'inv_rice', 0.25), (:'r1', :'prod_goat', :'inv_goat', 0.30);

select tests.throws(format($$insert into public.products (restaurant_id, name, sku, price) values (%L, 'Dup', 'p-001', 1)$$, :'r1'),
  'uq_products_sku', 'duplicate SKU rejected (case-insensitive)');
select tests.throws(format($$insert into public.products (restaurant_id, name, price) values (%L, 'Neg', -1)$$, :'r1'),
  'check constraint', 'negative price rejected');

update public.products set price = 13.50 where id = :'prod_goat';
select tests.ok((select count(*) from public.audit_logs where entity_id = :'prod_goat' and action = 'price_change'
                  and (old_data->>'price')::numeric = 12 and (new_data->>'price')::numeric = 13.5) = 1,
  'price change recorded in audit history');
update public.products set price = 12.00 where id = :'prod_goat';

select tests.throws(format($$delete from public.products where id = %L$$, :'prod_water'),
  'permission denied', 'products cannot be physically deleted by clients');

update public.products set archived_at = now() where id = :'prod_water';
select tests.ok((select action from public.audit_logs where entity_id = :'prod_water' order by id desc limit 1) = 'archive',
  'archiving is audited as archive');
update public.products set archived_at = null where id = :'prod_water';

insert into public.restaurant_tables (restaurant_id, table_number, name, capacity) values (:'r1', 1, 'Window', 4)
  returning id as t1 \gset
insert into public.restaurant_tables (restaurant_id, table_number, capacity) values (:'r1', 2, 2)
  returning id as t2 \gset
select tests.throws(format($$insert into public.restaurant_tables (restaurant_id, table_number) values (%L, 1)$$, :'r1'),
  'uq_tables_number', 'duplicate table number rejected');

insert into public.customers (restaurant_id, name, phone, email) values (:'r1', 'Hodan Ali', '+252 63 4123456', 'hodan@example.com')
  returning id as cust1 \gset
select tests.throws(format($$insert into public.customers (restaurant_id, name, email) values (%L, 'Bad', 'not-an-email')$$, :'r1'),
  'check constraint', 'invalid customer email rejected');
select tests.throws(format($$insert into public.customers (restaurant_id, name, phone) values (%L, 'Bad', 'abc')$$, :'r1'),
  'check constraint', 'invalid customer phone rejected');

insert into public.suppliers (restaurant_id, name, contact_person, phone) values (:'r1', 'Berbera Wholesale', 'Ahmed', '+252634000000')
  returning id as sup1 \gset

-- =====================================================================
-- Isolation: manager 2 sees and changes nothing in restaurant 1
-- =====================================================================
select set_config('request.jwt.claim.sub', :'m2', false);
select tests.ok((select count(*) from public.categories where restaurant_id = :'r1') = 0, 'RLS: other restaurant categories invisible');
select tests.ok((select count(*) from public.products where restaurant_id = :'r1') = 0, 'RLS: other restaurant products invisible');
select tests.ok((select count(*) from public.customers) = 0, 'RLS: other restaurant customers invisible');
select tests.ok((select count(*) from public.restaurants) = 1, 'RLS: manager sees only own restaurant');
select tests.ok((select count(*) from public.audit_logs where restaurant_id = :'r1') = 0, 'RLS: other restaurant audit invisible');
select tests.throws(format($$insert into public.categories (restaurant_id, name) values (%L, 'Hack')$$, :'r1'),
  'row-level security', 'RLS: cannot insert into another restaurant');
select tests.ok(tests.affected(format($$update public.products set price = 0 where id = %L$$, :'prod_goat')) = 0,
  'RLS: cannot update another restaurant product');
select tests.throws(format($$select public.adjust_stock(%L, 'receive', 5, 'hack')$$, :'inv_rice'),
  'Only managers', 'RPC: cannot adjust another restaurant stock');
select tests.throws(format($$select public.sales_summary(%L, now() - interval '1 day', now())$$, :'r1'),
  'Managers only', 'RPC: cannot read another restaurant sales summary');
-- Cross-restaurant reference smuggling
insert into public.categories (restaurant_id, name) values (:'r2', 'R2 cat') returning id as cat_r2 \gset
select tests.throws(format($$insert into public.products (restaurant_id, category_id, name, price) values (%L, %L, 'x', 1)$$, :'r2', :'cat_mains'),
  'does not belong', 'cannot reference another restaurant category');

-- =====================================================================
-- Role checks inside restaurant 1
-- =====================================================================
select set_config('request.jwt.claim.sub', :'w1', false);
select tests.ok((select count(*) from public.products) = 2, 'waiter can read the menu (POS sync)');
select tests.throws(format($$insert into public.products (restaurant_id, name, price) values (%L, 'W', 1)$$, :'r1'),
  'row-level security', 'waiter cannot create products');
select tests.ok((select count(*) from public.suppliers) = 0, 'waiter cannot see suppliers');
select tests.ok((select count(*) from public.audit_logs) = 0, 'waiter cannot read audit logs');
update public.restaurant_tables set needs_cleaning = true where id = :'t2';
select tests.throws(format($$update public.restaurant_tables set capacity = 10 where id = %L$$, :'t2'),
  'Only managers', 'waiter cannot edit table configuration');
select tests.throws(format($$insert into public.customers (restaurant_id, name) values (%L, 'Walk In')$$, :'r1'),
  'row-level security', 'waiter cannot create customers by default');

select set_config('request.jwt.claim.sub', :'c1', false);
select tests.ok((select count(*) from public.expenses) = 0 and (select count(*) from public.purchase_orders) = 0,
  'cashier cannot see expenses or purchase orders');
select tests.ok(tests.affected(format($$update public.restaurants set name = 'Hacked' where id = %L$$, :'r1')) = 0,
  'cashier cannot change restaurant settings');

select set_config('request.jwt.claim.sub', :'s1', false);
select tests.ok((select count(*) from public.products) = 0, 'suspended staff lose all access');

reset role;
set role anon;
select tests.throws($$select count(*) from public.orders$$, 'permission denied', 'anon cannot read orders');
reset role;

-- =====================================================================
-- Order lifecycle with derived table status
-- =====================================================================
set role authenticated;
select set_config('request.jwt.claim.sub', :'w1', false);
select tests.ok((select status from public.table_status_v where id = :'t1') = 'available', 'table available before order');
insert into public.orders (restaurant_id, table_id, waiter_id, order_type, total, payment_status)
  values (:'r1', :'t1', :'w1', 'dine_in', 0.01, 'paid') returning id as o1, order_number as o1n \gset
select tests.ok((select payment_status from public.orders where id = :'o1') = 'unpaid', 'client cannot pre-set payment status');
select tests.throws(format($$insert into public.orders (restaurant_id, order_type) values (%L, 'dine_in')$$, :'r1'),
  'require a table', 'dine-in order requires a table');

-- Client-supplied price is ignored; server snapshots product price.
insert into public.order_items (restaurant_id, order_id, product_id, product_name, quantity, unit_price)
  values (:'r1', :'o1', :'prod_goat', 'tampered', 2, 0.01);
insert into public.order_items (restaurant_id, order_id, product_id, product_name, quantity, unit_price)
  values (:'r1', :'o1', :'prod_water', 'x', 2, 0);
select tests.ok((select unit_price from public.order_items where order_id = :'o1' and product_id = :'prod_goat') = 12.00,
  'order item price snapshot taken from product, not client');
-- subtotal 24 + 2 = 26 ; tax 10% on taxable 24 = 2.40 ; total 28.40
select tests.ok((select subtotal = 26 and tax_amount = 2.40 and total = 28.40 from public.orders where id = :'o1'),
  'order totals computed server-side with exempt items untaxed');
select tests.throws(format($$update public.orders set total = 1 where id = %L$$, :'o1'),
  'system-maintained', 'order totals cannot be tampered with');
select tests.ok((select status from public.table_status_v where id = :'t1') = 'occupied', 'table occupied with active order');

select tests.throws(format($$update public.orders set bill_requested_at = now() where id = %L$$, :'o1'), 'request_bill', 'bill flag cannot be set directly');
select set_config('request.jwt.claim.sub', :'m1', false);
update public.orders set status = 'served' where id = :'o1';
select set_config('request.jwt.claim.sub', :'w1', false);
select public.request_bill(:'o1');
select tests.ok((select status from public.table_status_v where id = :'t1') = 'bill_requested', 'table shows bill requested');

select tests.throws(format($$insert into public.payments (restaurant_id, order_id, method, amount) values (%L, %L, 'cash', 5)$$, :'r1', :'o1'),
  'permission denied', 'waiter cannot record payments');
select tests.throws(format($$select public.record_payments(%L, '[{"method":"cash","amount":5}]'::jsonb, gen_random_uuid())$$, :'o1'),
  'Only cashiers or managers', 'waiter cannot record payments via RPC either');

select set_config('request.jwt.claim.sub', :'c1', false);
select public.open_cashier_shift(:'r1', 50, 'Morning float');
select public.record_payments(:'o1', '[{"method":"cash","amount":10,"amount_received":10}]'::jsonb, gen_random_uuid(), false);
select tests.ok((select payment_status = 'partial' and amount_paid = 10 from public.orders where id = :'o1'), 'partial payment tracked');
select tests.ok((select status = 'payment_pending' and balance = 18.40 from public.table_status_v where id = :'t1'),
  'table shows payment pending with correct balance');
select tests.throws(format($$select public.record_payments(%L, '[{"method":"cash","amount":100}]'::jsonb, gen_random_uuid())$$, :'o1'),
  'OVERPAYMENT', 'overpayment rejected');
select tests.throws(format($$insert into public.payments (restaurant_id, order_id, kind, method, amount) values (%L, %L, 'refund', 'cash', 5)$$, :'r1', :'o1'),
  'permission denied', 'refunds cannot be inserted directly');
select public.record_payments(:'o1', '[{"method":"card","amount":18.40,"reference":"TERM-0001","terminal_confirmed":true}]'::jsonb, gen_random_uuid(), false);
select tests.ok((select payment_status from public.orders where id = :'o1') = 'paid', 'order fully paid');
select tests.throws($$update public.payments set amount = 1$$, 'permission denied', 'payments cannot be edited by clients');
reset role;
select tests.throws($$update public.payments set amount = 1$$, 'immutable', 'payments immutable even for service role');
select tests.throws($$delete from public.payments$$, 'immutable', 'payments undeletable even for service role');
set role authenticated;
select set_config('request.jwt.claim.sub', :'c1', false);

update public.orders set status = 'completed', cashier_id = :'c1' where id = :'o1';
reset role;
select tests.ok((select quantity from public.inventory_items where id = :'inv_rice') = 9.5, 'completion deducts recipe stock (rice 10 - 2*0.25)');
select tests.ok((select quantity from public.inventory_items where id = :'inv_goat') = 0.4, 'completion deducts recipe stock (goat 1 - 2*0.30)');
select tests.ok((select count(*) from public.stock_movements where reference_id = :'o1' and movement_type = 'sale') = 2,
  'sale stock movements recorded');
select tests.ok((select status from public.table_status_v where id = :'t1') = 'available', 'table freed after completion');
select tests.ok((select stock_deducted_at is not null from public.orders where id = :'o1'), 'order flagged as stock deducted');

set role authenticated;
select set_config('request.jwt.claim.sub', :'m1', false);
select tests.throws(format($$update public.orders set notes = 'edit' where id = %L$$, :'o1'), 'cannot be modified', 'completed order is locked');
select tests.throws(format($$delete from public.orders where id = %L$$, :'o1'), 'permission denied', 'clients can never delete orders');
reset role;
select tests.throws(format($$delete from public.orders where id = %L$$, :'o1'), 'never deleted', 'orders undeletable even for service role');
set role authenticated;
select set_config('request.jwt.claim.sub', :'m1', false);
select tests.throws(format($$insert into public.order_items (restaurant_id, order_id, product_id, product_name, quantity, unit_price) values (%L, %L, %L, 'x', 1, 1)$$, :'r1', :'o1', :'prod_water'),
  'cannot be changed', 'items cannot be added to completed order');

-- Negative stock prevention: second order needs 0.6kg goat, only 0.4 left
select set_config('request.jwt.claim.sub', :'w1', false);
insert into public.orders (restaurant_id, table_id, waiter_id) values (:'r1', :'t1', :'w1') returning id as o2 \gset
insert into public.order_items (restaurant_id, order_id, product_id, product_name, quantity, unit_price)
  values (:'r1', :'o2', :'prod_goat', 'x', 2, 0);
select set_config('request.jwt.claim.sub', :'c1', false);
select tests.throws(format($$update public.orders set status = 'completed' where id = %L$$, :'o2'),
  'Insufficient stock', 'negative stock prevented on completion');
reset role;
update public.restaurants set settings = jsonb_set(settings, '{inventory,allow_negative_stock}', 'true') where id = :'r1';
set role authenticated;
select set_config('request.jwt.claim.sub', :'w1', false);
select tests.throws(format($$select public.cancel_order(%L, 'customer left')$$, :'o2'), 'not authorized', 'waiter cannot cancel orders');
select set_config('request.jwt.claim.sub', :'c1', false);
select tests.throws(format($$select public.cancel_order(%L, 'customer left')$$, :'o2'), 'not authorized', 'cashier cannot cancel without permission');
select set_config('request.jwt.claim.sub', :'m1', false);
select tests.throws(format($$select public.cancel_order(%L, '')$$, :'o2'), 'reason is required', 'cancellation requires a reason');
select tests.throws(format($$update public.orders set status = 'cancelled', cancel_reason = 'x' where id = %L$$, :'o2'),
  'cancel_order', 'direct status=cancelled update blocked');
select public.cancel_order(:'o2', 'Customer left before food arrived');
select tests.ok((select status = 'cancelled' and cancelled_by = :'m1'::uuid from public.orders where id = :'o2'), 'manager cancelled order with reason');
select tests.ok((select count(*) from public.audit_logs where entity_id = :'o2' and action = 'cancel' and reason like 'Customer left%') = 1,
  'cancellation audited with reason');
select tests.ok((select quantity from public.inventory_items where id = :'inv_goat') = 0.4, 'cancelled order does not touch stock');

-- Refunds with restock
select set_config('request.jwt.claim.sub', :'c1', false);
select tests.throws(format($$select public.refund_order(%L, 5, 'cash', 'cold food')$$, :'o1'), 'not authorized', 'cashier cannot refund without permission');
select set_config('request.jwt.claim.sub', :'m1', false);
select tests.throws(format($$select public.refund_order(%L, 500, 'cash', 'too much')$$, :'o1'), 'exceeds collected', 'refund cannot exceed collected');
select public.refund_order(:'o1', 28.40, 'cash', 'Wrong dish served', true);
select tests.ok((select payment_status = 'refunded' and amount_refunded = 28.40 from public.orders where id = :'o1'), 'full refund marks order refunded');
select tests.ok((select quantity from public.inventory_items where id = :'inv_rice') = 10, 'refund with restock reverses rice');
select tests.ok((select quantity from public.inventory_items where id = :'inv_goat') = 1, 'refund with restock reverses goat');
select tests.ok((select count(*) from public.stock_movements where reference_id = :'o1' and movement_type = 'sale_reversal') = 2,
  'sale reversal movements recorded');

-- =====================================================================
-- Inventory operations
-- =====================================================================
select tests.throws(format($$update public.inventory_items set quantity = 999 where id = %L$$, :'inv_rice'),
  'stock movements', 'direct quantity edit blocked');
select tests.ok(public.adjust_stock(:'inv_rice', 'receive', 5, 'Market purchase', 2.10) = 15, 'stock receiving');
select tests.ok((select unit_cost from public.inventory_items where id = :'inv_rice') = 1.70, 'weighted average cost updated (10@1.50 + 5@2.10)');
select tests.ok(public.adjust_stock(:'inv_rice', 'wastage', 1, 'Spoiled bag') = 14, 'stock wastage');
select tests.ok(public.adjust_stock(:'inv_rice', 'adjustment', -0.5, 'Stock count correction') = 13.5, 'signed stock adjustment');
select tests.throws(format($$select public.adjust_stock(%L, 'wastage', 1, 'x')$$, :'inv_rice'), 'reason is required', 'adjustment requires reason');
select public.transfer_stock(:'inv_rice2', :'inv_rice', 2, 'Move from store room');
select tests.ok((select quantity from public.inventory_items where id = :'inv_rice') = 15.5
             and (select quantity from public.inventory_items where id = :'inv_rice2') = 3, 'stock transfer between items');
select tests.ok((select count(*) from public.stock_movements where inventory_item_id = :'inv_rice') =
                (select count(*) from public.stock_movements where inventory_item_id = :'inv_rice' and quantity_change <> 0),
  'every movement is non-zero');
select tests.throws($$update public.stock_movements set reason = 'x'$$, 'permission denied', 'stock movements immutable for clients');
reset role;
update public.restaurants set settings = jsonb_set(settings, '{inventory,allow_negative_stock}', 'false') where id = :'r1';
set role authenticated;
select set_config('request.jwt.claim.sub', :'m1', false);
select tests.throws(format($$select public.adjust_stock(%L, 'wastage', 100, 'Flood')$$, :'inv_rice'), 'Insufficient stock', 'wastage cannot drive stock negative');
select set_config('request.jwt.claim.sub', :'c1', false);
select tests.throws(format($$select public.adjust_stock(%L, 'receive', 1, 'cashier try')$$, :'inv_rice'), 'Only managers', 'cashier cannot adjust stock');

-- =====================================================================
-- Purchase orders and receiving
-- =====================================================================
select set_config('request.jwt.claim.sub', :'m1', false);
insert into public.purchase_orders (restaurant_id, supplier_id, expected_date) values (:'r1', :'sup1', current_date + 2)
  returning id as po1, po_number as po1n \gset
insert into public.purchase_order_items (restaurant_id, purchase_order_id, inventory_item_id, quantity_ordered, unit_cost)
  values (:'r1', :'po1', :'inv_goat', 10, 9.00) returning id as pol_goat \gset
insert into public.purchase_order_items (restaurant_id, purchase_order_id, inventory_item_id, quantity_ordered, unit_cost)
  values (:'r1', :'po1', :'inv_rice', 20, 1.40) returning id as pol_rice \gset
select tests.ok((select total from public.purchase_orders where id = :'po1') = 118.00, 'PO total computed (90 + 28)');
select tests.throws(format($$select public.receive_purchase_order(%L, '[{"line_id":"%s","quantity":1}]'::jsonb, gen_random_uuid())$$, :'po1', :'pol_goat'),
  'Only ordered', 'draft PO cannot be received');
select tests.throws(format($$update public.purchase_orders set status = 'received' where id = %L$$, :'po1'),
  'receive_purchase_order', 'PO cannot be marked received directly');
update public.purchase_orders set status = 'ordered' where id = :'po1';
select tests.throws(format($$update public.purchase_order_items set quantity_ordered = 99 where id = %L$$, :'pol_goat'),
  'draft', 'lines locked after ordering');

select gen_random_uuid() as key1 \gset
select public.receive_purchase_order(:'po1', format('[{"line_id":"%s","quantity":4}]', :'pol_goat')::jsonb, :'key1') ->> 'po_status' as st1 \gset
select tests.ok(:'st1' = 'partially_received', 'partial receiving sets partially_received');
select tests.ok((select quantity from public.inventory_items where id = :'inv_goat') = 5, 'partial receipt adds stock (1 + 4)');
select tests.ok((public.receive_purchase_order(:'po1', format('[{"line_id":"%s","quantity":4}]', :'pol_goat')::jsonb, :'key1') ->> 'status') = 'duplicate_ignored',
  'duplicate receiving submission ignored');
select tests.ok((select quantity from public.inventory_items where id = :'inv_goat') = 5, 'duplicate receipt did not add stock');
select tests.throws(format($$select public.receive_purchase_order(%L, '[{"line_id":"%s","quantity":7}]'::jsonb, gen_random_uuid())$$, :'po1', :'pol_goat'),
  'outstanding', 'cannot receive more than ordered');
select public.receive_purchase_order(:'po1', format('[{"line_id":"%s","quantity":6},{"line_id":"%s","quantity":20}]', :'pol_goat', :'pol_rice')::jsonb, gen_random_uuid()) ->> 'po_status' as st2 \gset
select tests.ok(:'st2' = 'received', 'final receipt closes PO');
select tests.ok((select count(*) from public.stock_movements where reference_id = :'po1' and movement_type = 'receive') = 3,
  'each receipt line created a stock movement');
select set_config('request.jwt.claim.sub', :'m2', false);
select tests.throws(format($$select public.receive_purchase_order(%L, '[]'::jsonb, gen_random_uuid())$$, :'po1'),
  'Only managers', 'other restaurant manager cannot receive PO');

-- =====================================================================
-- Expenses
-- =====================================================================
reset role;
update public.restaurants set settings = jsonb_set(settings, '{expenses,approval_required}', 'true') where id = :'r1';
set role authenticated;
select set_config('request.jwt.claim.sub', :'m1', false);
insert into public.expenses (restaurant_id, category, description, amount, status) values (:'r1', 'Utilities', 'Electricity November', 85.00, 'approved')
  returning id as e1 \gset
select tests.ok((select status from public.expenses where id = :'e1') = 'pending', 'approval-required expense starts pending (client status ignored)');
select tests.throws(format($$update public.expenses set status = 'approved' where id = %L$$, :'e1'), 'review_expense', 'direct approval blocked');
select tests.throws(format($$select public.review_expense(%L, false)$$, :'e1'), 'rejection reason', 'rejection needs reason');
select public.review_expense(:'e1', true);
select tests.ok((select status = 'approved' and approved_by = :'m1'::uuid from public.expenses where id = :'e1'), 'expense approved by manager');
select tests.throws(format($$insert into public.expenses (restaurant_id, category, description, amount) values (%L, 'X', 'zero', 0)$$, :'r1'),
  'check constraint', 'expense amount must be positive');

-- =====================================================================
-- Reporting, audit and storage
-- =====================================================================
select (public.sales_summary(:'r1', now() - interval '1 day', now() + interval '1 day')) as s \gset
select tests.ok((:'s'::jsonb ->> 'gross_sales')::numeric = 28.40, 'sales summary: gross excludes cancelled orders');
select tests.ok((:'s'::jsonb ->> 'collected')::numeric = 28.40, 'sales summary: collected from successful payments');
select tests.ok((:'s'::jsonb ->> 'refunds')::numeric = 28.40, 'sales summary: refunds kept separate');
select tests.ok((:'s'::jsonb ->> 'cancelled_orders')::int = 1 and (:'s'::jsonb ->> 'completed_orders')::int = 1, 'sales summary: order counts');

select tests.throws(format($$insert into public.audit_logs (restaurant_id, action, entity_type) values (%L, 'fake', 'x')$$, :'r1'),
  'permission denied', 'clients cannot forge audit logs');
select tests.throws(format($$insert into public.stock_movements (restaurant_id, inventory_item_id, movement_type, quantity_change, quantity_after) values (%L, %L, 'receive', 1, 1)$$, :'r1', :'inv_rice'),
  'permission denied', 'clients cannot insert stock movements directly');
select tests.throws(format($$select public.apply_stock_movement(%L, 'receive', 100)$$, :'inv_rice'),
  'permission denied', 'internal stock primitive not callable');
select tests.throws(format($$update public.restaurants set order_seq = 0 where id = %L$$, :'r1'),
  'permission denied', 'order sequence not client-writable');
update public.restaurants set receipt_footer = 'Mahadsanid!' where id = :'r1';
select tests.ok((select receipt_footer from public.restaurants where id = :'r1') = 'Mahadsanid!', 'manager updates restaurant settings');

insert into storage.objects (bucket_id, name) values ('menu-images', :'r1' || '/products/a.png');
select tests.ok(true, 'manager uploads into own restaurant folder');
select tests.throws(format($$insert into storage.objects (bucket_id, name) values ('menu-images', '%s/products/x.png')$$, :'r2'),
  'row-level security', 'manager cannot upload into another restaurant folder');
select set_config('request.jwt.claim.sub', :'w1', false);
select tests.throws(format($$insert into storage.objects (bucket_id, name) values ('menu-images', '%s/products/w.png')$$, :'r1'),
  'row-level security', 'waiter cannot upload menu images');
reset role;

select count(*) as passed from tests.results \gset
\echo '==> database assertions passed:' :passed
