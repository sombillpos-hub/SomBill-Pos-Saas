-- =====================================================================
-- SomBill – Waiter POS enum additions
-- Migration: 20261121000004_waiter_enums.sql
-- Kept in its own file: PostgreSQL requires new enum values to be
-- committed before they can be referenced by later statements.
-- =====================================================================

-- Kitchen acknowledgement step between New and Preparing.
alter type public.order_status add value if not exists 'accepted' after 'pending';

-- Kitchen staff role: may move orders through Accepted / Preparing / Ready.
alter type public.app_role add value if not exists 'kitchen';
