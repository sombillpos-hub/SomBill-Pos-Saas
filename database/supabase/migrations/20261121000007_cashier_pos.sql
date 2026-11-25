-- =====================================================================
-- SomBill – Cashier POS: payments, verification, split/partial, refunds,
-- discounts, cashier shifts, cash movements, receipts.
-- Migration: 20261121000007_cashier_pos.sql
-- Depends on 000001–000006. Idempotent and additive.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Settings helpers
-- ---------------------------------------------------------------------
create or replace function public.restaurant_number(p_restaurant uuid, p_section text, p_key text, p_default numeric)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce((select (settings -> p_section ->> p_key)::numeric from public.restaurants where id = p_restaurant), p_default)
$$;

alter table public.restaurants add column if not exists txn_seq bigint not null default 0;
alter table public.restaurants add column if not exists receipt_seq bigint not null default 0;

-- ---------------------------------------------------------------------
-- Cashier shifts (cash drawer sessions) and cash movements
-- (staff_shifts from 000005 is attendance; this is money accountability.)
-- ---------------------------------------------------------------------
create table if not exists public.cashier_shifts (
  id              uuid primary key default gen_random_uuid(),
  restaurant_id   uuid not null references public.restaurants(id) on delete restrict,
  cashier_id      uuid not null references auth.users(id) on delete restrict,
  status          text not null default 'open' check (status in ('open', 'closed')),
  opened_at       timestamptz not null default now(),
  opening_cash    numeric(12,2) not null check (opening_cash >= 0),
  opening_notes   text,
  closed_at       timestamptz,
  closed_by       uuid references auth.users(id) on delete set null,
  expected_cash   numeric(12,2),
  counted_cash    numeric(12,2) check (counted_cash is null or counted_cash >= 0),
  cash_difference numeric(12,2),
  closing_notes   text,
  summary         jsonb,
  check ((status = 'open') = (closed_at is null))
);
create unique index if not exists uq_open_cashier_shift on public.cashier_shifts(restaurant_id, cashier_id) where status = 'open';
create index if not exists idx_cashier_shifts_rest on public.cashier_shifts(restaurant_id, opened_at desc);

create table if not exists public.cash_movements (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references public.restaurants(id) on delete restrict,
  shift_id       uuid not null references public.cashier_shifts(id) on delete restrict,
  movement_type  text not null check (movement_type in ('pay_in', 'pay_out', 'drop')),
  amount         numeric(12,2) not null check (amount > 0),
  reason         text not null check (length(trim(reason)) >= 3),
  created_by     uuid references auth.users(id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now()
);
create index if not exists idx_cash_movements_shift on public.cash_movements(shift_id);

-- ---------------------------------------------------------------------
-- Payments: verification, references, shift link, transaction numbers
-- ---------------------------------------------------------------------
alter table public.payments add column if not exists transaction_number bigint;
alter table public.payments add column if not exists verification_status text not null default 'not_required';
alter table public.payments add column if not exists verified_by uuid references auth.users(id) on delete set null;
alter table public.payments add column if not exists verified_at timestamptz;
alter table public.payments add column if not exists verification_note text;
alter table public.payments add column if not exists shift_id uuid references public.cashier_shifts(id) on delete restrict;
alter table public.payments add column if not exists amount_received numeric(12,2);
alter table public.payments add column if not exists change_given numeric(12,2);
alter table public.payments add column if not exists request_key uuid;
alter table public.payments add column if not exists refund_of uuid references public.payments(id) on delete restrict;

do $$ begin
  alter table public.payments drop constraint if exists payments_status_check;
  alter table public.payments add constraint payments_status_check check (status in ('succeeded', 'failed', 'pending'));
  alter table public.payments drop constraint if exists payments_verification_check;
  alter table public.payments add constraint payments_verification_check
    check (verification_status in ('not_required', 'terminal_confirmed', 'pending', 'verified', 'rejected'));
  alter table public.payments drop constraint if exists payments_cash_change_check;
  alter table public.payments add constraint payments_cash_change_check
    check (amount_received is null or (amount_received >= amount and change_given = amount_received - amount));
end $$;

create unique index if not exists uq_payments_txn_number on public.payments(restaurant_id, transaction_number) where transaction_number is not null;
-- The same mobile-money reference can never be recorded twice (unless the earlier one was rejected).
create unique index if not exists uq_payments_mobile_ref on public.payments(restaurant_id, method, lower(reference))
  where kind = 'payment' and status <> 'failed' and reference is not null
    and method in ('evc_plus', 'zaad', 'somtel_money', 'mobile_money');
create index if not exists idx_payments_shift on public.payments(shift_id);
create index if not exists idx_payments_pending on public.payments(restaurant_id) where status = 'pending';

create or replace function public.is_mobile_money(m public.payment_method)
returns boolean language sql immutable as $$ select m in ('evc_plus', 'zaad', 'somtel_money', 'mobile_money') $$;

-- All payment rows are written by SECURITY DEFINER functions only.
create or replace function public.payments_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare o public.orders; v_net numeric(12,2); v_pending numeric(12,2);
begin
  if coalesce(current_setting('sombill.internal', true), '') <> 'on' then
    raise exception 'Use record_payments() or process_refund() – payments cannot be inserted directly' using errcode = '42501';
  end if;
  select * into o from public.orders where id = new.order_id for update;
  if o.restaurant_id <> new.restaurant_id then
    raise exception 'Payment restaurant mismatch' using errcode = '23503';
  end if;
  update public.restaurants set txn_seq = txn_seq + 1 where id = new.restaurant_id returning txn_seq into new.transaction_number;
  v_net := o.amount_paid - o.amount_refunded;
  if new.kind = 'payment' then
    if o.status = 'cancelled' then
      raise exception 'Cannot take payment for a cancelled order' using errcode = '23514';
    end if;
    select coalesce(sum(amount), 0) into v_pending from public.payments
     where order_id = o.id and kind = 'payment' and status = 'pending';
    if new.status in ('succeeded', 'pending') and v_net + v_pending + new.amount > o.total + 0.001 then
      raise exception 'OVERPAYMENT: payment exceeds outstanding balance (%)', greatest(o.total - v_net - v_pending, 0) using errcode = '23514';
    end if;
  else
    if new.amount > v_net + 0.001 then
      raise exception 'Refund exceeds collected amount (%)', v_net using errcode = '23514';
    end if;
  end if;
  return new;
end $$;

-- Ledger immutability: only a pending payment's verification outcome may be
-- recorded, and only by internal (verify_payment) code. Never deletable.
create or replace function public.block_payment_mutation()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and coalesce(current_setting('sombill.internal', true), '') = 'on'
     and old.status = 'pending' and new.status in ('succeeded', 'failed')
     and (to_jsonb(new) - array['status','verification_status','verified_by','verified_at','verification_note'])
       = (to_jsonb(old) - array['status','verification_status','verified_by','verified_at','verification_note']) then
    return new;
  end if;
  raise exception 'Payments are an immutable ledger; record a refund instead' using errcode = '42501';
end $$;

-- Re-run payment state after a verification outcome.
create or replace function public.payments_after_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.refresh_payment_state(new.order_id);
  return null;
end $$;
drop trigger if exists trg_payments_after_update on public.payments;
create trigger trg_payments_after_update after update on public.payments
  for each row execute function public.payments_after_update();

-- Direct discount changes are blocked; use apply_discount() (limits + reason + audit).
create or replace function public.orders_discount_guard()
returns trigger language plpgsql as $$
begin
  if new.discount_amount <> old.discount_amount and coalesce(current_setting('sombill.internal', true), '') <> 'on' then
    raise exception 'Use apply_discount() to change discounts' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists trg_orders_discount_guard on public.orders;
create trigger trg_orders_discount_guard before update of discount_amount on public.orders
  for each row execute function public.orders_discount_guard();

-- ---------------------------------------------------------------------
-- Idempotency ledger for payment submissions
-- ---------------------------------------------------------------------
create table if not exists public.payment_requests (
  idempotency_key uuid primary key,
  restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
  order_id        uuid not null references public.orders(id) on delete cascade,
  result          jsonb not null,
  created_by      uuid references auth.users(id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now()
);

create or replace function public.open_cashier_shift_id(p_restaurant uuid, p_user uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.cashier_shifts where restaurant_id = p_restaurant and cashier_id = p_user and status = 'open'
$$;

-- Closes a fully paid order once the food has been served/handed over.
create or replace function public.try_close_paid_order(p_order uuid)
returns text language plpgsql security definer set search_path = public as $$
declare o public.orders;
begin
  select * into o from public.orders where id = p_order;
  if o.payment_status <> 'paid' or o.status not in ('ready', 'served') then return null; end if;
  begin
    update public.orders set status = 'completed', cashier_id = coalesce(cashier_id, auth.uid()) where id = p_order;
    return 'completed';
  exception when others then
    return 'close_failed: ' || sqlerrm;   -- payment stands; order stays open for follow-up
  end;
end $$;

-- ---------------------------------------------------------------------
-- record_payments – one or many (split) payments, atomically
-- p_payments: [{"method": "cash", "amount": 10, "amount_received": 20},
--              {"method": "evc_plus", "amount": 5, "reference": "TX123"},
--              {"method": "card", "amount": 7, "reference": "TERM-88", "terminal_confirmed": true}]
-- ---------------------------------------------------------------------
create or replace function public.record_payments(
  p_order uuid, p_payments jsonb, p_idempotency_key uuid, p_close_order boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare o public.orders; v_role public.app_role; v_prev text := coalesce(current_setting('sombill.internal', true), '');
        v_existing public.payment_requests; v_shift uuid; e jsonb; v_method public.payment_method; v_amount numeric;
        v_received numeric; v_ref text; v_total numeric := 0; v_out numeric; v_pending numeric; v_ids uuid[] := '{}';
        v_id uuid; v_change numeric := 0; v_close text; v_result jsonb; v_has_pending boolean := false;
begin
  select * into o from public.orders where id = p_order for update;   -- serialises concurrent attempts
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;
  v_role := public.member_role(o.restaurant_id);
  if v_role is null or v_role not in ('cashier', 'manager') then
    raise exception 'Only cashiers or managers can record payments' using errcode = '42501';
  end if;
  if p_idempotency_key is null then raise exception 'Idempotency key required' using errcode = '22023'; end if;
  select * into v_existing from public.payment_requests where idempotency_key = p_idempotency_key;
  if found then
    if v_existing.order_id <> p_order then raise exception 'Idempotency key reused for a different order' using errcode = '22023'; end if;
    return v_existing.result || jsonb_build_object('duplicate', true);
  end if;
  if o.status = 'cancelled' then raise exception 'This order is cancelled' using errcode = '23514'; end if;

  v_shift := public.open_cashier_shift_id(o.restaurant_id, auth.uid());
  if v_shift is null and v_role = 'cashier' and public.restaurant_flag(o.restaurant_id, 'permissions', 'require_open_shift', true) then
    raise exception 'NO_OPEN_SHIFT: open your cash shift before taking payments' using errcode = '23514';
  end if;

  if p_payments is null or jsonb_typeof(p_payments) <> 'array' or jsonb_array_length(p_payments) = 0 then
    raise exception 'Add at least one payment' using errcode = '23514';
  end if;
  if jsonb_array_length(p_payments) > 6 then raise exception 'Too many split payments' using errcode = '23514'; end if;

  select coalesce(sum(amount), 0) into v_pending from public.payments where order_id = o.id and kind = 'payment' and status = 'pending';
  v_out := round(o.total - (o.amount_paid - o.amount_refunded) - v_pending, 2);
  if v_out <= 0 then
    raise exception 'ALREADY_SETTLED: nothing is outstanding on order #%', o.order_number using errcode = '23514';
  end if;

  -- Validate every line before writing anything.
  for e in select * from jsonb_array_elements(p_payments) loop
    begin
      v_method := (e->>'method')::public.payment_method;
      v_amount := (e->>'amount')::numeric;
      v_received := nullif(e->>'amount_received', '')::numeric;
    exception when others then
      raise exception 'Invalid payment line' using errcode = '22023';
    end;
    if v_method not in ('cash', 'card', 'evc_plus', 'zaad', 'somtel_money') then
      raise exception 'Unsupported payment method %', v_method using errcode = '22023';
    end if;
    if v_amount is null or v_amount <= 0 or v_amount <> round(v_amount, 2) then
      raise exception 'Payment amounts must be positive with at most 2 decimals' using errcode = '23514';
    end if;
    v_ref := nullif(trim(coalesce(e->>'reference', '')), '');
    if v_method = 'cash' then
      if v_received is not null and v_received < v_amount then
        raise exception 'Cash received (%) is less than the amount (%)', v_received, v_amount using errcode = '23514';
      end if;
    elsif v_method = 'card' then
      if v_ref is null or length(v_ref) < 4 then raise exception 'Enter the card terminal transaction ID' using errcode = '23514'; end if;
      if coalesce((e->>'terminal_confirmed')::boolean, false) is not true then
        raise exception 'Confirm that the card terminal approved the payment' using errcode = '23514';
      end if;
    else
      if v_ref is null or length(v_ref) < 4 then raise exception 'Enter the mobile money transaction reference' using errcode = '23514'; end if;
    end if;
    v_total := v_total + v_amount;
  end loop;
  if v_total > v_out + 0.001 then
    raise exception 'OVERPAYMENT: payments total % but only % is outstanding', v_total, v_out using errcode = '23514';
  end if;

  perform set_config('sombill.internal', 'on', true);
  for e in select * from jsonb_array_elements(p_payments) loop
    v_method := (e->>'method')::public.payment_method;
    v_amount := (e->>'amount')::numeric;
    v_received := case when v_method = 'cash' then nullif(e->>'amount_received', '')::numeric end;
    v_ref := nullif(trim(coalesce(e->>'reference', '')), '');
    begin
      insert into public.payments (restaurant_id, order_id, kind, method, amount, status, reference, notes, cashier_id, shift_id,
                                   verification_status, amount_received, change_given, request_key)
      values (o.restaurant_id, o.id, 'payment', v_method, v_amount,
              case when public.is_mobile_money(v_method) then 'pending' else 'succeeded' end,
              v_ref, nullif(trim(coalesce(e->>'note', '')), ''), auth.uid(), v_shift,
              case when v_method = 'cash' then 'not_required' when v_method = 'card' then 'terminal_confirmed' else 'pending' end,
              v_received, case when v_received is not null then v_received - v_amount end, p_idempotency_key)
      returning id into v_id;
    exception when unique_violation then
      raise exception 'DUPLICATE_REFERENCE: reference % has already been recorded for %', v_ref, v_method using errcode = '23505';
    end;
    v_ids := v_ids || v_id;
    if v_received is not null then v_change := v_change + (v_received - v_amount); end if;
    if public.is_mobile_money(v_method) then v_has_pending := true; end if;
  end loop;

  -- The cashier is now handling this bill.
  update public.orders set bill_acknowledged_at = coalesce(bill_acknowledged_at, case when bill_requested_at is not null then now() end),
         bill_acknowledged_by = coalesce(bill_acknowledged_by, case when bill_requested_at is not null then auth.uid() end)
   where id = o.id;
  perform set_config('sombill.internal', v_prev, true);
  update public.orders set cashier_id = auth.uid() where id = o.id and cashier_id is null and status not in ('completed', 'cancelled');

  if p_close_order then v_close := public.try_close_paid_order(o.id); end if;
  select * into o from public.orders where id = p_order;
  select coalesce(sum(amount), 0) into v_pending from public.payments where order_id = o.id and kind = 'payment' and status = 'pending';
  v_result := jsonb_build_object(
    'payment_ids', to_jsonb(v_ids),
    'transaction_numbers', (select jsonb_agg(transaction_number order by transaction_number) from public.payments where id = any(v_ids)),
    'payment_status', o.payment_status, 'order_status', o.status, 'total', o.total,
    'paid', o.amount_paid - o.amount_refunded, 'pending_verification', v_pending,
    'balance', round(greatest(o.total - (o.amount_paid - o.amount_refunded), 0), 2),
    'change', round(v_change, 2), 'close', v_close, 'awaiting_verification', v_has_pending, 'duplicate', false);
  insert into public.payment_requests (idempotency_key, restaurant_id, order_id, result) values (p_idempotency_key, o.restaurant_id, o.id, v_result);
  if v_has_pending then
    perform public.notify_roles(o.restaurant_id, array['manager']::public.app_role[], 'payment_verification',
      'Mobile money payment awaiting verification – order #' || o.order_number, null, o.id, o.table_id);
  end if;
  return v_result;
end $$;

-- ---------------------------------------------------------------------
-- Manual verification of mobile money (no provider integration exists)
-- ---------------------------------------------------------------------
create or replace function public.verify_payment(p_payment uuid, p_approve boolean, p_note text default null, p_close_order boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare p public.payments; o public.orders; v_role public.app_role; v_prev text := coalesce(current_setting('sombill.internal', true), ''); v_close text;
begin
  select * into p from public.payments where id = p_payment for update;
  if not found then raise exception 'Payment not found' using errcode = 'P0002'; end if;
  select * into o from public.orders where id = p.order_id for update;
  v_role := public.member_role(p.restaurant_id);
  if not (v_role = 'manager' or (v_role = 'cashier'
          and public.restaurant_flag(p.restaurant_id, 'permissions', 'cashier_can_verify_mobile_money', true))) then
    raise exception 'You are not authorized to verify payments' using errcode = '42501';
  end if;
  if p.status <> 'pending' then raise exception 'This payment is already %', p.status using errcode = '23514'; end if;
  if not p_approve and (p_note is null or length(trim(p_note)) < 3) then
    raise exception 'Give a reason for rejecting the payment' using errcode = '23514';
  end if;
  perform set_config('sombill.internal', 'on', true);
  update public.payments set status = case when p_approve then 'succeeded' else 'failed' end,
         verification_status = case when p_approve then 'verified' else 'rejected' end,
         verified_by = auth.uid(), verified_at = now(), verification_note = nullif(trim(coalesce(p_note, '')), '')
   where id = p_payment;
  perform set_config('sombill.internal', v_prev, true);
  perform public.write_audit(p.restaurant_id, case when p_approve then 'payment_verified' else 'payment_rejected' end, 'payments', p.id,
    jsonb_build_object('status', 'pending'), jsonb_build_object('method', p.method, 'reference', p.reference, 'amount', p.amount), p_note);
  if p_approve and p_close_order then v_close := public.try_close_paid_order(o.id); end if;
  select * into o from public.orders where id = p.order_id;
  return jsonb_build_object('payment_status', o.payment_status, 'order_status', o.status,
    'balance', round(greatest(o.total - (o.amount_paid - o.amount_refunded), 0), 2), 'close', v_close);
end $$;

create or replace function public.close_paid_order(p_order uuid)
returns text language plpgsql security definer set search_path = public as $$
declare o public.orders;
begin
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;
  if not public.has_role(o.restaurant_id, array['cashier', 'manager']::public.app_role[]) then
    raise exception 'Only cashiers or managers can close orders' using errcode = '42501';
  end if;
  if o.payment_status <> 'paid' then raise exception 'The order is not fully paid' using errcode = '23514'; end if;
  if o.status = 'completed' then return 'completed'; end if;
  update public.orders set status = 'completed', cashier_id = coalesce(cashier_id, auth.uid()) where id = p_order;
  return 'completed';
end $$;

-- ---------------------------------------------------------------------
-- Discounts (authorised limits + reason + audit)
-- ---------------------------------------------------------------------
create or replace function public.apply_discount(p_order uuid, p_amount numeric, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare o public.orders; v_role public.app_role; v_max numeric; v_prev text := coalesce(current_setting('sombill.internal', true), ''); v_pending numeric;
begin
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;
  v_role := public.member_role(o.restaurant_id);
  if v_role is null or v_role not in ('cashier', 'manager') then
    raise exception 'Only cashiers or managers can apply discounts' using errcode = '42501';
  end if;
  if o.status in ('completed', 'cancelled') then raise exception 'This order is %', o.status using errcode = '23514'; end if;
  select coalesce(sum(amount), 0) into v_pending from public.payments where order_id = o.id and kind = 'payment' and status in ('pending', 'succeeded');
  if v_pending > 0 then raise exception 'Discounts can only be changed before any payment is taken' using errcode = '23514'; end if;
  if p_amount is null or p_amount < 0 or p_amount <> round(p_amount, 2) then
    raise exception 'Invalid discount amount' using errcode = '23514';
  end if;
  if p_amount > o.subtotal then raise exception 'Discount cannot exceed the subtotal (%)', o.subtotal using errcode = '23514'; end if;
  if p_amount > 0 and (p_reason is null or length(trim(p_reason)) < 3) then
    raise exception 'A discount reason is required' using errcode = '23514';
  end if;
  if v_role = 'cashier' then
    v_max := public.restaurant_number(o.restaurant_id, 'permissions', 'cashier_max_discount_percent', 10);
    if p_amount > round(o.subtotal * v_max / 100, 2) + 0.001 then
      raise exception 'DISCOUNT_LIMIT: cashiers may discount at most %%% (%). Ask a manager.', v_max, round(o.subtotal * v_max / 100, 2) using errcode = '42501';
    end if;
  end if;
  perform set_config('sombill.internal', 'on', true);
  update public.orders set discount_amount = p_amount where id = p_order;
  perform set_config('sombill.internal', v_prev, true);
  perform public.write_audit(o.restaurant_id, 'discount', 'orders', o.id, jsonb_build_object('discount_amount', o.discount_amount),
    jsonb_build_object('discount_amount', p_amount), p_reason);
  select * into o from public.orders where id = p_order;
  return jsonb_build_object('subtotal', o.subtotal, 'discount', o.discount_amount, 'tax', o.tax_amount, 'total', o.total);
end $$;

-- ---------------------------------------------------------------------
-- Cashier order creation (dine-in / takeaway / delivery)
-- ---------------------------------------------------------------------
create or replace function public.submit_pos_order(
  p_restaurant uuid, p_order_type public.order_type, p_table uuid, p_items jsonb, p_notes text default null,
  p_customer uuid default null, p_guest_count int default null, p_discount numeric default 0,
  p_discount_reason text default null, p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_role public.app_role; v_existing public.pos_requests; o public.orders;
begin
  v_role := public.member_role(p_restaurant);
  if v_role is null or v_role not in ('cashier', 'manager', 'waiter') then
    raise exception 'You are not allowed to create orders for this restaurant' using errcode = '42501';
  end if;
  if p_idempotency_key is null then raise exception 'Idempotency key required' using errcode = '22023'; end if;
  select * into v_existing from public.pos_requests where idempotency_key = p_idempotency_key;
  if found then
    if v_existing.restaurant_id <> p_restaurant or v_existing.kind <> 'create_order' then
      raise exception 'Idempotency key reused for a different request' using errcode = '22023';
    end if;
    select * into o from public.orders where id = v_existing.order_id;
    return jsonb_build_object('order_id', o.id, 'order_number', o.order_number, 'total', o.total, 'duplicate', true);
  end if;
  if p_order_type = 'dine_in' and p_table is null then raise exception 'Select a table for dine-in' using errcode = '23514'; end if;
  if p_order_type <> 'dine_in' and p_table is not null then raise exception 'Takeaway and delivery orders have no table' using errcode = '23514'; end if;
  if p_order_type = 'delivery' and p_customer is null then raise exception 'Select the customer for delivery' using errcode = '23514'; end if;
  if v_role = 'waiter' and p_order_type <> 'dine_in' then raise exception 'Waiters create dine-in orders only' using errcode = '42501'; end if;
  if length(coalesce(p_notes, '')) > 500 then raise exception 'Order notes are limited to 500 characters' using errcode = '23514'; end if;
  if p_guest_count is not null and (p_guest_count < 1 or p_guest_count > 50) then
    raise exception 'Guest count must be between 1 and 50' using errcode = '23514';
  end if;
  perform public.validate_pos_items(p_restaurant, p_items);

  insert into public.orders (restaurant_id, table_id, waiter_id, cashier_id, customer_id, order_type, notes, guest_count)
  values (p_restaurant, p_table, case when v_role = 'waiter' then auth.uid() end, case when v_role in ('cashier', 'manager') then auth.uid() end,
          p_customer, p_order_type, nullif(trim(coalesce(p_notes, '')), ''), p_guest_count)
  returning * into o;
  perform public.insert_pos_items(p_restaurant, o.id, p_items);
  insert into public.pos_requests (idempotency_key, restaurant_id, kind, order_id) values (p_idempotency_key, p_restaurant, 'create_order', o.id);
  if coalesce(p_discount, 0) > 0 then
    perform public.apply_discount(o.id, p_discount, p_discount_reason);
  end if;
  select * into o from public.orders where id = o.id;
  return jsonb_build_object('order_id', o.id, 'order_number', o.order_number, 'total', o.total, 'duplicate', false);
end $$;

-- ---------------------------------------------------------------------
-- Refunds (separate records; approval for restricted refunds)
-- ---------------------------------------------------------------------
create table if not exists public.refunds (
  id                 uuid primary key default gen_random_uuid(),
  restaurant_id      uuid not null references public.restaurants(id) on delete restrict,
  order_id           uuid not null references public.orders(id) on delete restrict,
  payment_id         uuid references public.payments(id) on delete restrict,     -- original transaction
  refund_payment_id  uuid references public.payments(id) on delete restrict,     -- ledger row once paid out
  amount             numeric(12,2) not null check (amount > 0),
  method             public.payment_method not null,
  reason             text not null check (length(trim(reason)) >= 3),
  reference          text,
  items              jsonb not null default '[]'::jsonb,
  restock            boolean not null default false,
  status             text not null default 'pending_approval' check (status in ('pending_approval', 'completed', 'rejected')),
  shift_id           uuid references public.cashier_shifts(id) on delete restrict,
  requested_by       uuid references auth.users(id) on delete set null default auth.uid(),
  approved_by        uuid references auth.users(id) on delete set null,
  decided_at         timestamptz,
  decision_note      text,
  idempotency_key    uuid unique,
  created_at         timestamptz not null default now()
);
create index if not exists idx_refunds_rest on public.refunds(restaurant_id, created_at desc);
create index if not exists idx_refunds_payment on public.refunds(payment_id);

create or replace function public.execute_refund(p_refund uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare rf public.refunds; o public.orders; v_prev text := coalesce(current_setting('sombill.internal', true), ''); v_pay uuid; e jsonb;
        it public.order_items; p public.products; rec record;
begin
  select * into rf from public.refunds where id = p_refund for update;
  select * into o from public.orders where id = rf.order_id for update;
  perform set_config('sombill.internal', 'on', true);
  insert into public.payments (restaurant_id, order_id, kind, method, amount, status, reference, notes, cashier_id, shift_id, refund_of)
  values (rf.restaurant_id, rf.order_id, 'refund', rf.method, rf.amount, 'succeeded', rf.reference, rf.reason,
          rf.requested_by, rf.shift_id, rf.payment_id)
  returning id into v_pay;
  update public.refunds set refund_payment_id = v_pay, status = 'completed', decided_at = coalesce(decided_at, now()) where id = p_refund;
  -- Item-level restock, only if stock was deducted and not already fully reversed.
  if rf.restock and o.stock_deducted_at is not null and o.stock_reversed_at is null then
    for e in select * from jsonb_array_elements(rf.items) loop
      select * into it from public.order_items where id = (e->>'order_item_id')::uuid;
      select * into p from public.products where id = it.product_id;
      if p.track_stock then
        for rec in select inventory_item_id, quantity from public.product_recipe_items where product_id = p.id loop
          perform public.apply_stock_movement(rec.inventory_item_id, 'sale_reversal', rec.quantity * (e->>'quantity')::numeric, null, 'refund', rf.id, 'Refund: ' || rf.reason);
        end loop;
        if p.inventory_item_id is not null and not exists (select 1 from public.product_recipe_items where product_id = p.id) then
          perform public.apply_stock_movement(p.inventory_item_id, 'sale_reversal', (e->>'quantity')::numeric, null, 'refund', rf.id, 'Refund: ' || rf.reason);
        end if;
      end if;
    end loop;
  end if;
  perform set_config('sombill.internal', v_prev, true);
  perform public.write_audit(rf.restaurant_id, 'refund', 'orders', rf.order_id, null,
    jsonb_build_object('refund_id', rf.id, 'amount', rf.amount, 'method', rf.method, 'payment_id', rf.payment_id, 'restock', rf.restock), rf.reason);
  if rf.requested_by is distinct from auth.uid() then
    perform public.notify_user(rf.restaurant_id, rf.requested_by, 'refund_approved', 'Refund approved – order #' || o.order_number, rf.reason, o.id, o.table_id);
  end if;
  return v_pay;
end $$;

create or replace function public.process_refund(
  p_payment uuid, p_amount numeric, p_method public.payment_method, p_reason text, p_reference text default null,
  p_items jsonb default '[]'::jsonb, p_restock boolean default false, p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare p public.payments; o public.orders; v_role public.app_role; v_existing public.refunds; v_eligible numeric; v_net numeric;
        e jsonb; it public.order_items; v_done numeric; v_shift uuid; v_id uuid; v_status text; v_limit numeric;
begin
  if p_idempotency_key is null then raise exception 'Idempotency key required' using errcode = '22023'; end if;
  select * into v_existing from public.refunds where idempotency_key = p_idempotency_key;
  if found then return jsonb_build_object('refund_id', v_existing.id, 'status', v_existing.status, 'duplicate', true); end if;
  select * into p from public.payments where id = p_payment for update;   -- serialises refunds of one transaction
  if not found then raise exception 'Original transaction not found' using errcode = 'P0002'; end if;
  select * into o from public.orders where id = p.order_id for update;
  v_role := public.member_role(p.restaurant_id);
  if v_role is null or v_role not in ('cashier', 'manager') then
    raise exception 'Only cashiers or managers can refund' using errcode = '42501';
  end if;
  if p.kind <> 'payment' or p.status <> 'succeeded' then
    raise exception 'Only successful payments can be refunded' using errcode = '23514';
  end if;
  if p_reason is null or length(trim(p_reason)) < 3 then raise exception 'A refund reason is required' using errcode = '23514'; end if;
  if p_amount is null or p_amount <= 0 or p_amount <> round(p_amount, 2) then raise exception 'Invalid refund amount' using errcode = '23514'; end if;
  if p_method not in ('cash', 'card', 'evc_plus', 'zaad', 'somtel_money') then raise exception 'Unsupported refund method' using errcode = '22023'; end if;
  if p_method <> 'cash' and (p_reference is null or length(trim(p_reference)) < 4) then
    raise exception 'Enter the refund reference for % refunds', p_method using errcode = '23514';
  end if;
  select p.amount - coalesce(sum(amount), 0) into v_eligible from public.refunds
   where payment_id = p.id and status in ('completed', 'pending_approval');
  v_net := o.amount_paid - o.amount_refunded
           - coalesce((select sum(amount) from public.refunds where order_id = o.id and status = 'pending_approval'), 0);
  if p_amount > least(v_eligible, v_net) + 0.001 then
    raise exception 'REFUND_EXCEEDS: at most % can be refunded on this transaction', greatest(least(v_eligible, v_net), 0) using errcode = '23514';
  end if;
  -- Item quantities cannot be refunded twice.
  if p_items is not null and jsonb_typeof(p_items) = 'array' then
    for e in select * from jsonb_array_elements(p_items) loop
      select * into it from public.order_items where id = (e->>'order_item_id')::uuid and order_id = o.id;
      if not found then raise exception 'Item does not belong to this order' using errcode = '23503'; end if;
      if (e->>'quantity')::numeric <= 0 then raise exception 'Refund quantities must be positive' using errcode = '23514'; end if;
      select coalesce(sum((x->>'quantity')::numeric), 0) into v_done from public.refunds r, jsonb_array_elements(r.items) x
       where r.order_id = o.id and r.status in ('completed', 'pending_approval') and (x->>'order_item_id')::uuid = it.id;
      if v_done + (e->>'quantity')::numeric > it.quantity then
        raise exception 'Only % of "%" can still be refunded', it.quantity - v_done, it.product_name using errcode = '23514';
      end if;
    end loop;
  end if;

  v_shift := public.open_cashier_shift_id(o.restaurant_id, auth.uid());
  if v_shift is null and v_role = 'cashier' and public.restaurant_flag(o.restaurant_id, 'permissions', 'require_open_shift', true) then
    raise exception 'NO_OPEN_SHIFT: open your cash shift before refunding' using errcode = '23514';
  end if;
  v_limit := public.restaurant_number(o.restaurant_id, 'permissions', 'cashier_refund_limit', 0);
  v_status := case when v_role = 'manager' then 'completed'
                   when public.restaurant_flag(o.restaurant_id, 'permissions', 'cashier_can_refund', false) and p_amount <= v_limit then 'completed'
                   else 'pending_approval' end;
  insert into public.refunds (restaurant_id, order_id, payment_id, amount, method, reason, reference, items, restock, status, shift_id,
                              approved_by, decided_at, idempotency_key)
  values (o.restaurant_id, o.id, p.id, p_amount, p_method, trim(p_reason), nullif(trim(coalesce(p_reference, '')), ''),
          coalesce(p_items, '[]'::jsonb), coalesce(p_restock, false), 'pending_approval', v_shift,
          case when v_status = 'completed' then auth.uid() end, null, p_idempotency_key)
  returning id into v_id;
  if v_status = 'completed' then
    perform public.execute_refund(v_id);
  else
    perform public.notify_roles(o.restaurant_id, array['manager']::public.app_role[], 'refund_approval',
      'Refund awaiting approval – order #' || o.order_number, trim(p_reason), o.id, o.table_id);
  end if;
  return jsonb_build_object('refund_id', v_id, 'status', v_status, 'duplicate', false);
end $$;

create or replace function public.decide_refund(p_refund uuid, p_approve boolean, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare rf public.refunds; o public.orders;
begin
  select * into rf from public.refunds where id = p_refund for update;
  if not found then raise exception 'Refund not found' using errcode = 'P0002'; end if;
  if not public.is_manager(rf.restaurant_id) then raise exception 'Only managers can approve refunds' using errcode = '42501'; end if;
  if rf.status <> 'pending_approval' then raise exception 'This refund is already %', rf.status using errcode = '23514'; end if;
  if not p_approve and (p_note is null or length(trim(p_note)) < 3) then raise exception 'Give a reason for rejecting' using errcode = '23514'; end if;
  update public.refunds set approved_by = auth.uid(), decided_at = now(), decision_note = nullif(trim(coalesce(p_note, '')), ''),
         status = case when p_approve then status else 'rejected' end where id = p_refund;
  select * into o from public.orders where id = rf.order_id;
  if p_approve then
    if rf.amount > (o.amount_paid - o.amount_refunded) + 0.001 then raise exception 'Refund now exceeds the collected amount' using errcode = '23514'; end if;
    perform public.execute_refund(p_refund);
  else
    perform public.notify_user(rf.restaurant_id, rf.requested_by, 'refund_rejected', 'Refund rejected – order #' || o.order_number, p_note, o.id, o.table_id);
  end if;
  select * into rf from public.refunds where id = p_refund;
  return jsonb_build_object('refund_id', rf.id, 'status', rf.status);
end $$;

-- Manager dashboard's whole-order refund now also writes a refunds record.
create or replace function public.refund_order(
  p_order uuid, p_amount numeric, p_method public.payment_method, p_reason text, p_restock boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare o public.orders; v_id uuid; v_pay uuid; v_prev text := coalesce(current_setting('sombill.internal', true), '');
begin
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'Order not found'; end if;
  if not public.has_permission(o.restaurant_id, 'cashier_can_refund')
     or not (public.is_manager(o.restaurant_id) or public.has_role(o.restaurant_id, array['cashier']::public.app_role[])) then
    raise exception 'You are not authorized to refund' using errcode = '42501';
  end if;
  if p_reason is null or length(trim(p_reason)) < 3 then raise exception 'A refund reason is required' using errcode = '23514'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Refund amount must be positive' using errcode = '23514'; end if;
  if p_amount > (o.amount_paid - o.amount_refunded) + 0.001 then
    raise exception 'Refund exceeds collected amount (%)', o.amount_paid - o.amount_refunded using errcode = '23514';
  end if;
  insert into public.refunds (restaurant_id, order_id, amount, method, reason, restock, status, approved_by, decided_at,
                              shift_id)
  values (o.restaurant_id, o.id, p_amount, p_method, trim(p_reason), p_restock, 'completed', auth.uid(), now(),
          public.open_cashier_shift_id(o.restaurant_id, auth.uid()))
  returning id into v_id;
  perform set_config('sombill.internal', 'on', true);
  insert into public.payments (restaurant_id, order_id, kind, method, amount, notes, shift_id)
  values (o.restaurant_id, o.id, 'refund', p_method, p_amount, trim(p_reason), public.open_cashier_shift_id(o.restaurant_id, auth.uid()))
  returning id into v_pay;
  update public.refunds set refund_payment_id = v_pay where id = v_id;
  if p_restock and o.stock_deducted_at is not null and o.stock_reversed_at is null then
    perform public.reverse_order_stock(o.id, 'Refund: ' || trim(p_reason));
  end if;
  perform set_config('sombill.internal', v_prev, true);
  perform public.write_audit(o.restaurant_id, 'refund', 'orders', o.id, null,
    jsonb_build_object('amount', p_amount, 'method', p_method, 'restock', p_restock, 'refund_id', v_id), trim(p_reason));
  return v_pay;
end $$;

-- ---------------------------------------------------------------------
-- Cashier shift lifecycle
-- ---------------------------------------------------------------------
create or replace function public.cashier_shift_summary(p_shift uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare s public.cashier_shifts; v jsonb; v_cash_sales numeric; v_cash_refunds numeric; v_in numeric; v_out numeric;
begin
  select * into s from public.cashier_shifts where id = p_shift;
  if not found then raise exception 'Shift not found' using errcode = 'P0002'; end if;
  if not (s.cashier_id = auth.uid() or public.is_manager(s.restaurant_id)) then
    raise exception 'Not your shift' using errcode = '42501';
  end if;
  select coalesce(sum(amount) filter (where kind = 'payment' and method = 'cash' and status = 'succeeded'), 0),
         coalesce(sum(amount) filter (where kind = 'refund' and method = 'cash'), 0)
    into v_cash_sales, v_cash_refunds from public.payments where shift_id = p_shift;
  select coalesce(sum(amount) filter (where movement_type = 'pay_in'), 0),
         coalesce(sum(amount) filter (where movement_type in ('pay_out', 'drop')), 0)
    into v_in, v_out from public.cash_movements where shift_id = p_shift;
  select jsonb_build_object(
    'opening_cash', s.opening_cash,
    'cash_sales', v_cash_sales, 'cash_refunds', v_cash_refunds, 'pay_in', v_in, 'pay_out', v_out,
    'expected_cash', s.opening_cash + v_cash_sales - v_cash_refunds + v_in - v_out,
    'by_method', coalesce((select jsonb_object_agg(method, total) from (
        select method::text, sum(amount) as total from public.payments
         where shift_id = p_shift and kind = 'payment' and status = 'succeeded' group by method) t), '{}'::jsonb),
    'pending_verification', coalesce((select sum(amount) from public.payments where shift_id = p_shift and kind = 'payment' and status = 'pending'), 0),
    'refunds_total', coalesce((select sum(amount) from public.payments where shift_id = p_shift and kind = 'refund'), 0),
    'transactions', (select count(*) from public.payments where shift_id = p_shift),
    'collected_total', coalesce((select sum(amount) from public.payments where shift_id = p_shift and kind = 'payment' and status = 'succeeded'), 0)
  ) into v;
  return v;
end $$;

create or replace function public.open_cashier_shift(p_restaurant uuid, p_opening_cash numeric, p_notes text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if not public.has_role(p_restaurant, array['cashier', 'manager']::public.app_role[]) then
    raise exception 'Only cashiers or managers can open a cash shift' using errcode = '42501';
  end if;
  if public.open_cashier_shift_id(p_restaurant, auth.uid()) is not null then
    raise exception 'You already have an open shift' using errcode = '23505';
  end if;
  if p_opening_cash is null or p_opening_cash < 0 or p_opening_cash <> round(p_opening_cash, 2) then
    raise exception 'Enter a valid opening cash amount' using errcode = '23514';
  end if;
  insert into public.cashier_shifts (restaurant_id, cashier_id, opening_cash, opening_notes)
  values (p_restaurant, auth.uid(), p_opening_cash, nullif(trim(coalesce(p_notes, '')), '')) returning id into v;
  perform public.write_audit(p_restaurant, 'shift_open', 'cashier_shifts', v, null, jsonb_build_object('opening_cash', p_opening_cash), p_notes);
  return v;
end $$;

create or replace function public.add_cash_movement(p_shift uuid, p_type text, p_amount numeric, p_reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare s public.cashier_shifts; v uuid; v_expected numeric;
begin
  select * into s from public.cashier_shifts where id = p_shift for update;
  if not found then raise exception 'Shift not found' using errcode = 'P0002'; end if;
  if s.cashier_id <> auth.uid() and not public.is_manager(s.restaurant_id) then raise exception 'Not your shift' using errcode = '42501'; end if;
  if s.status <> 'open' then raise exception 'This shift is closed' using errcode = '23514'; end if;
  if p_type not in ('pay_in', 'pay_out', 'drop') then raise exception 'Invalid movement type' using errcode = '22023'; end if;
  if p_amount is null or p_amount <= 0 or p_amount <> round(p_amount, 2) then raise exception 'Invalid amount' using errcode = '23514'; end if;
  if p_type <> 'pay_in' then
    v_expected := (public.cashier_shift_summary(p_shift) ->> 'expected_cash')::numeric;
    if p_amount > v_expected + 0.001 then raise exception 'Only % cash is expected in the drawer', v_expected using errcode = '23514'; end if;
  end if;
  insert into public.cash_movements (restaurant_id, shift_id, movement_type, amount, reason)
  values (s.restaurant_id, p_shift, p_type, p_amount, trim(coalesce(p_reason, ''))) returning id into v;
  return v;
end $$;

create or replace function public.close_cashier_shift(p_shift uuid, p_counted_cash numeric, p_notes text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s public.cashier_shifts; v_sum jsonb; v_expected numeric; v_diff numeric; v_prev text := coalesce(current_setting('sombill.internal', true), '');
begin
  select * into s from public.cashier_shifts where id = p_shift for update;
  if not found then raise exception 'Shift not found' using errcode = 'P0002'; end if;
  if s.cashier_id <> auth.uid() and not public.is_manager(s.restaurant_id) then raise exception 'Not your shift' using errcode = '42501'; end if;
  if s.status <> 'open' then raise exception 'This shift is already closed' using errcode = '23514'; end if;
  if p_counted_cash is null or p_counted_cash < 0 or p_counted_cash <> round(p_counted_cash, 2) then
    raise exception 'Enter the counted cash' using errcode = '23514';
  end if;
  v_sum := public.cashier_shift_summary(p_shift);
  v_expected := (v_sum ->> 'expected_cash')::numeric;
  v_diff := p_counted_cash - v_expected;
  if v_diff <> 0 and (p_notes is null or length(trim(p_notes)) < 3) then
    raise exception 'Explain the cash difference of % in the closing notes', v_diff using errcode = '23514';
  end if;
  perform set_config('sombill.internal', 'on', true);
  update public.cashier_shifts set status = 'closed', closed_at = now(), closed_by = auth.uid(), expected_cash = v_expected,
         counted_cash = p_counted_cash, cash_difference = v_diff, closing_notes = nullif(trim(coalesce(p_notes, '')), ''), summary = v_sum
   where id = p_shift;
  perform set_config('sombill.internal', v_prev, true);
  perform public.write_audit(s.restaurant_id, 'shift_close', 'cashier_shifts', s.id, null,
    jsonb_build_object('expected_cash', v_expected, 'counted_cash', p_counted_cash, 'difference', v_diff), p_notes);
  return v_sum || jsonb_build_object('counted_cash', p_counted_cash, 'difference', v_diff);
end $$;

create or replace function public.cashier_shifts_guard()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then raise exception 'Cash shifts are never deleted' using errcode = '42501'; end if;
  if coalesce(current_setting('sombill.internal', true), '') <> 'on' then
    raise exception 'Use open_cashier_shift() / close_cashier_shift()' using errcode = '42501';
  end if;
  if old.status = 'closed' then raise exception 'A closed shift cannot be modified' using errcode = '42501'; end if;
  return new;
end $$;
drop trigger if exists trg_cashier_shifts_guard on public.cashier_shifts;
create trigger trg_cashier_shifts_guard before update or delete on public.cashier_shifts
  for each row execute function public.cashier_shifts_guard();

create or replace function public.immutable_row()
returns trigger language plpgsql as $$
begin
  raise exception '% records are immutable', tg_table_name using errcode = '42501';
end $$;
drop trigger if exists trg_cash_movements_immutable on public.cash_movements;
create trigger trg_cash_movements_immutable before update or delete on public.cash_movements
  for each row execute function public.immutable_row();

create or replace function public.refunds_guard()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then raise exception 'Refund records are never deleted' using errcode = '42501'; end if;
  if old.status in ('completed', 'rejected') and (to_jsonb(new) - 'refund_payment_id') <> (to_jsonb(old) - 'refund_payment_id') then
    raise exception 'A decided refund cannot be modified' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists trg_refunds_guard on public.refunds;
create trigger trg_refunds_guard before update or delete on public.refunds
  for each row execute function public.refunds_guard();

-- ---------------------------------------------------------------------
-- Receipts (one number per order; reprints counted)
-- ---------------------------------------------------------------------
create table if not exists public.receipts (
  id               uuid primary key default gen_random_uuid(),
  restaurant_id    uuid not null references public.restaurants(id) on delete restrict,
  order_id         uuid not null unique references public.orders(id) on delete restrict,
  receipt_number   bigint not null,
  issued_by        uuid references auth.users(id) on delete set null default auth.uid(),
  issued_at        timestamptz not null default now(),
  print_count      int not null default 0,
  last_printed_at  timestamptz,
  last_printed_by  uuid references auth.users(id) on delete set null,
  unique (restaurant_id, receipt_number)
);

create or replace function public.issue_receipt(p_order uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare o public.orders; r public.receipts; v_no bigint;
begin
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;
  if not public.has_role(o.restaurant_id, array['cashier', 'manager']::public.app_role[]) then
    raise exception 'Only cashiers or managers can issue receipts' using errcode = '42501';
  end if;
  select * into r from public.receipts where order_id = p_order;
  if found then return jsonb_build_object('receipt_id', r.id, 'receipt_number', r.receipt_number, 'print_count', r.print_count, 'new', false); end if;
  if not exists (select 1 from public.payments where order_id = p_order and kind = 'payment' and status = 'succeeded') then
    raise exception 'No confirmed payment yet – print the bill instead' using errcode = '23514';
  end if;
  update public.restaurants set receipt_seq = receipt_seq + 1 where id = o.restaurant_id returning receipt_seq into v_no;
  insert into public.receipts (restaurant_id, order_id, receipt_number) values (o.restaurant_id, p_order, v_no) returning * into r;
  return jsonb_build_object('receipt_id', r.id, 'receipt_number', r.receipt_number, 'print_count', 0, 'new', true);
end $$;

create or replace function public.mark_receipt_printed(p_receipt uuid)
returns int language plpgsql security definer set search_path = public as $$
declare r public.receipts;
begin
  select * into r from public.receipts where id = p_receipt for update;
  if not found then raise exception 'Receipt not found' using errcode = 'P0002'; end if;
  if not public.has_role(r.restaurant_id, array['cashier', 'manager']::public.app_role[]) then
    raise exception 'Only cashiers or managers can print receipts' using errcode = '42501';
  end if;
  update public.receipts set print_count = print_count + 1, last_printed_at = now(), last_printed_by = auth.uid() where id = p_receipt;
  if r.print_count >= 1 then
    perform public.write_audit(r.restaurant_id, 'receipt_reprint', 'receipts', r.id, null, jsonb_build_object('print', r.print_count + 1), null);
  end if;
  return r.print_count + 1;
end $$;

-- ---------------------------------------------------------------------
-- RLS and grants
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['cashier_shifts','cash_movements','payment_requests','refunds','receipts'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end $$;

drop policy if exists sb_cashier_shifts_select on public.cashier_shifts;
create policy sb_cashier_shifts_select on public.cashier_shifts for select to authenticated
  using (cashier_id = auth.uid() or public.is_manager(restaurant_id));
drop policy if exists sb_cash_movements_select on public.cash_movements;
create policy sb_cash_movements_select on public.cash_movements for select to authenticated
  using (public.is_manager(restaurant_id) or exists (select 1 from public.cashier_shifts s where s.id = shift_id and s.cashier_id = auth.uid()));
drop policy if exists sb_refunds_select on public.refunds;
create policy sb_refunds_select on public.refunds for select to authenticated
  using (public.has_role(restaurant_id, array['cashier', 'manager']::public.app_role[]));
drop policy if exists sb_receipts_select on public.receipts;
create policy sb_receipts_select on public.receipts for select to authenticated
  using (public.is_member(restaurant_id));

-- Payments: no client inserts at all (record_payments / process_refund only).
drop policy if exists sb_payments_insert on public.payments;
revoke insert, update, delete on public.payments from authenticated;

revoke all on public.cashier_shifts, public.cash_movements, public.payment_requests, public.refunds, public.receipts from anon, authenticated;
grant select on public.cashier_shifts, public.cash_movements, public.refunds, public.receipts to authenticated;
revoke update (txn_seq, receipt_seq) on public.restaurants from authenticated;

revoke execute on function public.execute_refund(uuid) from public, anon, authenticated;
revoke execute on function public.try_close_paid_order(uuid) from public, anon, authenticated;
revoke execute on function public.open_cashier_shift_id(uuid, uuid) from public, anon;
revoke execute on function public.restaurant_number(uuid, text, text, numeric) from public, anon;
revoke execute on function public.is_mobile_money(public.payment_method) from public, anon;

grant execute on function
  public.record_payments(uuid, jsonb, uuid, boolean),
  public.verify_payment(uuid, boolean, text, boolean),
  public.close_paid_order(uuid),
  public.apply_discount(uuid, numeric, text),
  public.submit_pos_order(uuid, public.order_type, uuid, jsonb, text, uuid, int, numeric, text, uuid),
  public.process_refund(uuid, numeric, public.payment_method, text, text, jsonb, boolean, uuid),
  public.decide_refund(uuid, boolean, text),
  public.refund_order(uuid, numeric, public.payment_method, text, boolean),
  public.cashier_shift_summary(uuid),
  public.open_cashier_shift(uuid, numeric, text),
  public.add_cash_movement(uuid, text, numeric, text),
  public.close_cashier_shift(uuid, numeric, text),
  public.issue_receipt(uuid),
  public.mark_receipt_printed(uuid),
  public.open_cashier_shift_id(uuid, uuid),
  public.restaurant_number(uuid, text, text, numeric),
  public.is_mobile_money(public.payment_method)
to authenticated;

-- ---------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['refunds', 'cashier_shifts', 'receipts'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;
