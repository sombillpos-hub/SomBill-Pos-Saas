-- =====================================================================
-- SomBill – Ensure service_role has full privileges on public schema
-- Migration: 20261125000011_grant_service_role_full_access.sql
-- Fixes "permission denied for table restaurant_members" (and audit_logs,
-- profiles, restaurants, etc.) when Edge Functions (manage-staff) use
-- SUPABASE_SERVICE_ROLE_KEY.
-- =====================================================================

grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;
