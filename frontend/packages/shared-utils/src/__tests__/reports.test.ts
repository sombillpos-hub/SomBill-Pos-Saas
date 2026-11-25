import { describe, expect, it } from 'vitest';
import {
  byPaymentMethod,
  cashierPerformance,
  categoryPerformance,
  expenseByCategory,
  inventoryValuation,
  orderBalance,
  popularProducts,
  productPerformance,
  profitEstimate,
  salesSeries,
  summarize,
  tablePerformance,
  waiterPerformance,
} from '../reports';
import type { Category, Expense, InventoryItem, Order, OrderItem, Payment, Product } from '@sombill/shared-types/types';

const order = (p: Partial<Order>): Order => ({
  id: crypto.randomUUID(),
  restaurant_id: 'r',
  order_number: 1,
  order_type: 'dine_in',
  status: 'completed',
  payment_status: 'paid',
  table_id: 't1',
  customer_id: null,
  waiter_id: 'w1',
  cashier_id: 'c1',
  tax_rate: 0.1,
  tax_inclusive: false,
  subtotal: 0,
  discount_amount: 0,
  tax_amount: 0,
  total: 0,
  amount_paid: 0,
  amount_refunded: 0,
  notes: null,
  guest_count: 2,
  bill_requested_at: null,
  bill_requested_by: null,
  bill_acknowledged_at: null,
  bill_acknowledged_by: null,
  completed_at: null,
  cancelled_at: null,
  cancelled_by: null,
  cancel_reason: null,
  stock_deducted_at: null,
  stock_reversed_at: null,
  created_by: null,
  created_at: '2026-11-20T09:00:00Z',
  updated_at: '2026-11-20T09:00:00Z',
  ...p,
});
const pay = (p: Partial<Payment>): Payment => ({
  id: crypto.randomUUID(),
  restaurant_id: 'r',
  order_id: 'o',
  kind: 'payment',
  method: 'cash',
  amount: 0,
  status: 'succeeded',
  reference: null,
  notes: null,
  cashier_id: 'c1',
  created_at: '2026-11-20T09:30:00Z',
  transaction_number: null,
  verification_status: 'not_required',
  verified_by: null,
  verified_at: null,
  verification_note: null,
  shift_id: null,
  amount_received: null,
  change_given: null,
  request_key: null,
  refund_of: null,
  ...p,
});
const item = (p: Partial<OrderItem>): OrderItem => ({
  id: crypto.randomUUID(),
  restaurant_id: 'r',
  order_id: 'o1',
  product_id: 'p1',
  product_name: 'Rice',
  quantity: 1,
  unit_price: 10,
  unit_cost: 4,
  tax_exempt: false,
  line_total: 10,
  notes: null,
  is_voided: false,
  void_reason: null,
  created_by: null,
  created_at: '',
  updated_at: '',
  ...p,
});

describe('summarize', () => {
  const orders = [
    order({ total: 28.4, tax_amount: 2.4, amount_paid: 28.4, discount_amount: 1 }),
    order({ total: 10, amount_paid: 4, status: 'served', payment_status: 'partial' }),
    order({ total: 50, status: 'cancelled', cancel_reason: 'x' }),
  ];
  const payments = [
    pay({ amount: 28.4 }),
    pay({ amount: 4, method: 'mobile_money' }),
    pay({ amount: 5, kind: 'refund' }),
    pay({ amount: 99, status: 'failed' }),
  ];
  const s = summarize(orders, payments);

  it('separates gross sales, collected, refunds and outstanding', () => {
    expect(s.grossSales).toBe(38.4);
    expect(s.collected).toBe(32.4);
    expect(s.refunds).toBe(5);
    expect(s.netCollected).toBe(27.4);
    expect(s.outstanding).toBe(6);
  });
  it('ignores failed payments and cancelled orders in money totals', () => {
    expect(s.collected).not.toBeGreaterThan(32.4);
    expect(s.grossSales).toBeLessThan(88.4);
  });
  it('counts orders by state and averages only live orders', () => {
    expect([s.totalOrders, s.completedOrders, s.cancelledOrders, s.pendingOrders]).toEqual([3, 1, 1, 1]);
    expect(s.avgOrderValue).toBe(19.2);
    expect(s.discounts).toBe(1);
    expect(s.taxCollected).toBe(2.4);
  });
  it('handles empty input', () => {
    expect(summarize([], []).avgOrderValue).toBe(0);
  });
});

describe('orderBalance', () => {
  it('accounts for refunds and never goes negative', () => {
    expect(orderBalance({ total: 20, amount_paid: 20, amount_refunded: 5, status: 'completed' })).toBe(5);
    expect(orderBalance({ total: 20, amount_paid: 25, amount_refunded: 0, status: 'completed' })).toBe(0);
    expect(orderBalance({ total: 20, amount_paid: 0, amount_refunded: 0, status: 'cancelled' })).toBe(0);
  });
});

describe('salesSeries', () => {
  it('buckets by restaurant-local day (EAT = UTC+3)', () => {
    // 22:30 UTC on the 19th is 01:30 on the 20th in Hargeisa
    const o = [
      order({ total: 10, created_at: '2026-11-19T22:30:00Z' }),
      order({ total: 5, created_at: '2026-11-20T10:00:00Z' }),
    ];
    const p = [
      pay({ amount: 10, created_at: '2026-11-19T22:31:00Z' }),
      pay({ amount: 2, kind: 'refund', created_at: '2026-11-20T11:00:00Z' }),
    ];
    const s = salesSeries(o, p, { from: '2026-11-19', to: '2026-11-20' }, 'Africa/Mogadishu', 'day');
    expect(s).toEqual([
      { key: '2026-11-19', label: '2026-11-19', sales: 0, collected: 0, orders: 0 },
      { key: '2026-11-20', label: '2026-11-20', sales: 15, collected: 8, orders: 2 },
    ]);
  });
  it('groups into ISO weeks and months', () => {
    const o = [
      order({ total: 1, created_at: '2026-11-02T09:00:00Z' }),
      order({ total: 2, created_at: '2026-11-10T09:00:00Z' }),
    ];
    const weeks = salesSeries(o, [], { from: '2026-11-02', to: '2026-11-15' }, 'UTC', 'week');
    expect(weeks.map((w) => [w.key, w.sales])).toEqual([
      ['2026-11-02', 1],
      ['2026-11-09', 2],
    ]);
    const months = salesSeries(o, [], { from: '2026-10-30', to: '2026-11-15' }, 'UTC', 'month');
    expect(months.map((m) => [m.key, m.sales])).toEqual([
      ['2026-10', 0],
      ['2026-11', 3],
    ]);
  });
});

describe('breakdowns', () => {
  it('payment methods net refunds per method', () => {
    const rows = byPaymentMethod([
      pay({ amount: 10 }),
      pay({ amount: 3, kind: 'refund' }),
      pay({ amount: 7, method: 'card' }),
    ]);
    expect(rows).toEqual([
      { method: 'cash', payments: 1, collected: 10, refunds: 3, net: 7 },
      { method: 'card', payments: 1, collected: 7, refunds: 0, net: 7 },
    ]);
  });
  it('product performance marks unknown cost instead of guessing', () => {
    const products = [
      { id: 'p1', name: 'Rice', category_id: 'c1' },
      { id: 'p2', name: 'Tea', category_id: null },
    ] as Product[];
    const cats = [{ id: 'c1', name: 'Mains' }] as Category[];
    const perf = productPerformance(
      [
        item({ quantity: 2, line_total: 20 }),
        item({ product_id: 'p2', product_name: 'Tea', unit_cost: null, line_total: 3 }),
        item({ is_voided: true, line_total: 100 }),
      ],
      products,
      cats,
    );
    expect(perf[0]).toMatchObject({
      name: 'Rice',
      category: 'Mains',
      quantity: 2,
      revenue: 20,
      cost: 8,
      profit: 12,
      margin: 60,
    });
    expect(perf[1]).toMatchObject({ name: 'Tea', category: 'Uncategorised', cost: null, profit: null });
    expect(categoryPerformance(perf).map((c) => [c.category, c.share])).toEqual([
      ['Mains', 87],
      ['Uncategorised', 13],
    ]);
  });
  it('staff and table performance', () => {
    const orders = [
      order({ total: 10 }),
      order({ total: 20, waiter_id: 'w2', table_id: 't2' }),
      order({ total: 5, status: 'cancelled', cancel_reason: 'x' }),
    ];
    expect(waiterPerformance(orders).map((w) => [w.user_id, w.orders, w.sales, w.cancelled])).toEqual([
      ['w2', 1, 20, 0],
      ['w1', 1, 10, 1],
    ]);
    expect(tablePerformance(orders).map((t) => [t.table_id, t.sales])).toEqual([
      ['t2', 20],
      ['t1', 10],
    ]);
    expect(cashierPerformance([pay({ amount: 5 }), pay({ amount: 2, kind: 'refund' })])).toEqual([
      { user_id: 'c1', payments: 1, collected: 5, refunds: 2, net: 3 },
    ]);
    expect(
      popularProducts([item({ quantity: 3 }), item({ product_id: 'p9', product_name: 'Tea', quantity: 5 })], 1),
    ).toEqual([{ name: 'Tea', quantity: 5, revenue: 10 }]);
  });
});

describe('profitEstimate', () => {
  const exp = [
    { status: 'approved', archived_at: null, amount: 5, category: 'Rent' },
    { status: 'pending', archived_at: null, amount: 100, category: 'Rent' },
  ] as Expense[];
  it('computes estimate with known costs and flags incomplete coverage', () => {
    const o = order({ id: 'o1', total: 33, tax_amount: 3 });
    const p = profitEstimate(
      [o],
      [item({ quantity: 2, line_total: 20, unit_cost: 4 }), item({ line_total: 10, unit_cost: null })],
      2,
      exp,
    );
    expect(p).toMatchObject({
      netSalesExTax: 30,
      costOfGoods: 8,
      grossProfit: 20,
      expenses: 5,
      netProfit: 15,
      complete: false,
    });
    expect(p.costCoveragePct).toBeCloseTo(66.7, 1);
    expect(expenseByCategory(exp)).toEqual([{ category: 'Rent', count: 1, amount: 5 }]);
  });
  it('returns null profit when no cost data exists', () => {
    const p = profitEstimate([order({ id: 'o1', total: 10 })], [item({ unit_cost: null })], 0, []);
    expect(p.grossProfit).toBeNull();
    expect(p.netProfit).toBeNull();
  });
});

describe('inventoryValuation', () => {
  it('values positive stock and lists low stock most urgent first', () => {
    const items = [
      { id: 'a', name: 'Rice', quantity: 10, unit_cost: 1.5, min_stock: 2, archived_at: null },
      { id: 'b', name: 'Goat', quantity: 1, unit_cost: 8, min_stock: 2, archived_at: null },
      { id: 'c', name: 'Oil', quantity: -1, unit_cost: 3, min_stock: 1, archived_at: null },
      { id: 'd', name: 'Old', quantity: 100, unit_cost: 1, min_stock: 0, archived_at: '2026-01-01' },
    ] as InventoryItem[];
    const v = inventoryValuation(items);
    expect(v.value).toBe(23);
    expect(v.lowStock.map((i) => i.id)).toEqual(['c', 'b']);
    expect(v.outOfStock).toBe(1);
  });
});
