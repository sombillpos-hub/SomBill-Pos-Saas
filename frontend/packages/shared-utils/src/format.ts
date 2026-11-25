import type {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  OrderType,
  StockMovementType,
  POStatus,
  TableStatus,
} from '@sombill/shared-types/types';

export function formatMoney(value: number | string | null | undefined, currency: string): string {
  const n = typeof value === 'string' ? Number(value) : (value ?? 0);
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, currencyDisplay: 'narrowSymbol' }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

export function formatNumber(value: number | null | undefined, digits = 0): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(
    value ?? 0,
  );
}

export function formatQty(value: number | null | undefined): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }).format(value ?? 0);
}

export function formatDateTime(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function formatDate(iso: string | null | undefined, timeZone?: string): string {
  if (!iso) return '—';
  // Plain dates (YYYY-MM-DD) are calendar dates; don't shift them by zone.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00Z`) : new Date(iso);
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: /^\d{4}-\d{2}-\d{2}$/.test(iso) ? 'UTC' : timeZone,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

export function formatDuration(fromIso: string | null, now: Date = new Date()): string {
  if (!fromIso) return '—';
  const mins = Math.max(0, Math.floor((now.getTime() - new Date(fromIso).getTime()) / 60000));
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  return `${h}h ${mins % 60}m`;
}

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  new: 'New',
  pending: 'Pending',
  accepted: 'Accepted',
  preparing: 'Preparing',
  ready: 'Ready',
  served: 'Served',
  completed: 'Completed',
  cancelled: 'Cancelled',
};
export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  unpaid: 'Unpaid',
  partial: 'Partially paid',
  paid: 'Paid',
  refunded: 'Refunded',
};
export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: 'Cash',
  card: 'Card',
  evc_plus: 'EVC Plus',
  zaad: 'Zaad',
  somtel_money: 'Somtel Money',
  mobile_money: 'Mobile money (other)',
  bank_transfer: 'Bank transfer',
  credit: 'On account',
  other: 'Other',
};
export const ORDER_TYPE_LABEL: Record<OrderType, string> = {
  dine_in: 'Dine-in',
  takeaway: 'Takeaway',
  delivery: 'Delivery',
};
export const MOVEMENT_LABEL: Record<StockMovementType, string> = {
  opening: 'Opening stock',
  receive: 'Received',
  adjustment: 'Adjustment',
  wastage: 'Wastage',
  transfer_in: 'Transfer in',
  transfer_out: 'Transfer out',
  sale: 'Sale',
  sale_reversal: 'Sale reversal',
};
export const PO_STATUS_LABEL: Record<POStatus, string> = {
  draft: 'Draft',
  ordered: 'Ordered',
  partially_received: 'Partially received',
  received: 'Received',
  cancelled: 'Cancelled',
};
export const TABLE_STATUS_LABEL: Record<TableStatus, string> = {
  available: 'Available',
  occupied: 'Occupied',
  bill_requested: 'Bill requested',
  payment_pending: 'Payment pending',
  cleaning: 'Cleaning',
};

export const ROLE_LABEL = { manager: 'Manager', cashier: 'Cashier', waiter: 'Waiter', kitchen: 'Kitchen' } as const;
