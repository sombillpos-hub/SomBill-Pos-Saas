-- =====================================================================
-- SomBill – Waiter POS: ordering, kitchen flow, bills, notifications, shifts
-- Migration: 20261121000005_waiter_pos.sql
-- Depends on 000001–000004. Idempotent. Extends (does not replace) the
-- shared schema used by Manager, Waiter and Cashier apps.
-- =====================================================================

-- ---------------------------------------------------------------------
-- New columns on orders (bill request workflow)
-- ---------------------------------------------------------------------
alter table public.orders add column if not exists bill_requested_by uuid references auth.users(id) on delete set null;
alter table public.orders add column if not exists bill_acknowledged_at timestamptz;
alter table public.orders add column if not exists bill_acknowledged_by uuid references auth.users(id) on delete set null;

-- Settings helper with defaults so older restaurant rows keep working.
create or replace function public.restaurant_flag(p_restaurant uuid, p_section text, p_key text, p_default boolean)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select (settings -> p_section ->> p_key)::boolean from public.restaurants where id = p_restaurant), p_default)
$$;

-- Can the caller act on this order as its waiter (or with elevated role)?
create or replace function public.can_act_on_order(p_restaurant uuid, p_waiter uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case public.member_role(p_restaurant)
    when 'manager' then true
    when 'cashier' then true
    when 'waiter' then p_waiter is null or p_waiter = auth.uid()
                       or public.restaurant_flag(p_restaurant, 'permissions', 'waiter_can_edit_others_orders', false)
    else false end
$$;

-- Ordinal position in the service flow.
create or replace function public.order_status_rank(s public.order_status)
returns int language sql immutable as $$
  select case s when 'new' then 0 when 'pending' then 1 when 'accepted' then 2 when 'preparing' then 3
                when 'ready' then 4 when 'served' then 5 when 'completed' then 6 else 99 end
$$;

-- ---------------------------------------------------------------------
-- notifications (persistent, per recipient)
-- ---------------------------------------------------------------------
create table if not exists public.notifications (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references public.restaurants(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  type           text not null,
  title          text not null,
  body           text,
  order_id       uuid references public.orders(id) on delete cascade,
  table_id       uuid references public.restaurant_tables(id) on delete set null,
  read_at        timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists idx_notifications_user on public.notifications(user_id, created_at desc);
create index if not exists idx_notifications_unread on public.notifications(user_id) where read_at is null;

create or replace function public.notify_user(p_restaurant uuid, p_user uuid, p_type text, p_title text,
  p_body text, p_order uuid, p_table uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_user is null then return; end if;
  insert into public.notifications (restaurant_id, user_id, type, title, body, order_id, table_id)
  values (p_restaurant, p_user, p_type, p_title, p_body, p_order, p_table);
end $$;

create or replace function public.notify_roles(p_restaurant uuid, p_roles public.app_role[], p_type text,
  p_title text, p_body text, p_order uuid, p_table uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (restaurant_id, user_id, type, title, body, order_id, table_id)
  select p_restaurant, m.user_id, p_type, p_title, p_body, p_order, p_table
    from public.restaurant_members m
   where m.restaurant_id = p_restaurant and m.status = 'active' and m.role = any(p_roles)
     and m.user_id is distinct from auth.uid();
end $$;

-- ---------------------------------------------------------------------
-- staff_shifts (current shift on the waiter dashboard)
-- ---------------------------------------------------------------------
create table if not exists public.staff_shifts (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references public.restaurants(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  started_at     timestamptz not null default now(),
  ended_at       timestamptz,
  check (ended_at is null or ended_at >= started_at)
);
create unique index if not exists uq_open_shift on public.staff_shifts(restaurant_id, user_id) where ended_at is null;
create index if not exists idx_shifts_user on public.staff_shifts(user_id, started_at desc);

create or replace function public.start_shift(p_restaurant uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if not public.is_member(p_restaurant) then raise exception 'Not a member of this restaurant' using errcode = '42501'; end if;
  select id into v from public.staff_shifts where restaurant_id = p_restaurant and user_id = auth.uid() and ended_at is null;
  if v is not null then return v; end if;
  insert into public.staff_shifts (restaurant_id, user_id) values (p_restaurant, auth.uid()) returning id into v;
  return v;
end $$;

create or replace function public.end_shift(p_restaurant uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_member(p_restaurant) then raise exception 'Not a member of this restaurant' using errcode = '42501'; end if;
  update public.staff_shifts set ended_at = now()
   where restaurant_id = p_restaurant and user_id = auth.uid() and ended_at is null;
end $$;

-- ---------------------------------------------------------------------
-- Idempotency ledger for POS submissions (double-tap / retry safe)
-- ---------------------------------------------------------------------
create table if not exists public.pos_requests (
  idempotency_key uuid primary key,
  restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
  kind            text not null check (kind in ('create_order', 'add_items')),
  order_id        uuid not null references public.orders(id) on delete cascade,
  created_by      uuid references auth.users(id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Order insert: lock the table, forbid accidental double occupation
-- ---------------------------------------------------------------------
create or replace function public.orders_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare r public.restaurants; t public.restaurant_tables; v_role public.app_role;
begin
  select * into r from public.restaurants where id = new.restaurant_id;
  if not found then raise exception 'Unknown restaurant'; end if;
  perform public.assert_same_restaurant('public.customers', new.customer_id, new.restaurant_id);
  if new.order_type = 'dine_in' and new.table_id is null then
    raise exception 'Dine-in orders require a table' using errcode = '23514';
  end if;
  if new.table_id is not null then
    -- Row lock serialises concurrent submissions for the same table.
    select * into t from public.restaurant_tables where id = new.table_id for update;
    if not found or t.restaurant_id <> new.restaurant_id then
      raise exception 'Referenced table does not belong to this restaurant' using errcode = '23503';
    end if;
    if t.archived_at is not null then
      raise exception 'Table % is archived', t.table_number using errcode = '23514';
    end if;
    if not public.restaurant_flag(new.restaurant_id, 'tables', 'allow_multiple_orders', false)
       and exists (select 1 from public.orders o where o.table_id = new.table_id
                   and o.status not in ('completed', 'cancelled')) then
      raise exception 'TABLE_OCCUPIED: Table % already has an active order', t.table_number using errcode = '23505';
    end if;
  end if;
  v_role := public.member_role(new.restaurant_id);
  if v_role = 'waiter' then
    new.waiter_id := auth.uid();      -- waiters always own the orders they open
  elsif v_role = 'kitchen' then
    raise exception 'Kitchen staff cannot create orders' using errcode = '42501';
  end if;
  new.order_number := public.next_order_number(new.restaurant_id);
  new.status := 'new';
  new.tax_rate := r.tax_rate;
  new.tax_inclusive := r.tax_inclusive;
  new.subtotal := 0; new.tax_amount := 0; new.total := 0;
  new.amount_paid := 0; new.amount_refunded := 0; new.payment_status := 'unpaid';
  new.stock_deducted_at := null; new.stock_reversed_at := null;
  new.bill_requested_at := null; new.bill_requested_by := null;
  new.bill_acknowledged_at := null; new.bill_acknowledged_by := null;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Order update guard: role-based status transitions + ownership
-- ---------------------------------------------------------------------
create or replace function public.orders_before_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_internal boolean := coalesce(current_setting('sombill.internal', true), '') = 'on';
        v_role public.app_role;
begin
  if new.restaurant_id <> old.restaurant_id or new.order_number <> old.order_number then
    raise exception 'Order identity cannot change';
  end if;

  if not v_internal then
    v_role := public.member_role(new.restaurant_id);
    -- No end-user (service role / backend job): treat as fully trusted.
    if auth.uid() is null then v_role := 'manager'; end if;

    if new.subtotal <> old.subtotal or new.tax_amount <> old.tax_amount or new.total <> old.total
       or new.amount_paid <> old.amount_paid or new.amount_refunded <> old.amount_refunded
       or new.payment_status <> old.payment_status or new.tax_rate <> old.tax_rate
       or new.tax_inclusive <> old.tax_inclusive
       or new.stock_deducted_at is distinct from old.stock_deducted_at
       or new.stock_reversed_at is distinct from old.stock_reversed_at then
      raise exception 'Order totals and payment state are system-maintained' using errcode = '42501';
    end if;

    if new.bill_requested_at is distinct from old.bill_requested_at
       or new.bill_requested_by is distinct from old.bill_requested_by
       or new.bill_acknowledged_at is distinct from old.bill_acknowledged_at
       or new.bill_acknowledged_by is distinct from old.bill_acknowledged_by then
      raise exception 'Use request_bill() / cancel_bill_request() / acknowledge_bill_request()' using errcode = '42501';
    end if;

    if old.status in ('completed', 'cancelled') then
      raise exception 'A % order cannot be modified', old.status using errcode = '42501';
    end if;

    if new.status = 'cancelled' and old.status <> 'cancelled' then
      raise exception 'Use cancel_order() to cancel an order' using errcode = '42501';
    end if;

    if new.discount_amount <> old.discount_amount and coalesce(v_role::text, 'none') not in ('manager', 'cashier') then
      raise exception 'Only cashiers or managers can apply discounts' using errcode = '42501';
    end if;

    -- Waiters: only their own orders (unless permitted), and no reassignment / table moves.
    if v_role = 'waiter' then
      if not public.can_act_on_order(old.restaurant_id, old.waiter_id) then
        raise exception 'You can only update your own orders' using errcode = '42501';
      end if;
      if new.waiter_id is distinct from old.waiter_id or new.table_id is distinct from old.table_id
         or new.cashier_id is distinct from old.cashier_id then
        raise exception 'Waiters cannot reassign orders or move tables' using errcode = '42501';
      end if;
    elsif v_role = 'kitchen' then
      if (to_jsonb(new) - 'status' - 'updated_at') <> (to_jsonb(old) - 'status' - 'updated_at') then
        raise exception 'Kitchen staff may only change preparation status' using errcode = '42501';
      end if;
    end if;

    if new.status <> old.status then
      if public.order_status_rank(new.status) < public.order_status_rank(old.status) and coalesce(v_role::text, 'none') <> 'manager' then
        raise exception 'Only managers can move an order backwards' using errcode = '42501';
      end if;
      if new.status in ('pending', 'accepted', 'preparing', 'ready') and coalesce(v_role::text, 'none') not in ('manager', 'kitchen') then
        raise exception 'Only kitchen staff or managers can set preparation status' using errcode = '42501';
      end if;
      if new.status = 'served' then
        if coalesce(v_role::text, 'none') not in ('manager', 'kitchen', 'cashier', 'waiter') then
          raise exception 'Not allowed to mark served' using errcode = '42501';
        end if;
        if v_role = 'waiter' and old.status <> 'ready' then
          raise exception 'Only orders marked Ready can be served' using errcode = '23514';
        end if;
      end if;
      if new.status = 'completed' and coalesce(v_role::text, 'none') not in ('manager', 'cashier') then
        raise exception 'Only cashiers or managers can complete orders' using errcode = '42501';
      end if;
    end if;
  end if;

  perform public.assert_same_restaurant('public.restaurant_tables', new.table_id, new.restaurant_id);
  perform public.assert_same_restaurant('public.customers', new.customer_id, new.restaurant_id);

  if new.status = 'completed' and old.status <> 'completed' then
    new.completed_at := now();
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Order items guard: waiters add (never edit/void) and only to eligible orders
-- ---------------------------------------------------------------------
create or replace function public.order_items_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
declare o public.orders; p public.products; v_role public.app_role;
begin
  select * into o from public.orders where id = new.order_id;
  if o.restaurant_id <> new.restaurant_id then
    raise exception 'Order item restaurant mismatch' using errcode = '23503';
  end if;
  if o.status in ('completed', 'cancelled') then
    raise exception 'Items of a % order cannot be changed', o.status using errcode = '42501';
  end if;
  v_role := public.member_role(new.restaurant_id);
  if v_role = 'kitchen' then
    raise exception 'Kitchen staff cannot change order items' using errcode = '42501';
  end if;
  if v_role = 'waiter' then
    if tg_op = 'UPDATE' then
      raise exception 'Submitted items cannot be changed by waiters. Ask a manager or cashier to void it.' using errcode = '42501';
    end if;
    if not public.can_act_on_order(o.restaurant_id, o.waiter_id) then
      raise exception 'You can only add items to your own orders' using errcode = '42501';
    end if;
    if o.amount_paid - o.amount_refunded > 0 then
      raise exception 'This order already has payments; items can no longer be added' using errcode = '23514';
    end if;
    if o.bill_requested_at is not null then
      raise exception 'The bill has been requested. Cancel the bill request before adding items.' using errcode = '23514';
    end if;
  end if;
  if tg_op = 'INSERT' then
    if new.quantity > 999 then raise exception 'Quantity too large' using errcode = '23514'; end if;
    select * into p from public.products where id = new.product_id;
    if p.restaurant_id <> new.restaurant_id then
      raise exception 'Product does not belong to this restaurant' using errcode = '23503';
    end if;
    if p.archived_at is not null or not p.is_available then
      raise exception 'PRODUCT_UNAVAILABLE: "%" is not available', p.name using errcode = '23514';
    end if;
    new.product_name := p.name;
    new.unit_price := p.price;
    new.unit_cost := p.cost_price;
    new.tax_exempt := (p.tax_category = 'exempt');
    new.is_voided := false;
  else
    if new.product_id <> old.product_id or new.unit_price <> old.unit_price or new.order_id <> old.order_id then
      raise exception 'Change quantity or void the item instead' using errcode = '42501';
    end if;
    if old.is_voided and not new.is_voided then
      raise exception 'A voided item cannot be restored' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Waiter order submission – one transaction, all or nothing
-- p_items: [{"product_id": uuid, "quantity": number, "unit_price": number, "notes": text}]
-- ---------------------------------------------------------------------
create or replace function public.validate_pos_items(p_restaurant uuid, p_items jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare e jsonb; p public.products; v_qty numeric; v_price numeric;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Add at least one item' using errcode = '23514';
  end if;
  if jsonb_array_length(p_items) > 100 then
    raise exception 'Too many lines in one order' using errcode = '23514';
  end if;
  for e in select * from jsonb_array_elements(p_items) loop
    begin
      v_qty := (e->>'quantity')::numeric;
      v_price := (e->>'unit_price')::numeric;
    exception when others then
      raise exception 'Invalid quantity or price' using errcode = '22023';
    end;
    if v_qty is null or v_qty <= 0 or v_qty > 999 or v_qty <> trunc(v_qty) then
      raise exception 'Quantities must be whole numbers between 1 and 999' using errcode = '23514';
    end if;
    if length(coalesce(e->>'notes', '')) > 300 then
      raise exception 'Item notes are limited to 300 characters' using errcode = '23514';
    end if;
    select * into p from public.products where id = (e->>'product_id')::uuid;
    if not found or p.restaurant_id <> p_restaurant then
      raise exception 'Product not found on this menu' using errcode = '23503';
    end if;
    if p.archived_at is not null or not p.is_available then
      raise exception 'PRODUCT_UNAVAILABLE: "%" is no longer available', p.name using errcode = '23514';
    end if;
    if v_price is null or abs(p.price - v_price) > 0.0001 then
      raise exception 'PRICE_CHANGED: "%" now costs %', p.name, p.price using errcode = '23514';
    end if;
  end loop;
end $$;

create or replace function public.insert_pos_items(p_restaurant uuid, p_order uuid, p_items jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.order_items (restaurant_id, order_id, product_id, product_name, quantity, unit_price, notes)
  select p_restaurant, p_order, (e->>'product_id')::uuid, '', (e->>'quantity')::numeric, 0,
         nullif(trim(coalesce(e->>'notes', '')), '')
    from jsonb_array_elements(p_items) e;
end $$;

create or replace function public.submit_waiter_order(
  p_restaurant uuid, p_table uuid, p_items jsonb, p_notes text default null,
  p_customer uuid default null, p_guest_count int default null, p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_role public.app_role; v_existing public.pos_requests; o public.orders;
begin
  v_role := public.member_role(p_restaurant);
  if v_role is null or v_role not in ('waiter', 'manager', 'cashier') then
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

  if p_table is null then raise exception 'Select a table' using errcode = '23514'; end if;
  if length(coalesce(p_notes, '')) > 500 then raise exception 'Order notes are limited to 500 characters' using errcode = '23514'; end if;
  if p_guest_count is not null and (p_guest_count < 1 or p_guest_count > 50) then
    raise exception 'Guest count must be between 1 and 50' using errcode = '23514';
  end if;
  perform public.validate_pos_items(p_restaurant, p_items);

  insert into public.orders (restaurant_id, table_id, waiter_id, customer_id, order_type, notes, guest_count)
  values (p_restaurant, p_table, auth.uid(), p_customer, 'dine_in', nullif(trim(coalesce(p_notes, '')), ''), p_guest_count)
  returning * into o;

  perform public.insert_pos_items(p_restaurant, o.id, p_items);
  insert into public.pos_requests (idempotency_key, restaurant_id, kind, order_id) values (p_idempotency_key, p_restaurant, 'create_order', o.id);

  select * into o from public.orders where id = o.id;
  return jsonb_build_object('order_id', o.id, 'order_number', o.order_number, 'total', o.total, 'duplicate', false);
end $$;

create or replace function public.add_order_items(p_order uuid, p_items jsonb, p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare o public.orders; v_existing public.pos_requests; v_role public.app_role;
begin
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;
  v_role := public.member_role(o.restaurant_id);
  if v_role is null or v_role not in ('waiter', 'manager', 'cashier') then
    raise exception 'You are not allowed to change this order' using errcode = '42501';
  end if;
  if p_idempotency_key is null then raise exception 'Idempotency key required' using errcode = '22023'; end if;
  select * into v_existing from public.pos_requests where idempotency_key = p_idempotency_key;
  if found then
    if v_existing.order_id <> p_order then raise exception 'Idempotency key reused for a different request' using errcode = '22023'; end if;
    return jsonb_build_object('order_id', o.id, 'order_number', o.order_number, 'total', o.total, 'duplicate', true);
  end if;
  if o.status in ('completed', 'cancelled') then
    raise exception 'This order is % and cannot be changed', o.status using errcode = '23514';
  end if;
  if not public.can_act_on_order(o.restaurant_id, o.waiter_id) then
    raise exception 'You can only add items to your own orders' using errcode = '42501';
  end if;
  perform public.validate_pos_items(o.restaurant_id, p_items);
  perform public.insert_pos_items(o.restaurant_id, o.id, p_items);
  insert into public.pos_requests (idempotency_key, restaurant_id, kind, order_id) values (p_idempotency_key, o.restaurant_id, 'add_items', o.id);
  select * into o from public.orders where id = p_order;
  if o.waiter_id is not null then
    perform public.notify_roles(o.restaurant_id, array['kitchen']::public.app_role[], 'items_added',
      'Items added to order #' || o.order_number, null, o.id, o.table_id);
  end if;
  return jsonb_build_object('order_id', o.id, 'order_number', o.order_number, 'total', o.total, 'duplicate', false);
end $$;

-- ---------------------------------------------------------------------
-- Bill requests
-- ---------------------------------------------------------------------
create or replace function public.request_bill(p_order uuid)
returns void language plpgsql security definer set search_path = public as $$
declare o public.orders; v_prev text := coalesce(current_setting('sombill.internal', true), ''); v_table int;
begin
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;
  if coalesce(public.member_role(o.restaurant_id)::text, 'none') not in ('waiter', 'manager', 'cashier')
     or not public.can_act_on_order(o.restaurant_id, o.waiter_id) then
    raise exception 'You cannot request the bill for this order' using errcode = '42501';
  end if;
  if o.status in ('completed', 'cancelled') then raise exception 'This order is already %', o.status using errcode = '23514'; end if;
  if o.total <= 0 then raise exception 'The order has no billable items' using errcode = '23514'; end if;
  if o.bill_requested_at is not null then raise exception 'The bill has already been requested' using errcode = '23514'; end if;
  perform set_config('sombill.internal', 'on', true);
  update public.orders set bill_requested_at = now(), bill_requested_by = auth.uid(),
         bill_acknowledged_at = null, bill_acknowledged_by = null where id = p_order;
  perform set_config('sombill.internal', v_prev, true);
  select table_number into v_table from public.restaurant_tables where id = o.table_id;
  perform public.notify_roles(o.restaurant_id, array['cashier', 'manager']::public.app_role[], 'bill_requested',
    'Bill requested' || coalesce(' – Table ' || v_table, ''), 'Order #' || o.order_number, o.id, o.table_id);
  perform public.write_audit(o.restaurant_id, 'bill_request', 'orders', o.id, null, null, null);
end $$;

create or replace function public.cancel_bill_request(p_order uuid)
returns void language plpgsql security definer set search_path = public as $$
declare o public.orders; v_role public.app_role; v_prev text := coalesce(current_setting('sombill.internal', true), '');
begin
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;
  v_role := public.member_role(o.restaurant_id);
  if coalesce(v_role::text, 'none') not in ('waiter', 'manager', 'cashier') or not public.can_act_on_order(o.restaurant_id, o.waiter_id) then
    raise exception 'You cannot change this bill request' using errcode = '42501';
  end if;
  if v_role = 'waiter' and not public.restaurant_flag(o.restaurant_id, 'permissions', 'waiter_can_cancel_bill_request', true) then
    raise exception 'Cancelling bill requests is not permitted for waiters' using errcode = '42501';
  end if;
  if o.bill_requested_at is null then raise exception 'There is no bill request to cancel' using errcode = '23514'; end if;
  if o.bill_acknowledged_at is not null and v_role = 'waiter' then
    raise exception 'The cashier is already processing this bill' using errcode = '23514';
  end if;
  if o.amount_paid - o.amount_refunded > 0 then
    raise exception 'Payment has started; the bill request can no longer be cancelled' using errcode = '23514';
  end if;
  perform set_config('sombill.internal', 'on', true);
  update public.orders set bill_requested_at = null, bill_requested_by = null,
         bill_acknowledged_at = null, bill_acknowledged_by = null where id = p_order;
  perform set_config('sombill.internal', v_prev, true);
  perform public.write_audit(o.restaurant_id, 'bill_request_cancel', 'orders', o.id, null, null, null);
end $$;

create or replace function public.acknowledge_bill_request(p_order uuid)
returns void language plpgsql security definer set search_path = public as $$
declare o public.orders; v_prev text := coalesce(current_setting('sombill.internal', true), '');
begin
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;
  if not public.has_role(o.restaurant_id, array['cashier', 'manager']::public.app_role[]) then
    raise exception 'Only cashiers or managers can acknowledge bills' using errcode = '42501';
  end if;
  if o.bill_requested_at is null then raise exception 'No bill has been requested' using errcode = '23514'; end if;
  if o.bill_acknowledged_at is not null then return; end if;
  perform set_config('sombill.internal', 'on', true);
  update public.orders set bill_acknowledged_at = now(), bill_acknowledged_by = auth.uid() where id = p_order;
  perform set_config('sombill.internal', v_prev, true);
end $$;

-- ---------------------------------------------------------------------
-- Notification triggers
-- ---------------------------------------------------------------------
create or replace function public.orders_notify_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_table int;
begin
  select table_number into v_table from public.restaurant_tables where id = new.table_id;
  perform public.notify_roles(new.restaurant_id, array['kitchen', 'cashier']::public.app_role[], 'new_order',
    'New order #' || new.order_number || coalesce(' – Table ' || v_table, ''), null, new.id, new.table_id);
  return null;
end $$;
drop trigger if exists trg_orders_notify_insert on public.orders;
create trigger trg_orders_notify_insert after insert on public.orders
  for each row execute function public.orders_notify_insert();

create or replace function public.orders_notify_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_table int; v_label text;
begin
  if new.waiter_id is null then return null; end if;
  select table_number into v_table from public.restaurant_tables where id = new.table_id;
  v_label := 'Order #' || new.order_number || coalesce(' (Table ' || v_table || ')', '');

  if new.status <> old.status and new.waiter_id is distinct from auth.uid() then
    case new.status
      when 'accepted'  then perform public.notify_user(new.restaurant_id, new.waiter_id, 'order_accepted', v_label || ' accepted by kitchen', null, new.id, new.table_id);
      when 'preparing' then perform public.notify_user(new.restaurant_id, new.waiter_id, 'order_preparing', v_label || ' is being prepared', null, new.id, new.table_id);
      when 'ready'     then perform public.notify_user(new.restaurant_id, new.waiter_id, 'order_ready', v_label || ' is ready to serve', null, new.id, new.table_id);
      when 'cancelled' then perform public.notify_user(new.restaurant_id, new.waiter_id, 'order_cancelled', v_label || ' was cancelled', new.cancel_reason, new.id, new.table_id);
      when 'completed' then
        if new.table_id is not null then
          perform public.notify_user(new.restaurant_id, new.waiter_id, 'table_status', 'Table ' || v_table || ' is now available', v_label || ' closed', new.id, new.table_id);
        end if;
      else null;
    end case;
  end if;

  if new.payment_status = 'paid' and old.payment_status <> 'paid' then
    perform public.notify_user(new.restaurant_id, new.waiter_id, 'payment_completed', 'Payment completed – ' || v_label, null, new.id, new.table_id);
  end if;

  if new.bill_acknowledged_at is not null and old.bill_acknowledged_at is null then
    perform public.notify_user(new.restaurant_id, new.waiter_id, 'bill_acknowledged', 'Cashier is processing the bill – ' || v_label, null, new.id, new.table_id);
  end if;
  return null;
end $$;
drop trigger if exists trg_orders_notify_update on public.orders;
create trigger trg_orders_notify_update after update on public.orders
  for each row execute function public.orders_notify_update();

-- ---------------------------------------------------------------------
-- Summary counts (pending now includes 'accepted')
-- ---------------------------------------------------------------------
create or replace function public.sales_summary(p_restaurant uuid, p_from timestamptz, p_to timestamptz)
returns jsonb language plpgsql stable security invoker set search_path = public as $$
declare v jsonb;
begin
  if not public.is_manager(p_restaurant) then
    raise exception 'Managers only' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'gross_sales',      coalesce(sum(total) filter (where status <> 'cancelled'), 0),
    'total_orders',     count(*),
    'completed_orders', count(*) filter (where status = 'completed'),
    'cancelled_orders', count(*) filter (where status = 'cancelled'),
    'pending_orders',   count(*) filter (where status not in ('completed', 'cancelled')),
    'outstanding',      coalesce(sum(greatest(total - (amount_paid - amount_refunded), 0)) filter (where status <> 'cancelled'), 0),
    'avg_order_value',  coalesce(round(avg(total) filter (where status <> 'cancelled'), 2), 0)
  ) into v
  from public.orders where restaurant_id = p_restaurant and created_at >= p_from and created_at < p_to;
  select v || jsonb_build_object(
    'collected', coalesce(sum(amount) filter (where kind = 'payment'), 0),
    'refunds',   coalesce(sum(amount) filter (where kind = 'refund'), 0),
    'net_collected', coalesce(sum(case when kind = 'payment' then amount else -amount end), 0)
  ) into v
  from public.payments where restaurant_id = p_restaurant and status = 'succeeded' and created_at >= p_from and created_at < p_to;
  return v;
end $$;

-- ---------------------------------------------------------------------
-- RLS for new tables
-- ---------------------------------------------------------------------
alter table public.notifications enable row level security;
alter table public.notifications force row level security;
alter table public.staff_shifts enable row level security;
alter table public.staff_shifts force row level security;
alter table public.pos_requests enable row level security;
alter table public.pos_requests force row level security;

drop policy if exists sb_notifications_select on public.notifications;
drop policy if exists sb_notifications_update on public.notifications;
drop policy if exists sb_notifications_delete on public.notifications;
create policy sb_notifications_select on public.notifications for select to authenticated
  using (user_id = auth.uid() and public.is_member(restaurant_id));
create policy sb_notifications_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy sb_notifications_delete on public.notifications for delete to authenticated
  using (user_id = auth.uid() and read_at is not null);

drop policy if exists sb_shifts_select on public.staff_shifts;
create policy sb_shifts_select on public.staff_shifts for select to authenticated
  using (user_id = auth.uid() or public.is_manager(restaurant_id));

revoke all on public.notifications, public.staff_shifts, public.pos_requests from anon;
revoke all on public.notifications, public.staff_shifts, public.pos_requests from authenticated;
grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant select on public.staff_shifts to authenticated;

-- Waiters update their own profile name/phone only (email belongs to Auth).
revoke update on public.profiles from authenticated;
grant update (full_name, phone, avatar_url, last_login_at) on public.profiles to authenticated;

revoke execute on function public.notify_user(uuid, uuid, text, text, text, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.notify_roles(uuid, public.app_role[], text, text, text, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.validate_pos_items(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.insert_pos_items(uuid, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.restaurant_flag(uuid, text, text, boolean) from public, anon;
revoke execute on function public.can_act_on_order(uuid, uuid) from public, anon;
revoke execute on function public.order_status_rank(public.order_status) from public, anon;

grant execute on function
  public.submit_waiter_order(uuid, uuid, jsonb, text, uuid, int, uuid),
  public.add_order_items(uuid, jsonb, uuid),
  public.request_bill(uuid),
  public.cancel_bill_request(uuid),
  public.acknowledge_bill_request(uuid),
  public.start_shift(uuid),
  public.end_shift(uuid),
  public.restaurant_flag(uuid, text, text, boolean),
  public.can_act_on_order(uuid, uuid),
  public.order_status_rank(public.order_status),
  public.sales_summary(uuid, timestamptz, timestamptz)
to authenticated;

-- ---------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['notifications', 'staff_shifts'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;
