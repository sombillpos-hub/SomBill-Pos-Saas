import type { Restaurant } from '@sombill/shared-types/types';

export const RID = '11111111-1111-4111-8111-111111111111';
export const MANAGER_ID = '22222222-2222-4222-8222-222222222222';

export const restaurant: Restaurant = {
  id: RID,
  name: 'Hargeisa Grill',
  logo_url: null,
  address: 'Road 1, Hargeisa',
  phone: '+252634000000',
  email: 'info@grill.test',
  currency: 'USD',
  timezone: 'Africa/Mogadishu',
  tax_rate: 0.1,
  tax_inclusive: false,
  tax_label: 'VAT',
  receipt_header: null,
  receipt_footer: 'Thanks',
  organization_id: null,
  order_seq: 0,
  po_seq: 0,
  txn_seq: 0,
  receipt_seq: 0,
  settings: {
    tables: { cleaning_enabled: true, allow_multiple_orders: false },
    orders: { require_cancel_reason: true, default_order_type: 'dine_in' },
    inventory: { allow_negative_stock: false, deduct_on: 'completed' },
    expenses: { approval_required: false },
    permissions: {
      cashier_can_cancel_orders: false,
      cashier_can_refund: false,
      cashier_can_create_customers: true,
      waiter_can_create_customers: false,
      waiter_can_edit_others_orders: false,
      waiter_can_cancel_bill_request: true,
      cashier_can_verify_mobile_money: true,
      require_open_shift: true,
      cashier_refund_limit: 0,
      cashier_max_discount_percent: 10,
    },
  },
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

export const WAITER_ID = '33333333-3333-4333-8333-333333333333';
export const CASHIER_ID = '55555555-5555-4555-8555-555555555555';
