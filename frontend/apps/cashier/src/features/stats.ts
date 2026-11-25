import type { Order, Payment } from '@sombill/shared-types/types';
import { isMobile, r2 } from './payment';

export interface CashierStats {
  grossSales: number;
  collected: number;
  cash: number;
  card: number;
  mobile: number;
  pendingVerification: number;
  refunds: number;
  net: number;
  paidOrders: number;
  unpaidOrders: number;
  partialOrders: number;
  activeOrders: number;
  avgTransaction: number;
  transactions: number;
}

/**
 * Dashboard figures. "Collected" counts only confirmed (succeeded) payments;
 * unpaid orders and mobile money still awaiting verification are never counted as collected.
 */
export function computeCashierStats(
  orders: Pick<Order, 'total' | 'status' | 'payment_status'>[],
  payments: Pick<Payment, 'kind' | 'status' | 'amount' | 'method'>[],
): CashierStats {
  const live = orders.filter((o) => o.status !== 'cancelled');
  const ok = payments.filter((p) => p.kind === 'payment' && p.status === 'succeeded');
  const sum = (xs: { amount: number | string }[]) => r2(xs.reduce((s, p) => s + Number(p.amount), 0));
  const collected = sum(ok);
  const refunds = sum(payments.filter((p) => p.kind === 'refund' && p.status === 'succeeded'));
  return {
    grossSales: r2(live.reduce((s, o) => s + Number(o.total), 0)),
    collected,
    cash: sum(ok.filter((p) => p.method === 'cash')),
    card: sum(ok.filter((p) => p.method === 'card')),
    mobile: sum(ok.filter((p) => isMobile(p.method))),
    pendingVerification: sum(payments.filter((p) => p.kind === 'payment' && p.status === 'pending')),
    refunds,
    net: r2(collected - refunds),
    paidOrders: live.filter((o) => o.payment_status === 'paid').length,
    unpaidOrders: live.filter((o) => o.payment_status === 'unpaid').length,
    partialOrders: live.filter((o) => o.payment_status === 'partial').length,
    activeOrders: live.filter((o) => o.status !== 'completed').length,
    transactions: ok.length,
    avgTransaction: ok.length ? r2(collected / ok.length) : 0,
  };
}
