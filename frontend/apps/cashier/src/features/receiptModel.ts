import type { Order, OrderItem, Payment, Restaurant } from '@sombill/shared-types/types';
import { PAYMENT_METHOD_LABEL, ORDER_TYPE_LABEL } from '@sombill/shared-utils/format';

export type DocKind = 'receipt' | 'bill' | 'transaction';
export interface ReceiptData {
  kind: DocKind;
  restaurant: Pick<
    Restaurant,
    'name' | 'address' | 'phone' | 'currency' | 'timezone' | 'tax_label' | 'receipt_header' | 'receipt_footer'
  >;
  order: Pick<
    Order,
    | 'order_number'
    | 'order_type'
    | 'subtotal'
    | 'discount_amount'
    | 'tax_amount'
    | 'total'
    | 'amount_paid'
    | 'amount_refunded'
    | 'tax_rate'
    | 'tax_inclusive'
    | 'created_at'
  >;
  items: Pick<OrderItem, 'product_name' | 'quantity' | 'unit_price' | 'line_total' | 'is_voided'>[];
  payments: Pick<
    Payment,
    | 'kind'
    | 'status'
    | 'method'
    | 'amount'
    | 'reference'
    | 'transaction_number'
    | 'amount_received'
    | 'change_given'
    | 'created_at'
  >[];
  receiptNumber: number | null;
  cashierName: string;
  tableNumber: number | null;
  printedAt: Date;
  reprint?: number;
}

const money = (n: number, cur: string) => {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur, currencyDisplay: 'narrowSymbol' }).format(
      n,
    );
  } catch {
    return `${cur} ${n.toFixed(2)}`;
  }
};

export function totals(d: ReceiptData) {
  const ok = d.payments.filter((p) => p.status === 'succeeded');
  const paid = ok.filter((p) => p.kind === 'payment').reduce((s, p) => s + Number(p.amount), 0);
  const refunded = ok.filter((p) => p.kind === 'refund').reduce((s, p) => s + Number(p.amount), 0);
  const pending = d.payments
    .filter((p) => p.kind === 'payment' && p.status === 'pending')
    .reduce((s, p) => s + Number(p.amount), 0);
  const balance = Math.max(Number(d.order.total) - (paid - refunded), 0);
  return { paid, refunded, pending, balance: Math.round(balance * 100) / 100 };
}

/** Plain-text lines (fixed width) used for ESC/POS printing. 48 columns ≈ 80mm Font A. */
export function receiptText(
  d: ReceiptData,
  width = 48,
): Array<{ text: string; align?: 'left' | 'center'; bold?: boolean; big?: boolean }> {
  const cur = d.restaurant.currency;
  const m = (n: number) => money(n, cur).replace(/[^\x20-\x7E]/g, cur === 'USD' ? '$' : '');
  const lr = (l: string, r: string) => {
    const space = width - r.length;
    return (l.length > space - 1 ? l.slice(0, space - 2) + '.' : l).padEnd(space) + r;
  };
  const rule = '-'.repeat(width);
  const t = totals(d);
  const title = d.kind === 'receipt' ? 'RECEIPT' : d.kind === 'bill' ? 'BILL (NOT A RECEIPT)' : 'TRANSACTION RECORD';
  const when = new Intl.DateTimeFormat('en-GB', {
    timeZone: d.restaurant.timezone,
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(d.printedAt);
  const out: Array<{ text: string; align?: 'left' | 'center'; bold?: boolean; big?: boolean }> = [
    { text: d.restaurant.name, align: 'center', bold: true, big: true },
    ...(d.restaurant.address ? [{ text: d.restaurant.address, align: 'center' as const }] : []),
    ...(d.restaurant.phone ? [{ text: d.restaurant.phone, align: 'center' as const }] : []),
    ...(d.restaurant.receipt_header ? [{ text: d.restaurant.receipt_header, align: 'center' as const }] : []),
    { text: rule },
    { text: title + (d.reprint && d.reprint > 1 ? ' (REPRINT)' : ''), align: 'center', bold: true },
    ...(d.receiptNumber ? [{ text: lr('Receipt #', String(d.receiptNumber)) }] : []),
    { text: lr('Order #', String(d.order.order_number)) },
    { text: lr('Date', when) },
    { text: lr('Cashier', d.cashierName) },
    {
      text: lr(
        d.tableNumber ? 'Table' : 'Type',
        d.tableNumber ? String(d.tableNumber) : ORDER_TYPE_LABEL[d.order.order_type],
      ),
    },
    { text: rule },
  ];
  for (const it of d.items.filter((i) => !i.is_voided)) {
    out.push({ text: it.product_name.slice(0, width) });
    out.push({ text: lr(`  ${Number(it.quantity)} x ${m(Number(it.unit_price))}`, m(Number(it.line_total))) });
  }
  out.push({ text: rule }, { text: lr('Subtotal', m(Number(d.order.subtotal))) });
  if (Number(d.order.discount_amount) > 0) out.push({ text: lr('Discount', '-' + m(Number(d.order.discount_amount))) });
  out.push({
    text: lr(
      `${d.restaurant.tax_label} ${(Number(d.order.tax_rate) * 100).toFixed(0)}%${d.order.tax_inclusive ? ' (incl.)' : ''}`,
      m(Number(d.order.tax_amount)),
    ),
  });
  out.push({ text: lr('TOTAL', m(Number(d.order.total))), bold: true });
  if (d.kind !== 'bill') {
    out.push({ text: rule });
    for (const p of d.payments.filter((x) => x.status !== 'failed')) {
      const label = `${p.kind === 'refund' ? 'Refund ' : ''}${PAYMENT_METHOD_LABEL[p.method]}${p.status === 'pending' ? ' (unverified)' : ''}`;
      out.push({ text: lr(label, (p.kind === 'refund' ? '-' : '') + m(Number(p.amount))) });
      if (p.reference) out.push({ text: `  Ref ${p.reference}`.slice(0, width) });
      if (p.amount_received != null)
        out.push(
          { text: lr('  Cash received', m(Number(p.amount_received))) },
          { text: lr('  Change', m(Number(p.change_given ?? 0))) },
        );
    }
    out.push({ text: lr('Amount paid', m(t.paid - t.refunded)) });
    if (t.pending > 0) out.push({ text: lr('Awaiting verification', m(t.pending)) });
    out.push({ text: lr('Balance due', m(t.balance)), bold: true });
  }
  out.push({ text: rule });
  out.push({ text: d.restaurant.receipt_footer || 'Thank you!', align: 'center' });
  out.push({ text: 'SomBill POS - Trusted Hospitality Partner', align: 'center' });
  return out;
}
