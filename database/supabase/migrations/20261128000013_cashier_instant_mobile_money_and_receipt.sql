-- =====================================================================
-- SomBill – Cashier POS: Instant Zaad / e-Dahab / Cash Confirm & Receipt
-- Migration: 20261128000013_cashier_instant_mobile_money_and_receipt.sql
-- Makes Cashier mobile money (Zaad, e-Dahab/Somtel, EVC Plus) confirm immediately
-- in 1 step (auto-generating a reference if blank) and allows issuing/printing
-- receipts without friction.
-- =====================================================================

create or replace function public.record_payments(
  p_order uuid,
  p_payments jsonb,
  p_idempotency_key uuid,
  p_close_order boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.orders;
  v_role public.app_role;
  v_prev text := coalesce(current_setting('sombill.internal', true), '');
  v_existing public.payment_requests;
  v_shift uuid;
  e jsonb;
  v_method public.payment_method;
  v_amount numeric;
  v_received numeric;
  v_ref text;
  v_total numeric := 0;
  v_out numeric;
  v_pending numeric;
  v_ids uuid[] := '{}';
  v_id uuid;
  v_change numeric := 0;
  v_close text;
  v_result jsonb;
  v_has_pending boolean := false;
  v_auto_verify boolean;
begin
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;

  v_role := public.member_role(o.restaurant_id);
  if v_role is null or v_role not in ('cashier', 'manager') then
    raise exception 'Only cashiers or managers can record payments' using errcode = '42501';
  end if;

  if p_idempotency_key is null then raise exception 'Idempotency key required' using errcode = '22023'; end if;

  select * into v_existing from public.payment_requests where idempotency_key = p_idempotency_key;
  if found then
    if v_existing.order_id <> p_order then
      raise exception 'Idempotency key reused for a different order' using errcode = '22023';
    end if;
    return v_existing.result || jsonb_build_object('duplicate', true);
  end if;

  if o.status = 'cancelled' then raise exception 'This order is cancelled' using errcode = '23514'; end if;

  v_shift := public.open_cashier_shift_id(o.restaurant_id, auth.uid());
  if v_shift is null and v_role = 'cashier' and public.restaurant_flag(o.restaurant_id, 'permissions', 'require_open_shift', false) then
    raise exception 'NO_OPEN_SHIFT: open your cash shift before taking payments' using errcode = '23514';
  end if;

  if p_payments is null or jsonb_typeof(p_payments) <> 'array' or jsonb_array_length(p_payments) = 0 then
    raise exception 'Add at least one payment' using errcode = '23514';
  end if;
  if jsonb_array_length(p_payments) > 6 then raise exception 'Too many split payments' using errcode = '23514'; end if;

  select coalesce(sum(amount), 0) into v_pending
    from public.payments
   where order_id = o.id and kind = 'payment' and status = 'pending';

  v_out := round(o.total - (o.amount_paid - o.amount_refunded) - v_pending, 2);
  if v_out <= 0 then
    raise exception 'ALREADY_SETTLED: nothing is outstanding on order #%', o.order_number using errcode = '23514';
  end if;

  -- Instant confirmation for Zaad / e-Dahab / EVC Plus when cashier verification is enabled (default true)
  v_auto_verify := (v_role = 'manager')
    or public.restaurant_flag(o.restaurant_id, 'permissions', 'cashier_can_verify_mobile_money', true);

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
    if v_method = 'cash' and v_received is not null and v_received < v_amount then
      raise exception 'Cash received (%) is less than the amount (%)', v_received, v_amount using errcode = '23514';
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

    if v_method <> 'cash' and v_ref is null then
      v_ref := upper(replace(v_method::text, '_money', '')) || '-' || o.order_number || '-' || floor(extract(epoch from now()))::bigint;
    end if;

    begin
      insert into public.payments (
        restaurant_id, order_id, kind, method, amount, status, reference, notes,
        cashier_id, shift_id, verification_status, verified_by, verified_at,
        amount_received, change_given, request_key
      ) values (
        o.restaurant_id,
        o.id,
        'payment',
        v_method,
        v_amount,
        case when public.is_mobile_money(v_method) and not v_auto_verify then 'pending' else 'succeeded' end,
        v_ref,
        nullif(trim(coalesce(e->>'note', '')), ''),
        auth.uid(),
        v_shift,
        case
          when v_method = 'cash' then 'not_required'
          when v_method = 'card' then 'terminal_confirmed'
          when v_auto_verify then 'verified'
          else 'pending'
        end,
        case when public.is_mobile_money(v_method) and v_auto_verify then auth.uid() end,
        case when public.is_mobile_money(v_method) and v_auto_verify then now() end,
        v_received,
        case when v_received is not null then v_received - v_amount end,
        p_idempotency_key
      )
      returning id into v_id;
    exception when unique_violation then
      raise exception 'DUPLICATE_REFERENCE: reference % has already been recorded for %', v_ref, v_method using errcode = '23505';
    end;

    v_ids := v_ids || v_id;
    if v_received is not null then v_change := v_change + (v_received - v_amount); end if;
    if public.is_mobile_money(v_method) and not v_auto_verify then v_has_pending := true; end if;
  end loop;

  update public.orders
     set bill_acknowledged_at = coalesce(bill_acknowledged_at, case when bill_requested_at is not null then now() end),
         bill_acknowledged_by = coalesce(bill_acknowledged_by, case when bill_requested_at is not null then auth.uid() end)
   where id = o.id;

  perform set_config('sombill.internal', v_prev, true);

  update public.orders
     set cashier_id = auth.uid()
   where id = o.id and cashier_id is null and status not in ('completed', 'cancelled');

  if p_close_order then
    select * into o from public.orders where id = p_order;
    if o.payment_status = 'paid' and o.status not in ('completed', 'cancelled') then
      perform set_config('sombill.internal', 'on', true);
      update public.orders
         set status = 'completed',
             completed_at = coalesce(completed_at, now()),
             cashier_id = coalesce(cashier_id, auth.uid())
       where id = p_order;
      perform set_config('sombill.internal', v_prev, true);
      v_close := 'completed';
    end if;
  end if;

  select * into o from public.orders where id = p_order;
  select coalesce(sum(amount), 0) into v_pending
    from public.payments
   where order_id = o.id and kind = 'payment' and status = 'pending';

  v_result := jsonb_build_object(
    'payment_ids', to_jsonb(v_ids),
    'transaction_numbers', (select jsonb_agg(transaction_number order by transaction_number) from public.payments where id = any(v_ids)),
    'payment_status', o.payment_status,
    'order_status', o.status,
    'total', o.total,
    'paid', o.amount_paid - o.amount_refunded,
    'pending_verification', v_pending,
    'balance', round(greatest(o.total - (o.amount_paid - o.amount_refunded), 0), 2),
    'change', round(v_change, 2),
    'close', v_close,
    'awaiting_verification', v_has_pending,
    'duplicate', false
  );

  insert into public.payment_requests (idempotency_key, restaurant_id, order_id, result)
  values (p_idempotency_key, o.restaurant_id, o.id, v_result);

  return v_result;
end;
$$;

create or replace function public.issue_receipt(p_order uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.orders;
  r public.receipts;
  v_no bigint;
begin
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;
  if not public.has_role(o.restaurant_id, array['cashier', 'manager']::public.app_role[]) then
    raise exception 'Only cashiers or managers can issue receipts' using errcode = '42501';
  end if;
  select * into r from public.receipts where order_id = p_order;
  if found then
    return jsonb_build_object('receipt_id', r.id, 'receipt_number', r.receipt_number, 'print_count', r.print_count, 'new', false);
  end if;
  update public.restaurants set receipt_seq = receipt_seq + 1 where id = o.restaurant_id returning receipt_seq into v_no;
  insert into public.receipts (restaurant_id, order_id, receipt_number)
  values (o.restaurant_id, p_order, v_no)
  returning * into r;
  return jsonb_build_object('receipt_id', r.id, 'receipt_number', r.receipt_number, 'print_count', 0, 'new', true);
end;
$$;
