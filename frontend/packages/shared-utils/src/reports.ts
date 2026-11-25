// Pure report calculations (unit-tested). Inputs are raw database rows.
// Definitions:
//   Gross sales     = sum of order totals for non-cancelled orders created in range
//   Collected       = successful payments (kind=payment) recorded in range
//   Refunds         = successful refunds recorded in range (kept separate)
//   Outstanding     = unpaid balance of non-cancelled orders created in range
//   Profit estimate = net sales ex-tax − cost of goods (known costs only) − approved expenses

import { daysBetween, localDateOf, weekStart, type DateRange } from './dates';
import type {
  Expense,
  InventoryItem,
  Order,
  OrderItem,
  Payment,
  PaymentMethod,
  Product,
  Category,
} from '@sombill/shared-types/types';

const n = (v: number | string | null | undefined): number => (v === null || v === undefined ? 0 : Number(v));
const r2 = (v: number): number => Math.round(v * 100) / 100;

export function orderBalance(o: Pick<Order, 'total' | 'amount_paid' | 'amount_refunded' | 'status'>): number {
  if (o.status === 'cancelled') return 0;
  return r2(Math.max(n(o.total) - (n(o.amount_paid) - n(o.amount_refunded)), 0));
}

export interface Summary {
  grossSales: number;
  collected: number;
  refunds: number;
  netCollected: number;
  outstanding: number;
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  pendingOrders: number;
  avgOrderValue: number;
  taxCollected: number;
  discounts: number;
}

export function summarize(orders: Order[], payments: Payment[]): Summary {
  const live = orders.filter((o) => o.status !== 'cancelled');
  const ok = payments.filter((p) => p.status === 'succeeded');
  const collected = ok.filter((p) => p.kind === 'payment').reduce((s, p) => s + n(p.amount), 0);
  const refunds = ok.filter((p) => p.kind === 'refund').reduce((s, p) => s + n(p.amount), 0);
  const gross = live.reduce((s, o) => s + n(o.total), 0);
  return {
    grossSales: r2(gross),
    collected: r2(collected),
    refunds: r2(refunds),
    netCollected: r2(collected - refunds),
    outstanding: r2(live.reduce((s, o) => s + orderBalance(o), 0)),
    totalOrders: orders.length,
    completedOrders: orders.filter((o) => o.status === 'completed').length,
    cancelledOrders: orders.filter((o) => o.status === 'cancelled').length,
    pendingOrders: orders.filter((o) => !['completed', 'cancelled'].includes(o.status)).length,
    avgOrderValue: live.length ? r2(gross / live.length) : 0,
    taxCollected: r2(live.reduce((s, o) => s + n(o.tax_amount), 0)),
    discounts: r2(live.reduce((s, o) => s + n(o.discount_amount), 0)),
  };
}

export interface SeriesPoint {
  label: string;
  key: string;
  sales: number;
  collected: number;
  orders: number;
}

export function salesSeries(
  orders: Order[],
  payments: Payment[],
  range: DateRange,
  tz: string,
  bucket: 'day' | 'week' | 'month',
): SeriesPoint[] {
  const keyOf = (ymd: string) => (bucket === 'day' ? ymd : bucket === 'week' ? weekStart(ymd) : ymd.slice(0, 7));
  const map = new Map<string, SeriesPoint>();
  for (const d of daysBetween(range)) {
    const k = keyOf(d);
    if (!map.has(k)) map.set(k, { key: k, label: k, sales: 0, collected: 0, orders: 0 });
  }
  for (const o of orders) {
    if (o.status === 'cancelled') continue;
    const p = map.get(keyOf(localDateOf(o.created_at, tz)));
    if (p) {
      p.sales = r2(p.sales + n(o.total));
      p.orders += 1;
    }
  }
  for (const pay of payments) {
    if (pay.status !== 'succeeded') continue;
    const p = map.get(keyOf(localDateOf(pay.created_at, tz)));
    if (p) p.collected = r2(p.collected + (pay.kind === 'payment' ? n(pay.amount) : -n(pay.amount)));
  }
  return [...map.values()];
}

export interface MethodRow {
  method: PaymentMethod;
  payments: number;
  collected: number;
  refunds: number;
  net: number;
}

export function byPaymentMethod(payments: Payment[]): MethodRow[] {
  const map = new Map<PaymentMethod, MethodRow>();
  for (const p of payments) {
    if (p.status !== 'succeeded') continue;
    const row = map.get(p.method) ?? { method: p.method, payments: 0, collected: 0, refunds: 0, net: 0 };
    if (p.kind === 'payment') {
      row.payments += 1;
      row.collected = r2(row.collected + n(p.amount));
    } else row.refunds = r2(row.refunds + n(p.amount));
    row.net = r2(row.collected - row.refunds);
    map.set(p.method, row);
  }
  return [...map.values()].sort((a, b) => b.net - a.net);
}

export interface ProductPerf {
  product_id: string;
  name: string;
  category: string;
  quantity: number;
  revenue: number;
  cost: number | null;
  profit: number | null;
  margin: number | null;
}

/** Items must belong to non-cancelled orders and not be voided. */
export function productPerformance(items: OrderItem[], products: Product[], categories: Category[]): ProductPerf[] {
  const prod = new Map(products.map((p) => [p.id, p]));
  const cat = new Map(categories.map((c) => [c.id, c.name]));
  const map = new Map<string, ProductPerf & { _costKnown: boolean }>();
  for (const it of items) {
    if (it.is_voided) continue;
    const p = prod.get(it.product_id);
    const row = map.get(it.product_id) ?? {
      product_id: it.product_id,
      name: p?.name ?? it.product_name,
      category: (p?.category_id && cat.get(p.category_id)) || 'Uncategorised',
      quantity: 0,
      revenue: 0,
      cost: 0,
      profit: null,
      margin: null,
      _costKnown: true,
    };
    row.quantity += n(it.quantity);
    row.revenue = r2(row.revenue + n(it.line_total));
    if (it.unit_cost === null || it.unit_cost === undefined) row._costKnown = false;
    else row.cost = r2((row.cost ?? 0) + n(it.unit_cost) * n(it.quantity));
    map.set(it.product_id, row);
  }
  return [...map.values()]
    .map(({ _costKnown, ...r }) => {
      if (!_costKnown) return { ...r, cost: null, profit: null, margin: null };
      const profit = r2(r.revenue - (r.cost ?? 0));
      return { ...r, profit, margin: r.revenue > 0 ? Math.round((profit / r.revenue) * 1000) / 10 : null };
    })
    .sort((a, b) => b.revenue - a.revenue);
}

export function categoryPerformance(
  perf: ProductPerf[],
): { category: string; quantity: number; revenue: number; share: number }[] {
  const total = perf.reduce((s, p) => s + p.revenue, 0);
  const map = new Map<string, { category: string; quantity: number; revenue: number; share: number }>();
  for (const p of perf) {
    const row = map.get(p.category) ?? { category: p.category, quantity: 0, revenue: 0, share: 0 };
    row.quantity += p.quantity;
    row.revenue = r2(row.revenue + p.revenue);
    map.set(p.category, row);
  }
  return [...map.values()]
    .map((r) => ({ ...r, share: total > 0 ? Math.round((r.revenue / total) * 1000) / 10 : 0 }))
    .sort((a, b) => b.revenue - a.revenue);
}

export interface StaffPerf {
  user_id: string;
  orders: number;
  sales: number;
  avg: number;
  cancelled: number;
}

export function waiterPerformance(orders: Order[]): StaffPerf[] {
  const map = new Map<string, StaffPerf>();
  for (const o of orders) {
    if (!o.waiter_id) continue;
    const row = map.get(o.waiter_id) ?? { user_id: o.waiter_id, orders: 0, sales: 0, avg: 0, cancelled: 0 };
    if (o.status === 'cancelled') row.cancelled += 1;
    else {
      row.orders += 1;
      row.sales = r2(row.sales + n(o.total));
    }
    map.set(o.waiter_id, row);
  }
  return [...map.values()]
    .map((r) => ({ ...r, avg: r.orders ? r2(r.sales / r.orders) : 0 }))
    .sort((a, b) => b.sales - a.sales);
}

export interface CashierPerf {
  user_id: string;
  payments: number;
  collected: number;
  refunds: number;
  net: number;
}

export function cashierPerformance(payments: Payment[]): CashierPerf[] {
  const map = new Map<string, CashierPerf>();
  for (const p of payments) {
    if (!p.cashier_id || p.status !== 'succeeded') continue;
    const row = map.get(p.cashier_id) ?? { user_id: p.cashier_id, payments: 0, collected: 0, refunds: 0, net: 0 };
    if (p.kind === 'payment') {
      row.payments += 1;
      row.collected = r2(row.collected + n(p.amount));
    } else row.refunds = r2(row.refunds + n(p.amount));
    row.net = r2(row.collected - row.refunds);
    map.set(p.cashier_id, row);
  }
  return [...map.values()].sort((a, b) => b.net - a.net);
}

export function tablePerformance(
  orders: Order[],
): { table_id: string; orders: number; sales: number; avg: number; guests: number }[] {
  const map = new Map<string, { table_id: string; orders: number; sales: number; avg: number; guests: number }>();
  for (const o of orders) {
    if (!o.table_id || o.status === 'cancelled') continue;
    const row = map.get(o.table_id) ?? { table_id: o.table_id, orders: 0, sales: 0, avg: 0, guests: 0 };
    row.orders += 1;
    row.sales = r2(row.sales + n(o.total));
    row.guests += n(o.guest_count);
    map.set(o.table_id, row);
  }
  return [...map.values()].map((r) => ({ ...r, avg: r2(r.sales / r.orders) })).sort((a, b) => b.sales - a.sales);
}

export function expenseByCategory(expenses: Expense[]): { category: string; count: number; amount: number }[] {
  const map = new Map<string, { category: string; count: number; amount: number }>();
  for (const e of expenses) {
    if (e.status !== 'approved' || e.archived_at) continue;
    const row = map.get(e.category) ?? { category: e.category, count: 0, amount: 0 };
    row.count += 1;
    row.amount = r2(row.amount + n(e.amount));
    map.set(e.category, row);
  }
  return [...map.values()].sort((a, b) => b.amount - a.amount);
}

export interface ProfitEstimate {
  netSalesExTax: number;
  refunds: number;
  costOfGoods: number;
  costCoveragePct: number; // share of item revenue with known cost
  grossProfit: number | null;
  expenses: number;
  netProfit: number | null;
  complete: boolean;
}

export function profitEstimate(
  orders: Order[],
  items: OrderItem[],
  refunds: number,
  expenses: Expense[],
): ProfitEstimate {
  const live = orders.filter((o) => o.status !== 'cancelled');
  const liveIds = new Set(live.map((o) => o.id));
  const netSalesExTax = r2(live.reduce((s, o) => s + n(o.total) - n(o.tax_amount), 0));
  let revenueWithCost = 0;
  let revenueAll = 0;
  let cogs = 0;
  for (const it of items) {
    if (it.is_voided || !liveIds.has(it.order_id)) continue;
    revenueAll += n(it.line_total);
    if (it.unit_cost !== null && it.unit_cost !== undefined) {
      revenueWithCost += n(it.line_total);
      cogs += n(it.unit_cost) * n(it.quantity);
    }
  }
  const coverage = revenueAll > 0 ? Math.round((revenueWithCost / revenueAll) * 1000) / 10 : 0;
  const exp = r2(
    expenses.filter((e) => e.status === 'approved' && !e.archived_at).reduce((s, e) => s + n(e.amount), 0),
  );
  const hasCost = revenueWithCost > 0;
  const gross = hasCost ? r2(netSalesExTax - refunds - cogs) : null;
  return {
    netSalesExTax,
    refunds: r2(refunds),
    costOfGoods: r2(cogs),
    costCoveragePct: coverage,
    grossProfit: gross,
    expenses: exp,
    netProfit: gross === null ? null : r2(gross - exp),
    complete: coverage === 100,
  };
}

export function inventoryValuation(items: InventoryItem[]): {
  value: number;
  lowStock: InventoryItem[];
  outOfStock: number;
} {
  const active = items.filter((i) => !i.archived_at);
  return {
    value: r2(active.reduce((s, i) => s + Math.max(n(i.quantity), 0) * n(i.unit_cost), 0)),
    lowStock: active
      .filter((i) => n(i.min_stock) > 0 && n(i.quantity) <= n(i.min_stock))
      .sort((a, b) => n(a.quantity) / Math.max(n(a.min_stock), 1e-9) - n(b.quantity) / Math.max(n(b.min_stock), 1e-9)),
    outOfStock: active.filter((i) => n(i.quantity) <= 0).length,
  };
}

export function popularProducts(items: OrderItem[], limit = 5): { name: string; quantity: number; revenue: number }[] {
  const map = new Map<string, { name: string; quantity: number; revenue: number }>();
  for (const it of items) {
    if (it.is_voided) continue;
    const row = map.get(it.product_id) ?? { name: it.product_name, quantity: 0, revenue: 0 };
    row.quantity += n(it.quantity);
    row.revenue = r2(row.revenue + n(it.line_total));
    map.set(it.product_id, row);
  }
  return [...map.values()].sort((a, b) => b.quantity - a.quantity).slice(0, limit);
}
