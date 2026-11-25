-- =====================================================================
-- SomBill – Cashier POS enum additions
-- Migration: 20261121000006_cashier_enums.sql
-- Separate file: new enum values must be committed before use (000007).
-- =====================================================================

-- Somaliland / Somalia mobile money wallets, recorded as distinct methods.
alter type public.payment_method add value if not exists 'evc_plus';
alter type public.payment_method add value if not exists 'zaad';
alter type public.payment_method add value if not exists 'somtel_money';
