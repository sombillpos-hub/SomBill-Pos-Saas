/**
 * Domain types derived directly from `database.types.ts` (`Database['public']`),
 * replacing the earlier hand-written row interfaces while narrowing PostgreSQL
 * `jsonb` and `CHECK`-constrained `text` columns for compile-time safety.
 */

import type { Database, Enums, Json, Tables, TablesInsert, TablesUpdate } from './database.types';

export type { Database, Enums, Json, Tables, TablesInsert, TablesUpdate };

type WithNarrowed<Base, Overrides extends Partial<Record<keyof Base, unknown>>> = Omit<Base, keyof Overrides> &
  Overrides;

// ---------------------------------------------------------------------
// Database Enums & Constrained Literals
// ---------------------------------------------------------------------
export type AppRole = Enums<'app_role'>;
/** What a signed-in person is acting as. `owner` is the group owner (Super Admin); the others come from `restaurant_members`. */
export type SessionRole = AppRole | 'owner';

export type MemberStatus = Enums<'member_status'>;
export type OrderStatus = Enums<'order_status'>;
export type OrderType = Enums<'order_type'>;
export type PaymentStatus = Enums<'payment_status'>;
export type PaymentMethod = Enums<'payment_method'>;
export type StockMovementType = Enums<'stock_movement_type'>;
export type POStatus = Enums<'po_status'>;
export type ExpenseStatus = Enums<'expense_status'>;

export type LicenseStatus = 'trial' | 'active' | 'past_due' | 'suspended';
export type PlanCode = 'starter' | 'growth' | 'enterprise';
export type VerificationStatus = 'not_required' | 'terminal_confirmed' | 'pending' | 'verified' | 'rejected';
export type TableStatus = 'available' | 'occupied' | 'bill_requested' | 'payment_pending' | 'cleaning';
export type TableShape = 'square' | 'round' | 'rect';
export type PreparationStation = 'kitchen' | 'bar' | 'grill' | 'bakery' | 'none';
export type TaxCategory = 'standard' | 'exempt';

// ---------------------------------------------------------------------
// Structured JSONB Shapes
// ---------------------------------------------------------------------
export interface RestaurantSettings {
  tables: { cleaning_enabled: boolean; allow_multiple_orders: boolean };
  orders: { require_cancel_reason: boolean; default_order_type: OrderType };
  inventory: { allow_negative_stock: boolean; deduct_on: 'completed' | 'none' };
  expenses: { approval_required: boolean };
  permissions: {
    cashier_can_cancel_orders: boolean;
    cashier_can_refund: boolean;
    cashier_can_create_customers: boolean;
    waiter_can_create_customers: boolean;
    waiter_can_edit_others_orders: boolean;
    waiter_can_cancel_bill_request: boolean;
    cashier_can_verify_mobile_money: boolean;
    require_open_shift: boolean;
    cashier_refund_limit: number;
    cashier_max_discount_percent: number;
  };
}

export interface OrganizationSettings {
  reporting_currency?: string;
  fx_rates?: Record<string, number>;
}

export interface ShiftSummary {
  opening_cash: number;
  cash_sales: number;
  cash_refunds: number;
  pay_in: number;
  pay_out: number;
  expected_cash: number;
  by_method: Partial<Record<PaymentMethod, number>>;
  pending_verification: number;
  refunds_total: number;
  transactions: number;
  collected_total: number;
}

export interface SalesSummary {
  gross_sales: number;
  total_orders: number;
  completed_orders: number;
  cancelled_orders: number;
  pending_orders: number;
  outstanding: number;
  avg_order_value: number;
  collected: number;
  refunds: number;
  net_collected: number;
}

// ---------------------------------------------------------------------
// Table & View Row Types (derived 1:1 from Database['public'])
// ---------------------------------------------------------------------
export type Organization = WithNarrowed<
  Tables<'organizations'>,
  {
    plan: PlanCode;
    license_status: LicenseStatus;
    settings: OrganizationSettings;
  }
>;

export type OrganizationMember = Tables<'organization_members'>;
export type TaxFiling = Tables<'tax_filings'>;
export type AuditReview = WithNarrowed<
  Tables<'audit_reviews'>,
  {
    status: 'investigating' | 'cleared' | 'escalated';
  }
>;

export type Restaurant = WithNarrowed<
  Tables<'restaurants'>,
  {
    settings: RestaurantSettings;
  }
>;

export type Profile = Tables<'profiles'>;
export type RestaurantMember = Tables<'restaurant_members'>;
export type Category = Tables<'categories'>;

export type Product = WithNarrowed<
  Tables<'products'>,
  {
    tax_category: TaxCategory;
    preparation_station: PreparationStation;
  }
>;

export type RecipeItem = Tables<'product_recipe_items'>;

export type RestaurantTable = WithNarrowed<
  Tables<'restaurant_tables'>,
  {
    shape: TableShape;
  }
>;

/**
 * PostgreSQL view `table_status_v` joins `restaurant_tables` (NOT NULL base columns)
 * with active `orders`; PostgREST types view columns as nullable, so non-null base
 * columns are narrowed to match the underlying `restaurant_tables` schema.
 */
export type TableStatusRow = WithNarrowed<
  Tables<'table_status_v'>,
  {
    id: string;
    restaurant_id: string;
    table_number: number;
    capacity: number;
    section: string;
    floor: string;
    pos_x: number;
    pos_y: number;
    shape: TableShape;
    needs_cleaning: boolean;
    balance: number;
    status: TableStatus;
  }
>;

export type Customer = Tables<'customers'>;
export type Order = Tables<'orders'>;
export type OrderItem = Tables<'order_items'>;

export type Payment = WithNarrowed<
  Tables<'payments'>,
  {
    kind: 'payment' | 'refund';
    status: 'succeeded' | 'failed' | 'pending';
    verification_status: VerificationStatus;
  }
>;

export type InventoryItem = Tables<'inventory_items'>;
export type StockMovement = Tables<'stock_movements'>;
export type Supplier = Tables<'suppliers'>;
export type PurchaseOrder = Tables<'purchase_orders'>;
export type PurchaseOrderItem = Tables<'purchase_order_items'>;
export type PurchaseOrderReceipt = Tables<'purchase_order_receipts'>;
export type Expense = Tables<'expenses'>;

export type AuditLog = WithNarrowed<
  Tables<'audit_logs'>,
  {
    old_data: Record<string, unknown> | null;
    new_data: Record<string, unknown> | null;
  }
>;

export type AppNotification = Tables<'notifications'>;
export type StaffShift = Tables<'staff_shifts'>;
export type PosRequest = Tables<'pos_requests'>;

export type Refund = WithNarrowed<
  Tables<'refunds'>,
  {
    items: Array<{ order_item_id: string; quantity: number }>;
    status: 'pending_approval' | 'completed' | 'rejected';
  }
>;

export type CashierShift = WithNarrowed<
  Tables<'cashier_shifts'>,
  {
    status: 'open' | 'closed';
    summary: ShiftSummary | null;
  }
>;

export type CashMovement = WithNarrowed<
  Tables<'cash_movements'>,
  {
    movement_type: 'pay_in' | 'pay_out' | 'drop';
  }
>;

export type PaymentRequest = Tables<'payment_requests'>;
export type ReceiptRecord = Tables<'receipts'>;
