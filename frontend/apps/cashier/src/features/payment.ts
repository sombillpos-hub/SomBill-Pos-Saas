// Pure Cashier payment logic (unit-tested). The database re-validates everything
// in record_payments(); this only drives the on-screen form and preview.
import type { Order, OrderItem, Payment, PaymentMethod, Refund } from '@sombill/shared-types/types';

export type PosMethod = 'cash' | 'card' | 'evc_plus' | 'zaad' | 'somtel_money';
export const POS_METHODS: Array<{ id: PosMethod; label: string; kind: 'cash' | 'card' | 'mobile' }> = [
  { id: 'cash', label: 'Cash', kind: 'cash' },
  { id: 'card', label: 'Card', kind: 'card' },
  { id: 'evc_plus', label: 'EVC Plus', kind: 'mobile' },
  { id: 'zaad', label: 'Zaad', kind: 'mobile' },
  { id: 'somtel_money', label: 'Somtel Money', kind: 'mobile' },
];
export const isMobile = (m: PaymentMethod) =>
  m === 'evc_plus' || m === 'zaad' || m === 'somtel_money' || m === 'mobile_money';
export const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Parses a money string; null when invalid (negative, >2 decimals, not a number). */
export function parseMoney(v: string): number | null {
  const s = v.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Number(s);
}

type OrderMoney = Pick<Order, 'total' | 'amount_paid' | 'amount_refunded'>;
/** Pending (unverified) mobile money is reserved: it cannot be paid twice, but is not counted as collected. */
export function balances(o: OrderMoney, payments: Pick<Payment, 'kind' | 'status' | 'amount'>[]) {
  const pending = r2(
    payments.filter((p) => p.kind === 'payment' && p.status === 'pending').reduce((s, p) => s + Number(p.amount), 0),
  );
  const paid = r2(Number(o.amount_paid) - Number(o.amount_refunded));
  const balance = r2(Math.max(Number(o.total) - paid, 0));
  return { paid, pending, balance, payable: r2(Math.max(balance - pending, 0)) };
}

export interface PayLine {
  key: string;
  method: PosMethod;
  amount: string;
  reference: string;
  received: string;
  terminalConfirmed: boolean;
}

export interface LineCheck {
  ok: boolean;
  errors: Record<string, string>;
  total: number;
  remainingAfter: number;
  change: number;
  awaitingVerification: number;
  payload: Array<{
    method: PosMethod;
    amount: number;
    reference?: string;
    amount_received?: number;
    terminal_confirmed?: boolean;
  }>;
}

export function checkLines(lines: PayLine[], payable: number): LineCheck {
  const errors: Record<string, string> = {};
  const payload: LineCheck['payload'] = [];
  let total = 0;
  let change = 0;
  let awaiting = 0;
  const refs = new Set<string>();
  if (!lines.length) errors.form = 'Add a payment method.';
  for (const l of lines) {
    const amt = parseMoney(l.amount);
    if (amt === null || amt <= 0) {
      errors[l.key] = 'Enter an amount greater than zero (max 2 decimals).';
      continue;
    }
    const ref = l.reference.trim();
    if (l.method === 'cash') {
      if (l.received.trim()) {
        const rec = parseMoney(l.received);
        if (rec === null) {
          errors[l.key] = 'Cash received is not a valid amount.';
          continue;
        }
        if (rec < amt) {
          errors[l.key] = `Cash received is less than ${amt.toFixed(2)}.`;
          continue;
        }
        change = r2(change + rec - amt);
        payload.push({ method: 'cash', amount: amt, amount_received: rec });
      } else payload.push({ method: 'cash', amount: amt });
    } else if (l.method === 'card') {
      if (ref.length < 4) {
        errors[l.key] = 'Enter the terminal transaction ID from the card slip.';
        continue;
      }
      if (!l.terminalConfirmed) {
        errors[l.key] = 'Confirm the card terminal shows APPROVED.';
        continue;
      }
      payload.push({ method: 'card', amount: amt, reference: ref, terminal_confirmed: true });
    } else {
      if (ref.length < 4) {
        errors[l.key] = 'Enter the mobile money transaction reference.';
        continue;
      }
      const k = `${l.method}:${ref.toLowerCase()}`;
      if (refs.has(k)) {
        errors[l.key] = 'This reference is already in another line.';
        continue;
      }
      refs.add(k);
      awaiting = r2(awaiting + amt);
      payload.push({ method: l.method, amount: amt, reference: ref });
    }
    total = r2(total + amt);
  }
  if (total > payable + 0.001)
    errors.form = `Payments total ${total.toFixed(2)} but only ${payable.toFixed(2)} is outstanding.`;
  if (payable <= 0) errors.form = 'Nothing is outstanding on this order.';
  return {
    ok: Object.keys(errors).length === 0 && payload.length > 0,
    errors,
    total,
    remainingAfter: r2(Math.max(payable - total, 0)),
    change,
    awaitingVerification: awaiting,
    payload,
  };
}

/** Quick-cash suggestions: exact amount and the next round notes. */
export function cashSuggestions(amount: number): number[] {
  if (amount <= 0) return [];
  const out = new Set<number>([r2(amount)]);
  for (const step of [1, 5, 10, 20, 50, 100]) {
    const v = Math.ceil(amount / step) * step;
    if (v > amount) out.add(v);
    if (out.size >= 4) break;
  }
  return [...out].sort((a, b) => a - b).slice(0, 4);
}

/** How much of a transaction can still be refunded. */
export function refundEligible(
  p: Pick<Payment, 'id' | 'amount' | 'kind' | 'status'>,
  refunds: Pick<Refund, 'payment_id' | 'status' | 'amount'>[],
): number {
  if (p.kind !== 'payment' || p.status !== 'succeeded') return 0;
  const used = refunds
    .filter((r) => r.payment_id === p.id && r.status !== 'rejected')
    .reduce((s, r) => s + Number(r.amount), 0);
  return r2(Math.max(Number(p.amount) - used, 0));
}

/** Suggested refund for selected items: their share of the order total (includes tax, net of discount). */
export function itemsRefundSuggestion(
  o: Pick<Order, 'subtotal' | 'total'>,
  items: Pick<OrderItem, 'id' | 'unit_price'>[],
  picks: Record<string, number>,
): number {
  const base = items.reduce((s, it) => s + (picks[it.id] ?? 0) * Number(it.unit_price), 0);
  if (!base || Number(o.subtotal) <= 0) return 0;
  return r2(base * (Number(o.total) / Number(o.subtotal)));
}

export function refundedQty(refunds: Pick<Refund, 'status' | 'items'>[], itemId: string): number {
  return refunds
    .filter((r) => r.status !== 'rejected')
    .flatMap((r) => r.items)
    .filter((i) => i.order_item_id === itemId)
    .reduce((s, i) => s + Number(i.quantity), 0);
}

export const VERIFICATION_LABEL: Record<string, string> = {
  not_required: 'Not required',
  terminal_confirmed: 'Terminal approved (cashier-confirmed)',
  pending: 'Awaiting verification',
  verified: 'Verified',
  rejected: 'Rejected',
};

/** Friendly messages for record_payments / refund errors. */
export function cashierErrorMessage(raw: string): string {
  if (raw.includes('NO_OPEN_SHIFT'))
    return 'Open your cash shift (Shift Management) before taking payments or refunds.';
  if (raw.includes('ALREADY_SETTLED'))
    return 'This order is already settled (or another cashier just took the payment). The screen has been refreshed.';
  if (raw.includes('DUPLICATE_REFERENCE'))
    return (
      raw.replace(/^DUPLICATE_REFERENCE:\s*/, 'Duplicate reference: ') +
      '. Check the customer’s message — this transaction was already recorded.'
    );
  if (raw.includes('OVERPAYMENT')) return raw.replace(/^OVERPAYMENT:\s*/, '') + '.';
  if (raw.includes('DISCOUNT_LIMIT')) return raw.replace(/^DISCOUNT_LIMIT:\s*/, '');
  if (raw.includes('REFUND_EXCEEDS')) return raw.replace(/^REFUND_EXCEEDS:\s*/, 'Too much: ') + '.';
  return raw;
}
