import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Banknote, CheckCircle2, CreditCard, Printer, Smartphone, Trash2 } from 'lucide-react';
import { useRestaurant } from '@sombill/shared-hooks/AuthContext';
import { supabase, friendlyError } from '@sombill/api-client/supabase';
import { formatMoney, ORDER_TYPE_LABEL } from '@sombill/shared-utils/format';
import { cn } from '@sombill/shared-utils/cn';
import { Button } from '@sombill/shared-ui/ui/Button';
import { useToast } from '@sombill/shared-ui/ui/Toast';
import type { OrderBundle } from '../services/data';
import {
  balances,
  cashierErrorMessage,
  cashSuggestions,
  checkLines,
  POS_METHODS,
  r2,
  type PayLine,
  type PosMethod,
} from '../features/payment';

export interface PaymentResult {
  payment_status: string;
  order_status: string;
  balance: number;
  change: number;
  paid: number;
  pending_verification: number;
  transaction_numbers: number[];
  awaiting_verification: boolean;
  duplicate: boolean;
  close: string | null;
}

const ICON = { cash: Banknote, card: CreditCard, mobile: Smartphone };

export function PaymentPanel({
  bundle,
  blocked,
  onRecorded,
  onPrintReceipt,
}: {
  bundle: OrderBundle;
  blocked: boolean;
  onRecorded: (r: PaymentResult) => void;
  onPrintReceipt: () => void;
}) {
  const r = useRestaurant();
  const toast = useToast();
  const money = (n: number) => formatMoney(n, r.currency);
  const { order: o, payments, table, customer } = bundle;
  const b = balances(o, payments);
  const [lines, setLines] = useState<PayLine[]>([]);
  const [key, setKey] = useState(() => crypto.randomUUID()); // one key per payment attempt; retries reuse it
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<PaymentResult | null>(null);
  const check = useMemo(() => checkLines(lines, b.payable), [lines, b.payable]);

  const addLine = (method: PosMethod) => {
    setDone(null);
    setError(null);
    const remaining = r2(Math.max(b.payable - lines.reduce((s, l) => s + (Number(l.amount) || 0), 0), 0));
    setLines((ls) => [
      ...ls,
      {
        key: crypto.randomUUID(),
        method,
        amount: remaining > 0 ? remaining.toFixed(2) : '',
        reference: '',
        received: '',
        terminalConfirmed: false,
      },
    ]);
  };
  const patch = (k: string, p: Partial<PayLine>) => setLines((ls) => ls.map((l) => (l.key === k ? { ...l, ...p } : l)));

  const confirm = async () => {
    if (inFlight.current || !check.ok || blocked) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    const { data, error: e } = await supabase.rpc('record_payments', {
      p_order: o.id,
      p_payments: check.payload,
      p_idempotency_key: key,
      p_close_order: true,
    });
    inFlight.current = false;
    setBusy(false);
    if (e) {
      setError(cashierErrorMessage(friendlyError(e)));
      return;
    }
    const res = data as unknown as PaymentResult;
    setDone(res);
    setLines([]);
    setKey(crypto.randomUUID());
    toast.success(
      res.payment_status === 'paid'
        ? `Order #${o.order_number} fully paid.`
        : res.awaiting_verification
          ? 'Payment recorded – mobile money awaiting verification.'
          : 'Partial payment recorded.',
    );
    onRecorded(res);
  };

  return (
    <div className="space-y-4" data-testid="payment-panel">
      <dl
        data-sb="pay-summary"
        className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-3"
      >
        <div>
          <dt className="text-xs text-slate-500">Order</dt>
          <dd className="font-bold">#{o.order_number}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">{table ? 'Table' : 'Type'}</dt>
          <dd className="font-semibold">{table ? table.table_number : ORDER_TYPE_LABEL[o.order_type]}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Customer</dt>
          <dd className="truncate font-semibold">{customer?.name ?? 'Walk-in'}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Total bill</dt>
          <dd className="font-semibold tabular-nums" data-testid="pp-total">
            {money(o.total)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Previously paid</dt>
          <dd className="font-semibold tabular-nums text-emerald-700" data-testid="pp-paid">
            {money(b.paid)}
          </dd>
        </div>
        {b.pending > 0 && (
          <div>
            <dt className="text-xs text-slate-500">Awaiting verification</dt>
            <dd className="font-semibold tabular-nums text-amber-700">{money(b.pending)}</dd>
          </div>
        )}
        <div className="col-span-2 sm:col-span-3">
          <dt className="text-xs text-slate-500">Outstanding</dt>
          <dd className="text-2xl font-bold tabular-nums text-brand-red" data-testid="pp-outstanding">
            {money(b.payable)}
          </dd>
        </div>
      </dl>

      {blocked && (
        <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          Open your cash shift before taking payments.{' '}
          <Link to="/cashier/shift" className="font-semibold underline">
            Shift Management
          </Link>
        </p>
      )}

      {done && (
        <div
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"
          data-sb="paid-banner"
          role="status"
          data-testid="payment-done"
        >
          <p className="flex items-center gap-2 font-bold text-emerald-800">
            <CheckCircle2 className="h-5 w-5" />
            {done.payment_status === 'paid'
              ? 'Fully paid'
              : done.awaiting_verification
                ? 'Recorded – awaiting mobile money verification'
                : 'Partial payment recorded'}
          </p>
          {done.change > 0 && (
            <p
              className="mt-2 text-3xl font-bold tabular-nums text-brand-navy"
              data-testid="change-due"
              data-sb="change-due"
            >
              Change: {money(done.change)}
            </p>
          )}
          <p className="mt-1 text-sm text-slate-700">
            Transactions #{(done.transaction_numbers ?? []).join(', #')} · Balance {money(done.balance)}
            {done.pending_verification > 0 ? ` · ${money(done.pending_verification)} unverified` : ''}
          </p>
          {done.order_status === 'completed' && (
            <p className="text-sm text-slate-700">
              Order closed{table ? ` – Table ${table.table_number} is now available` : ''}.
            </p>
          )}
          {done.close?.startsWith('close_failed') && (
            <p className="text-sm text-amber-800">
              Paid, but the order could not be closed automatically: {done.close.replace('close_failed: ', '')}
            </p>
          )}
          <Button
            variant="secondary"
            className="mt-3 h-11"
            icon={<Printer className="h-4 w-4" />}
            onClick={onPrintReceipt}
            disabled={done.paid <= 0}
          >
            Print receipt
          </Button>
        </div>
      )}

      {b.payable > 0 && (
        <>
          <div>
            <p className="label">Add payment method</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {POS_METHODS.map((m) => {
                const I = ICON[m.kind];
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => addLine(m.id)}
                    data-sb="pay-method"
                    data-method={m.id}
                    disabled={blocked}
                    className="flex h-14 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white text-sm font-semibold hover:border-brand-orange disabled:opacity-50"
                  >
                    <I className="h-5 w-5 text-brand-navy" />
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          {lines.map((l) => {
            const meta = POS_METHODS.find((m) => m.id === l.method)!;
            const amt = Number(l.amount) || 0;
            return (
              <div
                key={l.key}
                className={cn(
                  'rounded-xl border p-3',
                  check.errors[l.key] ? 'border-red-300 bg-red-50/40' : 'border-slate-200',
                )}
                data-testid={`line-${l.method}`}
                data-sb="pay-line"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{meta.label}</p>
                  <button
                    type="button"
                    aria-label={`Remove ${meta.label} line`}
                    className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                    onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <label>
                    <span className="label">Amount</span>
                    <input
                      className="input h-12 text-lg tabular-nums"
                      inputMode="decimal"
                      aria-label={`${meta.label} amount`}
                      value={l.amount}
                      onChange={(e) => patch(l.key, { amount: e.target.value })}
                    />
                  </label>
                  {meta.kind === 'cash' && (
                    <label>
                      <span className="label">Amount received</span>
                      <input
                        className="input h-12 text-lg tabular-nums"
                        inputMode="decimal"
                        aria-label="Cash received"
                        value={l.received}
                        onChange={(e) => patch(l.key, { received: e.target.value })}
                        placeholder="Optional"
                      />
                    </label>
                  )}
                  {meta.kind !== 'cash' && (
                    <label>
                      <span className="label">
                        {meta.kind === 'card' ? 'Terminal transaction ID' : 'Transaction reference'}
                      </span>
                      <input
                        className="input h-12"
                        aria-label={`${meta.label} reference`}
                        value={l.reference}
                        maxLength={60}
                        onChange={(e) => patch(l.key, { reference: e.target.value })}
                      />
                    </label>
                  )}
                </div>
                {meta.kind === 'cash' && amt > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {cashSuggestions(amt).map((v) => (
                      <button
                        key={v}
                        type="button"
                        className="h-10 rounded-lg border border-slate-300 px-3 text-sm font-semibold tabular-nums hover:border-brand-orange"
                        data-sb="quick-bill"
                        onClick={() => patch(l.key, { received: v.toFixed(2) })}
                      >
                        {money(v)}
                      </button>
                    ))}
                    {Number(l.received) >= amt && (
                      <span className="ml-auto text-sm font-bold text-brand-navy" data-testid="change-preview">
                        Change {money(r2(Number(l.received) - amt))}
                      </span>
                    )}
                  </div>
                )}
                {meta.kind === 'card' && (
                  <label className="mt-2 flex min-h-[44px] items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-brand-red"
                      checked={l.terminalConfirmed}
                      onChange={(e) => patch(l.key, { terminalConfirmed: e.target.checked })}
                    />
                    The card terminal shows <b>APPROVED</b> for this amount
                  </label>
                )}
                {meta.kind === 'mobile' && (
                  <p className="mt-2 text-xs text-amber-800">
                    A typed reference is not proof of payment. This is recorded as <b>awaiting verification</b> and
                    counts as paid only after it is confirmed in the {meta.label} merchant app or statement.
                  </p>
                )}
                {check.errors[l.key] && (
                  <p role="alert" className="mt-2 text-sm text-red-700">
                    {check.errors[l.key]}
                  </p>
                )}
              </div>
            );
          })}

          {lines.length > 0 && (
            <div className="space-y-2 rounded-xl bg-slate-50 p-4" data-sb="pay-totals">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Entered</span>
                <span className="font-semibold tabular-nums" data-testid="pp-entered">
                  {money(check.total)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Remaining after this</span>
                <span className="font-semibold tabular-nums" data-testid="pp-remaining">
                  {money(check.remainingAfter)}
                </span>
              </div>
              {check.awaitingVerification > 0 && (
                <div className="flex justify-between text-sm text-amber-800">
                  <span>Of which awaiting verification</span>
                  <span className="tabular-nums">{money(check.awaitingVerification)}</span>
                </div>
              )}
              {check.change > 0 && (
                <div className="flex justify-between text-base font-bold text-brand-navy">
                  <span>Change to give</span>
                  <span className="tabular-nums">{money(check.change)}</span>
                </div>
              )}
              {check.errors.form && (
                <p role="alert" className="text-sm text-red-700">
                  {check.errors.form}
                </p>
              )}
              {error && (
                <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </p>
              )}
              <Button
                variant="orange"
                className="h-14 w-full text-base"
                loading={busy}
                disabled={!check.ok || busy || blocked}
                onClick={() => void confirm()}
              >
                Confirm payment {check.total > 0 ? money(check.total) : ''}
              </Button>
            </div>
          )}
        </>
      )}
      {b.payable <= 0 && !done && (
        <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
          {b.pending > 0
            ? 'The remaining balance is covered by mobile money awaiting verification.'
            : 'Nothing is outstanding on this order.'}
        </p>
      )}
    </div>
  );
}
