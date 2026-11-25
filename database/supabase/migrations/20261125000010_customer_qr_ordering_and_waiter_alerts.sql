-- =====================================================================
-- SomBill – Public Customer QR Ordering & Waiter Live Alerts
-- Migration: 20261125000010_customer_qr_ordering_and_waiter_alerts.sql
-- Enables unauthenticated guests scanning a table QR code (/table-menu/:tableId)
-- to submit real dine-in orders and call a waiter, immediately notifying all
-- active waiters and managers in that restaurant via public.notifications.
-- =====================================================================

create or replace function public.place_qr_table_order(
  p_table_id uuid,
  p_items jsonb,
  p_guest_name text default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.restaurant_tables;
  o public.orders;
  e jsonb;
  p public.products;
  v_qty numeric;
  v_note text;
  v_summary text;
  v_item_lines text[] := '{}';
  v_appended boolean := false;
begin
  if p_table_id is null then
    raise exception 'Table is required' using errcode = '22023';
  end if;

  select * into t
    from public.restaurant_tables
   where id = p_table_id and archived_at is null
   for update;

  if not found then
    raise exception 'Table not found or inactive' using errcode = 'P0002';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Add at least one item' using errcode = '23514';
  end if;

  if jsonb_array_length(p_items) > 100 then
    raise exception 'Too many items in one order' using errcode = '23514';
  end if;

  if length(coalesce(p_notes, '')) > 500 then
    raise exception 'Order notes are limited to 500 characters' using errcode = '23514';
  end if;

  -- Validate every item against live restaurant products (never trust client prices).
  for e in select * from jsonb_array_elements(p_items) loop
    begin
      v_qty := (e->>'quantity')::numeric;
    exception when others then
      raise exception 'Invalid quantity' using errcode = '22023';
    end;

    if v_qty is null or v_qty <= 0 or v_qty > 999 or v_qty <> trunc(v_qty) then
      raise exception 'Quantities must be whole numbers between 1 and 999' using errcode = '23514';
    end if;

    select * into p
      from public.products
     where id = (e->>'product_id')::uuid
       and restaurant_id = t.restaurant_id;

    if not found then
      raise exception 'Product not found on this menu' using errcode = '23503';
    end if;

    if p.archived_at is not null or not p.is_available then
      raise exception 'PRODUCT_UNAVAILABLE: "%" is not available', p.name using errcode = '23514';
    end if;

    v_item_lines := array_append(v_item_lines, format('%s× %s', v_qty::int, p.name));
  end loop;

  v_note := trim(concat_ws(' · ',
    case when nullif(trim(coalesce(p_guest_name, '')), '') is not null then 'Guest: ' || trim(p_guest_name) end,
    nullif(trim(coalesce(p_notes, '')), '')
  ));
  if v_note = '' then
    v_note := format('QR Self-Order · Table #%s', t.table_number);
  else
    v_note := format('QR Self-Order · %s', v_note);
  end if;

  -- If the table already has an active open order (and multi-orders are off), append items cleanly.
  if not public.restaurant_flag(t.restaurant_id, 'tables', 'allow_multiple_orders', false) then
    select * into o
      from public.orders
     where table_id = t.id
       and restaurant_id = t.restaurant_id
       and status not in ('completed', 'cancelled')
     order by created_at desc
     limit 1
     for update;

    if found then
      if o.bill_requested_at is not null or (o.amount_paid - o.amount_refunded) > 0 then
        raise exception 'This table already has a bill in progress. Please call a waiter to add more items.' using errcode = '23514';
      end if;
      v_appended := true;
    end if;
  end if;

  if not v_appended then
    insert into public.orders (
      restaurant_id, table_id, waiter_id, order_type, notes, guest_count
    ) values (
      t.restaurant_id, t.id, null, 'dine_in', v_note, 1
    )
    returning * into o;
  end if;

  -- Insert order items (order_items_before_write sets authoritative name, price, cost, tax_exempt;
  -- after-insert trigger recalculates order subtotal/tax/total).
  insert into public.order_items (
    restaurant_id, order_id, product_id, product_name, quantity, unit_price, notes
  )
  select
    t.restaurant_id,
    o.id,
    (el->>'product_id')::uuid,
    '',
    (el->>'quantity')::numeric,
    0,
    nullif(trim(coalesce(el->>'notes', '')), '')
  from jsonb_array_elements(p_items) el;

  select * into o from public.orders where id = o.id;

  v_summary := left(
    concat_ws(' · ',
      case when nullif(trim(coalesce(p_guest_name, '')), '') is not null then 'Guest: ' || trim(p_guest_name) end,
      array_to_string(v_item_lines, ', ')
    ),
    240
  );

  -- Notify all active waiters and managers immediately (realtime notifications table).
  perform public.notify_roles(
    t.restaurant_id,
    array['waiter', 'manager']::public.app_role[],
    'qr_order',
    case when v_appended
      then format('Added QR Items · Order #%s · Table #%s', o.order_number, t.table_number)
      else format('New QR Order #%s · Table #%s', o.order_number, t.table_number)
    end,
    v_summary,
    o.id,
    t.id
  );

  return jsonb_build_object(
    'order_id', o.id,
    'order_number', o.order_number,
    'total', o.total,
    'status', o.status,
    'appended', v_appended
  );
end;
$$;

create or replace function public.call_table_waiter(
  p_table_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.restaurant_tables;
  v_order_id uuid;
  v_body text;
begin
  if p_table_id is null then
    raise exception 'Table is required' using errcode = '22023';
  end if;

  select * into t
    from public.restaurant_tables
   where id = p_table_id and archived_at is null;

  if not found then
    raise exception 'Table not found or inactive' using errcode = 'P0002';
  end if;

  select id into v_order_id
    from public.orders
   where table_id = t.id
     and restaurant_id = t.restaurant_id
     and status not in ('completed', 'cancelled')
   order by created_at desc
   limit 1;

  v_body := coalesce(
    nullif(trim(coalesce(p_reason, '')), ''),
    format('Guest at Table #%s (%s) requested a waiter.', t.table_number, coalesce(t.section, 'Dining Floor'))
  );

  perform public.notify_roles(
    t.restaurant_id,
    array['waiter', 'manager']::public.app_role[],
    'waiter_call',
    format('Table #%s needs a waiter', t.table_number),
    left(v_body, 240),
    v_order_id,
    t.id
  );

  return jsonb_build_object('ok', true, 'table_number', t.table_number);
end;
$$;

grant execute on function public.place_qr_table_order(uuid, jsonb, text, text) to anon, authenticated;
grant execute on function public.call_table_waiter(uuid, text) to anon, authenticated;
