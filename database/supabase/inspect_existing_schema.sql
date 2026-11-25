-- Run this in the Supabase SQL editor BEFORE applying the SomBill migrations
-- to an existing (shared) database. It lists what already exists so you can
-- reconcile instead of duplicating or renaming production columns.

-- 1. Tables and columns in public
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;

-- 2. Enums
select t.typname as enum_name, string_agg(e.enumlabel, ', ' order by e.enumsortorder) as values
from pg_type t join pg_enum e on e.enumtypid = t.oid
join pg_namespace n on n.oid = t.typnamespace and n.nspname = 'public'
group by t.typname;

-- 3. RLS status and policies
select relname as table_name, relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' order by relname;

select tablename, policyname, cmd, roles, qual, with_check
from pg_policies where schemaname = 'public' order by tablename, policyname;

-- 4. Functions and triggers
select p.proname, pg_get_function_identity_arguments(p.oid) as args, p.prosecdef as security_definer
from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' order by 1;

select event_object_table as table_name, trigger_name, action_timing, event_manipulation
from information_schema.triggers where trigger_schema = 'public' order by 1, 2;

-- 5. Row counts (are there business records to preserve?)
select relname as table_name, n_live_tup as approx_rows
from pg_stat_user_tables where schemaname = 'public' order by relname;
