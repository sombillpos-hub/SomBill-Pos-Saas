-- =====================================================================
-- SomBill Restaurant POS – Core schema
-- Migration: 20261121000001_core_schema.sql
--
-- Idempotent where practical (IF NOT EXISTS). Designed for the shared
-- SomBill Supabase database used by Manager, Waiter and Cashier apps.
-- BEFORE APPLYING TO AN EXISTING DATABASE: run
--   supabase/inspect_existing_schema.sql
-- and compare. If tables already exist with different columns, do not
-- apply blindly – write a reconciling migration instead.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
do $$ begin
  create type public.app_role as enum ('manager', 'cashier', 'waiter');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.member_status as enum ('active', 'suspended');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.order_status as enum
    ('new', 'pending', 'preparing', 'ready', 'served', 'completed', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.order_type as enum ('dine_in', 'takeaway', 'delivery');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_status as enum ('unpaid', 'partial', 'paid', 'refunded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_method as enum
    ('cash', 'card', 'mobile_money', 'bank_transfer', 'credit', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.stock_movement_type as enum
    ('opening', 'receive', 'adjustment', 'wastage', 'transfer_in', 'transfer_out',
     'sale', 'sale_reversal');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.po_status as enum
    ('draft', 'ordered', 'partially_received', 'received', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.expense_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- Generic updated_at trigger
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- restaurants
-- ---------------------------------------------------------------------
create table if not exists public.restaurants (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (length(trim(name)) between 2 and 120),
  logo_url        text,
  address         text,
  phone           text,
  email           text,
  currency        char(3) not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  timezone        text not null default 'Africa/Mogadishu',
  tax_rate        numeric(6,4) not null default 0 check (tax_rate >= 0 and tax_rate < 1),
  tax_inclusive   boolean not null default false,
  tax_label       text not null default 'VAT',
  receipt_header  text,
  receipt_footer  text default 'Thank you for dining with us!',
  -- Structured settings: tables, orders, inventory, expenses, permissions.
  settings        jsonb not null default jsonb_build_object(
                    'tables',    jsonb_build_object('cleaning_enabled', false),
                    'orders',    jsonb_build_object('require_cancel_reason', true,
                                                    'default_order_type', 'dine_in'),
                    'inventory', jsonb_build_object('allow_negative_stock', false,
                                                    'deduct_on', 'completed'),
                    'expenses',  jsonb_build_object('approval_required', false),
                    'permissions', jsonb_build_object(
                                    'cashier_can_cancel_orders', false,
                                    'cashier_can_refund', false,
                                    'cashier_can_create_customers', true,
                                    'waiter_can_create_customers', false)
                  ),
  order_seq       bigint not null default 0,
  po_seq          bigint not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
drop trigger if exists trg_restaurants_updated on public.restaurants;
create trigger trg_restaurants_updated before update on public.restaurants
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  full_name      text not null default '',
  email          text,
  phone          text,
  avatar_url     text,
  last_login_at  timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, phone)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'full_name', ''),
          new.raw_user_meta_data->>'phone')
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ---------------------------------------------------------------------
-- restaurant_members
-- ---------------------------------------------------------------------
create table if not exists public.restaurant_members (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references public.restaurants(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  role           public.app_role not null,
  status         public.member_status not null default 'active',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (restaurant_id, user_id)
);
create index if not exists idx_members_user on public.restaurant_members(user_id);
drop trigger if exists trg_members_updated on public.restaurant_members;
create trigger trg_members_updated before update on public.restaurant_members
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Authorization helpers (SECURITY DEFINER so they can be used in RLS
-- without recursive policy evaluation).
-- ---------------------------------------------------------------------
create or replace function public.member_role(p_restaurant uuid)
returns public.app_role language sql stable security definer set search_path = public as $$
  select role from public.restaurant_members
  where restaurant_id = p_restaurant and user_id = auth.uid() and status = 'active'
$$;

create or replace function public.is_member(p_restaurant uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.restaurant_members
                 where restaurant_id = p_restaurant and user_id = auth.uid()
                   and status = 'active')
$$;

create or replace function public.is_manager(p_restaurant uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.restaurant_members
                 where restaurant_id = p_restaurant and user_id = auth.uid()
                   and status = 'active' and role = 'manager')
$$;

create or replace function public.has_role(p_restaurant uuid, p_roles public.app_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.restaurant_members
                 where restaurant_id = p_restaurant and user_id = auth.uid()
                   and status = 'active' and role = any(p_roles))
$$;

-- Configurable permission toggles. Managers always pass.
create or replace function public.has_permission(p_restaurant uuid, p_key text)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when public.is_manager(p_restaurant) then true
    when not public.is_member(p_restaurant) then false
    else coalesce((select (settings->'permissions'->>p_key)::boolean
                   from public.restaurants where id = p_restaurant), false)
  end
$$;

create or replace function public.shares_restaurant_with(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.restaurant_members a
    join public.restaurant_members b on a.restaurant_id = b.restaurant_id
    where a.user_id = auth.uid() and a.status = 'active' and b.user_id = p_user)
$$;

-- ---------------------------------------------------------------------
-- audit_logs (append-only)
-- ---------------------------------------------------------------------
create table if not exists public.audit_logs (
  id             bigint generated always as identity primary key,
  restaurant_id  uuid not null references public.restaurants(id) on delete cascade,
  actor_id       uuid references auth.users(id) on delete set null,
  action         text not null,
  entity_type    text not null,
  entity_id      uuid,
  old_data       jsonb,
  new_data       jsonb,
  reason         text,
  created_at     timestamptz not null default now()
);
create index if not exists idx_audit_rest_time on public.audit_logs(restaurant_id, created_at desc);
create index if not exists idx_audit_entity on public.audit_logs(entity_type, entity_id);

create or replace function public.write_audit(
  p_restaurant uuid, p_action text, p_entity text, p_entity_id uuid,
  p_old jsonb, p_new jsonb, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_logs (restaurant_id, actor_id, action, entity_type, entity_id,
                                 old_data, new_data, reason)
  values (p_restaurant, auth.uid(), p_action, p_entity, p_entity_id, p_old, p_new, p_reason);
end $$;

-- Generic row audit trigger. Records changed columns only for updates.
create or replace function public.audit_row()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb; v_new jsonb; v_action text; v_rid uuid; v_id uuid;
  v_changed_old jsonb := '{}'::jsonb; v_changed_new jsonb := '{}'::jsonb; k text;
begin
  if tg_op = 'DELETE' then
    v_old := to_jsonb(old); v_rid := old.restaurant_id; v_id := old.id; v_action := 'delete';
  elsif tg_op = 'INSERT' then
    v_new := to_jsonb(new); v_rid := new.restaurant_id; v_id := new.id; v_action := 'create';
  else
    v_old := to_jsonb(old); v_new := to_jsonb(new); v_rid := new.restaurant_id; v_id := new.id;
    for k in select jsonb_object_keys(v_new) loop
      if k not in ('updated_at') and (v_old->k) is distinct from (v_new->k) then
        v_changed_old := v_changed_old || jsonb_build_object(k, v_old->k);
        v_changed_new := v_changed_new || jsonb_build_object(k, v_new->k);
      end if;
    end loop;
    if v_changed_new = '{}'::jsonb then return new; end if;
    v_old := v_changed_old; v_new := v_changed_new;
    v_action := 'update';
    if v_new ? 'archived_at' then
      v_action := case when new.archived_at is null then 'restore' else 'archive' end;
    elsif tg_table_name = 'products' and (v_new ? 'price' or v_new ? 'cost_price') then
      v_action := 'price_change';
    elsif tg_table_name = 'orders' and v_new ? 'status' then
      v_action := 'status_change';
    end if;
  end if;
  insert into public.audit_logs (restaurant_id, actor_id, action, entity_type, entity_id,
                                 old_data, new_data)
  values (v_rid, auth.uid(), v_action, tg_table_name, v_id, v_old, v_new);
  return coalesce(new, old);
end $$;

-- ---------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------
create table if not exists public.categories (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references public.restaurants(id) on delete cascade,
  name           text not null check (length(trim(name)) between 1 and 80),
  description    text,
  image_url      text,
  display_order  integer not null default 0,
  is_active      boolean not null default true,
  archived_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create unique index if not exists uq_categories_name
  on public.categories(restaurant_id, lower(trim(name))) where archived_at is null;
create index if not exists idx_categories_rest on public.categories(restaurant_id, display_order);

-- ---------------------------------------------------------------------
-- suppliers
-- ---------------------------------------------------------------------
create table if not exists public.suppliers (
  id              uuid primary key default gen_random_uuid(),
  restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
  name            text not null check (length(trim(name)) between 2 and 120),
  contact_person  text,
  phone           text,
  email           text,
  address         text,
  notes           text,
  is_active       boolean not null default true,
  archived_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index if not exists uq_suppliers_name
  on public.suppliers(restaurant_id, lower(trim(name))) where archived_at is null;

-- ---------------------------------------------------------------------
-- inventory_items
-- ---------------------------------------------------------------------
create table if not exists public.inventory_items (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references public.restaurants(id) on delete cascade,
  name           text not null check (length(trim(name)) between 1 and 120),
  sku            text,
  category       text,
  unit           text not null default 'pcs' check (length(unit) between 1 and 16),
  quantity       numeric(14,3) not null default 0,
  unit_cost      numeric(14,4) not null default 0 check (unit_cost >= 0),
  min_stock      numeric(14,3) not null default 0 check (min_stock >= 0),
  supplier_id    uuid references public.suppliers(id) on delete set null,
  expiry_date    date,
  location       text,
  archived_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create unique index if not exists uq_inventory_sku
  on public.inventory_items(restaurant_id, lower(sku)) where sku is not null and archived_at is null;
create index if not exists idx_inventory_rest on public.inventory_items(restaurant_id);

-- ---------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------
create table if not exists public.products (
  id                   uuid primary key default gen_random_uuid(),
  restaurant_id        uuid not null references public.restaurants(id) on delete cascade,
  category_id          uuid references public.categories(id) on delete set null,
  name                 text not null check (length(trim(name)) between 1 and 120),
  description          text,
  sku                  text,
  barcode              text,
  image_url            text,
  price                numeric(12,2) not null check (price >= 0),
  cost_price           numeric(12,2) check (cost_price is null or cost_price >= 0),
  tax_category         text not null default 'standard'
                         check (tax_category in ('standard', 'exempt')),
  is_available         boolean not null default true,
  track_stock          boolean not null default false,
  -- Direct stock link for retail items (e.g. bottled drinks) without a recipe.
  inventory_item_id    uuid references public.inventory_items(id) on delete set null,
  preparation_station  text not null default 'kitchen'
                         check (preparation_station in ('kitchen', 'bar', 'grill', 'bakery', 'none')),
  archived_at          timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create unique index if not exists uq_products_sku
  on public.products(restaurant_id, lower(sku)) where sku is not null;
create unique index if not exists uq_products_barcode
  on public.products(restaurant_id, barcode) where barcode is not null;
create index if not exists idx_products_rest_cat on public.products(restaurant_id, category_id);

-- Recipe lines: ingredients consumed per unit of product sold.
create table if not exists public.product_recipe_items (
  id                 uuid primary key default gen_random_uuid(),
  restaurant_id      uuid not null references public.restaurants(id) on delete cascade,
  product_id         uuid not null references public.products(id) on delete cascade,
  inventory_item_id  uuid not null references public.inventory_items(id) on delete restrict,
  quantity           numeric(14,3) not null check (quantity > 0),
  created_at         timestamptz not null default now(),
  unique (product_id, inventory_item_id)
);
create index if not exists idx_recipe_product on public.product_recipe_items(product_id);

-- ---------------------------------------------------------------------
-- restaurant_tables
-- ---------------------------------------------------------------------
create table if not exists public.restaurant_tables (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references public.restaurants(id) on delete cascade,
  table_number   integer not null check (table_number > 0),
  name           text,
  capacity       integer not null default 4 check (capacity between 1 and 50),
  section        text not null default 'Main',
  floor          text not null default 'Ground',
  pos_x          integer not null default 0 check (pos_x between 0 and 11),
  pos_y          integer not null default 0 check (pos_y between 0 and 11),
  shape          text not null default 'square' check (shape in ('square', 'round', 'rect')),
  needs_cleaning boolean not null default false,
  archived_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create unique index if not exists uq_tables_number
  on public.restaurant_tables(restaurant_id, table_number) where archived_at is null;

-- ---------------------------------------------------------------------
-- customers
-- ---------------------------------------------------------------------
create table if not exists public.customers (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references public.restaurants(id) on delete cascade,
  name           text not null check (length(trim(name)) between 2 and 120),
  phone          text check (phone is null or phone ~ '^\+?[0-9 ()-]{6,20}$'),
  email          text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  address        text,
  notes          text,
  archived_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create unique index if not exists uq_customers_phone
  on public.customers(restaurant_id, phone) where phone is not null and archived_at is null;
create index if not exists idx_customers_rest_name on public.customers(restaurant_id, lower(name));

-- ---------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------
create table if not exists public.orders (
  id                uuid primary key default gen_random_uuid(),
  restaurant_id     uuid not null references public.restaurants(id) on delete restrict,
  order_number      bigint not null,
  order_type        public.order_type not null default 'dine_in',
  status            public.order_status not null default 'new',
  payment_status    public.payment_status not null default 'unpaid',
  table_id          uuid references public.restaurant_tables(id) on delete restrict,
  customer_id       uuid references public.customers(id) on delete restrict,
  waiter_id         uuid references auth.users(id) on delete set null,
  cashier_id        uuid references auth.users(id) on delete set null,
  tax_rate          numeric(6,4) not null default 0,
  tax_inclusive     boolean not null default false,
  subtotal          numeric(12,2) not null default 0 check (subtotal >= 0),
  discount_amount   numeric(12,2) not null default 0 check (discount_amount >= 0),
  tax_amount        numeric(12,2) not null default 0 check (tax_amount >= 0),
  total             numeric(12,2) not null default 0 check (total >= 0),
  amount_paid       numeric(12,2) not null default 0,
  amount_refunded   numeric(12,2) not null default 0,
  notes             text,
  guest_count       integer check (guest_count is null or guest_count > 0),
  bill_requested_at timestamptz,
  completed_at      timestamptz,
  cancelled_at      timestamptz,
  cancelled_by      uuid references auth.users(id) on delete set null,
  cancel_reason     text,
  stock_deducted_at timestamptz,
  stock_reversed_at timestamptz,
  created_by        uuid references auth.users(id) on delete set null default auth.uid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (restaurant_id, order_number),
  check (status <> 'cancelled' or cancel_reason is not null)
);
create index if not exists idx_orders_rest_created on public.orders(restaurant_id, created_at desc);
create index if not exists idx_orders_rest_status on public.orders(restaurant_id, status);
create index if not exists idx_orders_table_active on public.orders(table_id)
  where status not in ('completed', 'cancelled');
create index if not exists idx_orders_customer on public.orders(customer_id);
create index if not exists idx_orders_waiter on public.orders(waiter_id);

create table if not exists public.order_items (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references public.restaurants(id) on delete restrict,
  order_id       uuid not null references public.orders(id) on delete restrict,
  product_id     uuid not null references public.products(id) on delete restrict,
  product_name   text not null,
  quantity       numeric(10,3) not null check (quantity > 0),
  unit_price     numeric(12,2) not null check (unit_price >= 0),
  unit_cost      numeric(12,2),
  tax_exempt     boolean not null default false,
  line_total     numeric(12,2) generated always as (round(quantity * unit_price, 2)) stored,
  notes          text,
  is_voided      boolean not null default false,
  void_reason    text,
  created_by     uuid references auth.users(id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (not is_voided or void_reason is not null)
);
create index if not exists idx_order_items_order on public.order_items(order_id);
create index if not exists idx_order_items_product on public.order_items(product_id);

-- ---------------------------------------------------------------------
-- payments (append-only ledger; refunds are negative-direction rows)
-- ---------------------------------------------------------------------
create table if not exists public.payments (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references public.restaurants(id) on delete restrict,
  order_id       uuid not null references public.orders(id) on delete restrict,
  kind           text not null default 'payment' check (kind in ('payment', 'refund')),
  method         public.payment_method not null,
  amount         numeric(12,2) not null check (amount > 0),
  status         text not null default 'succeeded' check (status in ('succeeded', 'failed')),
  reference      text,
  notes          text,
  cashier_id     uuid references auth.users(id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now()
);
create index if not exists idx_payments_rest_time on public.payments(restaurant_id, created_at desc);
create index if not exists idx_payments_order on public.payments(order_id);

-- ---------------------------------------------------------------------
-- stock_movements (append-only)
-- ---------------------------------------------------------------------
create table if not exists public.stock_movements (
  id                 bigint generated always as identity primary key,
  restaurant_id      uuid not null references public.restaurants(id) on delete cascade,
  inventory_item_id  uuid not null references public.inventory_items(id) on delete restrict,
  movement_type      public.stock_movement_type not null,
  quantity_change    numeric(14,3) not null check (quantity_change <> 0),
  quantity_after     numeric(14,3) not null,
  unit_cost          numeric(14,4),
  reference_type     text,
  reference_id       uuid,
  reason             text,
  created_by         uuid references auth.users(id) on delete set null default auth.uid(),
  created_at         timestamptz not null default now()
);
create index if not exists idx_stock_mov_item on public.stock_movements(inventory_item_id, created_at desc);
create index if not exists idx_stock_mov_rest on public.stock_movements(restaurant_id, created_at desc);
create index if not exists idx_stock_mov_ref on public.stock_movements(reference_type, reference_id);

-- ---------------------------------------------------------------------
-- purchase orders
-- ---------------------------------------------------------------------
create table if not exists public.purchase_orders (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references public.restaurants(id) on delete restrict,
  po_number      bigint not null,
  supplier_id    uuid not null references public.suppliers(id) on delete restrict,
  status         public.po_status not null default 'draft',
  expected_date  date,
  notes          text,
  subtotal       numeric(12,2) not null default 0,
  total          numeric(12,2) not null default 0,
  amount_paid    numeric(12,2) not null default 0 check (amount_paid >= 0),
  ordered_at     timestamptz,
  received_at    timestamptz,
  created_by     uuid references auth.users(id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (restaurant_id, po_number)
);
create index if not exists idx_po_rest on public.purchase_orders(restaurant_id, created_at desc);
create index if not exists idx_po_supplier on public.purchase_orders(supplier_id);

create table if not exists public.purchase_order_items (
  id                 uuid primary key default gen_random_uuid(),
  restaurant_id      uuid not null references public.restaurants(id) on delete restrict,
  purchase_order_id  uuid not null references public.purchase_orders(id) on delete cascade,
  inventory_item_id  uuid not null references public.inventory_items(id) on delete restrict,
  quantity_ordered   numeric(14,3) not null check (quantity_ordered > 0),
  quantity_received  numeric(14,3) not null default 0 check (quantity_received >= 0),
  unit_cost          numeric(14,4) not null check (unit_cost >= 0),
  line_total         numeric(12,2) generated always as (round(quantity_ordered * unit_cost, 2)) stored,
  created_at         timestamptz not null default now(),
  check (quantity_received <= quantity_ordered),
  unique (purchase_order_id, inventory_item_id)
);

-- One row per receiving operation; idempotency_key blocks duplicate submits.
create table if not exists public.purchase_order_receipts (
  id                 uuid primary key default gen_random_uuid(),
  restaurant_id      uuid not null references public.restaurants(id) on delete restrict,
  purchase_order_id  uuid not null references public.purchase_orders(id) on delete restrict,
  idempotency_key    uuid not null unique,
  lines              jsonb not null,
  received_by        uuid references auth.users(id) on delete set null default auth.uid(),
  created_at         timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- expenses
-- ---------------------------------------------------------------------
create table if not exists public.expenses (
  id                uuid primary key default gen_random_uuid(),
  restaurant_id     uuid not null references public.restaurants(id) on delete restrict,
  category          text not null check (length(trim(category)) between 2 and 60),
  description       text not null check (length(trim(description)) between 2 and 500),
  amount            numeric(12,2) not null check (amount > 0),
  payment_method    public.payment_method not null default 'cash',
  expense_date      date not null default current_date,
  reference_number  text,
  attachment_path   text,
  supplier_id       uuid references public.suppliers(id) on delete set null,
  status            public.expense_status not null default 'approved',
  approved_by       uuid references auth.users(id) on delete set null,
  approved_at       timestamptz,
  rejection_reason  text,
  archived_at       timestamptz,
  created_by        uuid references auth.users(id) on delete set null default auth.uid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_expenses_rest_date on public.expenses(restaurant_id, expense_date desc);

-- ---------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['categories','suppliers','inventory_items','products',
    'restaurant_tables','customers','orders','order_items','purchase_orders','expenses']
  loop
    execute format('drop trigger if exists trg_%1$s_updated on public.%1$s', t);
    execute format('create trigger trg_%1$s_updated before update on public.%1$s
                    for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- audit triggers
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['restaurants','restaurant_members','categories','suppliers',
    'inventory_items','products','product_recipe_items','restaurant_tables','customers',
    'orders','order_items','payments','purchase_orders','expenses']
  loop
    execute format('drop trigger if exists trg_%1$s_audit on public.%1$s', t);
  end loop;
end $$;

-- restaurants has no restaurant_id column; dedicated audit function.
create or replace function public.audit_restaurant()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_old jsonb := '{}'; v_new jsonb := '{}'; k text;
begin
  for k in select jsonb_object_keys(to_jsonb(new)) loop
    if k not in ('updated_at','order_seq','po_seq')
       and (to_jsonb(old)->k) is distinct from (to_jsonb(new)->k) then
      v_old := v_old || jsonb_build_object(k, to_jsonb(old)->k);
      v_new := v_new || jsonb_build_object(k, to_jsonb(new)->k);
    end if;
  end loop;
  if v_new <> '{}'::jsonb then
    insert into public.audit_logs(restaurant_id, actor_id, action, entity_type, entity_id, old_data, new_data)
    values (new.id, auth.uid(), 'update', 'restaurants', new.id, v_old, v_new);
  end if;
  return new;
end $$;
create trigger trg_restaurants_audit after update on public.restaurants
  for each row execute function public.audit_restaurant();

do $$
declare t text;
begin
  foreach t in array array['restaurant_members','categories','suppliers','inventory_items',
    'products','product_recipe_items','restaurant_tables','customers','orders','order_items',
    'payments','purchase_orders','expenses']
  loop
    execute format('create trigger trg_%1$s_audit after insert or update or delete on public.%1$s
                    for each row execute function public.audit_row()', t);
  end loop;
end $$;
