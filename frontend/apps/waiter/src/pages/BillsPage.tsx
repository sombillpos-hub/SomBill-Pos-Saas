import { useEffect, useRef, useState } from 'react';
import { revealIfStacked } from '@sombill/shared-hooks/useMediaQuery';
import { useSearchParams } from 'react-router-dom';
import { BellRing, Printer, Undo2 } from 'lucide-react';
import { useAuth, useRestaurant } from '@sombill/shared-hooks/AuthContext';
import { useQuery } from '@sombill/shared-hooks/useQuery';
import { useRealtime } from '@sombill/shared-hooks/useRealtime';
import { supabase, unwrap, friendlyError } from '@sombill/api-client/supabase';
import { fetchTables } from '@sombill/api-client/queries';
import { formatDateTime, formatMoney, PAYMENT_METHOD_LABEL } from '@sombill/shared-utils/format';
import { orderBalance } from '@sombill/shared-utils/reports';
import { cn } from '@sombill/shared-utils/cn';
import type { Order, OrderItem, Payment } from '@sombill/shared-types/types';
import { Badge, Card, EmptyState, ErrorState, PageHeader, Skeleton, type Tone } from '@sombill/shared-ui/ui/Feedback';
import { Button } from '@sombill/shared-ui/ui/Button';
import { ConfirmDialog } from '@sombill/shared-ui/ui/ConfirmDialog';
import { useToast } from '@sombill/shared-ui/ui/Toast';
import { fetchActiveOrders } from '@sombill/api-client/orderData';
import {
  BILL_STATE_LABEL,
  billState,
  canActOnOrder,
  canCancelBill,
  canRequestBill,
  type BillState,
} from '@sombill/shared-utils/posRules';

const TONE: Record<BillState, Tone> = {
  not_requested: 'gray',
  requested: 'purple',
  processing: 'blue',
  partially_paid: 'orange',
  paid: 'green',
  closed: 'green',
  cancelled: 'red',
};

export default function BillsPage() {
  const r = useRestaurant();
  const { session, role } = useAuth();
  const uid = session?.user.id;
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('order');
  const [confirm, setConfirm] = useState<'request' | 'cancel' | null>(null);
  const billRef = useRef<HTMLDivElement>(null);
  const money = (n: number) => formatMoney(n, r.currency);

  const list = useQuery(async () => {
    const [active, tables] = await Promise.all([fetchActiveOrders(r.id), fetchTables(r.id)]);
    let orders = active.filter((o) => canActOnOrder(o, uid, role, r.settings));
    if (selectedId && !orders.some((o) => o.id === selectedId)) {
      const extra = unwrap(
        await supabase.from('orders').select('*').eq('id', selectedId).maybeSingle(),
      ) as Order | null;
      if (extra) orders = [extra, ...orders];
    }
    return { orders, tables: new Map(tables.map((t) => [t.id, t.table_number])) };
  }, [r.id, uid, selectedId]);
  const detail = useQuery(async () => {
    if (!selectedId) return null;
    const [o, items, payments] = await Promise.all([
      supabase
        .from('orders')
        .select('*')
        .eq('id', selectedId)
        .maybeSingle()
        .then((x) => unwrap(x) as Order | null),
      supabase
        .from('order_items')
        .select('*')
        .eq('order_id', selectedId)
        .order('created_at')
        .then((x) => unwrap(x) as OrderItem[]),
      supabase
        .from('payments')
        .select('*')
        .eq('order_id', selectedId)
        .order('created_at')
        .then((x) => unwrap(x) as Payment[]),
    ]);
    return o ? { o, items, payments } : null;
  }, [selectedId]);
  useRealtime(['orders', 'payments', 'order_items'], r.id, () => {
    void list.reload();
    void detail.reload();
  });
  useEffect(() => {
    if (!selectedId && list.data?.orders[0]) setParams({ order: list.data.orders[0].id }, { replace: true });
  }, [list.data, selectedId, setParams]);

  const o = detail.data?.o ?? null;
  const run = async (kind: 'request' | 'cancel') => {
    if (!o) return;
    const { error } = await supabase.rpc(kind === 'request' ? 'request_bill' : 'cancel_bill_request', {
      p_order: o.id,
    });
    if (error) throw new Error(friendlyError(error));
    toast.success(
      kind === 'request'
        ? `Bill requested for order #${o.order_number}. The cashier has been notified.`
        : 'Bill request cancelled.',
    );
    setConfirm(null);
    await Promise.all([detail.reload(), list.reload()]);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Service · Table Checkouts"
        title="Bills"
        description="Request bills and follow the cashier’s progress. Payments are recorded only by the cashier."
      />
      {list.error ? (
        <div className="card">
          <ErrorState message={list.error} onRetry={list.reload} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <Card title="Open bills" bodyClassName="p-0" className="h-fit">
            {list.loading && !list.data ? (
              <div className="p-4">
                <Skeleton className="h-32 w-full" />
              </div>
            ) : !list.data?.orders.length ? (
              <EmptyState title="No open orders" message="Bills appear here for orders you are serving." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {list.data.orders.map((x) => (
                  <li key={x.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setParams({ order: x.id });
                        revealIfStacked(billRef.current, '(max-width: 1023px)');
                      }}
                      aria-current={x.id === selectedId}
                      className={cn(
                        'flex min-h-[64px] w-full items-center justify-between gap-2 px-4 py-3 text-left',
                        x.id === selectedId ? 'bg-orange-50' : 'hover:bg-slate-50',
                      )}
                    >
                      <span className="min-w-0">
                        <b>#{x.order_number}</b>{' '}
                        <span className="text-sm text-slate-500">
                          {x.table_id ? `Table ${list.data!.tables.get(x.table_id)}` : ''}
                        </span>
                        <span className="mt-0.5 block">
                          <Badge tone={TONE[billState(x)]}>{BILL_STATE_LABEL[billState(x)]}</Badge>
                        </span>
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums">{money(x.total)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <div ref={billRef} className="scroll-mt-20">
            <Card
              title={
                o
                  ? `Bill · Order #${o.order_number}${o.table_id ? ` · Table ${list.data?.tables.get(o.table_id) ?? ''}` : ''}`
                  : 'Bill'
              }
            >
              {detail.loading && !detail.data ? (
                <Skeleton className="h-64 w-full" />
              ) : !o ? (
                <p className="text-sm text-slate-500">Select an order to view its bill.</p>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={TONE[billState(o)]}>{BILL_STATE_LABEL[billState(o)]}</Badge>
                    {o.bill_requested_at && (
                      <span className="text-xs text-slate-500">
                        Requested {formatDateTime(o.bill_requested_at, r.timezone)}
                      </span>
                    )}
                    {o.bill_acknowledged_at && (
                      <span className="text-xs text-slate-500">
                        · Cashier started {formatDateTime(o.bill_acknowledged_at, r.timezone)}
                      </span>
                    )}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="py-2 text-left font-semibold text-slate-500">Item</th>
                          <th className="py-2 text-right font-semibold text-slate-500">Qty</th>
                          <th className="py-2 text-right font-semibold text-slate-500">Unit</th>
                          <th className="py-2 text-right font-semibold text-slate-500">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {detail
                          .data!.items.filter((i) => !i.is_voided)
                          .map((i) => (
                            <tr key={i.id}>
                              <td className="py-2">{i.product_name}</td>
                              <td className="py-2 text-right tabular-nums">{Number(i.quantity)}</td>
                              <td className="py-2 text-right tabular-nums">{money(i.unit_price)}</td>
                              <td className="py-2 text-right tabular-nums">{money(i.line_total)}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                  <dl className="space-y-1 border-t border-slate-100 pt-3 text-sm" aria-label="Bill totals">
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Subtotal</dt>
                      <dd className="tabular-nums">{money(o.subtotal)}</dd>
                    </div>
                    {o.discount_amount > 0 && (
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Discount (authorised)</dt>
                        <dd className="tabular-nums">−{money(o.discount_amount)}</dd>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <dt className="text-slate-500">
                        {r.tax_label} {(o.tax_rate * 100).toFixed(0)}%{o.tax_inclusive ? ' (included)' : ''}
                      </dt>
                      <dd className="tabular-nums">{money(o.tax_amount)}</dd>
                    </div>
                    <div className="flex justify-between text-base font-bold text-brand-navy">
                      <dt>Grand total</dt>
                      <dd className="tabular-nums">{money(o.total)}</dd>
                    </div>
                    {detail
                      .data!.payments.filter((p) => p.status === 'succeeded')
                      .map((p) => (
                        <div
                          key={p.id}
                          className={cn(
                            'flex justify-between',
                            p.kind === 'refund' ? 'text-brand-red' : 'text-emerald-700',
                          )}
                        >
                          <dt>
                            {p.kind === 'refund' ? 'Refund' : 'Paid'} · {PAYMENT_METHOD_LABEL[p.method]}
                          </dt>
                          <dd className="tabular-nums">
                            {p.kind === 'refund' ? '+' : '−'}
                            {money(p.amount)}
                          </dd>
                        </div>
                      ))}
                    <div className="flex justify-between text-base font-bold">
                      <dt>Remaining balance</dt>
                      <dd className="tabular-nums" data-testid="balance">
                        {money(orderBalance(o))}
                      </dd>
                    </div>
                  </dl>
                  <div className="flex flex-wrap gap-2">
                    {canRequestBill(o, uid, role, r.settings) && (
                      <Button
                        variant="orange"
                        className="h-12"
                        icon={<BellRing className="h-5 w-5" />}
                        onClick={() => setConfirm('request')}
                      >
                        Request bill
                      </Button>
                    )}
                    {canCancelBill(o, uid, role, r.settings) && (
                      <Button
                        className="h-12"
                        variant="secondary"
                        icon={<Undo2 className="h-5 w-5" />}
                        onClick={() => setConfirm('cancel')}
                      >
                        Cancel bill request
                      </Button>
                    )}
                    {(o.payment_status === 'paid' || o.status === 'completed') && (
                      <Button
                        className="h-12"
                        variant="secondary"
                        icon={<Printer className="h-5 w-5" />}
                        onClick={() => window.print()}
                      >
                        Print receipt
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    {o.payment_status === 'paid'
                      ? 'Receipt available — payment completed by the cashier.'
                      : 'The receipt becomes available once the cashier records full payment.'}
                  </p>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={confirm !== null}
        danger={confirm === 'cancel'}
        title={confirm === 'request' ? 'Request the bill?' : 'Cancel the bill request?'}
        message={
          confirm === 'request'
            ? 'The cashier will be notified. Items can’t be added while the bill is requested.'
            : 'Use this if the guests want to order more. Not possible once the cashier has started.'
        }
        confirmLabel={confirm === 'request' ? 'Request bill' : 'Cancel request'}
        onConfirm={() => run(confirm!)}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}
