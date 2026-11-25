import { useState } from 'react';
import { useAuth, useRestaurant } from '@sombill/shared-hooks/AuthContext';
import { supabase, friendlyError } from '@sombill/api-client/supabase';
import {
  formatDateTime,
  formatMoney,
  ORDER_STATUS_LABEL,
  ORDER_TYPE_LABEL,
  PAYMENT_METHOD_LABEL,
} from '@sombill/shared-utils/format';
import { cn } from '@sombill/shared-utils/cn';
import { Badge } from '@sombill/shared-ui/ui/Feedback';
import { Button } from '@sombill/shared-ui/ui/Button';
import { useToast } from '@sombill/shared-ui/ui/Toast';
import type { OrderBundle } from '../services/data';
import { balances, cashierErrorMessage, parseMoney, VERIFICATION_LABEL } from '../features/payment';

/** Bill breakdown. All balances are computed from recorded payments. */
export function BillDetail({
  bundle,
  waiterName,
  onChanged,
}: {
  bundle: OrderBundle;
  waiterName?: string;
  onChanged?: () => void;
}) {
  const r = useRestaurant();
  const money = (n: number) => formatMoney(n, r.currency);
  const { order: o, items, payments, table, customer } = bundle;
  const b = balances(o, payments);
  return (
    <div className="space-y-4" data-testid="bill-detail">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-slate-500">{table ? 'Table' : 'Type'}</dt>
          <dd className="font-semibold">{table ? table.table_number : ORDER_TYPE_LABEL[o.order_type]}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Waiter</dt>
          <dd className="font-semibold">{waiterName ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Customer</dt>
          <dd className="truncate font-semibold">{customer?.name ?? 'Walk-in'}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Preparation</dt>
          <dd className="font-semibold">{ORDER_STATUS_LABEL[o.status]}</dd>
        </div>
      </dl>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-slate-500">
              <th className="py-2 font-semibold">Item</th>
              <th className="py-2 text-right font-semibold">Qty</th>
              <th className="py-2 text-right font-semibold">Unit</th>
              <th className="py-2 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {items.map((i) => (
              <tr key={i.id} className={cn(i.is_voided && 'text-slate-400 line-through')}>
                <td className="py-2">
                  {i.product_name}
                  {i.notes && <span className="block text-xs text-brand-orange no-underline">↳ {i.notes}</span>}
                </td>
                <td className="py-2 text-right tabular-nums">{Number(i.quantity)}</td>
                <td className="py-2 text-right tabular-nums">{money(i.unit_price)}</td>
                <td className="py-2 text-right tabular-nums">{money(i.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl className="space-y-1 border-t border-slate-100 pt-3 text-sm" aria-label="Bill totals">
        <Line l="Subtotal" r={money(o.subtotal)} testid="bill-subtotal" />
        {Number(o.discount_amount) > 0 && (
          <Line l="Discount" r={`−${money(o.discount_amount)}`} testid="bill-discount" />
        )}
        <Line
          l={`${r.tax_label} ${(Number(o.tax_rate) * 100).toFixed(0)}%${o.tax_inclusive ? ' (incl.)' : ''}`}
          r={money(o.tax_amount)}
          testid="bill-tax"
        />
        <Line l="Grand total" r={money(o.total)} bold testid="bill-total" />
        <Line l="Amount paid" r={money(b.paid)} testid="bill-paid" />
        {b.pending > 0 && <Line l="Awaiting verification" r={money(b.pending)} />}
        <Line l="Outstanding balance" r={money(b.balance)} bold testid="bill-balance" />
      </dl>
      {payments.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100 text-sm" aria-label="Payments">
          {payments.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <span className="min-w-0">
                #{p.transaction_number ?? '—'} · {p.kind === 'refund' ? 'Refund · ' : ''}
                {PAYMENT_METHOD_LABEL[p.method]}
                {p.reference ? ` · ${p.reference}` : ''}
                <span className="block text-xs text-slate-500">{formatDateTime(p.created_at, r.timezone)}</span>
              </span>
              <span className="flex items-center gap-2">
                {p.status !== 'succeeded' || p.verification_status === 'verified' ? (
                  <Badge tone={p.status === 'pending' ? 'yellow' : p.status === 'failed' ? 'red' : 'green'}>
                    {VERIFICATION_LABEL[p.verification_status ?? 'not_required']}
                  </Badge>
                ) : null}
                <b
                  className={cn(
                    'tabular-nums',
                    p.kind === 'refund' && 'text-brand-red',
                    p.status === 'failed' && 'line-through opacity-60',
                  )}
                >
                  {p.kind === 'refund' ? '−' : ''}
                  {money(p.amount)}
                </b>
              </span>
            </li>
          ))}
        </ul>
      )}
      {onChanged && <DiscountForm bundle={bundle} onChanged={onChanged} />}
    </div>
  );
}

function Line({ l, r: right, bold, testid }: { l: string; r: string; bold?: boolean; testid?: string }) {
  return (
    <div className={cn('flex justify-between gap-2', bold && 'text-base font-bold text-brand-navy')}>
      <dt className={bold ? '' : 'text-slate-500'}>{l}</dt>
      <dd className="tabular-nums" data-testid={testid}>
        {right}
      </dd>
    </div>
  );
}

/** Authorised discount (before any payment). Limits enforced by apply_discount(). */
function DiscountForm({ bundle, onChanged }: { bundle: OrderBundle; onChanged: () => void }) {
  const r = useRestaurant();
  const { role } = useAuth();
  const toast = useToast();
  const o = bundle.order;
  const [amount, setAmount] = useState(Number(o.discount_amount) > 0 ? String(o.discount_amount) : '');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const anyPayment = bundle.payments.some((p) => p.kind === 'payment' && p.status !== 'failed');
  if (anyPayment || o.status === 'completed' || o.status === 'cancelled') return null;
  const save = async () => {
    const v = parseMoney(amount || '0');
    if (v === null) {
      setErr('Enter a valid amount');
      return;
    }
    setBusy(true);
    setErr(null);
    const { error } = await supabase.rpc('apply_discount', {
      p_order: o.id,
      p_amount: v,
      p_reason: reason.trim(),
    });
    setBusy(false);
    if (error) {
      setErr(cashierErrorMessage(friendlyError(error)));
      return;
    }
    toast.success(v > 0 ? `Discount ${formatMoney(v, r.currency)} applied.` : 'Discount removed.');
    onChanged();
  };
  return (
    <details className="rounded-xl border border-slate-200 p-3">
      <summary className="cursor-pointer text-sm font-semibold text-brand-navy">
        Apply discount{' '}
        {role === 'cashier' && (
          <span className="font-normal text-slate-500">
            (up to {r.settings.permissions.cashier_max_discount_percent}%)
          </span>
        )}
      </summary>
      <div className="mt-3 grid grid-cols-[110px_1fr_auto] items-end gap-2">
        <label>
          <span className="label">Amount</span>
          <input
            className="input h-11"
            inputMode="decimal"
            aria-label="Bill discount amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <label>
          <span className="label">Reason</span>
          <input
            className="input h-11"
            aria-label="Bill discount reason"
            value={reason}
            maxLength={200}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        <Button className="h-11" variant="navy" loading={busy} onClick={() => void save()}>
          Apply
        </Button>
      </div>
      {err && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {err}
        </p>
      )}
    </details>
  );
}
