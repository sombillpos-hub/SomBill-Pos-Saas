import type { AppRole } from '@sombill/shared-types/types';

/** One row of public.org_branch_summary. Numbers arrive as strings from PostgREST for numeric columns. */
export interface BranchSummary {
  restaurant_id: string;
  name: string;
  address: string | null;
  phone: string | null;
  currency: string;
  timezone: string;
  tax_rate: number;
  orders_count: number;
  gross: number;
  net: number;
  tax: number;
  discounts: number;
  guests: number;
  cancelled_count: number;
  collected: number;
  refunded: number;
  open_orders: number;
  tables_total: number;
  tables_occupied: number;
  open_cashier_shifts: number;
  staff_on_duty: number;
  staff_active: number;
  last_order_at: string | null;
}

export interface SeriesPoint {
  bucket: string;
  restaurant_id: string;
  gross: number;
  orders: number;
}

export interface PayMixRow {
  restaurant_id: string;
  method: string;
  kind: 'payment' | 'refund';
  status: string;
  verification_status: string;
  amount: number;
  txns: number;
}

export interface Branch {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  currency: string;
  timezone: string;
  tax_rate: number;
  tax_label: string;
  tax_inclusive: boolean;
  receipt_footer: string | null;
  settings: Record<string, unknown>;
}

export interface InventorySummary {
  restaurant_id: string;
  items: number;
  low_stock: number;
  out_of_stock: number;
  stock_value: number;
  open_purchase_orders: number;
  open_po_value: number;
}

export interface LowStockRow {
  restaurant_id: string;
  item_id: string;
  name: string;
  unit: string;
  quantity: number;
  min_stock: number;
}

export interface MenuMatrixRow {
  restaurant_id: string;
  product_id: string;
  name: string;
  category: string | null;
  price: number;
  is_available: boolean;
}

export interface PushResult {
  restaurant_id: string;
  status: 'updated' | 'created' | 'missing';
  product_id: string | null;
  old_price: number | null;
}

export interface TaxDueRow {
  restaurant_id: string;
  currency: string;
  tax_rate: number;
  tax_label: string;
  taxable_sales: number;
  tax_collected: number;
  orders_count: number;
  filing_id: string | null;
  filing_reference: string | null;
  filed_at: string | null;
}

export interface TaxFiling {
  id: string;
  restaurant_id: string;
  period_from: string;
  period_to: string;
  tax_collected: number;
  currency: string;
  reference: string | null;
  notes: string | null;
  filed_at: string;
}

export interface AuditRow {
  id: number;
  restaurant_id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  reason: string | null;
  created_at: string;
}

export type Risk = 'high' | 'medium' | 'low';
export type ReviewStatus = 'investigating' | 'cleared' | 'escalated';
export interface AuditReview {
  event_key: string;
  status: ReviewStatus;
  note: string | null;
  reviewed_at: string;
}

/** A flagged event shown in the anti-fraud stream. */
export interface Flagged {
  key: string;
  at: string;
  restaurantId: string;
  actorId: string | null;
  action: string;
  risk: Risk;
  title: string;
  detail: string;
  amount: number | null;
}

export interface StaffRow {
  id: string;
  restaurant_id: string;
  user_id: string;
  role: AppRole;
  status: 'active' | 'suspended';
  created_at: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  last_login_at: string | null;
}

export type RangeKey = 'today' | 'week' | 'mtd' | 'year';
export interface Range {
  key: RangeKey;
  from: Date;
  to: Date;
  /** Same length, immediately before `from`: used for the trend arrow. */
  prevFrom: Date;
  prevTo: Date;
  bucket: 'hour' | 'day' | 'month';
  label: string;
}
