import type { RestaurantSettings } from '@sombill/shared-types/types';

export const DEFAULT_SETTINGS: RestaurantSettings = {
  tables: { cleaning_enabled: false, allow_multiple_orders: false },
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
};

/** Fills missing keys with the same defaults the database functions use. */
export function normalizeSettings(raw: unknown): RestaurantSettings {
  const r = (typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? raw : {}) as Partial<RestaurantSettings>;
  return {
    tables: { ...DEFAULT_SETTINGS.tables, ...r.tables },
    orders: { ...DEFAULT_SETTINGS.orders, ...r.orders },
    inventory: { ...DEFAULT_SETTINGS.inventory, ...r.inventory },
    expenses: { ...DEFAULT_SETTINGS.expenses, ...r.expenses },
    permissions: { ...DEFAULT_SETTINGS.permissions, ...r.permissions },
  };
}
