import { PAYMENT_METHOD_LABEL } from '@sombill/shared-utils/format';
import type { PaymentMethod } from '@sombill/shared-types/types';
import { convert, type Fx } from './money';
import type { PayMixRow } from '../types';

export interface Share {
  method: string;
  label: string;
  amount: number;
  pct: number;
}

/** Share of takings by payment method, in the reporting currency. Failed payments and refunds are left out. */
export function mixShares(
  rows: PayMixRow[],
  currencyOf: (restaurantId: string) => string,
  fx: Fx,
): { shares: Share[]; total: number } {
  const by = new Map<string, number>();
  for (const r of rows) {
    if (r.kind !== 'payment' || r.status === 'failed' || r.verification_status === 'rejected') continue;
    const v = convert(r.amount, currencyOf(r.restaurant_id), fx.reporting, fx);
    if (v === null) continue;
    by.set(r.method, (by.get(r.method) ?? 0) + v);
  }
  const total = [...by.values()].reduce((a, b) => a + b, 0);
  const shares = [...by.entries()]
    .map(([method, amount]) => ({
      method,
      label: PAYMENT_METHOD_LABEL[method as PaymentMethod] ?? method,
      amount,
      pct: total > 0 ? (amount / total) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
  return { shares, total };
}

export const MOBILE_METHODS = ['zaad', 'evc_plus', 'somtel_money', 'mobile_money'];
