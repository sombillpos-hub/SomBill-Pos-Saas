-- =====================================================================
-- SomBill – Business logic: triggers and RPCs
-- Migration: 20261121000002_business_logic.sql
-- All state-changing financial / stock operations run server-side so the
-- frontend can never bypass the rules.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Cross-restaurant integrity: a child row must belong to the same
-- restaurant as the rows it references.
-- ---------------------------------------------------------------------
create or replace function public.assert_same_restaurant(p_table regclass, p_id uuid, p_restaurant uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_rid uuid;
begin
  if p_id is null then return; end if;
  execute format('select restaurant_id from %s where id = $1', p_table) into v_rid using p_id;
  if v_rid is null or v_rid <> p_restaurant then
    raise exception 'Referenced % does not belong to this restaurant', p_table
      using errcode = '23503';
  end if;
end $$;

create or replace function public.check_product_refs()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_same_restaurant('public.categories', new.category_id, new.restaurant_id);
  perform public.assert_same_restaurant('public.inventory_items', new.inventory_item_id, new.restaurant_id);
  return new;
end $$;
drop trigger if exists trg_products_refs on public.products;
create trigger trg_products_refs before insert or update on public.products
  for each row execute function public.check_product_refs();

create or replace function public.check_recipe_refs()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_same_restaurant('public.products', new.product_id, new.restaurant_id);
  perform public.assert_same_restaurant('public.inventory_items', new.inventory_item_id, new.restaurant_id);
  return new;
end $$;
drop trigger if exists trg_recipe_refs on public.product_recipe_items;
create trigger trg_recipe_refs before insert or update on public.product_recipe_items
  for each row execute function public.check_recipe_refs();

create or replace function public.check_inventory_refs()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_same_restaurant('public.suppliers', new.supplier_id, new.restaurant_id);
  return new;
end $$;
drop trigger if exists trg_inventory_refs on public.inventory_items;
create trigger trg_inventory_refs before insert or update on public.inventory_items
  for each row execute function public.check_inventory_refs();

create or replace function public.check_expense_refs()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_same_restaurant('public.suppliers', new.supplier_id, new.restaurant_id);
  return new;
end $$;
drop trigger if exists trg_expense_refs on public.expenses;
create trigger trg_expense_refs before insert or update on public.expenses
  for each row execute function public.check_expense_refs();

-- ---------------------------------------------------------------------
-- Orders: numbering, snapshots, guards
-- ---------------------------------------------------------------------
create or replace function public.next_order_number(p_restaurant uuid)
returns bigint language plpgsql security definer set search_path = public as $$
declare v bigint;
begin
  update public.restaurants set order_seq = order_seq + 1 where id = p_restaurant
  returning order_seq into v;
  return v;
end $$;

create or replace function public.orders_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare r public.restaurants;
begin
  select * into r from public.restaurants where id = new.restaurant_id;
  if not found then raise exception 'Unknown restaurant'; end if;
  perform public.assert_same_restaurant('public.restaurant_tables', new.table_id, new.restaurant_id);
  perform public.assert_same_restaurant('public.customers', new.customer_id, new.restaurant_id);
  if new.order_type = 'dine_in' and new.table_id is null then
    raise exception 'Dine-in orders require a table' using errcode = '23514';
  end if;
  new.order_number := public.next_order_number(new.restaurant_id);
  new.tax_rate := r.tax_rate;
  new.tax_inclusive := r.tax_inclusive;
  new.subtotal := 0; new.tax_amount := 0; new.total := 0;
  new.amount_paid := 0; new.amount_refunded := 0; new.payment_status := 'unpaid';
  new.stock_deducted_at := null; new.stock_reversed_at := null;
  if new.status in ('completed', 'cancelled') then
    raise exception 'Orders cannot be created as % ', new.status;
  end if;
  return new;
end $$;
drop trigger if exists trg_orders_before_insert on public.orders;
create trigger trg_orders_before_insert before insert on public.orders
  for each row execute function public.orders_before_insert();

-- Guards on order updates. Financial columns are maintained only by
-- internal triggers which set the sombill.internal flag.
create or replace function public.orders_before_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_internal boolean := coalesce(current_setting('sombill.internal', true), '') = 'on';
begin
  if new.restaurant_id <> old.restaurant_id or new.order_number <> old.order_number then
    raise exception 'Order identity cannot change';
  end if;

  if not v_internal then
    -- Money/stock bookkeeping columns are trigger-maintained.
    if new.subtotal <> old.subtotal or new.tax_amount <> old.tax_amount or new.total <> old.total
       or new.amount_paid <> old.amount_paid or new.amount_refunded <> old.amount_refunded
       or new.payment_status <> old.payment_status or new.tax_rate <> old.tax_rate
       or new.tax_inclusive <> old.tax_inclusive
       or new.stock_deducted_at is distinct from old.stock_deducted_at
       or new.stock_reversed_at is distinct from old.stock_reversed_at then
      raise exception 'Order totals and payment state are system-maintained' using errcode = '42501';
    end if;

    if old.status in ('completed', 'cancelled') then
      raise exception 'A % order cannot be modified', old.status using errcode = '42501';
    end if;

    if new.status = 'cancelled' and old.status <> 'cancelled' then
      raise exception 'Use cancel_order() to cancel an order' using errcode = '42501';
    end if;

    if new.discount_amount <> old.discount_amount and not public.is_manager(new.restaurant_id)
       and not public.has_role(new.restaurant_id, array['cashier']::public.app_role[]) then
      raise exception 'Only cashiers or managers can apply discounts' using errcode = '42501';
    end if;
  end if;

  perform public.assert_same_restaurant('public.restaurant_tables', new.table_id, new.restaurant_id);
  perform public.assert_same_restaurant('public.customers', new.customer_id, new.restaurant_id);

  if new.status = 'completed' and old.status <> 'completed' then
    new.completed_at := now();
  end if;
  return new;
end $$;
drop trigger if exists trg_orders_before_update on public.orders;
create trigger trg_orders_before_update before update on public.orders
  for each row execute function public.orders_before_update();

create or replace function public.block_order_delete()
returns trigger language plpgsql as $$
begin
  raise exception 'Orders are never deleted. Cancel the order with a reason instead.'
    using errcode = '42501';
end $$;
drop trigger if exists trg_orders_no_delete on public.orders;
create trigger trg_orders_no_delete before delete on public.orders
  for each row execute function public.block_order_delete();

-- ---------------------------------------------------------------------
-- Order totals
-- ---------------------------------------------------------------------
create or replace function public.recalc_order_totals(p_order uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_prev_internal text := coalesce(current_setting('sombill.internal', true), ''); o public.orders; v_sub numeric(12,2); v_taxable numeric(12,2); v_tax numeric(12,2);
        v_ratio numeric; v_total numeric(12,2);
begin
  select * into o from public.orders where id = p_order for update;
  select coalesce(sum(line_total), 0),
         coalesce(sum(line_total) filter (where not tax_exempt), 0)
    into v_sub, v_taxable
    from public.order_items where order_id = p_order and not is_voided;

  -- discount applied proportionally across taxable base
  v_ratio := case when v_sub > 0 then greatest(v_sub - o.discount_amount, 0) / v_sub else 0 end;
  v_taxable := round(v_taxable * v_ratio, 2);

  if o.tax_inclusive then
    v_tax := round(v_taxable - v_taxable / (1 + o.tax_rate), 2);
    v_total := greatest(v_sub - o.discount_amount, 0);
  else
    v_tax := round(v_taxable * o.tax_rate, 2);
    v_total := greatest(v_sub - o.discount_amount, 0) + v_tax;
  end if;

  perform set_config('sombill.internal', 'on', true);
  update public.orders set subtotal = v_sub, tax_amount = v_tax, total = v_total where id = p_order;
  perform public.refresh_payment_state(p_order);
  perform set_config('sombill.internal', v_prev_internal, true);
end $$;

create or replace function public.order_items_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
declare o public.orders; p public.products;
begin
  select * into o from public.orders where id = new.order_id;
  if o.restaurant_id <> new.restaurant_id then
    raise exception 'Order item restaurant mismatch' using errcode = '23503';
  end if;
  if o.status in ('completed', 'cancelled') then
    raise exception 'Items of a % order cannot be changed', o.status using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    select * into p from public.products where id = new.product_id;
    if p.restaurant_id <> new.restaurant_id then
      raise exception 'Product does not belong to this restaurant' using errcode = '23503';
    end if;
    if p.archived_at is not null or not p.is_available then
      raise exception 'Product "%" is not available', p.name using errcode = '23514';
    end if;
    -- Server-side price snapshot: never trust a client-supplied price.
    new.product_name := p.name;
    new.unit_price := p.price;
    new.unit_cost := p.cost_price;
    new.tax_exempt := (p.tax_category = 'exempt');
    new.is_voided := false;
  else
    if new.product_id <> old.product_id or new.unit_price <> old.unit_price
       or new.order_id <> old.order_id then
      raise exception 'Change quantity or void the item instead' using errcode = '42501';
    end if;
    if old.is_voided and not new.is_voided then
      raise exception 'A voided item cannot be restored' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_order_items_before on public.order_items;
create trigger trg_order_items_before before insert or update on public.order_items
  for each row execute function public.order_items_before_write();

create or replace function public.order_items_after_write()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.recalc_order_totals(coalesce(new.order_id, old.order_id));
  return null;
end $$;
drop trigger if exists trg_order_items_after on public.order_items;
create trigger trg_order_items_after after insert or update on public.order_items
  for each row execute function public.order_items_after_write();

create or replace function public.block_order_item_delete()
returns trigger language plpgsql as $$
begin
  raise exception 'Order items are voided, never deleted' using errcode = '42501';
end $$;
drop trigger if exists trg_order_items_no_delete on public.order_items;
create trigger trg_order_items_no_delete before delete on public.order_items
  for each row execute function public.block_order_item_delete();

create or replace function public.orders_discount_after()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.discount_amount <> old.discount_amount then
    perform public.recalc_order_totals(new.id);
  end if;
  return null;
end $$;
drop trigger if exists trg_orders_discount on public.orders;
create trigger trg_orders_discount after update of discount_amount on public.orders
  for each row execute function public.orders_discount_after();

-- ---------------------------------------------------------------------
-- Payments → order payment state
-- ---------------------------------------------------------------------
create or replace function public.refresh_payment_state(p_order uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_prev_internal text := coalesce(current_setting('sombill.internal', true), ''); v_paid numeric(12,2); v_ref numeric(12,2); v_total numeric(12,2); v_state public.payment_status;
begin
  select coalesce(sum(amount) filter (where kind = 'payment'), 0),
         coalesce(sum(amount) filter (where kind = 'refund'), 0)
    into v_paid, v_ref
    from public.payments where order_id = p_order and status = 'succeeded';
  select total into v_total from public.orders where id = p_order;

  v_state := case
    when v_ref > 0 and v_paid - v_ref <= 0 then 'refunded'
    when v_total > 0 and v_paid - v_ref >= v_total then 'paid'
    when v_paid - v_ref > 0 then 'partial'
    else 'unpaid' end;

  perform set_config('sombill.internal', 'on', true);
  update public.orders
     set amount_paid = v_paid, amount_refunded = v_ref, payment_status = v_state
   where id = p_order;
  perform set_config('sombill.internal', v_prev_internal, true);
end $$;

create or replace function public.payments_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare o public.orders; v_net numeric(12,2);
begin
  select * into o from public.orders where id = new.order_id for update;
  if o.restaurant_id <> new.restaurant_id then
    raise exception 'Payment restaurant mismatch' using errcode = '23503';
  end if;
  if new.kind = 'payment' then
    if o.status = 'cancelled' then
      raise exception 'Cannot take payment for a cancelled order' using errcode = '23514';
    end if;
    if new.status = 'succeeded' and o.amount_paid - o.amount_refunded + new.amount > o.total then
      raise exception 'Payment exceeds outstanding balance (%.2f)',
        o.total - (o.amount_paid - o.amount_refunded) using errcode = '23514';
    end if;
  else
    if coalesce(current_setting('sombill.internal', true), '') <> 'on' then
      raise exception 'Use refund_order() to record refunds' using errcode = '42501';
    end if;
    v_net := o.amount_paid - o.amount_refunded;
    if new.amount > v_net then
      raise exception 'Refund exceeds collected amount (%.2f)', v_net using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_payments_before_insert on public.payments;
create trigger trg_payments_before_insert before insert on public.payments
  for each row execute function public.payments_before_insert();

create or replace function public.payments_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_prev_internal text := coalesce(current_setting('sombill.internal', true), '');
begin
  perform public.refresh_payment_state(new.order_id);
  return null;
end $$;
drop trigger if exists trg_payments_after_insert on public.payments;
create trigger trg_payments_after_insert after insert on public.payments
  for each row execute function public.payments_after_insert();

create or replace function public.block_payment_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'Payments are an immutable ledger; record a refund instead'
    using errcode = '42501';
end $$;
drop trigger if exists trg_payments_immutable on public.payments;
create trigger trg_payments_immutable before update or delete on public.payments
  for each row execute function public.block_payment_mutation();

-- ---------------------------------------------------------------------
-- Inventory: every quantity change goes through apply_stock_movement()
-- ---------------------------------------------------------------------
create or replace function public.inventory_guard()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.quantity <> old.quantity
     and coalesce(current_setting('sombill.stock_rpc', true), '') <> 'on' then
    raise exception 'Stock quantity changes must be recorded as stock movements'
      using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists trg_inventory_guard on public.inventory_items;
create trigger trg_inventory_guard before update on public.inventory_items
  for each row execute function public.inventory_guard();

create or replace function public.inventory_opening_movement()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.quantity < 0 then
    raise exception 'Opening stock cannot be negative' using errcode = '23514';
  end if;
  if new.quantity <> 0 then
    insert into public.stock_movements (restaurant_id, inventory_item_id, movement_type,
      quantity_change, quantity_after, unit_cost, reason)
    values (new.restaurant_id, new.id, 'opening', new.quantity, new.quantity, new.unit_cost,
            'Opening stock');
  end if;
  return null;
end $$;
drop trigger if exists trg_inventory_opening on public.inventory_items;
create trigger trg_inventory_opening after insert on public.inventory_items
  for each row execute function public.inventory_opening_movement();

create or replace function public.block_stock_movement_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'Stock movements are immutable; record a correcting movement'
    using errcode = '42501';
end $$;
drop trigger if exists trg_stock_mov_immutable on public.stock_movements;
create trigger trg_stock_mov_immutable before update or delete on public.stock_movements
  for each row execute function public.block_stock_movement_mutation();

-- Internal primitive (not granted to clients).
create or replace function public.apply_stock_movement(
  p_item uuid, p_type public.stock_movement_type, p_change numeric,
  p_unit_cost numeric default null, p_ref_type text default null, p_ref_id uuid default null,
  p_reason text default null)
returns numeric language plpgsql security definer set search_path = public as $$
declare it public.inventory_items; v_after numeric(14,3); v_allow boolean; v_cost numeric(14,4);
begin
  if p_change = 0 then return null; end if;
  select * into it from public.inventory_items where id = p_item for update;
  if not found then raise exception 'Inventory item not found'; end if;

  select coalesce((settings->'inventory'->>'allow_negative_stock')::boolean, false)
    into v_allow from public.restaurants where id = it.restaurant_id;

  v_after := it.quantity + p_change;
  if v_after < 0 and not v_allow then
    raise exception 'Insufficient stock for "%": have % %, need %',
      it.name, it.quantity, it.unit, abs(p_change) using errcode = '23514';
  end if;

  -- Weighted average cost on receipts.
  v_cost := it.unit_cost;
  if p_type in ('receive', 'transfer_in') and p_unit_cost is not null and p_change > 0 then
    v_cost := case when it.quantity > 0
                   then round((it.quantity * it.unit_cost + p_change * p_unit_cost) / (it.quantity + p_change), 4)
                   else p_unit_cost end;
  end if;

  perform set_config('sombill.stock_rpc', 'on', true);
  update public.inventory_items set quantity = v_after, unit_cost = v_cost where id = p_item;
  perform set_config('sombill.stock_rpc', 'off', true);

  insert into public.stock_movements (restaurant_id, inventory_item_id, movement_type,
    quantity_change, quantity_after, unit_cost, reference_type, reference_id, reason)
  values (it.restaurant_id, p_item, p_type, p_change, v_after,
          coalesce(p_unit_cost, it.unit_cost), p_ref_type, p_ref_id, p_reason);
  return v_after;
end $$;
revoke all on function public.apply_stock_movement(uuid, public.stock_movement_type, numeric, numeric, text, uuid, text) from public;

-- Manager-facing: receive / adjust / wastage.
create or replace function public.adjust_stock(
  p_item uuid, p_type public.stock_movement_type, p_quantity numeric,
  p_reason text, p_unit_cost numeric default null)
returns numeric language plpgsql security definer set search_path = public as $$
declare v_rid uuid; v_change numeric;
begin
  select restaurant_id into v_rid from public.inventory_items where id = p_item and archived_at is null;
  if v_rid is null then raise exception 'Inventory item not found'; end if;
  if not public.is_manager(v_rid) then
    raise exception 'Only managers can change stock' using errcode = '42501';
  end if;
  if p_reason is null or length(trim(p_reason)) < 3 then
    raise exception 'A reason is required' using errcode = '23514';
  end if;
  case p_type
    when 'receive' then
      if p_quantity <= 0 then raise exception 'Quantity must be positive' using errcode = '23514'; end if;
      v_change := p_quantity;
    when 'wastage' then
      if p_quantity <= 0 then raise exception 'Quantity must be positive' using errcode = '23514'; end if;
      v_change := -p_quantity;
    when 'adjustment' then
      if p_quantity = 0 then raise exception 'Adjustment cannot be zero' using errcode = '23514'; end if;
      v_change := p_quantity;  -- signed
    else
      raise exception 'Unsupported movement type %', p_type using errcode = '22023';
  end case;
  return public.apply_stock_movement(p_item, p_type, v_change, p_unit_cost, 'manual', null, trim(p_reason));
end $$;

create or replace function public.transfer_stock(
  p_from uuid, p_to uuid, p_quantity numeric, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare a public.inventory_items; b public.inventory_items; v_ref uuid := gen_random_uuid();
begin
  select * into a from public.inventory_items where id = p_from and archived_at is null;
  select * into b from public.inventory_items where id = p_to and archived_at is null;
  if a.id is null or b.id is null then raise exception 'Inventory item not found'; end if;
  if a.restaurant_id <> b.restaurant_id then raise exception 'Items belong to different restaurants'; end if;
  if a.id = b.id then raise exception 'Choose two different items' using errcode = '23514'; end if;
  if a.unit <> b.unit then
    raise exception 'Units differ (% vs %)', a.unit, b.unit using errcode = '23514';
  end if;
  if not public.is_manager(a.restaurant_id) then
    raise exception 'Only managers can transfer stock' using errcode = '42501';
  end if;
  if p_quantity <= 0 then raise exception 'Quantity must be positive' using errcode = '23514'; end if;
  perform public.apply_stock_movement(p_from, 'transfer_out', -p_quantity, a.unit_cost, 'transfer', v_ref, p_reason);
  perform public.apply_stock_movement(p_to, 'transfer_in', p_quantity, a.unit_cost, 'transfer', v_ref, p_reason);
end $$;

-- ---------------------------------------------------------------------
-- Sale stock deduction / reversal
-- ---------------------------------------------------------------------
create or replace function public.deduct_order_stock(p_order uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_prev_internal text := coalesce(current_setting('sombill.internal', true), ''); rec record;
begin
  for rec in
    select r.inventory_item_id as item_id, sum(oi.quantity * r.quantity) as qty
      from public.order_items oi
      join public.products p on p.id = oi.product_id and p.track_stock
      join public.product_recipe_items r on r.product_id = p.id
     where oi.order_id = p_order and not oi.is_voided
     group by r.inventory_item_id
    union all
    select p.inventory_item_id, sum(oi.quantity)
      from public.order_items oi
      join public.products p on p.id = oi.product_id and p.track_stock
     where oi.order_id = p_order and not oi.is_voided and p.inventory_item_id is not null
       and not exists (select 1 from public.product_recipe_items r where r.product_id = p.id)
     group by p.inventory_item_id
  loop
    perform public.apply_stock_movement(rec.item_id, 'sale', -rec.qty, null, 'order', p_order, 'Sale');
  end loop;
  perform set_config('sombill.internal', 'on', true);
  update public.orders set stock_deducted_at = now() where id = p_order;
  perform set_config('sombill.internal', v_prev_internal, true);
end $$;
revoke all on function public.deduct_order_stock(uuid) from public;

create or replace function public.reverse_order_stock(p_order uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_prev_internal text := coalesce(current_setting('sombill.internal', true), ''); rec record;
begin
  for rec in
    select inventory_item_id, sum(quantity_change) as qty
      from public.stock_movements
     where reference_type = 'order' and reference_id = p_order and movement_type = 'sale'
     group by inventory_item_id
  loop
    perform public.apply_stock_movement(rec.inventory_item_id, 'sale_reversal', -rec.qty, null,
                                        'order', p_order, p_reason);
  end loop;
  perform set_config('sombill.internal', 'on', true);
  update public.orders set stock_reversed_at = now() where id = p_order;
  perform set_config('sombill.internal', v_prev_internal, true);
end $$;
revoke all on function public.reverse_order_stock(uuid, text) from public;

create or replace function public.orders_after_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_deduct text;
begin
  if new.status = 'completed' and old.status <> 'completed' and new.stock_deducted_at is null then
    select coalesce(settings->'inventory'->>'deduct_on', 'completed') into v_deduct
      from public.restaurants where id = new.restaurant_id;
    if v_deduct = 'completed' then
      perform public.deduct_order_stock(new.id);
    end if;
  end if;
  return null;
end $$;
drop trigger if exists trg_orders_after_status on public.orders;
create trigger trg_orders_after_status after update of status on public.orders
  for each row execute function public.orders_after_status();

-- ---------------------------------------------------------------------
-- Cancellation and refunds
-- ---------------------------------------------------------------------
create or replace function public.cancel_order(p_order uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_prev_internal text := coalesce(current_setting('sombill.internal', true), ''); o public.orders;
begin
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'Order not found'; end if;
  if not public.has_permission(o.restaurant_id, 'cashier_can_cancel_orders')
     or not (public.is_manager(o.restaurant_id)
             or public.has_role(o.restaurant_id, array['cashier']::public.app_role[])) then
    raise exception 'You are not authorized to cancel orders' using errcode = '42501';
  end if;
  if p_reason is null or length(trim(p_reason)) < 3 then
    raise exception 'A cancellation reason is required' using errcode = '23514';
  end if;
  if o.status in ('completed', 'cancelled') then
    raise exception 'A % order cannot be cancelled', o.status using errcode = '23514';
  end if;
  if o.amount_paid - o.amount_refunded > 0 then
    raise exception 'Refund collected payments before cancelling' using errcode = '23514';
  end if;
  perform set_config('sombill.internal', 'on', true);
  update public.orders
     set status = 'cancelled', cancel_reason = trim(p_reason), cancelled_at = now(),
         cancelled_by = auth.uid()
   where id = p_order;
  perform set_config('sombill.internal', v_prev_internal, true);
  perform public.write_audit(o.restaurant_id, 'cancel', 'orders', o.id,
    jsonb_build_object('status', o.status), jsonb_build_object('status', 'cancelled'), trim(p_reason));
end $$;

create or replace function public.refund_order(
  p_order uuid, p_amount numeric, p_method public.payment_method, p_reason text,
  p_restock boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_prev_internal text := coalesce(current_setting('sombill.internal', true), ''); o public.orders; v_id uuid;
begin
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'Order not found'; end if;
  if not public.has_permission(o.restaurant_id, 'cashier_can_refund')
     or not (public.is_manager(o.restaurant_id)
             or public.has_role(o.restaurant_id, array['cashier']::public.app_role[])) then
    raise exception 'You are not authorized to refund' using errcode = '42501';
  end if;
  if p_reason is null or length(trim(p_reason)) < 3 then
    raise exception 'A refund reason is required' using errcode = '23514';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Refund amount must be positive' using errcode = '23514';
  end if;
  perform set_config('sombill.internal', 'on', true);
  insert into public.payments (restaurant_id, order_id, kind, method, amount, notes)
  values (o.restaurant_id, o.id, 'refund', p_method, p_amount, trim(p_reason))
  returning id into v_id;
  if p_restock and o.stock_deducted_at is not null and o.stock_reversed_at is null then
    perform public.reverse_order_stock(o.id, 'Refund: ' || trim(p_reason));
  end if;
  perform set_config('sombill.internal', v_prev_internal, true);
  perform public.write_audit(o.restaurant_id, 'refund', 'orders', o.id, null,
    jsonb_build_object('amount', p_amount, 'method', p_method, 'restock', p_restock), trim(p_reason));
  return v_id;
end $$;

-- ---------------------------------------------------------------------
-- Purchase orders
-- ---------------------------------------------------------------------
create or replace function public.purchase_orders_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_same_restaurant('public.suppliers', new.supplier_id, new.restaurant_id);
  update public.restaurants set po_seq = po_seq + 1 where id = new.restaurant_id
  returning po_seq into new.po_number;
  new.subtotal := 0; new.total := 0;
  if new.status not in ('draft', 'ordered') then
    raise exception 'New purchase orders must be draft or ordered';
  end if;
  return new;
end $$;
drop trigger if exists trg_po_before_insert on public.purchase_orders;
create trigger trg_po_before_insert before insert on public.purchase_orders
  for each row execute function public.purchase_orders_before_insert();

create or replace function public.purchase_orders_before_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_internal boolean := coalesce(current_setting('sombill.internal', true), '') = 'on';
begin
  if new.po_number <> old.po_number or new.restaurant_id <> old.restaurant_id then
    raise exception 'PO identity cannot change';
  end if;
  if not v_internal then
    if new.subtotal <> old.subtotal or new.total <> old.total then
      raise exception 'PO totals are system-maintained' using errcode = '42501';
    end if;
    if new.status in ('partially_received', 'received') and new.status <> old.status then
      raise exception 'Use receive_purchase_order() to receive stock' using errcode = '42501';
    end if;
    if old.status in ('received', 'cancelled') and new.status <> old.status then
      raise exception 'A % purchase order cannot change status', old.status using errcode = '42501';
    end if;
    if old.status = 'partially_received' and new.status not in ('partially_received', 'cancelled') then
      raise exception 'Invalid status transition' using errcode = '42501';
    end if;
    if new.supplier_id <> old.supplier_id and old.status <> 'draft' then
      raise exception 'Supplier can only change on draft POs' using errcode = '42501';
    end if;
  end if;
  perform public.assert_same_restaurant('public.suppliers', new.supplier_id, new.restaurant_id);
  if new.status = 'ordered' and old.status = 'draft' then new.ordered_at := now(); end if;
  return new;
end $$;
drop trigger if exists trg_po_before_update on public.purchase_orders;
create trigger trg_po_before_update before update on public.purchase_orders
  for each row execute function public.purchase_orders_before_update();

create or replace function public.po_items_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
declare po public.purchase_orders;
begin
  select * into po from public.purchase_orders where id = coalesce(new.purchase_order_id, old.purchase_order_id);
  if coalesce(current_setting('sombill.internal', true), '') <> 'on' then
    if po.status <> 'draft' then
      raise exception 'Lines can only be edited while the PO is a draft' using errcode = '42501';
    end if;
    if tg_op <> 'DELETE' and new.quantity_received <> coalesce(old.quantity_received, 0) then
      raise exception 'Received quantity is set by receiving' using errcode = '42501';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  if po.restaurant_id <> new.restaurant_id then raise exception 'Restaurant mismatch'; end if;
  perform public.assert_same_restaurant('public.inventory_items', new.inventory_item_id, new.restaurant_id);
  return new;
end $$;
drop trigger if exists trg_po_items_before on public.purchase_order_items;
create trigger trg_po_items_before before insert or update or delete on public.purchase_order_items
  for each row execute function public.po_items_before_write();

create or replace function public.po_items_after_write()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_prev_internal text := coalesce(current_setting('sombill.internal', true), ''); v_po uuid := coalesce(new.purchase_order_id, old.purchase_order_id); v_sum numeric(12,2);
begin
  select coalesce(sum(line_total), 0) into v_sum from public.purchase_order_items where purchase_order_id = v_po;
  perform set_config('sombill.internal', 'on', true);
  update public.purchase_orders set subtotal = v_sum, total = v_sum where id = v_po;
  perform set_config('sombill.internal', v_prev_internal, true);
  return null;
end $$;
drop trigger if exists trg_po_items_after on public.purchase_order_items;
create trigger trg_po_items_after after insert or update or delete on public.purchase_order_items
  for each row execute function public.po_items_after_write();

-- p_lines: [{"line_id": uuid, "quantity": number}, ...]
create or replace function public.receive_purchase_order(
  p_po uuid, p_lines jsonb, p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_prev_internal text := coalesce(current_setting('sombill.internal', true), ''); po public.purchase_orders; ln record; li public.purchase_order_items;
        v_remaining numeric; v_total_received numeric := 0; v_open numeric;
begin
  select * into po from public.purchase_orders where id = p_po for update;
  if not found then raise exception 'Purchase order not found'; end if;
  if not public.is_manager(po.restaurant_id) then
    raise exception 'Only managers can receive stock' using errcode = '42501';
  end if;
  if p_idempotency_key is null then raise exception 'Idempotency key required'; end if;
  if exists (select 1 from public.purchase_order_receipts where idempotency_key = p_idempotency_key) then
    return jsonb_build_object('status', 'duplicate_ignored', 'po_status', po.status);
  end if;
  if po.status not in ('ordered', 'partially_received') then
    raise exception 'Only ordered purchase orders can be received (status: %)', po.status
      using errcode = '23514';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Nothing to receive' using errcode = '23514';
  end if;

  perform set_config('sombill.internal', 'on', true);
  for ln in select (e->>'line_id')::uuid as line_id, (e->>'quantity')::numeric as qty
              from jsonb_array_elements(p_lines) e
  loop
    if ln.qty is null or ln.qty < 0 then
      raise exception 'Invalid quantity' using errcode = '23514';
    end if;
    continue when ln.qty = 0;
    select * into li from public.purchase_order_items
     where id = ln.line_id and purchase_order_id = p_po for update;
    if not found then raise exception 'Line does not belong to this purchase order'; end if;
    v_remaining := li.quantity_ordered - li.quantity_received;
    if ln.qty > v_remaining then
      raise exception 'Cannot receive % – only % outstanding on this line', ln.qty, v_remaining
        using errcode = '23514';
    end if;
    update public.purchase_order_items set quantity_received = quantity_received + ln.qty
     where id = li.id;
    perform public.apply_stock_movement(li.inventory_item_id, 'receive', ln.qty, li.unit_cost,
      'purchase_order', p_po, 'PO #' || po.po_number);
    v_total_received := v_total_received + ln.qty;
  end loop;

  if v_total_received = 0 then raise exception 'Nothing to receive' using errcode = '23514'; end if;

  select coalesce(sum(quantity_ordered - quantity_received), 0) into v_open
    from public.purchase_order_items where purchase_order_id = p_po;

  update public.purchase_orders
     set status = case when v_open = 0 then 'received'::public.po_status
                       else 'partially_received'::public.po_status end,
         received_at = case when v_open = 0 then now() else received_at end
   where id = p_po;

  insert into public.purchase_order_receipts (restaurant_id, purchase_order_id, idempotency_key, lines)
  values (po.restaurant_id, p_po, p_idempotency_key, p_lines);
  perform set_config('sombill.internal', v_prev_internal, true);

  return jsonb_build_object('status', 'received',
                            'po_status', case when v_open = 0 then 'received' else 'partially_received' end,
                            'quantity_received', v_total_received);
end $$;

-- ---------------------------------------------------------------------
-- Expenses: approval workflow + lock approved records
-- ---------------------------------------------------------------------
create or replace function public.expenses_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_req boolean;
begin
  select coalesce((settings->'expenses'->>'approval_required')::boolean, false)
    into v_req from public.restaurants where id = new.restaurant_id;
  if tg_op = 'INSERT' then
    new.approved_by := null; new.approved_at := null;
    if v_req then new.status := 'pending';
    else new.status := 'approved'; new.approved_by := auth.uid(); new.approved_at := now(); end if;
  else
    if coalesce(current_setting('sombill.internal', true), '') <> 'on' then
      if new.status <> old.status or new.approved_by is distinct from old.approved_by then
        raise exception 'Use review_expense() to approve or reject' using errcode = '42501';
      end if;
      if old.status = 'approved' and (new.amount <> old.amount or new.expense_date <> old.expense_date
           or new.category <> old.category or new.payment_method <> old.payment_method)
         and old.approved_by is distinct from auth.uid() and v_req then
        raise exception 'Approved expenses are locked' using errcode = '42501';
      end if;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_expenses_before on public.expenses;
create trigger trg_expenses_before before insert or update on public.expenses
  for each row execute function public.expenses_before_write();

create or replace function public.review_expense(p_expense uuid, p_approve boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_prev_internal text := coalesce(current_setting('sombill.internal', true), ''); e public.expenses;
begin
  select * into e from public.expenses where id = p_expense for update;
  if not found then raise exception 'Expense not found'; end if;
  if not public.is_manager(e.restaurant_id) then
    raise exception 'Only managers can review expenses' using errcode = '42501';
  end if;
  if e.status <> 'pending' then raise exception 'Expense already reviewed' using errcode = '23514'; end if;
  if not p_approve and (p_reason is null or length(trim(p_reason)) < 3) then
    raise exception 'A rejection reason is required' using errcode = '23514';
  end if;
  perform set_config('sombill.internal', 'on', true);
  update public.expenses
     set status = case when p_approve then 'approved'::public.expense_status else 'rejected'::public.expense_status end,
         approved_by = auth.uid(), approved_at = now(),
         rejection_reason = case when p_approve then null else trim(p_reason) end
   where id = p_expense;
  perform set_config('sombill.internal', v_prev_internal, true);
end $$;

-- ---------------------------------------------------------------------
-- Bootstrap: first manager creates their restaurant
-- ---------------------------------------------------------------------
create or replace function public.create_restaurant(
  p_name text, p_currency text default 'USD', p_timezone text default 'Africa/Mogadishu')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
  if exists (select 1 from public.restaurant_members where user_id = auth.uid()) then
    raise exception 'You already belong to a restaurant' using errcode = '23505';
  end if;
  insert into public.restaurants (name, currency, timezone)
  values (trim(p_name), upper(p_currency), p_timezone) returning id into v_id;
  insert into public.restaurant_members (restaurant_id, user_id, role) values (v_id, auth.uid(), 'manager');
  return v_id;
end $$;

create or replace function public.touch_last_login()
returns void language sql security definer set search_path = public as $$
  update public.profiles set last_login_at = now() where id = auth.uid();
$$;

-- ---------------------------------------------------------------------
-- Derived table status (never manually set except "needs cleaning")
-- ---------------------------------------------------------------------
create or replace view public.table_status_v with (security_invoker = true) as
select t.id, t.restaurant_id, t.table_number, t.name, t.capacity, t.section, t.floor,
       t.pos_x, t.pos_y, t.shape, t.needs_cleaning, t.archived_at,
       o.id as order_id, o.order_number, o.waiter_id, o.created_at as order_started_at,
       o.total as order_total,
       coalesce(o.total - (o.amount_paid - o.amount_refunded), 0)::numeric(12,2) as balance,
       case
         when o.id is null then
           case when t.needs_cleaning
                 and coalesce((r.settings->'tables'->>'cleaning_enabled')::boolean, false)
                then 'cleaning' else 'available' end
         when (o.amount_paid - o.amount_refunded) > 0 then 'payment_pending'
         when o.bill_requested_at is not null then 'bill_requested'
         else 'occupied'
       end as status
  from public.restaurant_tables t
  join public.restaurants r on r.id = t.restaurant_id
  left join lateral (
    select * from public.orders o
     where o.table_id = t.id and o.status not in ('completed', 'cancelled')
     order by o.created_at desc limit 1) o on true;

-- ---------------------------------------------------------------------
-- Sales summary: sales vs collected vs outstanding vs refunds
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
    'pending_orders',   count(*) filter (where status in ('new','pending','preparing','ready','served')),
    'outstanding',      coalesce(sum(greatest(total - (amount_paid - amount_refunded), 0))
                                 filter (where status <> 'cancelled'), 0),
    'avg_order_value',  coalesce(round(avg(total) filter (where status <> 'cancelled'), 2), 0)
  ) into v
  from public.orders
  where restaurant_id = p_restaurant and created_at >= p_from and created_at < p_to;

  select v || jsonb_build_object(
    'collected', coalesce(sum(amount) filter (where kind = 'payment'), 0),
    'refunds',   coalesce(sum(amount) filter (where kind = 'refund'), 0),
    'net_collected', coalesce(sum(case when kind = 'payment' then amount else -amount end), 0)
  ) into v
  from public.payments
  where restaurant_id = p_restaurant and status = 'succeeded'
    and created_at >= p_from and created_at < p_to;
  return v;
end $$;
