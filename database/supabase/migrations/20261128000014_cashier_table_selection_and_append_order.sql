-- =====================================================================
-- SomBill – POS Table Selection: Auto-Release Fully Paid Open Orders & Append Rounds
-- Migration: 20261128000014_cashier_table_selection_and_append_order.sql
-- Additive & idempotent.
-- 1. Closes any legacy dine-in orders that are already fully paid (balance <= 0)
--    so their tables are immediately available on the floor & in Select Table.
-- 2. Updates submit_pos_order so that if a cashier selects a table that already
--    has an active unpaid order (or starts a new round on an occupied table),
--    it appends the new items to that table's open order seamlessly.
-- =====================================================================

-- 1. Release tables stuck in 'payment_pending' where the order is already paid
do $$
begin
  perform set_config('sombill.internal', 'on', true);
  update public.orders
     set status = 'completed',
         payment_status = 'paid',
         completed_at = coalesce(completed_at, now())
   where status not in ('completed', 'cancelled')
     and total > 0
     and (amount_paid - amount_refunded) >= total;
  perform set_config('sombill.internal', '', true);
end $$;

-- 2. Enhance submit_pos_order to append items when a cashier picks an occupied table
create or replace function public.submit_pos_order(
  p_restaurant uuid,
  p_order_type public.order_type,
  p_table uuid,
  p_items jsonb,
  p_notes text default null,
  p_customer uuid default null,
  p_guest_count integer default null,
  p_discount numeric default 0,
  p_discount_reason text default null,
  p_idempotency_key uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.app_role;
  v_existing public.pos_requests;
  o public.orders;
  v_appended boolean := false;
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

  -- If the selected table already has an active open order (and multi-orders is off)
  -- and the caller is a cashier or manager, append the round to that table's open order
  -- (or close it first if it was already paid in full).
  if p_order_type = 'dine_in' and p_table is not null and v_role in ('cashier', 'manager')
     and not public.restaurant_flag(p_restaurant, 'tables', 'allow_multiple_orders', false) then
    select * into o
      from public.orders
     where table_id = p_table
       and restaurant_id = p_restaurant
       and status not in ('completed', 'cancelled')
     order by created_at desc
     limit 1
     for update;

    if found then
      if o.total > 0 and (o.amount_paid - o.amount_refunded) >= o.total then
        -- Previous order on this table was already paid in full: close it so the new order starts fresh
        update public.orders
           set status = 'completed',
               payment_status = 'paid',
               completed_at = coalesce(completed_at, now())
         where id = o.id;
        o := null;
      elsif (o.amount_paid - o.amount_refunded) = 0 then
        v_appended := true;
      end if;
    end if;
  end if;

  if not v_appended then
    insert into public.orders (restaurant_id, table_id, waiter_id, cashier_id, customer_id, order_type, notes, guest_count)
    values (p_restaurant, p_table, case when v_role = 'waiter' then auth.uid() end, case when v_role in ('cashier', 'manager') then auth.uid() end,
            p_customer, p_order_type, nullif(trim(coalesce(p_notes, '')), ''), p_guest_count)
    returning * into o;
  end if;

  perform public.insert_pos_items(p_restaurant, o.id, p_items);
  insert into public.pos_requests (idempotency_key, restaurant_id, kind, order_id) values (p_idempotency_key, p_restaurant, 'create_order', o.id);
  if coalesce(p_discount, 0) > 0 then
    perform public.apply_discount(o.id, p_discount, p_discount_reason);
  end if;
  select * into o from public.orders where id = o.id;
  return jsonb_build_object('order_id', o.id, 'order_number', o.order_number, 'total', o.total, 'duplicate', false, 'appended', v_appended);
end;
$$;
