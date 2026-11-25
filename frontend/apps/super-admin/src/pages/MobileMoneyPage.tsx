import { useMemo, useState } from 'react';
import { Check, X } from 'lucide-react';
import { Badge, Card, EmptyState, ErrorState, PageHeader, TableSkeleton } from '@sombill/shared-ui/ui/Feedback';
import { Button } from '@sombill/shared-ui/ui/Button';
import { ConfirmDialog } from '@sombill/shared-ui/ui/ConfirmDialog';
import { useToast } from '@sombill/shared-ui/ui/Toast';
import { useQuery } from '@sombill/shared-hooks/useQuery';
import { friendlyError } from '@sombill/api-client/supabase';
import { formatDateTime, formatMoney, PAYMENT_METHOD_LABEL } from '@sombill/shared-utils/format';
import type { PaymentMethod } from '@sombill/shared-types/types';
import { pendingPayments, verifyPayment, type PendingPayment } from '../services/hq';
import { useHq } from '../features/HqContext';
import { usePayMix } from '../hooks/hq';
import { MOBILE_METHODS, mixShares } from '../features/lib/mix';
import { RangeTabs } from '../components/RangeTabs';
import { formatConverted } from '../features/lib/money';
import type { RangeKey } from '../features/types';

const label = (m: string) => PAYMENT_METHOD_LABEL[m as PaymentMethod] ?? m;

/** Mobile money (Zaad, EVC Plus, Somtel Money) across branches, and payments waiting for someone to check the merchant statement. */
export default function MobileMoneyPage() {
  const { branches, scopeIds, fx, refreshLive } = useHq();
  const toast = useToast();
  const [key, setKey] = useState<RangeKey>('week');
  const mix = usePayMix(key);
  const pending = useQuery(() => pendingPayments(branches.map((b) => b.id)), [branches.length]);
  const [act, setAct] = useState<{ p: PendingPayment; approve: boolean } | null>(null);
  const cur = (id: string) => branches.find((b) => b.id === id)?.currency ?? fx.reporting;
  const name = (id: string) => branches.find((b) => b.id === id)?.name ?? '—';
  const shares = useMemo(() => mixShares(mix.rows, cur, fx), [mix.rows, branches, fx]); // eslint-disable-line react-hooks/exhaustive-deps
  const mobile = shares.shares.filter((s) => MOBILE_METHODS.includes(s.method));
  const mobileTotal = mobile.reduce((s, x) => s + x.amount, 0);
  const rows = (pending.data ?? []).filter((p) => scopeIds.includes(p.restaurant_id));

  // method × branch matrix, in each branch's currency
  const matrix = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of mix.rows) {
      if (
        r.kind !== 'payment' ||
        r.status === 'failed' ||
        r.verification_status === 'rejected' ||
        !MOBILE_METHODS.includes(r.method)
      )
        continue;
      const k = `${r.restaurant_id}:${r.method}`;
      m.set(k, (m.get(k) ?? 0) + r.amount);
    }
    return m;
  }, [mix.rows]);
  const methods = MOBILE_METHODS.filter((m) => mix.rows.some((r) => r.method === m) || m !== 'mobile_money');

  const decide = async (note: string) => {
    if (!act) return;
    try {
      await verifyPayment(act.p.id, act.approve, note);
      toast.success(act.approve ? 'Payment verified.' : 'Payment rejected.');
      setAct(null);
      await Promise.all([pending.reload(), mix.reload(), refreshLive()]);
    } catch (e) {
      throw new Error(friendlyError(e));
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Consolidated Finance · Settlement"
        title="Mobile Money Portals"
        description="Zaad, EVC Plus and Somtel Money takings. Mobile payments stay “awaiting verification” until someone checks the merchant statement."
        actions={<RangeTabs value={key} onChange={setKey} />}
      />
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <div className="sa-stat">
          <p>Mobile money taken</p>
          <strong>{formatConverted({ total: mobileTotal, unconverted: {} }, fx)}</strong>
          <small>
            {shares.total > 0 ? `${Math.round((mobileTotal / shares.total) * 100)}% of all takings` : 'No payments yet'}
          </small>
        </div>
        {mobile.slice(0, 2).map((s) => (
          <div className="sa-stat" key={s.method}>
            <p>{s.label}</p>
            <strong>{formatMoney(s.amount, fx.reporting)}</strong>
            <small>{s.pct.toFixed(0)}% of takings</small>
          </div>
        ))}
      </div>
      <Card title="By branch" bodyClassName="p-0" className="mb-4">
        {mix.error ? (
          <ErrorState message={mix.error} onRetry={mix.reload} />
        ) : mix.loading ? (
          <TableSkeleton cols={4} />
        ) : (
          <div className="overflow-x-auto">
            <table className="sa-table min-w-full">
              <thead>
                <tr>
                  <th scope="col">Branch</th>
                  {methods.map((m) => (
                    <th scope="col" key={m} className="text-right">
                      {label(m)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {branches
                  .filter((b) => scopeIds.includes(b.id))
                  .map((b) => (
                    <tr key={b.id}>
                      <td className="font-semibold">{b.name}</td>
                      {methods.map((m) => (
                        <td key={m} className="text-right tabular-nums">
                          {formatMoney(matrix.get(`${b.id}:${m}`) ?? 0, b.currency)}
                        </td>
                      ))}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Card title={`Awaiting verification (${rows.length})`} bodyClassName="p-0">
        {pending.error ? (
          <ErrorState message={pending.error} onRetry={pending.reload} />
        ) : pending.loading ? (
          <TableSkeleton cols={5} />
        ) : rows.length === 0 ? (
          <EmptyState title="Nothing to verify" message="Every mobile payment has been checked." />
        ) : (
          <div className="overflow-x-auto">
            <table className="sa-table min-w-full">
              <thead>
                <tr>
                  <th scope="col">Time</th>
                  <th scope="col">Branch</th>
                  <th scope="col">Order</th>
                  <th scope="col">Method</th>
                  <th scope="col">Reference</th>
                  <th scope="col" className="text-right">
                    Amount
                  </th>
                  <th scope="col" className="text-right">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td className="whitespace-nowrap">
                      {formatDateTime(
                        p.created_at,
                        branches.find((b) => b.id === p.restaurant_id)?.timezone ?? 'Africa/Mogadishu',
                      )}
                    </td>
                    <td>{name(p.restaurant_id)}</td>
                    <td>#{p.order_number ?? '—'}</td>
                    <td>
                      <Badge tone="purple">{label(p.method)}</Badge>
                    </td>
                    <td className="font-mono text-xs">{p.reference ?? '—'}</td>
                    <td className="text-right tabular-nums font-semibold">
                      {formatMoney(p.amount, cur(p.restaurant_id))}
                    </td>
                    <td className="whitespace-nowrap text-right">
                      <Button
                        size="sm"
                        icon={<Check className="h-3.5 w-3.5" />}
                        onClick={() => setAct({ p, approve: true })}
                      >
                        Verify
                      </Button>{' '}
                      <Button
                        size="sm"
                        variant="danger"
                        icon={<X className="h-3.5 w-3.5" />}
                        onClick={() => setAct({ p, approve: false })}
                      >
                        Reject
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <ConfirmDialog
        open={act !== null}
        title={act?.approve ? 'Verify this payment?' : 'Reject this payment?'}
        message={
          act
            ? `${label(act.p.method)} ${formatMoney(act.p.amount, cur(act.p.restaurant_id))} · ref ${act.p.reference ?? '—'} · ${name(act.p.restaurant_id)}. ${act.approve ? 'Confirm you saw it on the merchant statement.' : 'The customer will still owe the amount.'}`.trim()
            : ''
        }
        confirmLabel={act?.approve ? 'Verify' : 'Reject'}
        danger={act ? !act.approve : false}
        requireReason={act ? !act.approve : false}
        onConfirm={decide}
        onClose={() => setAct(null)}
      />
    </div>
  );
}
