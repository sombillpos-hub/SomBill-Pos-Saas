import { describe, expect, it } from 'vitest';
import { convert, fxFrom, sumConverted, formatConverted, secondary, trendPct } from '../features/lib/money';
import { bucketLabels, rangeFor } from '../features/lib/range';
import { classify, flagAll } from '../features/lib/risk';
import type { AuditRow } from '../features/types';

const fx = fxFrom({ reporting_currency: 'USD', fx_rates: { SLS: 11800 } });

describe('group money', () => {
  it('converts through USD both ways and refuses to guess a missing rate', () => {
    expect(convert(11800, 'SLS', 'USD', fx)).toBeCloseTo(1);
    expect(convert(2, 'USD', 'SLS', fx)).toBe(23600);
    expect(convert(5, 'USD', 'USD', fx)).toBe(5);
    expect(convert(5, 'EUR', 'USD', fx)).toBeNull();
  });
  it('totals in the reporting currency and keeps unconvertible amounts visible', () => {
    const rows = [
      { a: 10, c: 'USD' },
      { a: 11800, c: 'SLS' },
      { a: 7, c: 'EUR' },
    ];
    const t = sumConverted(
      rows,
      (r) => r.a,
      (r) => r.c,
      fx,
    );
    expect(t.total).toBeCloseTo(11);
    expect(t.unconverted).toEqual({ EUR: 7 });
    expect(formatConverted(t, fx)).toContain('+');
  });
  it('shows a second currency only when a rate exists, and a trend only against a real baseline', () => {
    expect(secondary(1, fx)).toBe('SLS 11,800');
    expect(secondary(1, fxFrom({ reporting_currency: 'USD', fx_rates: {} }))).toBeNull();
    expect(trendPct(120, 100)).toBeCloseTo(20);
    expect(trendPct(50, 0)).toBeNull();
  });
});

describe('time ranges', () => {
  const now = new Date(2026, 10, 22, 18, 40); // Sunday 22 Nov 2026
  it('today is one day cut into 24 hourly buckets', () => {
    const r = rangeFor('today', now);
    expect(r.to.getTime() - r.from.getTime()).toBe(86400000);
    expect(r.bucket).toBe('hour');
    expect(bucketLabels(r)).toHaveLength(24);
    expect(r.prevTo.getTime()).toBe(r.from.getTime());
  });
  it('the week starts on Saturday and lasts seven days', () => {
    const r = rangeFor('week', now);
    expect(r.from.getDay()).toBe(6);
    expect(r.from.getDate()).toBe(21);
    expect(bucketLabels(r)).toHaveLength(7);
  });
  it('month-to-date starts on the 1st; the year has 12 monthly buckets', () => {
    expect(rangeFor('mtd', now).from.getDate()).toBe(1);
    expect(bucketLabels(rangeFor('mtd', now))).toHaveLength(22);
    expect(bucketLabels(rangeFor('year', now))).toHaveLength(12);
  });
});

const row = (over: Partial<AuditRow>): AuditRow => ({
  id: 1,
  restaurant_id: 'r1',
  actor_id: 'u1',
  action: 'cancel',
  entity_type: 'orders',
  entity_id: null,
  old_data: null,
  new_data: null,
  reason: null,
  created_at: '2026-11-22T10:00:00Z',
  ...over,
});

describe('anti-fraud classification', () => {
  it('flags deletions as high and small cancellations as medium', () => {
    expect(classify(row({ action: 'delete', entity_type: 'products' }))?.risk).toBe('high');
    expect(classify(row({ action: 'cancel', reason: 'Guest left' }))?.risk).toBe('medium');
  });
  it('flags a drawer difference, high when it is 5% or more of expected cash', () => {
    expect(classify(row({ action: 'shift_close', new_data: { difference: 0, expected_cash: 100 } }))).toBeNull();
    expect(classify(row({ action: 'shift_close', new_data: { difference: -2, expected_cash: 100 } }))?.risk).toBe(
      'medium',
    );
    const f = classify(row({ action: 'shift_close', new_data: { difference: -10, expected_cash: 100 } }));
    expect(f?.risk).toBe('high');
    expect(f?.title).toMatch(/short/);
  });
  it('flags discounts at 15% or more of the subtotal, and ignores small ones', () => {
    expect(classify(row({ action: 'discount', new_data: { discount_amount: 2, subtotal: 100 } }))).toBeNull();
    expect(classify(row({ action: 'discount', new_data: { discount_amount: 20, subtotal: 100 } }))?.risk).toBe(
      'medium',
    );
    expect(classify(row({ action: 'discount', new_data: { discount_amount: 40, subtotal: 100 } }))?.risk).toBe('high');
  });
  it('refunds of 100 or more are high; routine actions are not flagged', () => {
    expect(classify(row({ action: 'refund', new_data: { amount: 150 } }))?.risk).toBe('high');
    expect(classify(row({ action: 'refund', new_data: { amount: 5 } }))?.risk).toBe('medium');
    expect(
      flagAll([row({ action: 'create' }), row({ id: 2, action: 'update' }), row({ id: 3, action: 'cancel' })]),
    ).toHaveLength(1);
  });
  it('gives every event a stable key for reviews', () => {
    expect(classify(row({ id: 42, action: 'cancel' }))?.key).toBe('audit:42');
  });
});

describe('payment mix', () => {
  it('shares takings by method and ignores refunds, failed and rejected payments', async () => {
    const { mixShares } = await import('../features/lib/mix');
    const row = (method: string, amount: number, over: Record<string, unknown> = {}) => ({
      restaurant_id: 'r1',
      method,
      kind: 'payment' as const,
      status: 'succeeded',
      verification_status: 'not_required',
      amount,
      txns: 1,
      ...over,
    });
    const { shares, total } = mixShares(
      [
        row('zaad', 64),
        row('cash', 8),
        row('evc_plus', 28),
        row('cash', 50, { kind: 'refund' }),
        row('card', 9, { status: 'failed' }),
        row('zaad', 5, { verification_status: 'rejected' }),
      ],
      () => 'USD',
      fx,
    );
    expect(total).toBe(100);
    expect(shares.map((s) => [s.method, Math.round(s.pct)])).toEqual([
      ['zaad', 64],
      ['evc_plus', 28],
      ['cash', 8],
    ]);
  });
});
