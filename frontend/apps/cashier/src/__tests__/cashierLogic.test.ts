import { describe, expect, it } from 'vitest';
import {
  balances,
  cashierErrorMessage,
  cashSuggestions,
  checkLines,
  itemsRefundSuggestion,
  parseMoney,
  refundEligible,
  refundedQty,
  type PayLine,
} from '../features/payment';
import { computeCashierStats } from '../features/stats';
import { receiptText, totals, type ReceiptData } from '../features/receiptModel';
import { encodeReceipt, toAsciiBytes } from '../services/escpos';

const line = (p: Partial<PayLine>): PayLine => ({
  key: p.key ?? crypto.randomUUID(),
  method: 'cash',
  amount: '',
  reference: '',
  received: '',
  terminalConfirmed: false,
  ...p,
});

describe('money parsing', () => {
  it('accepts at most 2 decimals and rejects negatives and junk', () => {
    expect(parseMoney('12')).toBe(12);
    expect(parseMoney(' 12.50 ')).toBe(12.5);
    expect(parseMoney('-1')).toBeNull();
    expect(parseMoney('1.234')).toBeNull();
    expect(parseMoney('abc')).toBeNull();
    expect(parseMoney('')).toBeNull();
  });
});

describe('outstanding balance', () => {
  it('is computed from confirmed payments; pending mobile money is reserved but not collected', () => {
    const o = { total: 33, amount_paid: 10, amount_refunded: 0 };
    const b = balances(o, [
      { kind: 'payment', status: 'succeeded', amount: 10 },
      { kind: 'payment', status: 'pending', amount: 13 },
      { kind: 'payment', status: 'failed', amount: 99 },
    ]);
    expect(b).toEqual({ paid: 10, pending: 13, balance: 23, payable: 10 });
  });
  it('refunds reduce the net paid amount', () => {
    expect(balances({ total: 20, amount_paid: 20, amount_refunded: 5 }, []).balance).toBe(5);
  });
  it('never goes negative', () => {
    expect(balances({ total: 10, amount_paid: 12, amount_refunded: 0 }, []).balance).toBe(0);
  });
});

describe('payment line validation', () => {
  it('cash: change = received − amount; short cash is refused', () => {
    const ok = checkLines([line({ key: 'a', amount: '23.10', received: '30' })], 23.1);
    expect(ok.ok).toBe(true);
    expect(ok.change).toBe(6.9);
    expect(ok.payload).toEqual([{ method: 'cash', amount: 23.1, amount_received: 30 }]);
    const short = checkLines([line({ key: 'a', amount: '23.10', received: '20' })], 23.1);
    expect(short.ok).toBe(false);
    expect(short.errors.a).toMatch(/less than 23.10/);
  });
  it('rejects zero, negative and malformed amounts', () => {
    for (const amount of ['0', '-5', '5.555', 'x'])
      expect(checkLines([line({ key: 'a', amount })], 50).errors.a).toMatch(/greater than zero/);
  });
  it('card: needs the terminal transaction ID AND confirmation that the terminal approved', () => {
    expect(checkLines([line({ key: 'a', method: 'card', amount: '10' })], 10).errors.a).toMatch(
      /terminal transaction ID/,
    );
    expect(checkLines([line({ key: 'a', method: 'card', amount: '10', reference: 'TID-8841' })], 10).errors.a).toMatch(
      /APPROVED/,
    );
    const ok = checkLines(
      [line({ key: 'a', method: 'card', amount: '10', reference: 'TID-8841', terminalConfirmed: true })],
      10,
    );
    expect(ok.ok).toBe(true);
    expect(ok.payload[0]).toEqual({ method: 'card', amount: 10, reference: 'TID-8841', terminal_confirmed: true });
  });
  it.each(['evc_plus', 'zaad', 'somtel_money'] as const)(
    '%s: needs a reference and is marked awaiting verification',
    (method) => {
      expect(checkLines([line({ key: 'a', method, amount: '10' })], 10).errors.a).toMatch(/reference/);
      const ok = checkLines([line({ key: 'a', method, amount: '10', reference: 'EVC123456' })], 10);
      expect(ok.ok).toBe(true);
      expect(ok.awaitingVerification).toBe(10);
      expect(ok.payload[0]).toEqual({ method, amount: 10, reference: 'EVC123456' });
    },
  );
  it('the same mobile reference cannot appear twice in one payment', () => {
    const c = checkLines(
      [
        line({ key: 'a', method: 'zaad', amount: '5', reference: 'ZD-1111' }),
        line({ key: 'b', method: 'zaad', amount: '5', reference: 'zd-1111' }),
      ],
      10,
    );
    expect(c.errors.b).toMatch(/already in another line/);
  });
  it('split payment: lines add up, remaining is shown, overpayment is refused', () => {
    const split = checkLines(
      [
        line({ key: 'a', amount: '10' }),
        line({ key: 'b', method: 'card', amount: '5', reference: 'T1', terminalConfirmed: true }),
      ],
      23.1,
    );
    expect(split.errors.b).toMatch(/terminal transaction ID/); // a terminal ID shorter than 4 characters is refused
    const ok = checkLines(
      [
        line({ key: 'a', amount: '10' }),
        line({ key: 'b', method: 'card', amount: '5', reference: 'TID-0001', terminalConfirmed: true }),
      ],
      23.1,
    );
    expect(ok.ok).toBe(true);
    expect(ok.total).toBe(15);
    expect(ok.remainingAfter).toBe(8.1);
    const over = checkLines([line({ key: 'a', amount: '24' })], 23.1);
    expect(over.ok).toBe(false);
    expect(over.errors.form).toMatch(/only 23.10 is outstanding/);
  });
  it('nothing outstanding → nothing can be paid', () => {
    expect(checkLines([line({ key: 'a', amount: '1' })], 0).errors.form).toMatch(/Nothing is outstanding/);
  });
  it('quick-cash suggestions start at the exact amount', () => {
    expect(cashSuggestions(23.1)).toEqual([23.1, 24, 25, 30]);
    expect(cashSuggestions(0)).toEqual([]);
  });
});

describe('refund eligibility', () => {
  const pay = { id: 'p1', amount: 20, kind: 'payment' as const, status: 'succeeded' as const };
  it('subtracts completed and pending refunds, ignores rejected ones', () => {
    expect(
      refundEligible(pay, [
        { payment_id: 'p1', status: 'completed', amount: 5 },
        { payment_id: 'p1', status: 'pending_approval', amount: 3 },
        { payment_id: 'p1', status: 'rejected', amount: 10 },
        { payment_id: 'p2', status: 'completed', amount: 9 },
      ]),
    ).toBe(12);
  });
  it('pending or failed payments cannot be refunded', () => {
    expect(refundEligible({ ...pay, status: 'pending' }, [])).toBe(0);
    expect(refundEligible({ ...pay, kind: 'refund' }, [])).toBe(0);
  });
  it('item value includes tax and discount share; refunded quantities are tracked', () => {
    expect(itemsRefundSuggestion({ subtotal: 20, total: 22 }, [{ id: 'i1', unit_price: 10 }], { i1: 1 })).toBe(11);
    expect(
      refundedQty(
        [
          { status: 'completed', items: [{ order_item_id: 'i1', quantity: 1 }] },
          { status: 'rejected', items: [{ order_item_id: 'i1', quantity: 5 }] },
        ],
        'i1',
      ),
    ).toBe(1);
  });
  it('friendly server errors', () => {
    expect(cashierErrorMessage('NO_OPEN_SHIFT')).toMatch(/Open your cash shift/);
    expect(cashierErrorMessage('DUPLICATE_REFERENCE: zaad ZD-1 already used')).toMatch(
      /^Duplicate reference: zaad ZD-1 already used/,
    );
    expect(cashierErrorMessage('REFUND_EXCEEDS: at most 5.00 can be refunded')).toBe(
      'Too much: at most 5.00 can be refunded.',
    );
    expect(cashierErrorMessage('ALREADY_SETTLED')).toMatch(/already settled/);
  });
});

describe('dashboard figures', () => {
  it('never counts unpaid orders or unverified mobile money as collected', () => {
    const s = computeCashierStats(
      [
        { total: 30, status: 'completed', payment_status: 'paid' },
        { total: 20, status: 'served', payment_status: 'partial' },
        { total: 15, status: 'new', payment_status: 'unpaid' },
        { total: 99, status: 'cancelled', payment_status: 'unpaid' },
      ],
      [
        { kind: 'payment', status: 'succeeded', method: 'cash', amount: 20 },
        { kind: 'payment', status: 'succeeded', method: 'card', amount: 10 },
        { kind: 'payment', status: 'succeeded', method: 'evc_plus', amount: 5 },
        { kind: 'payment', status: 'pending', method: 'zaad', amount: 7 },
        { kind: 'payment', status: 'failed', method: 'somtel_money', amount: 50 },
        { kind: 'refund', status: 'succeeded', method: 'cash', amount: 4 },
      ],
    );
    expect(s).toMatchObject({
      grossSales: 65,
      collected: 35,
      cash: 20,
      card: 10,
      mobile: 5,
      pendingVerification: 7,
      refunds: 4,
      net: 31,
      paidOrders: 1,
      partialOrders: 1,
      unpaidOrders: 1,
      activeOrders: 2,
      transactions: 3,
      avgTransaction: 11.67,
    });
  });
});

const receipt = (over: Partial<ReceiptData> = {}): ReceiptData => ({
  kind: 'receipt',
  restaurant: {
    name: 'Hargeisa Grill',
    address: 'Road 1',
    phone: '+252 63',
    currency: 'USD',
    timezone: 'Africa/Mogadishu',
    tax_label: 'VAT',
    receipt_header: null,
    receipt_footer: 'Mahadsanid!',
  },
  order: {
    order_number: 42,
    order_type: 'dine_in',
    subtotal: 21,
    discount_amount: 0,
    tax_amount: 2.1,
    total: 23.1,
    amount_paid: 23.1,
    amount_refunded: 0,
    tax_rate: 0.1,
    tax_inclusive: false,
    created_at: '2026-11-21T09:00:00Z',
  },
  items: [
    {
      product_name: 'Bariis iyo Hilib — extra long product name that must be cut',
      quantity: 1,
      unit_price: 12,
      line_total: 12,
      is_voided: false,
    },
    { product_name: 'Voided', quantity: 1, unit_price: 9, line_total: 9, is_voided: true },
    { product_name: 'Shaah', quantity: 6, unit_price: 1.5, line_total: 9, is_voided: false },
  ],
  payments: [
    {
      kind: 'payment',
      status: 'succeeded',
      method: 'cash',
      amount: 10,
      reference: null,
      transaction_number: 7,
      amount_received: 20,
      change_given: 10,
      created_at: '',
    },
    {
      kind: 'payment',
      status: 'pending',
      method: 'evc_plus',
      amount: 13.1,
      reference: 'EVC998877',
      transaction_number: 8,
      amount_received: null,
      change_given: null,
      created_at: '',
    },
  ],
  receiptNumber: 5,
  cashierName: 'Cali Cashier',
  tableNumber: 5,
  printedAt: new Date('2026-11-21T10:00:00Z'),
  ...over,
});

describe('80mm receipt text', () => {
  it('every line fits in 48 columns (80mm Font A), voided items are left out', () => {
    const lines = receiptText(receipt());
    for (const l of lines.filter((x) => !x.big)) expect(l.text.length).toBeLessThanOrEqual(48);
    const text = lines.map((l) => l.text).join('\n');
    expect(text).toContain('RECEIPT');
    expect(text).toContain('Receipt #');
    expect(text).not.toContain('Voided');
    expect(text).toMatch(/TOTAL\s+\$23\.10/);
    expect(text).toMatch(/Cash received\s+\$20\.00/);
    expect(text).toMatch(/Change\s+\$10\.00/);
  });
  it('unverified mobile money is shown as such and not counted as paid', () => {
    const text = receiptText(receipt())
      .map((l) => l.text)
      .join('\n');
    expect(text).toMatch(/EVC Plus \(unverified\)/);
    expect(text).toMatch(/Amount paid\s+\$10\.00/);
    expect(text).toMatch(/Awaiting verification\s+\$13\.10/);
    expect(text).toMatch(/Balance due\s+\$13\.10/);
    expect(totals(receipt())).toEqual({ paid: 10, refunded: 0, pending: 13.1, balance: 13.1 });
  });
  it('a bill is clearly not a receipt and lists no payments; reprints are marked', () => {
    const bill = receiptText(receipt({ kind: 'bill', receiptNumber: null }))
      .map((l) => l.text)
      .join('\n');
    expect(bill).toContain('BILL (NOT A RECEIPT)');
    expect(bill).not.toContain('Amount paid');
    expect(
      receiptText(receipt({ reprint: 2 }))
        .map((l) => l.text)
        .join('\n'),
    ).toContain('RECEIPT (REPRINT)');
  });
});

describe('ESC/POS encoding (bytes only — not tested on a physical printer)', () => {
  it('starts with initialise, ends with feed + partial cut, uses printable ASCII only', () => {
    const bytes = [...encodeReceipt(receipt())];
    expect(bytes.slice(0, 2)).toEqual([0x1b, 0x40]);
    expect(bytes.slice(-4)).toEqual([0x1d, 0x56, 0x42, 0x00]);
    expect(bytes).toContain(0x0a);
  });
  it('replaces characters thermal printers cannot print', () => {
    expect(toAsciiBytes('Café — ok')).toEqual([...'Cafe ? ok'].map((c) => c.charCodeAt(0)));
  });
});
