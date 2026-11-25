import { useState } from 'react';
import { ORDER_TYPE_LABEL, PAYMENT_METHOD_LABEL } from '@sombill/shared-utils/format';
import { totals, type ReceiptData } from '../features/receiptModel';

const fmt = (n: number, cur: string) => {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur, currencyDisplay: 'narrowSymbol' }).format(
      n,
    );
  } catch {
    return `${cur} ${n.toFixed(2)}`;
  }
};

/** 80mm thermal layout (72mm printable). Used for preview and printing. */
export function ReceiptView({ d }: { d: ReceiptData }) {
  const [logoOk, setLogoOk] = useState(true);
  const m = (n: number) => fmt(n, d.restaurant.currency);
  const t = totals(d);
  const when = new Intl.DateTimeFormat('en-GB', {
    timeZone: d.restaurant.timezone,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(d.printedAt);
  const Row = ({ l, r, b }: { l: string; r: string; b?: boolean }) => (
    <div className={`flex justify-between gap-2 ${b ? 'font-bold' : ''}`}>
      <span className="min-w-0 break-words">{l}</span>
      <span className="shrink-0 tabular-nums">{r}</span>
    </div>
  );
  return (
    <div
      className="receipt mx-auto w-[72mm] bg-white px-[3mm] py-[4mm] font-mono text-[11.5px] leading-[1.35] text-black"
      data-testid="receipt"
    >
      <div className="text-center">
        {logoOk && (
          <img
            src="/branding/sombill-logo.png"
            alt="SomBill"
            className="mx-auto mb-1 h-10 w-auto object-contain grayscale"
            onError={() => setLogoOk(false)}
          />
        )}
        <p className="text-[14px] font-bold">{d.restaurant.name}</p>
        {d.restaurant.address && <p>{d.restaurant.address}</p>}
        {d.restaurant.phone && <p>Tel {d.restaurant.phone}</p>}
        {d.restaurant.receipt_header && <p>{d.restaurant.receipt_header}</p>}
      </div>
      <hr className="my-2 border-dashed border-black" />
      <p className="text-center font-bold">
        {d.kind === 'receipt' ? 'RECEIPT' : d.kind === 'bill' ? 'BILL — NOT A RECEIPT' : 'TRANSACTION RECORD'}
        {d.reprint && d.reprint > 1 ? ' (REPRINT)' : ''}
      </p>
      {d.receiptNumber !== null && <Row l="Receipt #" r={String(d.receiptNumber)} />}
      <Row l="Order #" r={String(d.order.order_number)} />
      <Row l="Date" r={when} />
      <Row l="Cashier" r={d.cashierName} />
      <Row
        l={d.tableNumber ? 'Table' : 'Type'}
        r={d.tableNumber ? String(d.tableNumber) : ORDER_TYPE_LABEL[d.order.order_type]}
      />
      <hr className="my-2 border-dashed border-black" />
      <div className="mb-1 flex justify-between font-bold">
        <span>Item</span>
        <span>Total</span>
      </div>
      {d.items
        .filter((i) => !i.is_voided)
        .map((it, i) => (
          <div key={i} className="mb-1">
            <p className="break-words">{it.product_name}</p>
            <Row l={`  ${Number(it.quantity)} × ${m(Number(it.unit_price))}`} r={m(Number(it.line_total))} />
          </div>
        ))}
      <hr className="my-2 border-dashed border-black" />
      <Row l="Subtotal" r={m(Number(d.order.subtotal))} />
      {Number(d.order.discount_amount) > 0 && <Row l="Discount" r={`−${m(Number(d.order.discount_amount))}`} />}
      <Row
        l={`${d.restaurant.tax_label} ${(Number(d.order.tax_rate) * 100).toFixed(0)}%${d.order.tax_inclusive ? ' (incl.)' : ''}`}
        r={m(Number(d.order.tax_amount))}
      />
      <div className="mt-1 text-[14px]">
        <Row l="TOTAL" r={m(Number(d.order.total))} b />
      </div>
      {d.kind !== 'bill' && (
        <>
          <hr className="my-2 border-dashed border-black" />
          {d.payments
            .filter((p) => p.status !== 'failed')
            .map((p, i) => (
              <div key={i} className="mb-1">
                <Row
                  l={`${p.kind === 'refund' ? 'Refund · ' : ''}${PAYMENT_METHOD_LABEL[p.method]}${p.status === 'pending' ? ' (unverified)' : ''}`}
                  r={`${p.kind === 'refund' ? '−' : ''}${m(Number(p.amount))}`}
                />
                {p.reference && <p className="pl-2">Ref {p.reference}</p>}
                {p.transaction_number != null && <p className="pl-2">Txn #{p.transaction_number}</p>}
                {p.amount_received != null && (
                  <>
                    <Row l="  Cash received" r={m(Number(p.amount_received))} />
                    <Row l="  Change" r={m(Number(p.change_given ?? 0))} />
                  </>
                )}
              </div>
            ))}
          <Row l="Amount paid" r={m(t.paid - t.refunded)} />
          {t.pending > 0 && <Row l="Awaiting verification" r={m(t.pending)} />}
          <Row l="Balance due" r={m(t.balance)} b />
        </>
      )}
      <hr className="my-2 border-dashed border-black" />
      <p className="text-center">{d.restaurant.receipt_footer || 'Thank you!'}</p>
      <p className="mt-1 text-center text-[10px]">SomBill POS · Trusted Hospitality Partner</p>
    </div>
  );
}
