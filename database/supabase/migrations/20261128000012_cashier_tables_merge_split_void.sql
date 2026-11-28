-- =====================================================================
-- SomBill – Cashier POS: Table Merge, Unmerge, Transfer, Split Bill & Item Void
-- Migration: 20261128000012_cashier_tables_merge_split_void.sql
-- Additive & idempotent. Preserves all existing Waiter/Cashier RPCs and triggers.
-- =====================================================================

-- 1. Additive schema columns for table merge, split checks, and item origin tracking
alter table public.restaurant_tables
  add column if not exists merged_into_id uuid references public.restaurant_tables(id) on delete set null;

alter table public.orders
  add column if not exists merged_table_ids uuid[] not null default '{}',
  add column if not exists merged_table_numbers int[] not null default '{}',
  add column if not exists parent_order_id uuid references public.orders(id) on delete set null,
  add column if not exists split_label text;

alter table public.order_items
  add column if not exists source_table_id uuid references public.restaurant_tables(id) on delete set null,
  add column if not exists source_table_number int,
  add column if not exists source_order_id uuid;

-- 2. Allow internal SECURITY DEFINER operations (merge / split) to move order_items
--    and create split checks on an occupied table when sombill.internal = 'on'.
create or replace function public.orders_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare r public.restaurants; t public.restaurant_tables; v_role public.app_role;
        v_internal boolean := coalesce(current_setting('sombill.internal', true), '') = 'on';
begin
  select * into r from public.restaurants where id = new.restaurant_id;
  if not found then raise exception 'Unknown restaurant'; end if;
  perform public.assert_same_restaurant('public.customers', new.customer_id, new.restaurant_id);
  if new.order_type = 'dine_in' and new.table_id is null then
    raise exception 'Dine-in orders require a table' using errcode = '23514';
  end if;
  if new.table_id is not null then
    select * into t from public.restaurant_tables where id = new.table_id for update;
    if not found or t.restaurant_id <> new.restaurant_id then
      raise exception 'Referenced table does not belong to this restaurant' using errcode = '23503';
    end if;
    if t.archived_at is not null then
      raise exception 'Table % is archived', t.table_number using errcode = '23514';
    end if;
    if not v_internal
       and not public.restaurant_flag(new.restaurant_id, 'tables', 'allow_multiple_orders', false)
       and exists (select 1 from public.orders o where o.table_id = new.table_id
                   and o.status not in ('completed', 'cancelled')) then
      raise exception 'TABLE_OCCUPIED: Table % already has an active order', t.table_number using errcode = '23505';
    end if;
  end if;
  v_role := public.member_role(new.restaurant_id);
  if v_role = 'waiter' then
    new.waiter_id := auth.uid();
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

create or replace function public.order_items_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
declare o public.orders; p public.products; v_role public.app_role;
        v_internal boolean := coalesce(current_setting('sombill.internal', true), '') = 'on';
begin
  select * into o from public.orders where id = new.order_id;
  if o.restaurant_id <> new.restaurant_id then
    raise exception 'Order item restaurant mismatch' using errcode = '23503';
  end if;
  if not v_internal and o.status in ('completed', 'cancelled') then
    raise exception 'Items of a % order cannot be changed', o.status using errcode = '42501';
  end if;
  v_role := public.member_role(new.restaurant_id);
  if not v_internal then
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
  end if;
  if tg_op = 'INSERT' then
    if new.quantity > 999 then raise exception 'Quantity too large' using errcode = '23514'; end if;
    select * into p from public.products where id = new.product_id;
    if p.restaurant_id <> new.restaurant_id then
      raise exception 'Product does not belong to this restaurant' using errcode = '23503';
    end if;
    if not v_internal and (p.archived_at is not null or not p.is_available) then
      raise exception 'PRODUCT_UNAVAILABLE: "%" is not available', p.name using errcode = '23514';
    end if;
    new.product_name := p.name;
    new.unit_price := p.price;
    new.unit_cost := p.cost_price;
    new.tax_exempt := (p.tax_category = 'exempt');
    new.is_voided := false;
  else
    if not v_internal and (new.product_id <> old.product_id or new.unit_price <> old.unit_price or new.order_id <> old.order_id) then
      raise exception 'Change quantity or void the item instead' using errcode = '42501';
    end if;
    if old.is_voided and not new.is_voided then
      raise exception 'A voided item cannot be restored' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

-- 3. Automatically release merged secondary tables when the primary order is completed or cancelled
create or replace function public.orders_release_merged_tables()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('completed', 'cancelled')
     and old.status not in ('completed', 'cancelled')
     and new.table_id is not null then
    update public.restaurant_tables
       set merged_into_id = null
     where restaurant_id = new.restaurant_id
       and (merged_into_id = new.table_id or id = any(coalesce(new.merged_table_ids, '{}')));
  end if;
  return null;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_orders_release_merged_tables'
  ) then
    create trigger trg_orders_release_merged_tables
      after update of status on public.orders
      for each row execute function public.orders_release_merged_tables();
  end if;
end $$;

-- 4. Merge tables into one primary bill
create or replace function public.merge_table_orders(
  p_primary_table uuid,
  p_secondary_tables uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t_pri public.restaurant_tables;
  t_sec public.restaurant_tables;
  o_pri public.orders;
  o_sec public.orders;
  v_sec_id uuid;
  v_role public.app_role;
  v_prev text := coalesce(current_setting('sombill.internal', true), '');
  v_merged_ids uuid[];
  v_merged_nums int[];
  v_guests int;
begin
  if p_primary_table is null or p_secondary_tables is null or coalesce(array_length(p_secondary_tables, 1), 0) = 0 then
    raise exception 'Select a primary table and at least one table to merge' using errcode = '22023';
  end if;

  select * into t_pri from public.restaurant_tables where id = p_primary_table and archived_at is null for update;
  if not found then raise exception 'Primary table not found' using errcode = 'P0002'; end if;

  v_role := public.member_role(t_pri.restaurant_id);
  if v_role is null or v_role not in ('cashier', 'manager') then
    raise exception 'Only cashiers or managers can merge tables' using errcode = '42501';
  end if;

  select * into o_pri
    from public.orders
   where table_id = t_pri.id
     and restaurant_id = t_pri.restaurant_id
     and status not in ('completed', 'cancelled')
   order by created_at desc
   limit 1
   for update;

  if not found then
    raise exception 'Primary Table % has no active open order', t_pri.table_number using errcode = '23514';
  end if;

  if (o_pri.amount_paid - o_pri.amount_refunded) > 0 then
    raise exception 'Cannot merge into an order that already has payments' using errcode = '23514';
  end if;

  v_merged_ids := coalesce(o_pri.merged_table_ids, '{}');
  v_merged_nums := coalesce(o_pri.merged_table_numbers, '{}');
  v_guests := coalesce(o_pri.guest_count, 1);

  perform set_config('sombill.internal', 'on', true);

  foreach v_sec_id in array p_secondary_tables loop
    if v_sec_id = t_pri.id then
      continue;
    end if;

    select * into t_sec
      from public.restaurant_tables
     where id = v_sec_id and restaurant_id = t_pri.restaurant_id and archived_at is null
     for update;

    if not found then
      raise exception 'Secondary table not found in this restaurant' using errcode = 'P0002';
    end if;

    for o_sec in
      select * from public.orders
       where table_id = t_sec.id
         and restaurant_id = t_pri.restaurant_id
         and status not in ('completed', 'cancelled')
       for update
    loop
      if (o_sec.amount_paid - o_sec.amount_refunded) > 0 then
        raise exception 'Table % already has partial payments and cannot be merged', t_sec.table_number using errcode = '23514';
      end if;

      update public.order_items
         set order_id = o_pri.id,
             source_table_id = coalesce(source_table_id, t_sec.id),
             source_table_number = coalesce(source_table_number, t_sec.table_number),
             source_order_id = coalesce(source_order_id, o_sec.id),
             notes = case
               when coalesce(notes, '') like '[T' || t_sec.table_number || ']%' then notes
               when nullif(trim(coalesce(notes, '')), '') is null then format('[T%s]', t_sec.table_number)
               else format('[T%s] %s', t_sec.table_number, notes)
             end
       where order_id = o_sec.id
         and not is_voided;

      v_guests := v_guests + coalesce(o_sec.guest_count, 1);

      update public.orders
         set status = 'cancelled',
             cancel_reason = format('Merged into Table %s (Order #%s)', t_pri.table_number, o_pri.order_number),
             subtotal = 0,
             tax_amount = 0,
             total = 0
       where id = o_sec.id;
    end loop;

    update public.restaurant_tables
       set merged_into_id = t_pri.id
     where id = t_sec.id;

    if not (t_sec.id = any(v_merged_ids)) then
      v_merged_ids := array_append(v_merged_ids, t_sec.id);
    end if;
    if not (t_sec.table_number = any(v_merged_nums)) then
      v_merged_nums := array_append(v_merged_nums, t_sec.table_number);
    end if;
  end loop;

  update public.orders
     set merged_table_ids = v_merged_ids,
         merged_table_numbers = v_merged_nums,
         guest_count = least(v_guests, 50)
   where id = o_pri.id;

  perform public.recalc_order_totals(o_pri.id);
  perform set_config('sombill.internal', v_prev, true);

  select * into o_pri from public.orders where id = o_pri.id;

  perform public.write_audit(
    t_pri.restaurant_id,
    'table_merge',
    'orders',
    o_pri.id,
    null,
    jsonb_build_object(
      'primary_table', t_pri.table_number,
      'merged_tables', v_merged_nums,
      'order_number', o_pri.order_number,
      'total', o_pri.total
    ),
    format('Merged tables %s into Table %s', array_to_string(v_merged_nums, ', '), t_pri.table_number)
  );

  return jsonb_build_object(
    'order_id', o_pri.id,
    'order_number', o_pri.order_number,
    'primary_table_number', t_pri.table_number,
    'merged_table_numbers', v_merged_nums,
    'total', o_pri.total
  );
end;
$$;

-- 5. Unmerge tables before payment
create or replace function public.unmerge_table_orders(
  p_primary_table uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t_pri public.restaurant_tables;
  t_sec public.restaurant_tables;
  o_pri public.orders;
  o_new public.orders;
  v_sec_id uuid;
  v_role public.app_role;
  v_prev text := coalesce(current_setting('sombill.internal', true), '');
  v_restored int[] := '{}';
begin
  select * into t_pri from public.restaurant_tables where id = p_primary_table for update;
  if not found then raise exception 'Table not found' using errcode = 'P0002'; end if;

  v_role := public.member_role(t_pri.restaurant_id);
  if v_role is null or v_role not in ('cashier', 'manager') then
    raise exception 'Only cashiers or managers can unmerge tables' using errcode = '42501';
  end if;

  select * into o_pri
    from public.orders
   where table_id = t_pri.id
     and restaurant_id = t_pri.restaurant_id
     and status not in ('completed', 'cancelled')
   order by created_at desc
   limit 1
   for update;

  if not found then
    update public.restaurant_tables set merged_into_id = null where merged_into_id = t_pri.id;
    return jsonb_build_object('unmerged', true, 'restored_tables', v_restored);
  end if;

  if (o_pri.amount_paid - o_pri.amount_refunded) > 0 then
    raise exception 'Cannot unmerge after payment has been taken' using errcode = '23514';
  end if;

  perform set_config('sombill.internal', 'on', true);

  for v_sec_id in
    select distinct id from public.restaurant_tables
     where restaurant_id = t_pri.restaurant_id
       and (merged_into_id = t_pri.id or id = any(coalesce(o_pri.merged_table_ids, '{}')))
  loop
    select * into t_sec from public.restaurant_tables where id = v_sec_id for update;
    update public.restaurant_tables set merged_into_id = null where id = t_sec.id;

    if exists (
      select 1 from public.order_items
       where order_id = o_pri.id and source_table_id = t_sec.id and not is_voided
    ) then
      insert into public.orders (
        restaurant_id, table_id, waiter_id, cashier_id, order_type, notes, guest_count
      ) values (
        t_pri.restaurant_id, t_sec.id, o_pri.waiter_id, auth.uid(), 'dine_in',
        format('Unmerged from Table %s (Order #%s)', t_pri.table_number, o_pri.order_number), 1
      )
      returning * into o_new;

      update public.order_items
         set order_id = o_new.id,
             source_table_id = null,
             source_table_number = null,
             source_order_id = null,
             notes = nullif(trim(regexp_replace(coalesce(notes, ''), '^\[T[0-9]+\]\s*', '')), '')
       where order_id = o_pri.id
         and source_table_id = t_sec.id
         and not is_voided;

      perform public.recalc_order_totals(o_new.id);
      v_restored := array_append(v_restored, t_sec.table_number);
    end if;
  end loop;

  update public.orders
     set merged_table_ids = '{}',
         merged_table_numbers = '{}'
   where id = o_pri.id;

  perform public.recalc_order_totals(o_pri.id);
  perform set_config('sombill.internal', v_prev, true);

  select * into o_pri from public.orders where id = o_pri.id;

  perform public.write_audit(
    t_pri.restaurant_id,
    'table_unmerge',
    'orders',
    o_pri.id,
    null,
    jsonb_build_object('primary_table', t_pri.table_number, 'restored_tables', v_restored),
    format('Unmerged Table %s', t_pri.table_number)
  );

  return jsonb_build_object(
    'order_id', o_pri.id,
    'order_number', o_pri.order_number,
    'total', o_pri.total,
    'restored_tables', v_restored
  );
end;
$$;

-- 6. Transfer order to another table
create or replace function public.transfer_table_order(
  p_order uuid,
  p_to_table uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.orders;
  t_from public.restaurant_tables;
  t_to public.restaurant_tables;
  v_role public.app_role;
  v_prev text := coalesce(current_setting('sombill.internal', true), '');
begin
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;

  v_role := public.member_role(o.restaurant_id);
  if v_role is null or v_role not in ('cashier', 'manager', 'waiter') then
    raise exception 'Not authorized to transfer tables' using errcode = '42501';
  end if;

  if o.status in ('completed', 'cancelled') then
    raise exception 'Cannot transfer a % order', o.status using errcode = '23514';
  end if;

  select * into t_to
    from public.restaurant_tables
   where id = p_to_table and restaurant_id = o.restaurant_id and archived_at is null
   for update;

  if not found then
    raise exception 'Target table not found' using errcode = 'P0002';
  end if;

  if t_to.merged_into_id is not null then
    raise exception 'Target Table % is currently merged into another table', t_to.table_number using errcode = '23514';
  end if;

  if not public.restaurant_flag(o.restaurant_id, 'tables', 'allow_multiple_orders', false)
     and exists (
       select 1 from public.orders x
        where x.table_id = t_to.id
          and x.id <> o.id
          and x.status not in ('completed', 'cancelled')
     ) then
    raise exception 'Table % already has an active order. Use Merge Tables instead.', t_to.table_number using errcode = '23505';
  end if;

  if o.table_id is not null then
    select * into t_from from public.restaurant_tables where id = o.table_id;
  end if;

  perform set_config('sombill.internal', 'on', true);
  update public.orders set table_id = t_to.id where id = o.id;
  if t_from.id is not null then
    update public.restaurant_tables set merged_into_id = t_to.id where merged_into_id = t_from.id;
  end if;
  perform set_config('sombill.internal', v_prev, true);

  perform public.write_audit(
    o.restaurant_id,
    'table_transfer',
    'orders',
    o.id,
    jsonb_build_object('table_id', o.table_id, 'table_number', t_from.table_number),
    jsonb_build_object('table_id', t_to.id, 'table_number', t_to.table_number),
    format('Transferred Order #%s to Table %s', o.order_number, t_to.table_number)
  );

  return jsonb_build_object(
    'order_id', o.id,
    'order_number', o.order_number,
    'from_table_number', t_from.table_number,
    'to_table_number', t_to.table_number
  );
end;
$$;

-- 7. Void an individual order item with reason & audit trail
create or replace function public.void_order_item(
  p_item uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  it public.order_items;
  o public.orders;
  v_role public.app_role;
  v_prev text := coalesce(current_setting('sombill.internal', true), '');
begin
  if p_reason is null or length(trim(p_reason)) < 3 then
    raise exception 'A void reason (at least 3 characters) is required' using errcode = '23514';
  end if;

  select * into it from public.order_items where id = p_item for update;
  if not found then raise exception 'Order item not found' using errcode = 'P0002'; end if;

  select * into o from public.orders where id = it.order_id for update;
  v_role := public.member_role(o.restaurant_id);

  if v_role is null or v_role not in ('cashier', 'manager') then
    raise exception 'Only cashiers or managers can void items' using errcode = '42501';
  end if;

  if o.status in ('completed', 'cancelled') then
    raise exception 'Cannot void items on a % order', o.status using errcode = '23514';
  end if;

  if (o.amount_paid - o.amount_refunded) > 0 then
    raise exception 'Payment has already been taken; use Refunds instead' using errcode = '23514';
  end if;

  if it.is_voided then
    raise exception 'This item is already voided' using errcode = '23514';
  end if;

  perform set_config('sombill.internal', 'on', true);
  update public.order_items
     set is_voided = true,
         void_reason = trim(p_reason)
   where id = it.id;
  perform public.recalc_order_totals(o.id);
  perform set_config('sombill.internal', v_prev, true);

  select * into o from public.orders where id = o.id;

  perform public.write_audit(
    o.restaurant_id,
    'void_item',
    'order_items',
    it.id,
    jsonb_build_object('product_name', it.product_name, 'quantity', it.quantity, 'line_total', it.line_total),
    jsonb_build_object('is_voided', true, 'void_reason', trim(p_reason)),
    trim(p_reason)
  );

  return jsonb_build_object(
    'order_id', o.id,
    'subtotal', o.subtotal,
    'tax_amount', o.tax_amount,
    'total', o.total
  );
end;
$$;

-- 8. Split items off an open order into a separate child check on the same table
create or replace function public.split_order_by_items(
  p_order uuid,
  p_items jsonb,
  p_split_label text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.orders;
  o_child public.orders;
  it public.order_items;
  e jsonb;
  v_qty numeric;
  v_role public.app_role;
  v_prev text := coalesce(current_setting('sombill.internal', true), '');
begin
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;

  v_role := public.member_role(o.restaurant_id);
  if v_role is null or v_role not in ('cashier', 'manager') then
    raise exception 'Only cashiers or managers can split bills' using errcode = '42501';
  end if;

  if o.status in ('completed', 'cancelled') then
    raise exception 'Cannot split a % order', o.status using errcode = '23514';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Select at least one item to split into a separate check' using errcode = '23514';
  end if;

  perform set_config('sombill.internal', 'on', true);

  insert into public.orders (
    restaurant_id, table_id, waiter_id, cashier_id, customer_id, order_type,
    parent_order_id, split_label, notes, guest_count
  ) values (
    o.restaurant_id, o.table_id, o.waiter_id, auth.uid(), o.customer_id, o.order_type,
    o.id, coalesce(nullif(trim(coalesce(p_split_label, '')), ''), 'Split Check'),
    format('Split from Order #%s%s', o.order_number, case when p_split_label is not null then ' · ' || trim(p_split_label) else '' end),
    1
  )
  returning * into o_child;

  for e in select * from jsonb_array_elements(p_items) loop
    v_qty := round(((e->>'quantity')::numeric), 3);
    if v_qty is null or v_qty <= 0 then
      raise exception 'Split quantity must be greater than zero' using errcode = '23514';
    end if;

    select * into it
      from public.order_items
     where id = (e->>'item_id')::uuid
       and order_id = o.id
       and not is_voided
     for update;

    if not found then
      raise exception 'Item not found on this order' using errcode = 'P0002';
    end if;

    if v_qty > it.quantity + 0.0001 then
      raise exception 'Cannot split % of % (only % on order)', v_qty, it.product_name, it.quantity using errcode = '23514';
    end if;

    if abs(v_qty - it.quantity) <= 0.0001 then
      update public.order_items set order_id = o_child.id where id = it.id;
    else
      update public.order_items set quantity = round(it.quantity - v_qty, 3) where id = it.id;
      insert into public.order_items (
        restaurant_id, order_id, product_id, product_name, quantity, unit_price, notes,
        source_table_id, source_table_number, source_order_id
      ) values (
        o.restaurant_id, o_child.id, it.product_id, it.product_name, v_qty, it.unit_price, it.notes,
        it.source_table_id, it.source_table_number, o.id
      );
    end if;
  end loop;

  perform public.recalc_order_totals(o.id);
  perform public.recalc_order_totals(o_child.id);
  perform set_config('sombill.internal', v_prev, true);

  select * into o from public.orders where id = o.id;
  select * into o_child from public.orders where id = o_child.id;

  perform public.write_audit(
    o.restaurant_id,
    'split_bill',
    'orders',
    o.id,
    null,
    jsonb_build_object(
      'parent_order_number', o.order_number,
      'child_order_id', o_child.id,
      'child_order_number', o_child.order_number,
      'child_total', o_child.total,
      'parent_total', o.total
    ),
    coalesce(p_split_label, 'Split check by items')
  );

  return jsonb_build_object(
    'parent_order_id', o.id,
    'parent_order_number', o.order_number,
    'parent_total', o.total,
    'child_order_id', o_child.id,
    'child_order_number', o_child.order_number,
    'child_total', o_child.total
  );
end;
$$;

grant execute on function
  public.merge_table_orders(uuid, uuid[]),
  public.unmerge_table_orders(uuid),
  public.transfer_table_order(uuid, uuid),
  public.void_order_item(uuid, text),
  public.split_order_by_items(uuid, jsonb, text)
to authenticated, service_role;
