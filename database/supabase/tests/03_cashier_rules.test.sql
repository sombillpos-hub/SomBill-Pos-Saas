-- =====================================================================
-- SomBill Cashier POS – database tests with real records.
-- Part 1: 18-step acceptance workflow. Part 2: payment/refund/shift rules.
-- =====================================================================
\set ON_ERROR_STOP 1
set client_min_messages = warning;
\o /dev/null
reset role;
select count(*) as before_count from tests.results \gset

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000005a1', 'manager@r5.test', '{"full_name":"Hodan Manager"}'),
  ('00000000-0000-0000-0000-0000000005b1', 'waiter@r5.test',  '{"full_name":"Warsame Waiter"}'),
  ('00000000-0000-0000-0000-0000000005c1', 'cashier@r5.test', '{"full_name":"Cali Cashier"}'),
  ('00000000-0000-0000-0000-0000000005c2', 'cashier2@r5.test','{"full_name":"Caasha Cashier"}'),
  ('00000000-0000-0000-0000-0000000005d1', 'kitchen@r5.test', '{"full_name":"Khadar Kitchen"}'),
  ('00000000-0000-0000-0000-0000000006a1', 'manager@r6.test', '{"full_name":"Other Manager"}'),
  ('00000000-0000-0000-0000-0000000006c1', 'cashier@r6.test', '{"full_name":"Other Cashier"}');
\set M  '00000000-0000-0000-0000-0000000005a1'
\set W  '00000000-0000-0000-0000-0000000005b1'
\set C  '00000000-0000-0000-0000-0000000005c1'
\set C2 '00000000-0000-0000-0000-0000000005c2'
\set K  '00000000-0000-0000-0000-0000000005d1'
\set M6 '00000000-0000-0000-0000-0000000006a1'
\set C6 '00000000-0000-0000-0000-0000000006c1'

set role authenticated;
select set_config('request.jwt.claim.sub', :'M', false);
select public.create_restaurant('Hargeisa Grill', 'USD', 'Africa/Mogadishu') as r5 \gset
select set_config('request.jwt.claim.sub', :'M6', false);
select public.create_restaurant('Borama Bistro', 'USD', 'Africa/Mogadishu') as r6 \gset
reset role;
insert into public.restaurant_members (restaurant_id, user_id, role) values
  (:'r5', :'W', 'waiter'), (:'r5', :'C', 'cashier'), (:'r5', :'C2', 'cashier'), (:'r5', :'K', 'kitchen'), (:'r6', :'C6', 'cashier');
update public.restaurants set tax_rate = 0.10 where id in (:'r5', :'r6');

set role authenticated;
select set_config('request.jwt.claim.sub', :'M', false);
insert into public.categories (restaurant_id, name) values (:'r5', 'Mains') returning id as cat \gset
insert into public.inventory_items (restaurant_id, name, unit, quantity, unit_cost) values (:'r5', 'Rice', 'kg', 10, 1.5) returning id as rice \gset
insert into public.products (restaurant_id, category_id, name, price, cost_price, track_stock) values (:'r5', :'cat', 'Bariis iyo Hilib', 12.00, 5, true) returning id as p1 \gset
insert into public.products (restaurant_id, category_id, name, price, tax_category) values (:'r5', :'cat', 'Shaah', 1.50, 'exempt') returning id as p2 \gset
insert into public.product_recipe_items (restaurant_id, product_id, inventory_item_id, quantity) values (:'r5', :'p1', :'rice', 0.25);
insert into public.restaurant_tables (restaurant_id, table_number) values (:'r5', 4) returning id as t4 \gset
insert into public.restaurant_tables (restaurant_id, table_number) values (:'r5', 2) returning id as t2 \gset
insert into public.customers (restaurant_id, name, phone, address) values (:'r5', 'Hodan Ali', '+252634123456', 'Jigjiga Yar') returning id as cust \gset

-- =====================================================================
-- PART 1 – ACCEPTANCE WORKFLOW
-- =====================================================================
-- 1. Cashier logs in
select set_config('request.jwt.claim.sub', :'C', false);
select tests.ok(public.member_role(:'r5') = 'cashier', 'CASHIER ACCEPTANCE 1: session resolves to an active cashier');
-- 2. Cashier sees the menu created by the manager
select tests.ok((select count(*) from public.products where restaurant_id = :'r5' and archived_at is null and is_available) = 2, 'CASHIER ACCEPTANCE 2: cashier loads the manager''s menu');
-- 3. Cashier receives the waiter's order
select set_config('request.jwt.claim.sub', :'W', false);
select (public.submit_waiter_order(:'r5', :'t4', format('[{"product_id":"%s","quantity":2,"unit_price":12,"notes":"No onions"},{"product_id":"%s","quantity":3,"unit_price":1.5}]', :'p1', :'p2')::jsonb,
  'Allergy: nuts', null, 4, gen_random_uuid()) ->> 'order_id') as o1 \gset
select set_config('request.jwt.claim.sub', :'C', false);
select tests.ok((select count(*) from public.notifications where order_id = :'o1' and type = 'new_order') = 1, 'CASHIER ACCEPTANCE 3: cashier notified of the waiter''s new order');
-- 4. Cashier opens the active order
select tests.ok((select count(*) from public.orders where id = :'o1' and status not in ('completed', 'cancelled')) = 1, 'CASHIER ACCEPTANCE 4: order listed as active for the cashier');
-- 5. Cashier views details
select tests.ok((select count(*) from public.order_items where order_id = :'o1' and not is_voided) = 2
            and (select notes from public.order_items where order_id = :'o1' and product_id = :'p1') = 'No onions', 'CASHIER ACCEPTANCE 5: items and notes visible');
-- (kitchen prepares, waiter serves and requests the bill)
select set_config('request.jwt.claim.sub', :'K', false);
update public.orders set status = 'ready' where id = :'o1';
select set_config('request.jwt.claim.sub', :'W', false);
update public.orders set status = 'served' where id = :'o1';
select public.request_bill(:'o1');
-- 6. Cashier opens the bill: balance computed from recorded payments
select set_config('request.jwt.claim.sub', :'C', false);
select tests.ok((select subtotal = 28.50 and tax_amount = 2.40 and total = 30.90 and amount_paid = 0 from public.orders where id = :'o1'),
  'CASHIER ACCEPTANCE 6: bill 28.50 + VAT 2.40 = 30.90, nothing paid yet');
select public.open_cashier_shift(:'r5', 100.00, 'Float from safe') as shift_c \gset
-- 7–10. Choose methods, enter amounts, validate, record (split: cash + EVC Plus)
select public.record_payments(:'o1', '[{"method":"cash","amount":20,"amount_received":50},{"method":"evc_plus","amount":10.90,"reference":"EVC-55120"}]'::jsonb, gen_random_uuid()) as pay_res \gset
select tests.ok((:'pay_res'::jsonb ->> 'change')::numeric = 30, 'CASHIER ACCEPTANCE 9: cash change calculated (50 − 20 = 30)');
select tests.ok((select count(*) from public.payments where order_id = :'o1' and kind = 'payment') = 2, 'CASHIER ACCEPTANCE 10: two separate payment records (split)');
select tests.ok((select status from public.payments where order_id = :'o1' and method = 'evc_plus') = 'pending'
            and (select verification_status from public.payments where order_id = :'o1' and method = 'evc_plus') = 'pending',
  'CASHIER ACCEPTANCE 10: EVC Plus reference recorded as pending verification, not as paid');
-- 11. Outstanding balance
select tests.ok((:'pay_res'::jsonb ->> 'balance')::numeric = 10.90 and (select payment_status from public.orders where id = :'o1') = 'partial',
  'CASHIER ACCEPTANCE 11: outstanding 10.90 until mobile money is verified');
-- 12. Paid only when fully settled
select tests.ok((select status from public.orders where id = :'o1') = 'served', 'CASHIER ACCEPTANCE 12: not paid/closed while 10.90 is unverified');
select (select id from public.payments where order_id = :'o1' and method = 'evc_plus') as evc1 \gset
select public.verify_payment(:'evc1', true, 'Seen in EVC Plus merchant statement');
select tests.ok((select payment_status = 'paid' and status = 'completed' and amount_paid = 30.90 from public.orders where id = :'o1'),
  'CASHIER ACCEPTANCE 12: verified → fully settled → paid and closed');
-- 13–14. Receipt
select public.issue_receipt(:'o1') as rc \gset
select tests.ok((:'rc'::jsonb ->> 'receipt_number')::int = 1, 'CASHIER ACCEPTANCE 13: receipt #1 issued');
select tests.ok((public.issue_receipt(:'o1') ->> 'receipt_number')::int = 1, 'CASHIER ACCEPTANCE 13: re-issuing returns the same receipt number');
select tests.ok(public.mark_receipt_printed((:'rc'::jsonb ->> 'receipt_id')::uuid) = 1 and public.mark_receipt_printed((:'rc'::jsonb ->> 'receipt_id')::uuid) = 2,
  'CASHIER ACCEPTANCE 14: prints and reprints counted');
-- 15. Transaction history
select tests.ok((select count(*) from public.payments where order_id = :'o1' and transaction_number is not null and cashier_id = :'C'::uuid and shift_id = :'shift_c'::uuid) = 2,
  'CASHIER ACCEPTANCE 15: transactions numbered, attributed to the cashier and shift');
-- 16. Manager sees updated sales
select set_config('request.jwt.claim.sub', :'M', false);
select (public.sales_summary(:'r5', now() - interval '1 day', now() + interval '1 day')) as ss \gset
select tests.ok((:'ss'::jsonb ->> 'collected')::numeric = 30.90 and (:'ss'::jsonb ->> 'outstanding')::numeric = 0, 'CASHIER ACCEPTANCE 16: manager sees 30.90 collected, nothing outstanding');
-- 17. Waiter sees completed payment
select set_config('request.jwt.claim.sub', :'W', false);
select tests.ok((select payment_status from public.orders where id = :'o1') = 'paid'
            and (select count(*) from public.notifications where order_id = :'o1' and type in ('payment_completed', 'bill_acknowledged')) = 2,
  'CASHIER ACCEPTANCE 17: waiter sees paid and was notified (bill acknowledged, payment completed)');
-- 18. Table available
select tests.ok((select status from public.table_status_v where id = :'t4') = 'available', 'CASHIER ACCEPTANCE 18: Table 04 available again');

-- =====================================================================
-- PART 2 – RULES
-- =====================================================================
-- Role authorization and isolation
select tests.throws(format($$select public.record_payments(%L, '[{"method":"cash","amount":1}]'::jsonb, gen_random_uuid())$$, :'o1'), 'Only cashiers or managers', 'waiter cannot take payments');
select set_config('request.jwt.claim.sub', :'K', false);
select tests.throws(format($$select public.record_payments(%L, '[{"method":"cash","amount":1}]'::jsonb, gen_random_uuid())$$, :'o1'), 'Only cashiers or managers', 'kitchen cannot take payments');
select set_config('request.jwt.claim.sub', :'C6', false);
select tests.ok((select count(*) from public.orders where restaurant_id = :'r5') = 0 and (select count(*) from public.payments where restaurant_id = :'r5') = 0
            and (select count(*) from public.refunds where restaurant_id = :'r5') = 0 and (select count(*) from public.receipts where restaurant_id = :'r5') = 0,
  'other restaurant''s cashier sees no orders, payments, refunds or receipts');
select tests.throws(format($$select public.record_payments(%L, '[{"method":"cash","amount":1}]'::jsonb, gen_random_uuid())$$, :'o1'), 'Only cashiers or managers', 'other restaurant''s cashier cannot take payments');
select tests.throws(format($$select public.issue_receipt(%L)$$, :'o1'), 'Only cashiers or managers', 'other restaurant''s cashier cannot issue receipts');

-- New sale by the cashier (takeaway / delivery / dine-in rules)
select set_config('request.jwt.claim.sub', :'C', false);
select (public.submit_pos_order(:'r5', 'takeaway', null, format('[{"product_id":"%s","quantity":1,"unit_price":12}]', :'p1')::jsonb, null, null, null, 0, null, gen_random_uuid()) ->> 'order_id') as o2 \gset
select tests.ok((select order_type = 'takeaway' and table_id is null and cashier_id = :'C'::uuid and waiter_id is null and total = 13.20 from public.orders where id = :'o2'),
  'cashier creates a takeaway sale (12 + VAT 1.20 = 13.20)');
select tests.throws(format($$select public.submit_pos_order(%L, 'dine_in', null, '[{"product_id":"%s","quantity":1,"unit_price":12}]'::jsonb, null, null, null, 0, null, gen_random_uuid())$$, :'r5', :'p1'), 'Select a table', 'dine-in needs a table');
select tests.throws(format($$select public.submit_pos_order(%L, 'delivery', null, '[{"product_id":"%s","quantity":1,"unit_price":12}]'::jsonb, null, null, null, 0, null, gen_random_uuid())$$, :'r5', :'p1'), 'customer for delivery', 'delivery needs a customer');
select tests.throws(format($$select public.submit_pos_order(%L, 'takeaway', %L, '[{"product_id":"%s","quantity":1,"unit_price":12}]'::jsonb, null, null, null, 0, null, gen_random_uuid())$$, :'r5', :'t2', :'p1'), 'no table', 'takeaway cannot occupy a table');
select tests.throws(format($$select public.submit_pos_order(%L, 'takeaway', null, '[{"product_id":"%s","quantity":1,"unit_price":11}]'::jsonb, null, null, null, 0, null, gen_random_uuid())$$, :'r5', :'p1'), 'PRICE_CHANGED', 'cashier cannot change manager prices');
select (public.submit_pos_order(:'r5', 'delivery', null, format('[{"product_id":"%s","quantity":1,"unit_price":12}]', :'p1')::jsonb, 'Ring twice', :'cust', null, 1.20, 'Loyal customer', gen_random_uuid()) ->> 'order_id') as o3 \gset
select tests.ok((select discount_amount = 1.20 and tax_amount = 1.08 and total = 11.88 from public.orders where id = :'o3'),
  'delivery with authorised 10% discount: tax on discounted base (10.80 + 1.08 = 11.88)');

-- Discount authorization
select tests.throws(format($$select public.apply_discount(%L, 6, 'Too generous')$$, :'o2'), 'DISCOUNT_LIMIT', 'cashier cannot exceed the discount limit');
select tests.throws(format($$select public.apply_discount(%L, 1, '')$$, :'o2'), 'reason is required', 'discount needs a reason');
select tests.throws(format($$update public.orders set discount_amount = 1 where id = %L$$, :'o2'), 'apply_discount', 'direct discount edits blocked');
select set_config('request.jwt.claim.sub', :'M', false);
select tests.ok((public.apply_discount(:'o2', 6, 'Manager comp') ->> 'total')::numeric = 6.60, 'manager may discount beyond the cashier limit');
select tests.ok((public.apply_discount(:'o2', 0, null) ->> 'total')::numeric = 13.20, 'discount removed');
select tests.throws(format($$select public.apply_discount(%L, 20, 'x x x')$$, :'o2'), 'exceed the subtotal', 'discount cannot exceed subtotal');

-- Shift is required for cashiers
select set_config('request.jwt.claim.sub', :'C2', false);
select tests.throws(format($$select public.record_payments(%L, '[{"method":"cash","amount":1}]'::jsonb, gen_random_uuid())$$, :'o2'), 'NO_OPEN_SHIFT', 'cashier without an open shift cannot take payments');

-- Payment validation
select set_config('request.jwt.claim.sub', :'C', false);
select tests.throws(format($$select public.record_payments(%L, '[{"method":"cash","amount":5,"amount_received":4}]'::jsonb, gen_random_uuid())$$, :'o2'), 'less than the amount', 'cash received below amount rejected');
select tests.throws(format($$select public.record_payments(%L, '[{"method":"cash","amount":-5}]'::jsonb, gen_random_uuid())$$, :'o2'), 'positive', 'negative payment rejected');
select tests.throws(format($$select public.record_payments(%L, '[{"method":"cash","amount":1.005}]'::jsonb, gen_random_uuid())$$, :'o2'), '2 decimals', 'sub-cent payment rejected');
select tests.throws(format($$select public.record_payments(%L, '[{"method":"card","amount":5}]'::jsonb, gen_random_uuid())$$, :'o2'), 'terminal transaction ID', 'card needs the terminal transaction ID');
select tests.throws(format($$select public.record_payments(%L, '[{"method":"card","amount":5,"reference":"TERM-1"}]'::jsonb, gen_random_uuid())$$, :'o2'), 'terminal approved', 'card needs explicit terminal approval confirmation');
select tests.throws(format($$select public.record_payments(%L, '[{"method":"zaad","amount":5}]'::jsonb, gen_random_uuid())$$, :'o2'), 'transaction reference', 'mobile money needs a reference');
select tests.throws(format($$select public.record_payments(%L, '[{"method":"evc_plus","amount":5,"reference":"evc-55120"}]'::jsonb, gen_random_uuid())$$, :'o2'), 'DUPLICATE_REFERENCE', 'same mobile reference cannot be recorded twice (case-insensitive)');
select tests.throws(format($$select public.record_payments(%L, '[{"method":"cash","amount":10},{"method":"zaad","amount":5,"reference":"ZAAD-1001"}]'::jsonb, gen_random_uuid())$$, :'o2'), 'OVERPAYMENT', 'split total above balance rejected');
select tests.throws(format($$select public.record_payments(%L, '[{"method":"bank_transfer","amount":1}]'::jsonb, gen_random_uuid())$$, :'o2'), 'Unsupported payment method', 'unsupported method rejected');
select tests.ok((select count(*) from public.payments where order_id = :'o2') = 0, 'rejected attempts left no payment rows');

-- Partial payment, idempotency, pending reservation, rejection
select gen_random_uuid() as k1 \gset
select public.record_payments(:'o2', '[{"method":"cash","amount":5}]'::jsonb, :'k1');
select tests.ok((public.record_payments(:'o2', '[{"method":"cash","amount":5}]'::jsonb, :'k1') ->> 'duplicate')::boolean, 'repeat submission with the same key is ignored');
select tests.ok((select count(*) from public.payments where order_id = :'o2') = 1 and (select payment_status from public.orders where id = :'o2') = 'partial',
  'partial payment recorded once; order partially paid');
select (public.record_payments(:'o2', '[{"method":"somtel_money","amount":8.20,"reference":"SOM-9001"}]'::jsonb, gen_random_uuid()) -> 'payment_ids' ->> 0) as som \gset
select tests.throws(format($$select public.record_payments(%L, '[{"method":"cash","amount":1}]'::jsonb, gen_random_uuid())$$, :'o2'), 'ALREADY_SETTLED', 'pending mobile money reserves the balance against double payment');
select set_config('request.jwt.claim.sub', :'W', false);
select tests.throws(format($$select public.verify_payment(%L, true)$$, :'som'), 'not authorized', 'waiter cannot verify payments');
select set_config('request.jwt.claim.sub', :'C', false);
select tests.throws(format($$select public.verify_payment(%L, false)$$, :'som'), 'reason for rejecting', 'rejection needs a reason');
select public.verify_payment(:'som', false, 'Reference not found in Somtel statement');
select tests.ok((select status = 'failed' and verification_status = 'rejected' and verified_by = :'C'::uuid from public.payments where id = :'som')
            and (select payment_status from public.orders where id = :'o2') = 'partial', 'rejected mobile money does not count; balance reopens');
select tests.throws(format($$select public.verify_payment(%L, true)$$, :'som'), 'already failed', 'a decided verification cannot be changed');
select public.record_payments(:'o2', '[{"method":"somtel_money","amount":8.20,"reference":"SOM-9001"}]'::jsonb, gen_random_uuid());
select tests.ok(true, 'a rejected reference may be re-submitted after correction');
reset role;
update public.restaurants set settings = jsonb_set(settings, '{permissions,cashier_can_verify_mobile_money}', 'false') where id = :'r5';
set role authenticated;
select set_config('request.jwt.claim.sub', :'C', false);
select (select id from public.payments where order_id = :'o2' and status = 'pending') as som2 \gset
select tests.throws(format($$select public.verify_payment(%L, true)$$, :'som2'), 'not authorized', 'cashier verification can be restricted by the manager');
select set_config('request.jwt.claim.sub', :'M', false);
select public.verify_payment(:'som2', true, 'Confirmed by manager');
select tests.ok((select payment_status from public.orders where id = :'o2') = 'paid', 'manager verification settles the order');
select tests.ok((select status from public.orders where id = :'o2') = 'new', 'paid takeaway still in kitchen is not closed early');
select tests.throws(format($$select public.close_paid_order(%L)$$, :'o3'), 'not fully paid', 'unpaid order cannot be closed');

-- Immutability
select set_config('request.jwt.claim.sub', :'C', false);
select tests.throws($$update public.payments set amount = 1$$, 'permission denied', 'cashier cannot edit payments');
select tests.throws($$delete from public.payments$$, 'permission denied', 'cashier cannot delete payments');
reset role;
select tests.throws(format($$update public.payments set verification_note = 'tamper' where id = %L$$, :'evc1'), 'immutable', 'verified payments immutable even for service role');
set role authenticated;

-- Refunds
select set_config('request.jwt.claim.sub', :'C', false);
select (select id from public.payments where order_id = :'o1' and method = 'cash') as cashpay \gset
select (select id from public.order_items where order_id = :'o1' and product_id = :'p1') as item1 \gset
select gen_random_uuid() as rk1 \gset
select public.process_refund(:'cashpay', 12.00, 'cash', 'Dish returned cold', null, format('[{"order_item_id":"%s","quantity":1}]', :'item1')::jsonb, true, :'rk1') as rf1 \gset
select tests.ok((:'rf1'::jsonb ->> 'status') = 'pending_approval', 'cashier refund without permission waits for manager approval');
select tests.ok((select count(*) from public.payments where order_id = :'o1' and kind = 'refund') = 0, 'no money leaves before approval');
select tests.ok((public.process_refund(:'cashpay', 12.00, 'cash', 'Dish returned cold', null, '[]'::jsonb, false, :'rk1') ->> 'duplicate')::boolean, 'duplicate refund submission ignored');
select tests.throws(format($$select public.process_refund(%L, 9, 'cash', 'More please', null, '[]'::jsonb, false, gen_random_uuid())$$, :'cashpay'), 'REFUND_EXCEEDS', 'cannot refund more than eligible on the transaction');
select tests.throws(format($$select public.process_refund(%L, 1, 'cash', 'Again', null, '[{"order_item_id":"%s","quantity":2}]'::jsonb, false, gen_random_uuid())$$, :'evc1', :'item1'), 'can still be refunded', 'item quantities cannot be refunded twice');
select tests.throws(format($$select public.process_refund(%L, 1, 'evc_plus', 'To wallet', null, '[]'::jsonb, false, gen_random_uuid())$$, :'evc1'), 'refund reference', 'non-cash refund needs a reference');
select tests.throws(format($$select public.decide_refund(%L, true)$$, (:'rf1'::jsonb ->> 'refund_id')), 'Only managers', 'cashier cannot approve refunds');
select set_config('request.jwt.claim.sub', :'M', false);
select tests.ok((select count(*) from public.notifications where type = 'refund_approval' and user_id = :'M'::uuid) = 1, 'manager notified of the pending refund');
select public.decide_refund((:'rf1'::jsonb ->> 'refund_id')::uuid, true, 'OK');
select tests.ok((select status from public.refunds where id = (:'rf1'::jsonb ->> 'refund_id')::uuid) = 'completed'
            and (select amount_refunded from public.orders where id = :'o1') = 12.00
            and (select count(*) from public.payments where order_id = :'o1' and kind = 'refund' and refund_of = :'cashpay'::uuid) = 1,
  'approved refund: separate refund record + ledger row; original payment kept');
select tests.ok((select quantity from public.inventory_items where id = :'rice') = 9.75, 'item-level restock returned 0.25 kg (10 − 0.5 sold + 0.25)');
select tests.ok(((public.sales_summary(:'r5', now() - interval '1 day', now() + interval '1 day')) ->> 'net_collected')::numeric = 30.90 + 13.20 - 12.00,
  'net collected recalculated after refund');
reset role;
update public.restaurants set settings = jsonb_set(jsonb_set(settings, '{permissions,cashier_can_refund}', 'true'), '{permissions,cashier_refund_limit}', '5') where id = :'r5';
set role authenticated;
select set_config('request.jwt.claim.sub', :'C', false);
select tests.ok((public.process_refund(:'cashpay', 3, 'cash', 'Small apology', null, '[]'::jsonb, false, gen_random_uuid()) ->> 'status') = 'completed', 'within the cashier limit: completed immediately');
select tests.throws(format($$select public.process_refund(%L, 5.01, 'cash', 'Over remaining', null, '[]'::jsonb, false, gen_random_uuid())$$, :'cashpay'), 'at most 5.00', 'eligible amount shrinks with each refund (20 − 12 − 3 = 5)');
select tests.ok((public.process_refund(:'evc1', 5.01, 'evc_plus', 'Over limit', 'EVC-RF-0001', '[]'::jsonb, false, gen_random_uuid()) ->> 'status') = 'pending_approval', 'above the cashier limit: needs approval');
select (select id from public.refunds where amount = 5.01) as rf2 \gset
select set_config('request.jwt.claim.sub', :'M', false);
select tests.throws(format($$select public.decide_refund(%L, false)$$, :'rf2'), 'reason for rejecting', 'rejection needs a reason');
select public.decide_refund(:'rf2', false, 'Not justified');
select tests.ok((select status from public.refunds where id = :'rf2') = 'rejected', 'manager rejected the refund');
select tests.throws(format($$select public.decide_refund(%L, true)$$, :'rf2'), 'already rejected', 'decided refund cannot be re-decided');
select set_config('request.jwt.claim.sub', :'C', false);
select tests.throws(format($$update public.refunds set amount = 1 where id = %L$$, :'rf2'), 'permission denied', 'refund records cannot be edited');
select tests.throws(format($$select public.process_refund(%L, 1, 'cash', 'nope nope', null, '[]'::jsonb, false, gen_random_uuid())$$, :'som'), 'Only successful payments', 'failed/pending payments cannot be refunded');

-- Receipts
select tests.throws(format($$select public.issue_receipt(%L)$$, :'o3'), 'No confirmed payment', 'no receipt before a confirmed payment');
select set_config('request.jwt.claim.sub', :'W', false);
select tests.throws(format($$select public.issue_receipt(%L)$$, :'o1'), 'Only cashiers or managers', 'waiter cannot issue receipts');
select tests.ok((select count(*) from public.receipts where order_id = :'o1') = 1, 'waiter can see that a receipt exists');

-- Shift management and cash reconciliation
select set_config('request.jwt.claim.sub', :'C', false);
select tests.throws(format($$select public.open_cashier_shift(%L, 10)$$, :'r5'), 'already have an open shift', 'one open shift per cashier');
select public.add_cash_movement(:'shift_c', 'pay_in', 25, 'Change from bank');
select tests.throws(format($$select public.add_cash_movement(%L, 'pay_out', 10000, 'Too much')$$, :'shift_c'), 'expected in the drawer', 'cannot pay out more than the drawer holds');
select public.add_cash_movement(:'shift_c', 'pay_out', 10, 'Bought ice');
-- expected = 100 opening + cash sales (20 + 5) − cash refunds (12 + 3) + 25 in − 10 out = 125
select (public.cashier_shift_summary(:'shift_c')) as sum1 \gset
select tests.ok((:'sum1'::jsonb ->> 'cash_sales')::numeric = 25 and (:'sum1'::jsonb ->> 'cash_refunds')::numeric = 15 and (:'sum1'::jsonb ->> 'expected_cash')::numeric = 125,
  'shift summary: expected cash = opening + cash sales − cash refunds + pay-ins − pay-outs');
select tests.ok((:'sum1'::jsonb -> 'by_method' ->> 'evc_plus')::numeric = 10.90, 'shift summary shows non-cash totals by method');
select set_config('request.jwt.claim.sub', :'C2', false);
select tests.ok((select count(*) from public.cashier_shifts where cashier_id = :'C'::uuid) = 0, 'cashiers cannot see colleagues'' shifts');
select tests.throws(format($$select public.close_cashier_shift(%L, 125)$$, :'shift_c'), 'Not your shift', 'cashier cannot close a colleague''s shift');
select set_config('request.jwt.claim.sub', :'C', false);
select tests.throws(format($$select public.close_cashier_shift(%L, 120)$$, :'shift_c'), 'Explain the cash difference', 'difference requires a closing note');
select (public.close_cashier_shift(:'shift_c', 120, 'Short 5 – coin counting error suspected')) as close1 \gset
select tests.ok((:'close1'::jsonb ->> 'difference')::numeric = -5 and (select status = 'closed' and expected_cash = 125 and counted_cash = 120 and cash_difference = -5 from public.cashier_shifts where id = :'shift_c'),
  'shift closed with expected 125, counted 120, difference −5');
select tests.throws(format($$select public.add_cash_movement(%L, 'pay_in', 1, 'late')$$, :'shift_c'), 'closed', 'closed shift accepts no cash movements');
select tests.throws(format($$update public.cashier_shifts set counted_cash = 125 where id = %L$$, :'shift_c'), 'permission denied', 'closed shift cannot be edited by the cashier');
reset role;
select tests.throws(format($$update public.cashier_shifts set counted_cash = 125 where id = %L$$, :'shift_c'), 'close_cashier_shift', 'closed shift guarded even for service role');
select tests.throws($$delete from public.cash_movements$$, 'immutable', 'cash movements immutable');
set role authenticated;
select set_config('request.jwt.claim.sub', :'C', false);
select tests.throws(format($$select public.record_payments(%L, '[{"method":"cash","amount":1}]'::jsonb, gen_random_uuid())$$, :'o3'), 'NO_OPEN_SHIFT', 'after closing, payments need a new shift');
select set_config('request.jwt.claim.sub', :'M', false);
select tests.ok((select count(*) from public.cashier_shifts where cashier_id = :'C'::uuid) = 1 and (select count(*) from public.audit_logs where action in ('shift_open', 'shift_close')) = 2,
  'manager sees the shift and its audit trail');
reset role;

select count(*) - :before_count as passed from tests.results \gset
\o
\echo '==> cashier assertions passed:' :passed
