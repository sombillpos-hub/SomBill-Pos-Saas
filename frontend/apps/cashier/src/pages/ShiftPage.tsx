import { useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Lock, Printer, Unlock } from 'lucide-react';
import { useAuth, useRestaurant } from '@sombill/shared-hooks/AuthContext';
import { useQuery } from '@sombill/shared-hooks/useQuery';
import { useRealtime } from '@sombill/shared-hooks/useRealtime';
import { supabase, unwrap, friendlyError } from '@sombill/api-client/supabase';
import { formatDateTime, formatDuration, formatMoney, PAYMENT_METHOD_LABEL } from '@sombill/shared-utils/format';
import { cn } from '@sombill/shared-utils/cn';
import type { CashMovement, CashierShift, PaymentMethod, ShiftSummary } from '@sombill/shared-types/types';
import { Card, EmptyState, ErrorState, PageHeader, Skeleton, StatCard } from '@sombill/shared-ui/ui/Feedback';
import { Button } from '@sombill/shared-ui/ui/Button';
import { Input, Select, Textarea } from '@sombill/shared-ui/ui/Field';
import { ConfirmDialog } from '@sombill/shared-ui/ui/ConfirmDialog';
import { useToast } from '@sombill/shared-ui/ui/Toast';
import { parseMoney, r2 } from '../features/payment';

export default function ShiftPage() {
  const r = useRestaurant();
  const { session } = useAuth();
  const uid = session?.user.id ?? '';
  const toast = useToast();
  const money = (n: number) => formatMoney(n, r.currency);
  const q = useQuery(async () => {
    const shifts = unwrap(
      await supabase
        .from('cashier_shifts')
        .select('*')
        .eq('restaurant_id', r.id)
        .eq('cashier_id', uid)
        .order('opened_at', { ascending: false })
        .limit(20),
    ) as CashierShift[];
    const open = shifts.find((s) => s.status === 'open') ?? null;
    const [summary, movements] = open
      ? await Promise.all([
          supabase.rpc('cashier_shift_summary', { p_shift: open.id }).then((x) => unwrap<ShiftSummary>(x)),
          supabase
            .from('cash_movements')
            .select('*')
            .eq('shift_id', open.id)
            .order('created_at')
            .then((x) => unwrap(x) as CashMovement[]),
        ])
      : [null, [] as CashMovement[]];
    return { shifts, open, summary, movements };
  }, [r.id, uid]);
  useRealtime(['payments', 'cashier_shifts'], r.id, () => void q.reload());

  const [opening, setOpening] = useState('');
  const [openNotes, setOpenNotes] = useState('');
  const [mvType, setMvType] = useState<'pay_in' | 'pay_out' | 'drop'>('pay_out');
  const [mvAmount, setMvAmount] = useState('');
  const [mvReason, setMvReason] = useState('');
  const [counted, setCounted] = useState('');
  const [closeNotes, setCloseNotes] = useState('');
  const [confirmClose, setConfirmClose] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string) => {
    setBusy(true);
    setErr(null);
    const { error } = await fn();
    setBusy(false);
    if (error) {
      setErr(friendlyError(error));
      return false;
    }
    toast.success(ok);
    await q.reload();
    return true;
  };

  if (q.loading && !q.data) return <Skeleton className="h-80 w-full" />;
  if (q.error)
    return (
      <div className="card">
        <ErrorState message={q.error} onRetry={q.reload} />
      </div>
    );
  const { open, summary: s, movements, shifts } = q.data!;
  const countedN = parseMoney(counted || '');
  const diff = s && countedN !== null ? r2(countedN - s.expected_cash) : null;

  return (
    <div>
      <PageHeader
        eyebrow="Ledger & Cash · Cash Drawer"
        title="Shift Management"
        description="Your cash drawer session: opening float, cash in and out, and reconciliation at close."
      />
      {!open ? (
        <Card title="Open shift" className="max-w-xl">
          <div className="space-y-4">
            <Input
              label={`Opening cash in drawer (${r.currency})`}
              name="opening-cash"
              inputMode="decimal"
              value={opening}
              onChange={(e) => setOpening(e.target.value)}
            />
            <Textarea
              label="Notes (optional)"
              name="opening-notes"
              value={openNotes}
              maxLength={300}
              onChange={(e) => setOpenNotes(e.target.value)}
            />
            {err && (
              <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {err}
              </p>
            )}
            <Button
              variant="orange"
              className="h-12"
              icon={<Unlock className="h-5 w-5" />}
              loading={busy}
              onClick={() => {
                const v = parseMoney(opening || '');
                if (v === null) {
                  setErr('Enter the opening cash (e.g. 50 or 50.00).');
                  return;
                }
                void run(
                  () =>
                    supabase.rpc('open_cashier_shift', {
                      p_restaurant: r.id,
                      p_opening_cash: v,
                      p_notes: openNotes.trim() || null,
                    }),
                  'Shift opened.',
                );
              }}
            >
              Open shift
            </Button>
          </div>
        </Card>
      ) : (
        s && (
          <div className="space-y-6">
            <p className="text-sm text-slate-600">
              Open since <b>{formatDateTime(open.opened_at, r.timezone)}</b> ({formatDuration(open.opened_at)})
              {open.opening_notes ? ` · ${open.opening_notes}` : ''}
            </p>
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
              <StatCard label="Opening cash" value={money(s.opening_cash)} />
              <StatCard label="Cash sales" value={money(s.cash_sales)} tone="green" />
              <StatCard label="Cash refunds" value={money(s.cash_refunds)} tone="red" />
              <StatCard
                label="Expected cash"
                value={<span data-testid="expected-cash">{money(s.expected_cash)}</span>}
                tone="navy"
                sub={`+${money(s.pay_in)} in · −${money(s.pay_out)} out`}
              />
            </div>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card title="Other payment totals">
                <dl className="space-y-1 text-sm">
                  {(['card', 'evc_plus', 'zaad', 'somtel_money'] as PaymentMethod[]).map((m) => (
                    <div key={m} className="flex justify-between">
                      <dt className="text-slate-500">{PAYMENT_METHOD_LABEL[m]}</dt>
                      <dd className="tabular-nums">{money(s.by_method[m] ?? 0)}</dd>
                    </div>
                  ))}
                  <div className="flex justify-between text-amber-800">
                    <dt>Mobile money awaiting verification</dt>
                    <dd className="tabular-nums">{money(s.pending_verification)}</dd>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <dt>All refunds</dt>
                    <dd className="tabular-nums">{money(s.refunds_total)}</dd>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <dt>Transactions</dt>
                    <dd>{s.transactions}</dd>
                  </div>
                </dl>
              </Card>
              <Card title="Cash movements">
                <div className="grid grid-cols-[130px_100px_1fr] items-end gap-2">
                  <Select
                    label="Type"
                    name="mv-type"
                    value={mvType}
                    onChange={(e) => setMvType(e.target.value as typeof mvType)}
                  >
                    <option value="pay_out">Pay out</option>
                    <option value="drop">Safe drop</option>
                    <option value="pay_in">Pay in</option>
                  </Select>
                  <Input
                    label="Amount"
                    name="mv-amount"
                    inputMode="decimal"
                    value={mvAmount}
                    onChange={(e) => setMvAmount(e.target.value)}
                  />
                  <Input
                    label="Reason"
                    name="mv-reason"
                    value={mvReason}
                    maxLength={200}
                    onChange={(e) => setMvReason(e.target.value)}
                  />
                </div>
                <Button
                  className="mt-2 h-11"
                  variant="navy"
                  loading={busy}
                  icon={
                    mvType === 'pay_in' ? (
                      <ArrowDownToLine className="h-4 w-4" />
                    ) : (
                      <ArrowUpFromLine className="h-4 w-4" />
                    )
                  }
                  onClick={() => {
                    const v = parseMoney(mvAmount || '');
                    if (v === null || v <= 0) {
                      setErr('Enter a valid movement amount.');
                      return;
                    }
                    if (mvReason.trim().length < 3) {
                      setErr('Give a reason for the cash movement.');
                      return;
                    }
                    void run(
                      () =>
                        supabase.rpc('add_cash_movement', {
                          p_shift: open.id,
                          p_type: mvType,
                          p_amount: v,
                          p_reason: mvReason.trim(),
                        }),
                      'Cash movement recorded.',
                    ).then((ok) => {
                      if (ok) {
                        setMvAmount('');
                        setMvReason('');
                      }
                    });
                  }}
                >
                  Record movement
                </Button>
                <ul className="mt-3 divide-y divide-slate-100 text-sm" aria-label="Cash movements">
                  {movements.map((m) => (
                    <li key={m.id} className="flex justify-between py-2">
                      <span>
                        {m.movement_type === 'pay_in' ? 'Pay in' : m.movement_type === 'drop' ? 'Safe drop' : 'Pay out'}{' '}
                        · {m.reason}
                      </span>
                      <span className="tabular-nums">
                        {m.movement_type === 'pay_in' ? '+' : '−'}
                        {money(m.amount)}
                      </span>
                    </li>
                  ))}
                  {!movements.length && <li className="py-2 text-slate-500">No cash movements yet.</li>}
                </ul>
              </Card>
            </div>
            <Card title="Close shift">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <span className="label">Expected cash</span>
                  <p className="input flex h-12 items-center bg-slate-50 font-semibold tabular-nums">
                    {money(s.expected_cash)}
                  </p>
                </div>
                <Input
                  label="Actual cash counted"
                  name="counted-cash"
                  inputMode="decimal"
                  className="h-12"
                  value={counted}
                  onChange={(e) => setCounted(e.target.value)}
                />
                <div>
                  <span className="label">Difference</span>
                  <p
                    className={cn(
                      'input flex h-12 items-center font-bold tabular-nums',
                      diff === null ? 'text-slate-400' : diff === 0 ? 'text-emerald-700' : 'text-brand-red',
                    )}
                    data-testid="cash-difference"
                  >
                    {diff === null
                      ? '—'
                      : `${diff > 0 ? '+' : ''}${money(diff)}${diff === 0 ? ' (balanced)' : diff > 0 ? ' over' : ' short'}`}
                  </p>
                </div>
              </div>
              <Textarea
                wrapClassName="mt-4"
                label={diff ? 'Closing notes (required – explain the difference)' : 'Closing notes'}
                name="closing-notes"
                value={closeNotes}
                maxLength={500}
                onChange={(e) => setCloseNotes(e.target.value)}
              />
              {err && (
                <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  {err}
                </p>
              )}
              <Button
                className="mt-4 h-12"
                variant="primary"
                icon={<Lock className="h-5 w-5" />}
                onClick={() => {
                  if (countedN === null) {
                    setErr('Enter the cash you counted.');
                    return;
                  }
                  if (diff && closeNotes.trim().length < 3) {
                    setErr('Explain the cash difference in the closing notes.');
                    return;
                  }
                  setErr(null);
                  setConfirmClose(true);
                }}
              >
                Close shift
              </Button>
            </Card>
          </div>
        )
      )}
      <Card title="Shift history" className="mt-6" bodyClassName="p-0">
        {!shifts.filter((x) => x.status === 'closed').length ? (
          <EmptyState title="No closed shifts yet" />
        ) : (
          <ul className="divide-y divide-slate-100" aria-label="Shift history">
            {shifts
              .filter((x) => x.status === 'closed')
              .map((x) => (
                <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                  <span>
                    {formatDateTime(x.opened_at, r.timezone)} → {formatDateTime(x.closed_at, r.timezone)}
                  </span>
                  <span className="tabular-nums">
                    Expected {money(x.expected_cash ?? 0)} · Counted {money(x.counted_cash ?? 0)} ·{' '}
                    <b className={Number(x.cash_difference) === 0 ? 'text-emerald-700' : 'text-brand-red'}>
                      {Number(x.cash_difference) > 0 ? '+' : ''}
                      {money(x.cash_difference ?? 0)}
                    </b>
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Printer className="h-4 w-4" />}
                    onClick={() => window.print()}
                  >
                    Print
                  </Button>
                </li>
              ))}
          </ul>
        )}
      </Card>
      <ConfirmDialog
        open={confirmClose}
        title="Close your shift?"
        danger={!!diff}
        message={`Expected ${money(s?.expected_cash ?? 0)}, counted ${money(countedN ?? 0)}${diff ? `, difference ${money(diff)}` : ' — balanced'}. A closed shift cannot be changed.`}
        confirmLabel="Close shift"
        onClose={() => setConfirmClose(false)}
        onConfirm={async () => {
          if (countedN === null || !open) return;
          const ok = await run(
            () =>
              supabase.rpc('close_cashier_shift', {
                p_shift: open.id,
                p_counted_cash: countedN,
                p_notes: closeNotes.trim() || null,
              }),
            'Shift closed.',
          );
          setConfirmClose(false);
          if (ok) {
            setCounted('');
            setCloseNotes('');
          }
        }}
      />
    </div>
  );
}
