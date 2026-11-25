-- =====================================================================
-- SomBill – Super Admin / multi-branch owner (group HQ).
-- Migration: 20261122000008_super_admin.sql
-- Depends on 000001–000007. Idempotent and additive.
--
-- Model: an ORGANIZATION (the group) owns several restaurants (branches).
-- An organization OWNER is an implicit manager of every branch of the group:
-- the four authorization helpers below are extended, so every existing RLS
-- policy and RPC keeps working unchanged. Owners get no extra rights inside a
-- branch beyond what a manager has; they are not rows in restaurant_members.
-- Group-wide reads and bulk actions are SECURITY DEFINER functions that check
-- ownership first.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------
create table if not exists public.organizations (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null check (length(trim(name)) between 2 and 120),
  plan               text not null default 'starter' check (plan in ('starter', 'growth', 'enterprise')),
  max_branches       integer not null default 3 check (max_branches >= 1),
  max_staff          integer not null default 50 check (max_staff >= 1),
  license_status     text not null default 'active' check (license_status in ('trial', 'active', 'past_due', 'suspended')),
  license_expires_at timestamptz,
  -- reporting_currency (ISO code) and fx_rates ({"SLS": 11800} = units of that currency per 1 USD)
  settings           jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
drop trigger if exists trg_organizations_updated on public.organizations;
create trigger trg_organizations_updated before update on public.organizations
  for each row execute function public.set_updated_at();

create table if not exists public.organization_members (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  user_id          uuid not null references auth.users(id) on delete cascade,
  role             text not null default 'owner' check (role = 'owner'),
  status           public.member_status not null default 'active',
  created_at       timestamptz not null default now(),
  unique (organization_id, user_id)
);
create index if not exists idx_org_members_user on public.organization_members(user_id);

alter table public.restaurants add column if not exists organization_id uuid references public.organizations(id) on delete set null;
create index if not exists idx_restaurants_org on public.restaurants(organization_id);

-- Filing register for the tax authority. Records what was filed; it does not send anything anywhere.
create table if not exists public.tax_filings (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  restaurant_id    uuid not null references public.restaurants(id) on delete cascade,
  period_from      date not null,
  period_to        date not null,
  tax_collected    numeric(14,2) not null check (tax_collected >= 0),
  currency         char(3) not null,
  reference        text,
  notes            text,
  filed_by         uuid references auth.users(id) on delete set null default auth.uid(),
  filed_at         timestamptz not null default now(),
  check (period_to >= period_from),
  unique (restaurant_id, period_from, period_to)
);

-- Owner's review of a flagged event (an audit log row, a cash difference, ...).
create table if not exists public.audit_reviews (
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  event_key        text not null check (length(event_key) between 3 and 80),
  status           text not null check (status in ('investigating', 'cleared', 'escalated')),
  note             text,
  reviewed_by      uuid references auth.users(id) on delete set null default auth.uid(),
  reviewed_at      timestamptz not null default now(),
  primary key (organization_id, event_key)
);

-- ---------------------------------------------------------------------
-- Ownership helpers
-- ---------------------------------------------------------------------
create or replace function public.is_org_owner(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.organization_members
                 where organization_id = p_org and user_id = auth.uid() and status = 'active')
$$;

create or replace function public.is_owner_of_restaurant(p_restaurant uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.restaurants r
                 join public.organization_members om on om.organization_id = r.organization_id
                 where r.id = p_restaurant and om.user_id = auth.uid() and om.status = 'active')
$$;

-- Owners count as managers of every branch of their organization.
create or replace function public.member_role(p_restaurant uuid)
returns public.app_role language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role from public.restaurant_members
      where restaurant_id = p_restaurant and user_id = auth.uid() and status = 'active'),
    case when public.is_owner_of_restaurant(p_restaurant) then 'manager'::public.app_role end)
$$;

create or replace function public.is_member(p_restaurant uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.restaurant_members
                 where restaurant_id = p_restaurant and user_id = auth.uid() and status = 'active')
      or public.is_owner_of_restaurant(p_restaurant)
$$;

create or replace function public.is_manager(p_restaurant uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.restaurant_members
                 where restaurant_id = p_restaurant and user_id = auth.uid()
                   and status = 'active' and role = 'manager')
      or public.is_owner_of_restaurant(p_restaurant)
$$;

create or replace function public.has_role(p_restaurant uuid, p_roles public.app_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.restaurant_members
                 where restaurant_id = p_restaurant and user_id = auth.uid()
                   and status = 'active' and role = any(p_roles))
      or ('manager' = any(p_roles) and public.is_owner_of_restaurant(p_restaurant))
$$;

-- Owners can see the profiles of staff in their branches.
create or replace function public.shares_restaurant_with(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.restaurant_members a
    join public.restaurant_members b on a.restaurant_id = b.restaurant_id
    where a.user_id = auth.uid() and a.status = 'active' and b.user_id = p_user)
  or exists (
    select 1 from public.restaurant_members b
    where b.user_id = p_user and public.is_owner_of_restaurant(b.restaurant_id))
$$;

-- ---------------------------------------------------------------------
-- Onboarding: turn an existing manager (or a new account) into a group owner
-- ---------------------------------------------------------------------
create or replace function public.create_organization(p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_name text := trim(coalesce(p_name, ''));
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  if length(v_name) < 2 or length(v_name) > 120 then raise exception 'Organization name must be 2–120 characters' using errcode = '22023'; end if;
  if exists (select 1 from public.organization_members where user_id = auth.uid() and status = 'active') then
    raise exception 'You already own an organization' using errcode = '23505';
  end if;
  insert into public.organizations (name, settings)
  values (v_name, jsonb_build_object('reporting_currency', 'USD', 'fx_rates', '{}'::jsonb))
  returning id into v_org;
  insert into public.organization_members (organization_id, user_id) values (v_org, auth.uid());
  -- Link the branches this person already manages (and that are not part of another group).
  update public.restaurants r set organization_id = v_org
   where r.organization_id is null
     and exists (select 1 from public.restaurant_members m
                  where m.restaurant_id = r.id and m.user_id = auth.uid() and m.role = 'manager' and m.status = 'active');
  return v_org;
end $$;

-- ---------------------------------------------------------------------
-- Branch management
-- ---------------------------------------------------------------------
create or replace function public.org_create_branch(
  p_org uuid, p_name text, p_currency text default 'USD', p_timezone text default 'Africa/Mogadishu',
  p_address text default null, p_phone text default null, p_tax_rate numeric default 0)
returns uuid language plpgsql security definer set search_path = public as $$
declare o public.organizations; v_id uuid; v_count integer;
begin
  if not public.is_org_owner(p_org) then raise exception 'FORBIDDEN: only the owner can add branches' using errcode = '42501'; end if;
  select * into o from public.organizations where id = p_org for update;
  if o.license_status = 'suspended' then raise exception 'LICENSE_SUSPENDED: the subscription is suspended' using errcode = '42501'; end if;
  select count(*) into v_count from public.restaurants where organization_id = p_org;
  if v_count >= o.max_branches then
    raise exception 'BRANCH_LIMIT: your plan allows % branches', o.max_branches using errcode = '23514';
  end if;
  if length(trim(coalesce(p_name, ''))) < 2 then raise exception 'Branch name is too short' using errcode = '22023'; end if;
  if p_tax_rate < 0 or p_tax_rate >= 1 then raise exception 'Tax rate must be between 0 and 1 (e.g. 0.05 = 5%%)' using errcode = '22023'; end if;
  insert into public.restaurants (name, currency, timezone, address, phone, tax_rate, organization_id)
  values (trim(p_name), upper(p_currency), p_timezone, nullif(trim(p_address), ''), nullif(trim(p_phone), ''), p_tax_rate, p_org)
  returning id into v_id;
  perform public.write_audit(v_id, 'branch_created', 'restaurants', v_id, null, jsonb_build_object('name', trim(p_name)), null);
  return v_id;
end $$;

-- ---------------------------------------------------------------------
-- Group-wide read models. All check ownership; none exposes rows of other groups.
-- ---------------------------------------------------------------------
create or replace function public.org_branch_summary(p_org uuid, p_from timestamptz, p_to timestamptz)
returns table (
  restaurant_id uuid, name text, address text, phone text, currency text, timezone text, tax_rate numeric,
  orders_count bigint, gross numeric, net numeric, tax numeric, discounts numeric, guests bigint,
  cancelled_count bigint, collected numeric, refunded numeric,
  open_orders bigint, tables_total bigint, tables_occupied bigint,
  open_cashier_shifts bigint, staff_on_duty bigint, staff_active bigint, last_order_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_org_owner(p_org) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  return query
  select r.id, r.name, r.address, r.phone, r.currency::text, r.timezone, r.tax_rate,
    coalesce(s.orders_count, 0), coalesce(s.gross, 0), coalesce(s.gross - s.tax, 0), coalesce(s.tax, 0),
    coalesce(s.discounts, 0), coalesce(s.guests, 0), coalesce(s.cancelled_count, 0),
    coalesce(p.collected, 0), coalesce(p.refunded, 0),
    coalesce(l.open_orders, 0), coalesce(t.total, 0), coalesce(l.occupied, 0),
    coalesce(cs.n, 0), coalesce(ss.n, 0), coalesce(m.n, 0), l.last_order_at
  from public.restaurants r
  left join lateral (
    select count(*) filter (where o.status <> 'cancelled') as orders_count,
           sum(o.total) filter (where o.status <> 'cancelled') as gross,
           sum(o.tax_amount) filter (where o.status <> 'cancelled') as tax,
           sum(o.discount_amount) filter (where o.status <> 'cancelled') as discounts,
           sum(coalesce(o.guest_count, 0)) filter (where o.status <> 'cancelled') as guests,
           count(*) filter (where o.status = 'cancelled') as cancelled_count
      from public.orders o where o.restaurant_id = r.id and o.created_at >= p_from and o.created_at < p_to) s on true
  left join lateral (
    select sum(py.amount) filter (where py.kind = 'payment' and py.status = 'succeeded') as collected,
           sum(py.amount) filter (where py.kind = 'refund' and py.status = 'succeeded') as refunded
      from public.payments py where py.restaurant_id = r.id and py.created_at >= p_from and py.created_at < p_to) p on true
  left join lateral (
    select count(*) filter (where o.status not in ('completed', 'cancelled')) as open_orders,
           count(distinct o.table_id) filter (where o.status not in ('completed', 'cancelled') and o.table_id is not null) as occupied,
           max(o.created_at) as last_order_at
      from public.orders o where o.restaurant_id = r.id and o.created_at > now() - interval '7 days') l on true
  left join lateral (select count(*) as total from public.restaurant_tables x where x.restaurant_id = r.id and x.archived_at is null) t on true
  left join lateral (select count(*) as n from public.cashier_shifts c where c.restaurant_id = r.id and c.status = 'open') cs on true
  left join lateral (select count(*) as n from public.staff_shifts z where z.restaurant_id = r.id and z.ended_at is null) ss on true
  left join lateral (select count(*) as n from public.restaurant_members x where x.restaurant_id = r.id and x.status = 'active') m on true
  where r.organization_id = p_org
  order by r.name;
end $$;

-- Revenue by time bucket and branch. Buckets are cut in each branch's own time zone.
create or replace function public.org_revenue_series(p_org uuid, p_from timestamptz, p_to timestamptz, p_bucket text default 'day')
returns table (bucket text, restaurant_id uuid, gross numeric, orders bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_org_owner(p_org) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if p_bucket not in ('hour', 'day', 'month') then raise exception 'Bucket must be hour, day or month' using errcode = '22023'; end if;
  return query
  select to_char(date_trunc(p_bucket, o.created_at at time zone r.timezone),
           case p_bucket when 'hour' then 'YYYY-MM-DD HH24":00"' when 'day' then 'YYYY-MM-DD' else 'YYYY-MM' end),
         r.id, sum(o.total), count(*)
    from public.orders o join public.restaurants r on r.id = o.restaurant_id
   where r.organization_id = p_org and o.status <> 'cancelled' and o.created_at >= p_from and o.created_at < p_to
   group by 1, r.id
   order by 1, r.id;
end $$;

-- Money by payment method (mobile money included) and branch.
create or replace function public.org_payment_mix(p_org uuid, p_from timestamptz, p_to timestamptz)
returns table (restaurant_id uuid, method text, kind text, status text, verification_status text, amount numeric, txns bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_org_owner(p_org) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  return query
  select py.restaurant_id, py.method::text, py.kind, py.status, py.verification_status, sum(py.amount), count(*)
    from public.payments py join public.restaurants r on r.id = py.restaurant_id
   where r.organization_id = p_org and py.created_at >= p_from and py.created_at < p_to
   group by py.restaurant_id, py.method, py.kind, py.status, py.verification_status;
end $$;

-- Stock position per branch.
create or replace function public.org_inventory_summary(p_org uuid)
returns table (restaurant_id uuid, items bigint, low_stock bigint, out_of_stock bigint, stock_value numeric,
               open_purchase_orders bigint, open_po_value numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_org_owner(p_org) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  return query
  select r.id,
    coalesce(i.items, 0), coalesce(i.low, 0), coalesce(i.empty, 0), coalesce(i.value, 0),
    coalesce(po.n, 0), coalesce(po.value, 0)
  from public.restaurants r
  left join lateral (
    select count(*) as items,
           count(*) filter (where x.quantity <= x.min_stock and x.quantity > 0) as low,
           count(*) filter (where x.quantity <= 0) as empty,
           sum(x.quantity * x.unit_cost) as value
      from public.inventory_items x where x.restaurant_id = r.id and x.archived_at is null) i on true
  left join lateral (
    select count(*) as n, sum(p.total) as value
      from public.purchase_orders p where p.restaurant_id = r.id and p.status in ('ordered', 'partially_received')) po on true
  where r.organization_id = p_org
  order by r.name;
end $$;

create or replace function public.org_low_stock(p_org uuid, p_limit integer default 100)
returns table (restaurant_id uuid, item_id uuid, name text, unit text, quantity numeric, min_stock numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_org_owner(p_org) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  return query
  select x.restaurant_id, x.id, x.name, x.unit, x.quantity, x.min_stock
    from public.inventory_items x join public.restaurants r on r.id = x.restaurant_id
   where r.organization_id = p_org and x.archived_at is null and x.quantity <= x.min_stock
   order by (x.quantity - x.min_stock), x.name
   limit least(greatest(p_limit, 1), 500);
end $$;

-- ---------------------------------------------------------------------
-- Central menu: set a price / availability for a dish by name across branches
-- ---------------------------------------------------------------------
create or replace function public.org_push_menu_item(
  p_org uuid, p_name text, p_targets uuid[], p_price numeric default null, p_available boolean default null,
  p_create_missing boolean default false, p_category text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_name text := trim(coalesce(p_name, '')); t uuid; pr public.products; v_cat uuid; v_new uuid;
  v_res jsonb := '[]'::jsonb; v_status text; v_old numeric;
begin
  if not public.is_org_owner(p_org) then raise exception 'FORBIDDEN: only the owner can push the menu' using errcode = '42501'; end if;
  if v_name = '' then raise exception 'Dish name is required' using errcode = '22023'; end if;
  if p_price is null and p_available is null then raise exception 'Nothing to push: set a price or availability' using errcode = '22023'; end if;
  if p_price is not null and (p_price < 0 or p_price > 100000000) then raise exception 'Price is out of range' using errcode = '22023'; end if;
  if p_targets is null or cardinality(p_targets) = 0 then raise exception 'Choose at least one branch' using errcode = '22023'; end if;
  foreach t in array p_targets loop
    if not exists (select 1 from public.restaurants where id = t and organization_id = p_org) then
      raise exception 'Branch % does not belong to this organization', t using errcode = '42501';
    end if;
    select * into pr from public.products
     where restaurant_id = t and lower(trim(name)) = lower(v_name) and archived_at is null
     order by created_at limit 1;
    if found then
      v_old := pr.price;
      update public.products set price = coalesce(p_price, price), is_available = coalesce(p_available, is_available)
       where id = pr.id;
      v_status := 'updated'; v_new := pr.id;
    elsif p_create_missing and p_price is not null then
      v_cat := null;
      if nullif(trim(p_category), '') is not null then
        select id into v_cat from public.categories
         where restaurant_id = t and lower(name) = lower(trim(p_category)) and archived_at is null limit 1;
        if v_cat is null then
          insert into public.categories (restaurant_id, name) values (t, trim(p_category)) returning id into v_cat;
        end if;
      end if;
      insert into public.products (restaurant_id, category_id, name, price, is_available)
      values (t, v_cat, v_name, p_price, coalesce(p_available, true)) returning id into v_new;
      v_status := 'created'; v_old := null;
    else
      v_status := 'missing'; v_new := null; v_old := null;
    end if;
    if v_status <> 'missing' then
      perform public.write_audit(t, 'menu_push', 'products', v_new,
        jsonb_build_object('price', v_old), jsonb_build_object('name', v_name, 'price', p_price, 'is_available', p_available), null);
    end if;
    v_res := v_res || jsonb_build_object('restaurant_id', t, 'status', v_status, 'product_id', v_new, 'old_price', v_old);
  end loop;
  return v_res;
end $$;

-- Master dish list: one row per dish name with the price in each branch.
create or replace function public.org_menu_matrix(p_org uuid)
returns table (restaurant_id uuid, product_id uuid, name text, category text, price numeric, is_available boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_org_owner(p_org) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  return query
  select p.restaurant_id, p.id, p.name, c.name, p.price, p.is_available
    from public.products p
    join public.restaurants r on r.id = p.restaurant_id
    left join public.categories c on c.id = p.category_id
   where r.organization_id = p_org and p.archived_at is null
   order by lower(p.name), r.name;
end $$;

-- ---------------------------------------------------------------------
-- Broadcast to staff of one branch or all branches (stored as notifications)
-- ---------------------------------------------------------------------
create or replace function public.org_broadcast(
  p_org uuid, p_branch uuid, p_title text, p_body text default null, p_roles public.app_role[] default null)
returns integer language plpgsql security definer set search_path = public as $$
declare v_n integer; v_branch record; v_title text := trim(coalesce(p_title, ''));
begin
  if not public.is_org_owner(p_org) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if length(v_title) < 2 or length(v_title) > 120 then raise exception 'Title must be 2–120 characters' using errcode = '22023'; end if;
  if p_branch is not null and not exists (select 1 from public.restaurants where id = p_branch and organization_id = p_org) then
    raise exception 'Branch does not belong to this organization' using errcode = '42501';
  end if;
  insert into public.notifications (restaurant_id, user_id, type, title, body)
  select m.restaurant_id, m.user_id, 'broadcast', v_title, nullif(trim(p_body), '')
    from public.restaurant_members m join public.restaurants r on r.id = m.restaurant_id
   where r.organization_id = p_org and m.status = 'active'
     and (p_branch is null or m.restaurant_id = p_branch)
     and (p_roles is null or m.role = any(p_roles));
  get diagnostics v_n = row_count;
  for v_branch in select id from public.restaurants where organization_id = p_org and (p_branch is null or id = p_branch) loop
    perform public.write_audit(v_branch.id, 'broadcast', 'restaurants', v_branch.id, null, jsonb_build_object('title', v_title, 'recipients', v_n), null);
  end loop;
  return v_n;
end $$;

-- ---------------------------------------------------------------------
-- Tax filings: the amount is computed here from the orders, never taken from the client
-- ---------------------------------------------------------------------
create or replace function public.org_tax_due(p_org uuid, p_from date, p_to date)
returns table (restaurant_id uuid, currency text, tax_rate numeric, tax_label text, taxable_sales numeric, tax_collected numeric,
               orders_count bigint, filing_id uuid, filing_reference text, filed_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_org_owner(p_org) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  return query
  select r.id, r.currency::text, r.tax_rate, r.tax_label,
         coalesce(sum(o.total - o.tax_amount), 0), coalesce(sum(o.tax_amount), 0), count(o.id),
         f.id, f.reference, f.filed_at
    from public.restaurants r
    left join public.orders o on o.restaurant_id = r.id and o.status <> 'cancelled'
         and (o.created_at at time zone r.timezone)::date between p_from and p_to
    left join public.tax_filings f on f.restaurant_id = r.id and f.period_from = p_from and f.period_to = p_to
   where r.organization_id = p_org
   group by r.id, f.id
   order by r.name;
end $$;

create or replace function public.org_record_tax_filing(
  p_org uuid, p_restaurant uuid, p_from date, p_to date, p_reference text default null, p_notes text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_tax numeric; v_cur text; v_id uuid;
begin
  if not public.is_org_owner(p_org) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if p_to < p_from then raise exception 'Period end is before its start' using errcode = '22023'; end if;
  if p_to >= (now() at time zone 'utc')::date + 1 then raise exception 'The period has not ended yet' using errcode = '22023'; end if;
  select r.currency::text into v_cur from public.restaurants r where r.id = p_restaurant and r.organization_id = p_org;
  if v_cur is null then raise exception 'Branch does not belong to this organization' using errcode = '42501'; end if;
  select coalesce(sum(o.tax_amount), 0) into v_tax
    from public.orders o join public.restaurants r on r.id = o.restaurant_id
   where o.restaurant_id = p_restaurant and o.status <> 'cancelled'
     and (o.created_at at time zone r.timezone)::date between p_from and p_to;
  insert into public.tax_filings (organization_id, restaurant_id, period_from, period_to, tax_collected, currency, reference, notes)
  values (p_org, p_restaurant, p_from, p_to, v_tax, v_cur, nullif(trim(p_reference), ''), nullif(trim(p_notes), ''))
  returning id into v_id;
  perform public.write_audit(p_restaurant, 'tax_filing', 'restaurants', p_restaurant, null,
    jsonb_build_object('from', p_from, 'to', p_to, 'tax', v_tax, 'reference', nullif(trim(p_reference), '')), null);
  return v_id;
exception when unique_violation then
  raise exception 'This period is already recorded as filed for the branch' using errcode = '23505';
end $$;

-- ---------------------------------------------------------------------
-- Group settings
-- ---------------------------------------------------------------------
create or replace function public.org_update_settings(p_org uuid, p_name text, p_reporting_currency text, p_fx_rates jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare k text; v numeric;
begin
  if not public.is_org_owner(p_org) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if length(trim(coalesce(p_name, ''))) < 2 then raise exception 'Organization name is too short' using errcode = '22023'; end if;
  if p_reporting_currency !~ '^[A-Z]{3}$' then raise exception 'Currency must be a 3-letter code' using errcode = '22023'; end if;
  if jsonb_typeof(coalesce(p_fx_rates, '{}'::jsonb)) <> 'object' then raise exception 'Exchange rates must be an object' using errcode = '22023'; end if;
  for k in select jsonb_object_keys(coalesce(p_fx_rates, '{}'::jsonb)) loop
    if k !~ '^[A-Z]{3}$' then raise exception 'Rate key % is not a currency code', k using errcode = '22023'; end if;
    v := (p_fx_rates ->> k)::numeric;
    if v is null or v <= 0 then raise exception 'Rate for % must be greater than 0', k using errcode = '22023'; end if;
  end loop;
  update public.organizations
     set name = trim(p_name),
         settings = settings || jsonb_build_object('reporting_currency', p_reporting_currency, 'fx_rates', coalesce(p_fx_rates, '{}'::jsonb))
   where id = p_org;
end $$;

-- Apply tax / receipt / permission defaults to several branches at once.
create or replace function public.org_apply_branch_defaults(p_org uuid, p_targets uuid[], p_fields jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare t uuid; n integer := 0; k text;
begin
  if not public.is_org_owner(p_org) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if p_targets is null or cardinality(p_targets) = 0 then raise exception 'Choose at least one branch' using errcode = '22023'; end if;
  for k in select jsonb_object_keys(coalesce(p_fields, '{}'::jsonb)) loop
    if k not in ('tax_rate', 'tax_label', 'tax_inclusive', 'receipt_footer', 'permissions') then
      raise exception 'Field % cannot be applied group-wide', k using errcode = '22023';
    end if;
  end loop;
  if p_fields ? 'tax_rate' and ((p_fields ->> 'tax_rate')::numeric < 0 or (p_fields ->> 'tax_rate')::numeric >= 1) then
    raise exception 'Tax rate must be between 0 and 1' using errcode = '22023';
  end if;
  foreach t in array p_targets loop
    if not exists (select 1 from public.restaurants where id = t and organization_id = p_org) then
      raise exception 'Branch % does not belong to this organization', t using errcode = '42501';
    end if;
    update public.restaurants set
      tax_rate = coalesce((p_fields ->> 'tax_rate')::numeric, tax_rate),
      tax_label = coalesce(nullif(trim(p_fields ->> 'tax_label'), ''), tax_label),
      tax_inclusive = coalesce((p_fields ->> 'tax_inclusive')::boolean, tax_inclusive),
      receipt_footer = case when p_fields ? 'receipt_footer' then p_fields ->> 'receipt_footer' else receipt_footer end,
      settings = case when p_fields ? 'permissions'
                      then jsonb_set(settings, '{permissions}', coalesce(settings -> 'permissions', '{}'::jsonb) || (p_fields -> 'permissions'))
                      else settings end
    where id = t;
    n := n + 1;
  end loop;
  return n;
end $$;

-- ---------------------------------------------------------------------
-- RLS and grants
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['organizations', 'organization_members', 'tax_filings', 'audit_reviews'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end $$;

drop policy if exists sb_organizations_select on public.organizations;
create policy sb_organizations_select on public.organizations for select to authenticated
  using (public.is_org_owner(id));
drop policy if exists sb_org_members_select on public.organization_members;
create policy sb_org_members_select on public.organization_members for select to authenticated
  using (user_id = auth.uid());
drop policy if exists sb_tax_filings_select on public.tax_filings;
create policy sb_tax_filings_select on public.tax_filings for select to authenticated
  using (public.is_org_owner(organization_id));
drop policy if exists sb_audit_reviews_select on public.audit_reviews;
create policy sb_audit_reviews_select on public.audit_reviews for select to authenticated
  using (public.is_org_owner(organization_id));

revoke all on public.organizations, public.organization_members, public.tax_filings, public.audit_reviews from anon, authenticated;
grant select on public.organizations, public.organization_members, public.tax_filings, public.audit_reviews to authenticated;

-- Reviewing a flagged event is a plain upsert by the owner (no function needed).
grant insert, update on public.audit_reviews to authenticated;
drop policy if exists sb_audit_reviews_insert on public.audit_reviews;
create policy sb_audit_reviews_insert on public.audit_reviews for insert to authenticated
  with check (public.is_org_owner(organization_id) and reviewed_by = auth.uid());
drop policy if exists sb_audit_reviews_update on public.audit_reviews;
create policy sb_audit_reviews_update on public.audit_reviews for update to authenticated
  using (public.is_org_owner(organization_id)) with check (public.is_org_owner(organization_id) and reviewed_by = auth.uid());
revoke update (organization_id, event_key) on public.audit_reviews from authenticated;

-- Anything not listed is callable only through a function that checks ownership.
revoke execute on function
  public.is_org_owner(uuid), public.is_owner_of_restaurant(uuid), public.create_organization(text),
  public.org_create_branch(uuid, text, text, text, text, text, numeric),
  public.org_branch_summary(uuid, timestamptz, timestamptz), public.org_revenue_series(uuid, timestamptz, timestamptz, text),
  public.org_payment_mix(uuid, timestamptz, timestamptz), public.org_inventory_summary(uuid), public.org_low_stock(uuid, integer),
  public.org_push_menu_item(uuid, text, uuid[], numeric, boolean, boolean, text), public.org_menu_matrix(uuid),
  public.org_broadcast(uuid, uuid, text, text, public.app_role[]),
  public.org_tax_due(uuid, date, date), public.org_record_tax_filing(uuid, uuid, date, date, text, text),
  public.org_update_settings(uuid, text, text, jsonb), public.org_apply_branch_defaults(uuid, uuid[], jsonb)
  from public, anon;
grant execute on function
  public.is_org_owner(uuid), public.is_owner_of_restaurant(uuid), public.create_organization(text),
  public.org_create_branch(uuid, text, text, text, text, text, numeric),
  public.org_branch_summary(uuid, timestamptz, timestamptz), public.org_revenue_series(uuid, timestamptz, timestamptz, text),
  public.org_payment_mix(uuid, timestamptz, timestamptz), public.org_inventory_summary(uuid), public.org_low_stock(uuid, integer),
  public.org_push_menu_item(uuid, text, uuid[], numeric, boolean, boolean, text), public.org_menu_matrix(uuid),
  public.org_broadcast(uuid, uuid, text, text, public.app_role[]),
  public.org_tax_due(uuid, date, date), public.org_record_tax_filing(uuid, uuid, date, date, text, text),
  public.org_update_settings(uuid, text, text, jsonb), public.org_apply_branch_defaults(uuid, uuid[], jsonb)
  to authenticated;

-- Owners may update branch details but never the sequence counters or the group link.
revoke update (organization_id) on public.restaurants from authenticated;

-- Realtime: the HQ dashboard listens for changes to the filing register and reviews.
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.audit_reviews; exception when duplicate_object then null; end;
  end if;
end $$;
