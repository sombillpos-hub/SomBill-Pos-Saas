-- =====================================================================
-- SomBill – Public Customer QR Menu Read-Only Access
-- Migration: 20261125000009_customer_qr_menu_public_read.sql
-- Allows unauthenticated guests scanning a table QR code (/table-menu/:tableId)
-- to browse active categories, available products, and non-archived tables.
-- =====================================================================

grant select on public.categories, public.products, public.restaurant_tables to anon;

drop policy if exists sb_categories_public_qr_read on public.categories;
create policy sb_categories_public_qr_read on public.categories
  for select to anon
  using (is_active = true and archived_at is null);

drop policy if exists sb_products_public_qr_read on public.products;
create policy sb_products_public_qr_read on public.products
  for select to anon
  using (is_available = true and archived_at is null);

drop policy if exists sb_tables_public_qr_read on public.restaurant_tables;
create policy sb_tables_public_qr_read on public.restaurant_tables
  for select to anon
  using (archived_at is null);
