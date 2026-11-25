// Pure Waiter POS logic (unit-tested). The database recomputes everything;
// these functions only power the on-screen preview and must match
// public.recalc_order_totals exactly.
import type { SessionRole, Order, OrderStatus, RestaurantSettings } from '@sombill/shared-types/types';

export interface PricedLine {
  quantity: number;
  unit_price: number;
  tax_exempt: boolean;
}
export interface Totals {
  subtotal: number;
  taxable: number;
  tax: number;
  total: number;
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function lineTotal(qty: number, price: number): number {
  return r2(qty * price);
}

export function computeTotals(lines: PricedLine[], taxRate: number, inclusive: boolean, discount = 0): Totals {
  const subtotal = r2(lines.reduce((s, l) => s + lineTotal(l.quantity, l.unit_price), 0));
  let taxable = r2(lines.filter((l) => !l.tax_exempt).reduce((s, l) => s + lineTotal(l.quantity, l.unit_price), 0));
  const ratio = subtotal > 0 ? Math.max(subtotal - discount, 0) / subtotal : 0;
  taxable = r2(taxable * ratio);
  if (inclusive) {
    return {
      subtotal,
      taxable,
      tax: r2(taxable - taxable / (1 + taxRate)),
      total: r2(Math.max(subtotal - discount, 0)),
    };
  }
  const tax = r2(taxable * taxRate);
  return { subtotal, taxable, tax, total: r2(Math.max(subtotal - discount, 0) + tax) };
}

export const MAX_QTY = 999;
export function clampQty(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(MAX_QTY, Math.max(1, Math.trunc(n)));
}

/** Maps database error messages from the POS RPCs to waiter-friendly text. */
export function posErrorMessage(raw: string): {
  kind: 'price' | 'unavailable' | 'occupied' | 'bill' | 'other';
  message: string;
} {
  const strip = (m: string) => m.replace(/^[A-Z_]+:\s*/, '');
  if (raw.includes('PRICE_CHANGED'))
    return { kind: 'price', message: `${strip(raw)}. Prices were refreshed — please review the order and send again.` };
  if (raw.includes('PRODUCT_UNAVAILABLE'))
    return { kind: 'unavailable', message: `${strip(raw)}. Remove it from the order and send again.` };
  if (raw.includes('TABLE_OCCUPIED'))
    return { kind: 'occupied', message: `${strip(raw)}. Open the existing order from Tables to add items.` };
  if (/bill has been requested/i.test(raw)) return { kind: 'bill', message: raw };
  return { kind: 'other', message: raw };
}

// ---- permissions (mirror of public.can_act_on_order & RPC checks) -----------
type OrderLike = Pick<
  Order,
  'waiter_id' | 'status' | 'total' | 'amount_paid' | 'amount_refunded' | 'bill_requested_at' | 'bill_acknowledged_at'
>;
const TERMINAL: OrderStatus[] = ['completed', 'cancelled'];

export function canActOnOrder(
  o: Pick<Order, 'waiter_id'>,
  uid: string | undefined,
  role: SessionRole | null,
  s: RestaurantSettings,
): boolean {
  if (role === 'manager' || role === 'owner' || role === 'cashier') return true;
  if (role !== 'waiter') return false;
  return o.waiter_id === null || o.waiter_id === uid || s.permissions.waiter_can_edit_others_orders;
}
const netPaid = (o: OrderLike) => Number(o.amount_paid) - Number(o.amount_refunded);

export function canAddItems(
  o: OrderLike,
  uid: string | undefined,
  role: SessionRole | null,
  s: RestaurantSettings,
): boolean {
  return canActOnOrder(o, uid, role, s) && !TERMINAL.includes(o.status) && netPaid(o) <= 0 && !o.bill_requested_at;
}
export function canRequestBill(
  o: OrderLike,
  uid: string | undefined,
  role: SessionRole | null,
  s: RestaurantSettings,
): boolean {
  return canActOnOrder(o, uid, role, s) && !TERMINAL.includes(o.status) && Number(o.total) > 0 && !o.bill_requested_at;
}
export function canCancelBill(
  o: OrderLike,
  uid: string | undefined,
  role: SessionRole | null,
  s: RestaurantSettings,
): boolean {
  if (!canActOnOrder(o, uid, role, s) || !o.bill_requested_at || netPaid(o) > 0 || TERMINAL.includes(o.status))
    return false;
  if (role === 'waiter') return !o.bill_acknowledged_at && s.permissions.waiter_can_cancel_bill_request;
  return true;
}
export function canServe(
  o: OrderLike,
  uid: string | undefined,
  role: SessionRole | null,
  s: RestaurantSettings,
): boolean {
  return canActOnOrder(o, uid, role, s) && o.status === 'ready';
}

export type BillState =
  'not_requested' | 'requested' | 'processing' | 'partially_paid' | 'paid' | 'closed' | 'cancelled';
export function billState(o: OrderLike & Pick<Order, 'payment_status'>): BillState {
  if (o.status === 'cancelled') return 'cancelled';
  if (o.status === 'completed') return 'closed';
  if (o.payment_status === 'paid') return 'paid';
  if (netPaid(o) > 0) return 'partially_paid';
  if (o.bill_acknowledged_at) return 'processing';
  if (o.bill_requested_at) return 'requested';
  return 'not_requested';
}
export const BILL_STATE_LABEL: Record<BillState, string> = {
  not_requested: 'Bill not requested',
  requested: 'Bill requested – waiting for cashier',
  processing: 'Cashier processing',
  partially_paid: 'Partially paid',
  paid: 'Paid',
  closed: 'Paid & closed',
  cancelled: 'Cancelled',
};

export const KITCHEN_FLOW: OrderStatus[] = ['new', 'accepted', 'preparing', 'ready', 'served'];
export const ACTIVE_STATUSES: OrderStatus[] = ['new', 'pending', 'accepted', 'preparing', 'ready', 'served'];
