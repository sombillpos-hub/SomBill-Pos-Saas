-- =====================================================================
-- SomBill – Row Level Security, grants, storage and realtime
-- Migration: 20261121000003_rls_storage_realtime.sql
-- Restaurant-level isolation: every policy checks membership of the
-- row's restaurant via SECURITY DEFINER helpers.
-- =====================================================================

do $$
declare t text;
begin
  foreach t in array array['restaurants','profiles','restaurant_members','categories','products',
    'product_recipe_items','restaurant_tables','customers','orders','order_items','payments',
    'inventory_items','stock_movements','suppliers','purchase_orders','purchase_order_items',
    'purchase_order_receipts','expenses','audit_logs']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end $$;

-- Drop any previous versions of our policies (idempotent re-run).
do $$
declare p record;
begin
  for p in select schemaname, tablename, policyname from pg_policies
            where schemaname = 'public' and policyname like 'sb_%'
  loop
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

-- restaurants -----------------------------------------------------------
create policy sb_restaurants_select on public.restaurants for select to authenticated
  using (public.is_member(id));
create policy sb_restaurants_update on public.restaurants for update to authenticated
  using (public.is_manager(id)) with check (public.is_manager(id));

-- profiles --------------------------------------------------------------
create policy sb_profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_restaurant_with(id));
create policy sb_profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- restaurant_members: read within restaurant; writes only via the
-- manage-staff edge function (service role).
create policy sb_members_select on public.restaurant_members for select to authenticated
  using (user_id = auth.uid() or public.is_member(restaurant_id));

-- Catalogue tables: members read, managers write (no delete – archive).
create policy sb_categories_select on public.categories for select to authenticated
  using (public.is_member(restaurant_id));
create policy sb_categories_insert on public.categories for insert to authenticated
  with check (public.is_manager(restaurant_id));
create policy sb_categories_update on public.categories for update to authenticated
  using (public.is_manager(restaurant_id)) with check (public.is_manager(restaurant_id));

create policy sb_products_select on public.products for select to authenticated
  using (public.is_member(restaurant_id));
create policy sb_products_insert on public.products for insert to authenticated
  with check (public.is_manager(restaurant_id));
create policy sb_products_update on public.products for update to authenticated
  using (public.is_manager(restaurant_id)) with check (public.is_manager(restaurant_id));

create policy sb_recipe_select on public.product_recipe_items for select to authenticated
  using (public.is_member(restaurant_id));
create policy sb_recipe_insert on public.product_recipe_items for insert to authenticated
  with check (public.is_manager(restaurant_id));
create policy sb_recipe_update on public.product_recipe_items for update to authenticated
  using (public.is_manager(restaurant_id)) with check (public.is_manager(restaurant_id));
create policy sb_recipe_delete on public.product_recipe_items for delete to authenticated
  using (public.is_manager(restaurant_id));

create policy sb_tables_select on public.restaurant_tables for select to authenticated
  using (public.is_member(restaurant_id));
create policy sb_tables_insert on public.restaurant_tables for insert to authenticated
  with check (public.is_manager(restaurant_id));
create policy sb_tables_update on public.restaurant_tables for update to authenticated
  using (public.has_role(restaurant_id, array['manager','waiter','cashier']::public.app_role[]))
  with check (public.has_role(restaurant_id, array['manager','waiter','cashier']::public.app_role[]));
-- Non-managers may only toggle needs_cleaning (enforced by trigger below).

create or replace function public.tables_update_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_manager(new.restaurant_id) then
    if (to_jsonb(new) - 'needs_cleaning' - 'updated_at') <> (to_jsonb(old) - 'needs_cleaning' - 'updated_at') then
      raise exception 'Only managers can edit table configuration' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_tables_guard on public.restaurant_tables;
create trigger trg_tables_guard before update on public.restaurant_tables
  for each row execute function public.tables_update_guard();

create policy sb_customers_select on public.customers for select to authenticated
  using (public.is_member(restaurant_id));
create policy sb_customers_insert on public.customers for insert to authenticated
  with check (public.is_manager(restaurant_id)
    or (public.has_role(restaurant_id, array['cashier']::public.app_role[])
        and public.has_permission(restaurant_id, 'cashier_can_create_customers'))
    or (public.has_role(restaurant_id, array['waiter']::public.app_role[])
        and public.has_permission(restaurant_id, 'waiter_can_create_customers')));
create policy sb_customers_update on public.customers for update to authenticated
  using (public.is_manager(restaurant_id)) with check (public.is_manager(restaurant_id));

create policy sb_suppliers_select on public.suppliers for select to authenticated
  using (public.is_manager(restaurant_id));
create policy sb_suppliers_insert on public.suppliers for insert to authenticated
  with check (public.is_manager(restaurant_id));
create policy sb_suppliers_update on public.suppliers for update to authenticated
  using (public.is_manager(restaurant_id)) with check (public.is_manager(restaurant_id));

create policy sb_inventory_select on public.inventory_items for select to authenticated
  using (public.is_member(restaurant_id));
create policy sb_inventory_insert on public.inventory_items for insert to authenticated
  with check (public.is_manager(restaurant_id));
create policy sb_inventory_update on public.inventory_items for update to authenticated
  using (public.is_manager(restaurant_id)) with check (public.is_manager(restaurant_id));

create policy sb_stock_mov_select on public.stock_movements for select to authenticated
  using (public.is_manager(restaurant_id));
-- No insert policy: movements are written only by SECURITY DEFINER functions.

-- Orders ----------------------------------------------------------------
create policy sb_orders_select on public.orders for select to authenticated
  using (public.is_member(restaurant_id));
create policy sb_orders_insert on public.orders for insert to authenticated
  with check (public.is_member(restaurant_id));
create policy sb_orders_update on public.orders for update to authenticated
  using (public.is_member(restaurant_id)) with check (public.is_member(restaurant_id));

create policy sb_order_items_select on public.order_items for select to authenticated
  using (public.is_member(restaurant_id));
create policy sb_order_items_insert on public.order_items for insert to authenticated
  with check (public.is_member(restaurant_id));
create policy sb_order_items_update on public.order_items for update to authenticated
  using (public.is_member(restaurant_id)) with check (public.is_member(restaurant_id));

create policy sb_payments_select on public.payments for select to authenticated
  using (public.is_member(restaurant_id));
create policy sb_payments_insert on public.payments for insert to authenticated
  with check (kind = 'payment'
    and public.has_role(restaurant_id, array['manager','cashier']::public.app_role[]));

-- Purchasing ------------------------------------------------------------
create policy sb_po_select on public.purchase_orders for select to authenticated
  using (public.is_manager(restaurant_id));
create policy sb_po_insert on public.purchase_orders for insert to authenticated
  with check (public.is_manager(restaurant_id));
create policy sb_po_update on public.purchase_orders for update to authenticated
  using (public.is_manager(restaurant_id)) with check (public.is_manager(restaurant_id));

create policy sb_po_items_select on public.purchase_order_items for select to authenticated
  using (public.is_manager(restaurant_id));
create policy sb_po_items_insert on public.purchase_order_items for insert to authenticated
  with check (public.is_manager(restaurant_id));
create policy sb_po_items_update on public.purchase_order_items for update to authenticated
  using (public.is_manager(restaurant_id)) with check (public.is_manager(restaurant_id));
create policy sb_po_items_delete on public.purchase_order_items for delete to authenticated
  using (public.is_manager(restaurant_id));

create policy sb_po_receipts_select on public.purchase_order_receipts for select to authenticated
  using (public.is_manager(restaurant_id));

-- Expenses (managers only) -------------------------------------------------
create policy sb_expenses_select on public.expenses for select to authenticated
  using (public.is_manager(restaurant_id));
create policy sb_expenses_insert on public.expenses for insert to authenticated
  with check (public.is_manager(restaurant_id));
create policy sb_expenses_update on public.expenses for update to authenticated
  using (public.is_manager(restaurant_id)) with check (public.is_manager(restaurant_id));

-- Audit (managers read; no client writes) -----------------------------------
create policy sb_audit_select on public.audit_logs for select to authenticated
  using (public.is_manager(restaurant_id));

-- ---------------------------------------------------------------------
-- Grants. anon gets nothing. authenticated gets table privileges that
-- RLS then narrows. Internal helpers are revoked.
-- ---------------------------------------------------------------------
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
-- Historical records are archived, never deleted. Only recipe lines and
-- draft PO lines have a legitimate client delete path.
revoke delete on all tables in schema public from authenticated;
grant delete on public.product_recipe_items, public.purchase_order_items to authenticated;
grant select on public.table_status_v to authenticated;

-- order_seq / po_seq must never be client-writable; restrict restaurant columns.
revoke update on public.restaurants from authenticated;
grant update (name, logo_url, address, phone, email, currency, timezone, tax_rate, tax_inclusive,
              tax_label, receipt_header, receipt_footer, settings)
  on public.restaurants to authenticated;
revoke insert, delete on public.restaurants from authenticated;
revoke insert, update, delete on public.audit_logs, public.stock_movements,
  public.purchase_order_receipts, public.restaurant_members from authenticated;

revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.is_member(uuid), public.is_manager(uuid), public.has_role(uuid, public.app_role[]),
  public.has_permission(uuid, text), public.member_role(uuid), public.shares_restaurant_with(uuid),
  public.adjust_stock(uuid, public.stock_movement_type, numeric, text, numeric),
  public.transfer_stock(uuid, uuid, numeric, text),
  public.cancel_order(uuid, text),
  public.refund_order(uuid, numeric, public.payment_method, text, boolean),
  public.receive_purchase_order(uuid, jsonb, uuid),
  public.review_expense(uuid, boolean, text),
  public.create_restaurant(text, text, text),
  public.touch_last_login(),
  public.sales_summary(uuid, timestamptz, timestamptz)
to authenticated;

-- Trigger functions run as definer regardless; ensure internal primitives
-- are not callable over the API.
revoke execute on function public.apply_stock_movement(uuid, public.stock_movement_type, numeric, numeric, text, uuid, text) from authenticated;
revoke execute on function public.deduct_order_stock(uuid) from authenticated;
revoke execute on function public.reverse_order_stock(uuid, text) from authenticated;
revoke execute on function public.recalc_order_totals(uuid) from authenticated;
revoke execute on function public.refresh_payment_state(uuid) from authenticated;
revoke execute on function public.write_audit(uuid, text, text, uuid, jsonb, jsonb, text) from authenticated;
revoke execute on function public.next_order_number(uuid) from authenticated;

-- ---------------------------------------------------------------------
-- Storage buckets. Object paths MUST start with the restaurant id:
--   <restaurant_id>/<entity>/<uuid>.<ext>
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('menu-images', 'menu-images', true, 2097152, array['image/png','image/jpeg','image/webp']),
  ('branding', 'branding', true, 2097152, array['image/png','image/jpeg','image/webp','image/svg+xml']),
  ('expense-attachments', 'expense-attachments', false, 5242880,
     array['image/png','image/jpeg','image/webp','application/pdf'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.storage_restaurant_id(p_name text)
returns uuid language plpgsql immutable as $$
begin
  return split_part(p_name, '/', 1)::uuid;
exception when others then
  return null;
end $$;
grant execute on function public.storage_restaurant_id(text) to authenticated, anon;

drop policy if exists sb_storage_public_read on storage.objects;
drop policy if exists sb_storage_member_read_private on storage.objects;
drop policy if exists sb_storage_manager_insert on storage.objects;
drop policy if exists sb_storage_manager_update on storage.objects;
drop policy if exists sb_storage_manager_delete on storage.objects;

create policy sb_storage_public_read on storage.objects for select
  using (bucket_id in ('menu-images', 'branding'));
create policy sb_storage_member_read_private on storage.objects for select to authenticated
  using (bucket_id = 'expense-attachments' and public.is_manager(public.storage_restaurant_id(name)));
create policy sb_storage_manager_insert on storage.objects for insert to authenticated
  with check (bucket_id in ('menu-images', 'branding', 'expense-attachments')
              and public.is_manager(public.storage_restaurant_id(name)));
create policy sb_storage_manager_update on storage.objects for update to authenticated
  using (bucket_id in ('menu-images', 'branding', 'expense-attachments')
         and public.is_manager(public.storage_restaurant_id(name)));
create policy sb_storage_manager_delete on storage.objects for delete to authenticated
  using (bucket_id in ('menu-images', 'branding')
         and public.is_manager(public.storage_restaurant_id(name)));

-- ---------------------------------------------------------------------
-- Realtime publication
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['products','categories','restaurant_tables','orders','order_items',
                             'payments','inventory_items']
    loop
      if not exists (select 1 from pg_publication_tables
                      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;
