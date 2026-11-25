import { describe, expect, it } from 'vitest';
import {
  billState,
  canActOnOrder,
  canAddItems,
  canCancelBill,
  canRequestBill,
  canServe,
  clampQty,
  computeTotals,
  lineTotal,
  posErrorMessage,
} from '@sombill/shared-utils/posRules';
import { restaurant } from '@sombill/shared-utils/testing/fixtures';
import type { Order } from '@sombill/shared-types/types';

const S = restaurant.settings;
const W = 'waiter-1';
const order = (p: Partial<Order> = {}) =>
  ({
    waiter_id: W,
    status: 'served',
    total: 30.9,
    amount_paid: 0,
    amount_refunded: 0,
    bill_requested_at: null,
    bill_acknowledged_at: null,
    payment_status: 'unpaid',
    ...p,
  }) as Order;

describe('totals preview matches the database (recalc_order_totals)', () => {
  it('exclusive tax, exempt items untaxed — same numbers as the SQL acceptance test', () => {
    const t = computeTotals(
      [
        { quantity: 2, unit_price: 12, tax_exempt: false },
        { quantity: 3, unit_price: 1.5, tax_exempt: true },
      ],
      0.1,
      false,
    );
    expect(t).toEqual({ subtotal: 28.5, taxable: 24, tax: 2.4, total: 30.9 });
  });
  it('inclusive tax is extracted from the price', () => {
    const t = computeTotals([{ quantity: 1, unit_price: 11, tax_exempt: false }], 0.1, true);
    expect(t).toEqual({ subtotal: 11, taxable: 11, tax: 1, total: 11 });
  });
  it('applies discounts proportionally to the taxable base', () => {
    const t = computeTotals([{ quantity: 1, unit_price: 20, tax_exempt: false }], 0.1, false, 5);
    expect(t).toEqual({ subtotal: 20, taxable: 15, tax: 1.5, total: 16.5 });
  });
  it('rounds per line like NUMERIC(12,2)', () => {
    expect(lineTotal(3, 0.335)).toBe(1.01);
    expect(computeTotals([], 0.1, false)).toEqual({ subtotal: 0, taxable: 0, tax: 0, total: 0 });
  });
  it('clamps quantities to whole numbers 1–999', () => {
    expect([clampQty(0), clampQty(-4), clampQty(2.7), clampQty(5000), clampQty(Number.NaN)]).toEqual([1, 1, 2, 999, 1]);
  });
});

describe('server error mapping', () => {
  it('turns RPC errors into waiter guidance', () => {
    expect(posErrorMessage('PRICE_CHANGED: "Shaah" now costs 2.00')).toMatchObject({
      kind: 'price',
      message: expect.stringContaining('"Shaah" now costs 2.00'),
    });
    expect(posErrorMessage('PRODUCT_UNAVAILABLE: "Suqaar" is no longer available').kind).toBe('unavailable');
    expect(posErrorMessage('TABLE_OCCUPIED: Table 4 already has an active order')).toMatchObject({
      kind: 'occupied',
      message: expect.stringContaining('Table 4'),
    });
    expect(posErrorMessage('Network error').kind).toBe('other');
  });
});

describe('order permissions mirror the database', () => {
  it('waiters act on their own orders only, unless permitted', () => {
    expect(canActOnOrder(order(), W, 'waiter', S)).toBe(true);
    expect(canActOnOrder(order({ waiter_id: 'other' }), W, 'waiter', S)).toBe(false);
    expect(
      canActOnOrder(order({ waiter_id: 'other' }), W, 'waiter', {
        ...S,
        permissions: { ...S.permissions, waiter_can_edit_others_orders: true },
      }),
    ).toBe(true);
    expect(canActOnOrder(order({ waiter_id: 'other' }), 'm', 'manager', S)).toBe(true);
    expect(canActOnOrder(order(), 'k', 'kitchen', S)).toBe(false);
  });
  it('items can be added only to eligible unpaid orders', () => {
    expect(canAddItems(order(), W, 'waiter', S)).toBe(true);
    expect(canAddItems(order({ amount_paid: 5 }), W, 'waiter', S)).toBe(false);
    expect(canAddItems(order({ bill_requested_at: 'x' }), W, 'waiter', S)).toBe(false);
    expect(canAddItems(order({ status: 'completed' }), W, 'waiter', S)).toBe(false);
  });
  it('bill request / cancel rules', () => {
    expect(canRequestBill(order(), W, 'waiter', S)).toBe(true);
    expect(canRequestBill(order({ total: 0 }), W, 'waiter', S)).toBe(false);
    expect(canRequestBill(order({ bill_requested_at: 'x' }), W, 'waiter', S)).toBe(false);
    expect(canCancelBill(order({ bill_requested_at: 'x' }), W, 'waiter', S)).toBe(true);
    expect(canCancelBill(order({ bill_requested_at: 'x', bill_acknowledged_at: 'y' }), W, 'waiter', S)).toBe(false);
    expect(canCancelBill(order({ bill_requested_at: 'x', amount_paid: 1 }), W, 'waiter', S)).toBe(false);
    expect(
      canCancelBill(order({ bill_requested_at: 'x' }), W, 'waiter', {
        ...S,
        permissions: { ...S.permissions, waiter_can_cancel_bill_request: false },
      }),
    ).toBe(false);
  });
  it('waiters serve only Ready orders', () => {
    expect(canServe(order({ status: 'ready' }), W, 'waiter', S)).toBe(true);
    expect(canServe(order({ status: 'preparing' }), W, 'waiter', S)).toBe(false);
    expect(canServe(order({ status: 'ready', waiter_id: 'other' }), W, 'waiter', S)).toBe(false);
  });
  it('bill state follows the cashier workflow', () => {
    expect(billState(order())).toBe('not_requested');
    expect(billState(order({ bill_requested_at: 'x' }))).toBe('requested');
    expect(billState(order({ bill_requested_at: 'x', bill_acknowledged_at: 'y' }))).toBe('processing');
    expect(billState(order({ amount_paid: 10, payment_status: 'partial' }))).toBe('partially_paid');
    expect(billState(order({ amount_paid: 30.9, payment_status: 'paid' }))).toBe('paid');
    expect(billState(order({ status: 'completed', payment_status: 'paid' }))).toBe('closed');
  });
});
