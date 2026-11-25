-- =====================================================================
-- SomBill Waiter POS – database tests with real records.
-- Part 1: the 17-step acceptance workflow on Table 04.
-- Part 2: permission, isolation, atomicity and workflow rules.
-- Requires tests.* helpers created by 01_manager_rules.test.sql.
-- =====================================================================
\set ON_ERROR_STOP 1
set client_min_messages = warning;
\o /dev/null
reset role;
select count(*) as before_count from tests.results \gset

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000003a1', 'manager@r3.test', '{"full_name":"Mohamed Manager"}'),
  ('00000000-0000-0000-0000-0000000003b1', 'waiter@r3.test',  '{"full_name":"Warsame Waiter"}'),
  ('00000000-0000-0000-0000-0000000003b2', 'waiter2@r3.test', '{"full_name":"Ayaan Waiter"}'),
  ('00000000-0000-0000-0000-0000000003c1', 'cashier@r3.test', '{"full_name":"Cali Cashier"}'),
  ('00000000-0000-0000-0000-0000000003d1', 'kitchen@r3.test', '{"full_name":"Khadar Kitchen"}'),
  ('00000000-0000-0000-0000-0000000004a1', 'manager@r4.test', '{"full_name":"Other Manager"}'),
  ('00000000-0000-0000-0000-0000000004b1', 'waiter@r4.test',  '{"full_name":"Other Waiter"}');
\set M '00000000-0000-0000-0000-0000000003a1'
\set W '00000000-0000-0000-0000-0000000003b1'
\set W2 '00000000-0000-0000-0000-0000000003b2'
\set C '00000000-0000-0000-0000-0000000003c1'
\set K '00000000-0000-0000-0000-0000000003d1'
\set M4 '00000000-0000-0000-0000-0000000004a1'
\set W4 '00000000-0000-0000-0000-0000000004b1'

set role authenticated;
select set_config('request.jwt.claim.sub', :'M', false);
select public.create_restaurant('Hargeisa Grill', 'USD', 'Africa/Mogadishu') as r3 \gset
select set_config('request.jwt.claim.sub', :'M4', false);
select public.create_restaurant('Burao Kitchen', 'USD', 'Africa/Mogadishu') as r4 \gset
reset role;
insert into public.restaurant_members (restaurant_id, user_id, role) values
  (:'r3', :'W', 'waiter'), (:'r3', :'W2', 'waiter'), (:'r3', :'C', 'cashier'), (:'r3', :'K', 'kitchen'), (:'r4', :'W4', 'waiter');
update public.restaurants set tax_rate = 0.10 where id in (:'r3', :'r4');

-- Manager sets up the menu and floor (real records)
set role authenticated;
select set_config('request.jwt.claim.sub', :'M', false);
insert into public.categories (restaurant_id, name, display_order) values (:'r3', 'Mains', 1) returning id as cat1 \gset
insert into public.categories (restaurant_id, name, display_order) values (:'r3', 'Drinks', 2) returning id as cat2 \gset
insert into public.products (restaurant_id, category_id, name, price, cost_price) values (:'r3', :'cat1', 'Bariis iyo Hilib', 12.00, 5) returning id as p1 \gset
insert into public.products (restaurant_id, category_id, name, price, tax_category) values (:'r3', :'cat2', 'Shaah', 1.50, 'exempt') returning id as p2 \gset
insert into public.products (restaurant_id, category_id, name, price, is_available) values (:'r3', :'cat1', 'Sold-out Suqaar', 9.00, false) returning id as p3 \gset
insert into public.products (restaurant_id, category_id, name, price, archived_at) values (:'r3', :'cat1', 'Old Dish', 5.00, now()) returning id as p4 \gset
insert into public.restaurant_tables (restaurant_id, table_number, name, capacity) values (:'r3', 3, 'Patio', 2) returning id as t3 \gset
insert into public.restaurant_tables (restaurant_id, table_number, name, capacity) values (:'r3', 4, 'Window', 4) returning id as t4 \gset
insert into public.restaurant_tables (restaurant_id, table_number, capacity) values (:'r3', 5, 6) returning id as t5 \gset
insert into public.restaurant_tables (restaurant_id, table_number, capacity, archived_at) values (:'r3', 9, 2, now()) returning id as t9 \gset
select set_config('request.jwt.claim.sub', :'M4', false);
insert into public.restaurant_tables (restaurant_id, table_number) values (:'r4', 4) returning id as t4_other \gset

-- =====================================================================
-- PART 1 – ACCEPTANCE WORKFLOW (Table 04)
-- =====================================================================
-- 1. Waiter logs in (authenticated session resolves to an active waiter)
select set_config('request.jwt.claim.sub', :'W', false);
select tests.ok(public.member_role(:'r3') = 'waiter', 'ACCEPTANCE 1: waiter session resolves to active waiter membership');
-- 2. Waiter sees available tables
select tests.ok((select count(*) from public.table_status_v where restaurant_id = :'r3' and status = 'available' and archived_at is null) = 3,
  'ACCEPTANCE 2: waiter sees 3 available tables');
-- 3. Waiter selects Table 04
select tests.ok((select status from public.table_status_v where id = :'t4') = 'available', 'ACCEPTANCE 3: Table 04 is available to select');
-- 4. Waiter views categories
select tests.ok((select count(*) from public.categories where restaurant_id = :'r3' and is_active and archived_at is null) = 2, 'ACCEPTANCE 4: waiter loads the manager''s categories');
-- 5–8. Two products, changed quantities (2 and 3), special instructions, submit
select gen_random_uuid() as k1 \gset
select public.submit_waiter_order(:'r3', :'t4',
  format('[{"product_id":"%s","quantity":2,"unit_price":12.00,"notes":"No onions"},{"product_id":"%s","quantity":3,"unit_price":1.50,"notes":"Extra sugar"}]', :'p1', :'p2')::jsonb,
  'Allergy: nuts', null, 4, :'k1') as res1 \gset
select (:'res1'::jsonb ->> 'order_id') as o1 \gset
select tests.ok((:'res1'::jsonb ->> 'duplicate')::boolean = false, 'ACCEPTANCE 5-8: order submitted with two products, quantities and instructions');
-- 9. Order stored in Supabase with correct ownership and secure totals
select tests.ok((select restaurant_id = :'r3'::uuid and table_id = :'t4'::uuid and waiter_id = :'W'::uuid and status = 'new' and notes = 'Allergy: nuts' and guest_count = 4
                 from public.orders where id = :'o1'), 'ACCEPTANCE 9: order row stored with restaurant, table, waiter and notes');
select tests.ok((select count(*) from public.order_items where order_id = :'o1') = 2
            and (select string_agg(product_name || ':' || quantity::int || ':' || notes, '|' order by product_name) from public.order_items where order_id = :'o1')
                = 'Bariis iyo Hilib:2:No onions|Shaah:3:Extra sugar', 'ACCEPTANCE 9: order items persisted with quantities and notes');
-- subtotal 24 + 4.50 = 28.50; tax 10% on taxable 24 = 2.40; total 30.90
select tests.ok((select subtotal = 28.50 and tax_amount = 2.40 and total = 30.90 from public.orders where id = :'o1'), 'ACCEPTANCE 9: totals and tax calculated server-side');
-- 10. Table becomes occupied
select tests.ok((select status = 'occupied' and order_id = :'o1'::uuid and waiter_id = :'W'::uuid and balance = 30.90 from public.table_status_v where id = :'t4'),
  'ACCEPTANCE 10: Table 04 occupied with order, waiter and balance');
-- 11. Cashier receives the order
select set_config('request.jwt.claim.sub', :'C', false);
select tests.ok((select count(*) from public.orders where id = :'o1') = 1, 'ACCEPTANCE 11: cashier can see the new order');
select tests.ok((select count(*) from public.notifications where order_id = :'o1' and type = 'new_order') = 1, 'ACCEPTANCE 11: cashier got a new-order notification');
-- 12. Kitchen status updates
select set_config('request.jwt.claim.sub', :'K', false);
select tests.ok((select count(*) from public.notifications where order_id = :'o1' and type = 'new_order') = 1, 'ACCEPTANCE 12: kitchen got a new-order notification');
update public.orders set status = 'accepted' where id = :'o1';
update public.orders set status = 'preparing' where id = :'o1';
update public.orders set status = 'ready' where id = :'o1';
-- 13. Waiter sees the Ready status
select set_config('request.jwt.claim.sub', :'W', false);
select tests.ok((select status from public.orders where id = :'o1') = 'ready', 'ACCEPTANCE 13: waiter sees Ready');
select tests.ok((select array_agg(type order by created_at) from public.notifications where order_id = :'o1')
                = array['order_accepted', 'order_preparing', 'order_ready'], 'ACCEPTANCE 13: waiter notified accepted → preparing → ready');
-- 14. Waiter serves the order
update public.orders set status = 'served' where id = :'o1';
select tests.ok((select status from public.orders where id = :'o1') = 'served', 'ACCEPTANCE 14: waiter marked the order served');
-- 15. Waiter requests the bill
select public.request_bill(:'o1');
select tests.ok((select status from public.table_status_v where id = :'t4') = 'bill_requested', 'ACCEPTANCE 15: bill requested, table shows Bill Requested');
-- 16. Cashier processes payment
select set_config('request.jwt.claim.sub', :'C', false);
select tests.ok((select count(*) from public.notifications where order_id = :'o1' and type = 'bill_requested') = 1, 'ACCEPTANCE 16: cashier notified of bill request');
select public.acknowledge_bill_request(:'o1');
select public.open_cashier_shift(:'r3', 100);
select (public.record_payments(:'o1', '[{"method":"evc_plus","amount":30.90,"reference":"EVC-778812"}]'::jsonb, gen_random_uuid()) -> 'payment_ids' ->> 0) as pay1 \gset
-- A typed mobile-money reference is not proof of payment: pending until verified.
select tests.ok((select payment_status from public.orders where id = :'o1') = 'unpaid', 'ACCEPTANCE 16: unverified mobile money does not count as paid');
select public.verify_payment(:'pay1', true, 'Confirmed in EVC Plus merchant app');   -- verification closes the served, fully paid order
-- 17. Waiter sees payment completion
select set_config('request.jwt.claim.sub', :'W', false);
select tests.ok((select payment_status = 'paid' and status = 'completed' from public.orders where id = :'o1'), 'ACCEPTANCE 17: waiter sees order paid and completed');
select tests.ok((select count(*) from public.notifications where order_id = :'o1' and user_id = :'W'::uuid and type in ('bill_acknowledged', 'payment_completed', 'table_status')) = 3,
  'ACCEPTANCE 17: waiter notified bill acknowledged, payment completed, table available');
select tests.ok((select status from public.table_status_v where id = :'t4') = 'available', 'ACCEPTANCE 17: Table 04 is available again');

-- =====================================================================
-- PART 2 – RULES
-- =====================================================================
-- Duplicate prevention ------------------------------------------------
select gen_random_uuid() as k2 \gset
select (public.submit_waiter_order(:'r3', :'t3', format('[{"product_id":"%s","quantity":1,"unit_price":12}]', :'p1')::jsonb, null, null, null, :'k2') ->> 'order_id') as o2 \gset
select tests.ok((public.submit_waiter_order(:'r3', :'t3', format('[{"product_id":"%s","quantity":1,"unit_price":12}]', :'p1')::jsonb, null, null, null, :'k2') ->> 'duplicate')::boolean,
  'double-submit with the same key returns the existing order');
select tests.ok((select count(*) from public.orders where table_id = :'t3') = 1 and (select count(*) from public.order_items where order_id = :'o2') = 1,
  'double-submit created no extra order or items');
select tests.throws(format($$select public.submit_waiter_order(%L, %L, '[{"product_id":"%s","quantity":1,"unit_price":12}]'::jsonb, null, null, null, gen_random_uuid())$$, :'r3', :'t3', :'p1'),
  'TABLE_OCCUPIED', 'second active order on an occupied table is rejected');
select set_config('request.jwt.claim.sub', :'W2', false);
select tests.throws(format($$insert into public.orders (restaurant_id, table_id) values (%L, %L)$$, :'r3', :'t3'),
  'TABLE_OCCUPIED', 'direct insert cannot occupy an occupied table either');

-- Atomicity: failures leave nothing behind ----------------------------
select set_config('request.jwt.claim.sub', :'W', false);
select tests.throws(format($$select public.submit_waiter_order(%L, %L, '[{"product_id":"%s","quantity":1,"unit_price":12},{"product_id":"%s","quantity":1,"unit_price":9}]'::jsonb, null, null, null, gen_random_uuid())$$, :'r3', :'t5', :'p1', :'p3'),
  'PRODUCT_UNAVAILABLE', 'unavailable product rejects the whole order');
select tests.throws(format($$select public.submit_waiter_order(%L, %L, '[{"product_id":"%s","quantity":1,"unit_price":5}]'::jsonb, null, null, null, gen_random_uuid())$$, :'r3', :'t5', :'p4'),
  'PRODUCT_UNAVAILABLE', 'archived product cannot be ordered');
select tests.throws(format($$select public.submit_waiter_order(%L, %L, '[{"product_id":"%s","quantity":1,"unit_price":0.01}]'::jsonb, null, null, null, gen_random_uuid())$$, :'r3', :'t5', :'p1'),
  'PRICE_CHANGED', 'stale or tampered price is rejected');
select tests.throws(format($$select public.submit_waiter_order(%L, %L, '[{"product_id":"%s","quantity":0,"unit_price":12}]'::jsonb, null, null, null, gen_random_uuid())$$, :'r3', :'t5', :'p1'),
  'whole numbers', 'zero quantity rejected');
select tests.throws(format($$select public.submit_waiter_order(%L, %L, '[{"product_id":"%s","quantity":1.5,"unit_price":12}]'::jsonb, null, null, null, gen_random_uuid())$$, :'r3', :'t5', :'p1'),
  'whole numbers', 'fractional quantity rejected');
select tests.throws(format($$select public.submit_waiter_order(%L, %L, '[{"product_id":"%s","quantity":1000,"unit_price":12}]'::jsonb, null, null, null, gen_random_uuid())$$, :'r3', :'t5', :'p1'),
  'whole numbers', 'excessive quantity rejected');
select tests.throws(format($$select public.submit_waiter_order(%L, %L, '[]'::jsonb, null, null, null, gen_random_uuid())$$, :'r3', :'t5'),
  'at least one item', 'empty order rejected');
select tests.throws(format($$select public.submit_waiter_order(%L, null, '[{"product_id":"%s","quantity":1,"unit_price":12}]'::jsonb, null, null, null, gen_random_uuid())$$, :'r3', :'p1'),
  'Select a table', 'order without table rejected');
select tests.throws(format($$select public.submit_waiter_order(%L, %L, '[{"product_id":"%s","quantity":1,"unit_price":12}]'::jsonb, null, null, null, gen_random_uuid())$$, :'r3', :'t9', :'p1'),
  'archived', 'archived table cannot be occupied');
select tests.throws(format($$select public.submit_waiter_order(%L, %L, '[{"product_id":"%s","quantity":1,"unit_price":12}]'::jsonb, null, null, null, gen_random_uuid())$$, :'r3', :'t4_other', :'p1'),
  'does not belong', 'another restaurant''s table cannot be used');
select tests.ok((select count(*) from public.orders where table_id = :'t5') = 0 and (select status from public.table_status_v where id = :'t5') = 'available',
  'failed submissions left no order and Table 5 still available');

-- Existing order updates ----------------------------------------------
select gen_random_uuid() as k3 \gset
select public.add_order_items(:'o2', format('[{"product_id":"%s","quantity":2,"unit_price":1.5,"notes":"hot"}]', :'p2')::jsonb, :'k3');
select public.add_order_items(:'o2', format('[{"product_id":"%s","quantity":2,"unit_price":1.5,"notes":"hot"}]', :'p2')::jsonb, :'k3');
select tests.ok((select count(*) from public.order_items where order_id = :'o2') = 2, 'items added to own unpaid order; retry with same key ignored');
select tests.ok((select total from public.orders where id = :'o2') = 16.20, 'totals recalculated after adding items (12+1.2 tax + 3.00)');
select tests.throws(format($$update public.order_items set quantity = 5 where order_id = %L$$, :'o2'), 'cannot be changed by waiters', 'waiter cannot edit submitted items');
select tests.throws(format($$update public.order_items set is_voided = true, void_reason = 'x' where order_id = %L$$, :'o2'), 'cannot be changed by waiters', 'waiter cannot void submitted items');
select set_config('request.jwt.claim.sub', :'W2', false);
select tests.throws(format($$select public.add_order_items(%L, '[{"product_id":"%s","quantity":1,"unit_price":12}]'::jsonb, gen_random_uuid())$$, :'o2', :'p1'),
  'your own orders', 'another waiter cannot add items to this order');
select tests.throws(format($$update public.orders set notes = 'hijack' where id = %L$$, :'o2'), 'your own orders', 'another waiter cannot modify this order');
reset role;
update public.restaurants set settings = jsonb_set(settings, '{permissions,waiter_can_edit_others_orders}', 'true') where id = :'r3';
set role authenticated;
select public.add_order_items(:'o2', format('[{"product_id":"%s","quantity":1,"unit_price":1.5}]', :'p2')::jsonb, gen_random_uuid());
select tests.ok((select count(*) from public.order_items where order_id = :'o2') = 3, 'with the permission enabled, a colleague can add items');
reset role;
update public.restaurants set settings = jsonb_set(settings, '{permissions,waiter_can_edit_others_orders}', 'false') where id = :'r3';
set role authenticated;
select set_config('request.jwt.claim.sub', :'W', false);
select tests.throws(format($$update public.orders set table_id = %L where id = %L$$, :'t5', :'o2'), 'move tables', 'waiter cannot move an order to another table');
select tests.throws(format($$update public.orders set discount_amount = 5 where id = %L$$, :'o2'), 'discounts', 'waiter cannot apply discounts');

-- Kitchen status permissions -----------------------------------------
select tests.throws(format($$update public.orders set status = 'accepted' where id = %L$$, :'o2'), 'kitchen staff or managers', 'waiter cannot accept orders');
select tests.throws(format($$update public.orders set status = 'served' where id = %L$$, :'o2'), 'marked Ready', 'waiter cannot serve before Ready');
select tests.throws(format($$update public.orders set status = 'completed' where id = %L$$, :'o2'), 'cashiers or managers', 'waiter cannot complete orders');
select set_config('request.jwt.claim.sub', :'K', false);
update public.orders set status = 'preparing' where id = :'o2';
select tests.throws(format($$update public.orders set notes = 'x' where id = %L$$, :'o2'), 'only change preparation status', 'kitchen can change only status');
select tests.throws(format($$update public.orders set status = 'new' where id = %L$$, :'o2'), 'backwards', 'kitchen cannot move an order backwards');
select tests.throws(format($$select public.submit_waiter_order(%L, %L, '[{"product_id":"%s","quantity":1,"unit_price":12}]'::jsonb, null, null, null, gen_random_uuid())$$, :'r3', :'t5', :'p1'),
  'not allowed to create orders', 'kitchen cannot create orders');
select tests.throws(format($$insert into public.order_items (restaurant_id, order_id, product_id, product_name, quantity, unit_price) values (%L, %L, %L, 'x', 1, 1)$$, :'r3', :'o2', :'p1'),
  'Kitchen staff cannot change order items', 'kitchen cannot add items');
update public.orders set status = 'ready' where id = :'o2';

-- Bill requests --------------------------------------------------------
select set_config('request.jwt.claim.sub', :'W2', false);
select tests.throws(format($$select public.request_bill(%L)$$, :'o2'), 'cannot request the bill', 'another waiter cannot request this bill');
select set_config('request.jwt.claim.sub', :'W', false);
select public.request_bill(:'o2');
select tests.throws(format($$select public.request_bill(%L)$$, :'o2'), 'already been requested', 'bill cannot be requested twice');
select tests.throws(format($$select public.add_order_items(%L, '[{"product_id":"%s","quantity":1,"unit_price":12}]'::jsonb, gen_random_uuid())$$, :'o2', :'p1'),
  'bill has been requested', 'items cannot be added while the bill is requested');
select public.cancel_bill_request(:'o2');
select tests.ok((select bill_requested_at is null from public.orders where id = :'o2'), 'waiter cancelled an unprocessed bill request');
select public.request_bill(:'o2');
select set_config('request.jwt.claim.sub', :'C', false);
select public.acknowledge_bill_request(:'o2');
select set_config('request.jwt.claim.sub', :'W', false);
select tests.throws(format($$select public.cancel_bill_request(%L)$$, :'o2'), 'already processing', 'waiter cannot cancel once the cashier is processing');
select tests.throws(format($$select public.acknowledge_bill_request(%L)$$, :'o2'), 'Only cashiers or managers', 'waiter cannot acknowledge bills');

-- Payments: waiter cannot record or alter -------------------------------
select tests.throws(format($$insert into public.payments (restaurant_id, order_id, method, amount) values (%L, %L, 'cash', 1)$$, :'r3', :'o2'),
  'permission denied', 'waiter cannot record payments');
select tests.throws(format($$select public.refund_order(%L, 1, 'cash', 'nope')$$, :'o1'), 'not authorized', 'waiter cannot refund');
select tests.throws(format($$select public.cancel_order(%L, 'nope nope')$$, :'o2'), 'not authorized', 'waiter cannot cancel orders');
select tests.throws($$update public.payments set amount = 0$$, 'permission denied', 'waiter cannot change payment records');
select tests.throws($$delete from public.payments$$, 'permission denied', 'waiter cannot delete payments');
select set_config('request.jwt.claim.sub', :'C', false);
select public.record_payments(:'o2', '[{"method":"cash","amount":5}]'::jsonb, gen_random_uuid(), false);
select tests.ok((select status from public.table_status_v where id = :'t3') = 'payment_pending', 'partial payment shows Payment Pending to waiters');
select public.record_payments(:'o2', '[{"method":"cash","amount":12.70}]'::jsonb, gen_random_uuid(), false);
select set_config('request.jwt.claim.sub', :'W', false);
select tests.ok((select payment_status from public.orders where id = :'o2') = 'paid', 'payment status synchronised to waiter');
select tests.ok((select count(*) from public.notifications where order_id = :'o2' and type = 'payment_completed') = 1, 'waiter notified of payment completion');
select tests.throws(format($$update public.restaurant_tables set needs_cleaning = false, capacity = 99 where id = %L$$, :'t3'), 'Only managers', 'waiter cannot mark tables or change table config');

-- Waiter limits on catalogue / admin -----------------------------------
select tests.ok(tests.affected(format($$update public.products set price = 0.01 where id = %L$$, :'p1')) = 0, 'waiter cannot change product prices');
select tests.throws(format($$insert into public.products (restaurant_id, name, price) values (%L, 'x', 1)$$, :'r3'), 'row-level security', 'waiter cannot create products');
select tests.ok(tests.affected(format($$update public.restaurants set tax_rate = 0 where id = %L$$, :'r3')) = 0, 'waiter cannot change restaurant settings');
select tests.throws(format($$insert into public.restaurant_members (restaurant_id, user_id, role) values (%L, %L, 'manager')$$, :'r3', :'W2'), 'permission denied', 'waiter cannot create staff accounts');
select tests.ok((select count(*) from public.expenses) = 0 and (select count(*) from public.suppliers) = 0 and (select count(*) from public.audit_logs) = 0
            and (select count(*) from public.stock_movements) = 0 and (select count(*) from public.purchase_orders) = 0, 'waiter has no access to financial administration');

-- Restaurant isolation --------------------------------------------------
select set_config('request.jwt.claim.sub', :'W4', false);
select tests.ok((select count(*) from public.orders where restaurant_id = :'r3') = 0 and (select count(*) from public.products where restaurant_id = :'r3') = 0
            and (select count(*) from public.table_status_v where restaurant_id = :'r3') = 0 and (select count(*) from public.notifications) = 0,
  'other restaurant''s waiter sees none of Restaurant 3');
select tests.throws(format($$select public.submit_waiter_order(%L, %L, '[{"product_id":"%s","quantity":1,"unit_price":12}]'::jsonb, null, null, null, gen_random_uuid())$$, :'r3', :'t5', :'p1'),
  'not allowed to create orders', 'other restaurant''s waiter cannot submit orders here');
select tests.throws(format($$select public.request_bill(%L)$$, :'o2'), 'cannot request the bill', 'other restaurant''s waiter cannot request bills here');
select tests.throws(format($$select public.submit_waiter_order(%L, %L, '[{"product_id":"%s","quantity":1,"unit_price":12}]'::jsonb, null, null, null, gen_random_uuid())$$, :'r4', :'t4_other', :'p1'),
  'Product not found', 'cannot order another restaurant''s product');

-- Notifications ---------------------------------------------------------
select set_config('request.jwt.claim.sub', :'W2', false);
select tests.ok((select count(*) from public.notifications where user_id = :'W'::uuid) = 0, 'a waiter cannot read colleagues'' notifications');
select set_config('request.jwt.claim.sub', :'W', false);
select count(*) as my_n from public.notifications \gset
select tests.ok(:my_n >= 6, 'waiter has their own notifications');
select tests.throws(format($$insert into public.notifications (restaurant_id, user_id, type, title) values (%L, %L, 'x', 'fake')$$, :'r3', :'W'), 'permission denied', 'clients cannot create notifications');
select tests.throws($$update public.notifications set title = 'x'$$, 'permission denied', 'only read state is editable');
select tests.ok(tests.affected($$delete from public.notifications where read_at is null$$) = 0, 'unread notifications cannot be cleared');
select tests.ok(tests.affected(format($$update public.notifications set read_at = now() where order_id = %L$$, :'o1')) > 0, 'mark notifications read');
select tests.ok(tests.affected(format($$delete from public.notifications where order_id = %L$$, :'o1')) > 0, 'clear read notifications');

-- Shifts and profile -----------------------------------------------------
select public.start_shift(:'r3') as sh1 \gset
select tests.ok(public.start_shift(:'r3') = :'sh1'::uuid, 'starting a shift twice returns the open shift');
select public.end_shift(:'r3');
select tests.ok((select ended_at is not null from public.staff_shifts where id = :'sh1'), 'shift ended');
select set_config('request.jwt.claim.sub', :'W2', false);
select tests.ok((select count(*) from public.staff_shifts where user_id = :'W'::uuid) = 0, 'colleagues cannot see each other''s shifts');
select set_config('request.jwt.claim.sub', :'M', false);
select tests.ok((select count(*) from public.staff_shifts where user_id = :'W'::uuid) = 1, 'manager can see staff shifts');
select set_config('request.jwt.claim.sub', :'W', false);
update public.profiles set full_name = 'Warsame Ali', phone = '+252634111222' where id = :'W';
select tests.ok((select full_name from public.profiles where id = :'W') = 'Warsame Ali', 'waiter updates own name and phone');
select tests.throws(format($$update public.profiles set email = 'x@y.z' where id = %L$$, :'W'), 'permission denied', 'waiter cannot change email via profile');
select tests.ok(tests.affected(format($$update public.profiles set full_name = 'x' where id = %L$$, :'W2')) = 0, 'waiter cannot edit another profile');

-- Optional multiple orders per table -----------------------------------
reset role;
update public.restaurants set settings = jsonb_set(settings, '{tables}', coalesce(settings->'tables', '{}'::jsonb) || '{"allow_multiple_orders": true}') where id = :'r3';
set role authenticated;
select set_config('request.jwt.claim.sub', :'W', false);
select public.submit_waiter_order(:'r3', :'t5', format('[{"product_id":"%s","quantity":1,"unit_price":12}]', :'p1')::jsonb, null, null, null, gen_random_uuid());
select public.submit_waiter_order(:'r3', :'t5', format('[{"product_id":"%s","quantity":1,"unit_price":12}]', :'p1')::jsonb, null, null, null, gen_random_uuid());
select tests.ok((select count(*) from public.orders where table_id = :'t5' and status = 'new') = 2, 'multiple orders per table only when the restaurant enables it');
reset role;

select count(*) - :before_count as passed from tests.results \gset
\o
\echo '==> waiter assertions passed:' :passed
