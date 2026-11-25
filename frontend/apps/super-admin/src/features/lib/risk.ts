import type { AuditRow, Flagged, Risk } from '../types';

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' || typeof v === 'number' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

export const DISCOUNT_FLAG_PCT = 15;

/**
 * Turns the audit trail into an anti-fraud stream. Rules are deliberately simple and explained in the UI:
 * - deleting a record is high risk;
 * - a cash drawer that closes with a difference is medium (high when the difference is 5% or more of expected cash);
 * - refunds and cancellations are medium (high when large against typical sales: 100 or more in branch currency);
 * - a discount is flagged when it is at least DISCOUNT_FLAG_PCT of the order subtotal (needs subtotal in the log);
 * - rejected mobile money payments, receipt reprints and price changes are low.
 * Anything else is not flagged.
 */
export function classify(r: AuditRow): Flagged | null {
  const base = {
    key: `audit:${r.id}`,
    at: r.created_at,
    restaurantId: r.restaurant_id,
    actorId: r.actor_id,
    action: r.action,
  };
  const n = r.new_data ?? {};
  const o = r.old_data ?? {};
  switch (r.action) {
    case 'delete':
      return {
        ...base,
        risk: 'high',
        title: `Record deleted (${r.entity_type})`,
        detail: r.reason ?? 'No reason given',
        amount: null,
      };
    case 'shift_close': {
      const diff = num(n.difference);
      if (diff === null || Math.abs(diff) < 0.005) return null;
      const expected = num(n.expected_cash) ?? 0;
      const risk: Risk = expected > 0 && Math.abs(diff) / expected >= 0.05 ? 'high' : 'medium';
      return {
        ...base,
        risk,
        title: `Cash drawer closed ${diff < 0 ? 'short' : 'over'} by ${Math.abs(diff).toFixed(2)}`,
        detail: r.reason ?? 'No note',
        amount: Math.abs(diff),
      };
    }
    case 'refund': {
      const amount = num(n.amount);
      return {
        ...base,
        risk: amount !== null && amount >= 100 ? 'high' : 'medium',
        title: 'Refund issued',
        detail: r.reason ?? 'No reason given',
        amount,
      };
    }
    case 'cancel':
      return { ...base, risk: 'medium', title: 'Order cancelled', detail: r.reason ?? 'No reason given', amount: null };
    case 'discount': {
      const amount = num(n.discount_amount);
      const subtotal = num(n.subtotal) ?? num(o.subtotal);
      if (amount === null) return null;
      const pct = subtotal && subtotal > 0 ? (amount / subtotal) * 100 : null;
      if (pct !== null && pct < DISCOUNT_FLAG_PCT) return null;
      return {
        ...base,
        risk: pct !== null && pct >= 30 ? 'high' : 'medium',
        title: pct !== null ? `Discount of ${pct.toFixed(0)}% applied` : 'Discount applied',
        detail: r.reason ?? 'No reason given',
        amount,
      };
    }
    case 'payment_rejected':
      return {
        ...base,
        risk: 'low',
        title: 'Mobile money payment rejected',
        detail: r.reason ?? 'No note',
        amount: null,
      };
    case 'receipt_reprint':
      return {
        ...base,
        risk: 'low',
        title: 'Receipt reprinted',
        detail: 'A paid receipt was printed again',
        amount: null,
      };
    case 'price_change':
      return {
        ...base,
        risk: 'low',
        title: 'Menu price changed',
        detail: `${String(o.price ?? '?')} → ${String(n.price ?? '?')}`,
        amount: num(n.price),
      };
    default:
      return null;
  }
}

export function flagAll(rows: AuditRow[]): Flagged[] {
  return rows.map(classify).filter((f): f is Flagged => f !== null);
}

export const RISK_ORDER: Record<Risk, number> = { high: 0, medium: 1, low: 2 };
