import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BadgeCheck, BellRing, ShieldAlert, XCircle } from 'lucide-react';
import { useAuth, useRestaurant } from '@sombill/shared-hooks/AuthContext';
import { useQuery } from '@sombill/shared-hooks/useQuery';
import { useRealtime } from '@sombill/shared-hooks/useRealtime';
import { useStaffDirectory } from '@sombill/shared-hooks/useStaffDirectory';
import { fetchAll, supabase, unwrap, friendlyError } from '@sombill/api-client/supabase';
import { fetchTables } from '@sombill/api-client/queries';
import { formatDateTime, formatMoney, PAYMENT_METHOD_LABEL } from '@sombill/shared-utils/format';
import { orderBalance } from '@sombill/shared-utils/reports';
import { cn } from '@sombill/shared-utils/cn';
import type { Order, Payment } from '@sombill/shared-types/types';
import { Badge, Card, EmptyState, ErrorState, PageHeader, Skeleton } from '@sombill/shared-ui/ui/Feedback';
import { SearchInput, Tabs } from '@sombill/shared-ui/ui/Filters';
import { Button } from '@sombill/shared-ui/ui/Button';
import { ConfirmDialog } from '@sombill/shared-ui/ui/ConfirmDialog';
import { useToast } from '@sombill/shared-ui/ui/Toast';
import { fetchOrderBundle, printDocument } from '../services/data';
import { PaymentPanel } from '../components/PaymentPanel';
import { useOpenShift } from '../hooks/useShift';

export async function printReceiptFor(orderId: string, toast: { error: (m: string) => void }) {
  const { data, error } = await supabase.rpc('issue_receipt', { p_order: orderId });
  if (error) {
    toast.error(friendlyError(error));
    return;
  }
  const rec = data as { receipt_id: string };
  await supabase.rpc('mark_receipt_printed', { p_receipt: rec.receipt_id });
  await printDocument(`/cashier-print/receipt/${orderId}`);
}

export default function PaymentProcessingPage() {
  const r = useRestaurant();
  const { session, role } = useAuth();
  const uid = session?.user.id;
  const toast = useToast();
  const staff = useStaffDirectory(r.id);
  const shift = useOpenShift();
  const [params, setParams] = useSearchParams();
  const orderId = params.get('order');
  const [tab, setTab] = useState<'bills' | 'unpaid'>('bills');
  const [search, setSearch] = useState('');
  const [verify, setVerify] = useState<{ p: Payment; approve: boolean } | null>(null);

  const queue = useQuery(async () => {
    const [orders, tables, pending] = await Promise.all([
      fetchAll<Order>((a, b) =>
        supabase
          .from('orders')
          .select('*')
          .eq('restaurant_id', r.id)
          .in('payment_status', ['unpaid', 'partial'])
          .neq('status', 'cancelled')
          .order('created_at', { ascending: false })
          .range(a, b),
      ),
      fetchTables(r.id),
      supabase
        .from('payments')
        .select('*')
        .eq('restaurant_id', r.id)
        .eq('status', 'pending')
        .order('created_at')
        .then((x) => unwrap(x) as Payment[]),
    ]);
    return {
      orders: orders.filter((o) => Number(o.total) > 0),
      tables: new Map(tables.map((t) => [t.id, t.table_number])),
      pending,
    };
  }, [r.id]);
  const bundle = useQuery(() => (orderId ? fetchOrderBundle(orderId) : Promise.resolve(null)), [orderId]);
  useRealtime(['orders', 'payments', 'order_items'], r.id, () => {
    void queue.reload();
    void bundle.reload();
  });

  // Opening a requested bill tells waiters (and other cashiers) it is being processed.
  const o = bundle.data?.order;
  useEffect(() => {
    if (o && o.bill_requested_at && !o.bill_acknowledged_at)
      void supabase.rpc('acknowledge_bill_request', { p_order: o.id }).then(() => bundle.reload());
  }, [o?.id, o?.bill_requested_at, o?.bill_acknowledged_at]); // eslint-disable-line react-hooks/exhaustive-deps

  const list = useMemo(() => {
    const t = search.trim().toLowerCase().replace(/^#/, '');
    return (queue.data?.orders ?? [])
      .filter((x) => (tab === 'bills' ? x.bill_requested_at : true))
      .filter((x) => !t || String(x.order_number) === t || String(queue.data!.tables.get(x.table_id ?? '') ?? '') === t)
      .sort((a, b) => (a.bill_requested_at ?? '9').localeCompare(b.bill_requested_at ?? '9'));
  }, [queue.data, tab, search]);
  const canVerify = role === 'manager' || r.settings.permissions.cashier_can_verify_mobile_money;
  const byOther =
    o?.bill_acknowledged_by && o.bill_acknowledged_by !== uid ? staff.nameOf(o.bill_acknowledged_by) : null;

  const doVerify = async (note: string) => {
    if (!verify) return;
    const { error } = await supabase.rpc('verify_payment', {
      p_payment: verify.p.id,
      p_approve: verify.approve,
      p_note: note || null,
    });
    if (error) throw new Error(friendlyError(error));
    toast.success(verify.approve ? 'Payment verified.' : 'Payment marked as not received.');
    setVerify(null);
    await Promise.all([queue.reload(), bundle.reload()]);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Point of Sale · Checkout & Mobile Money"
        title="Payment Processing"
        description="Take full, partial and split payments. Every payment is recorded once, even if the button is pressed twice."
      />
      {queue.error ? (
        <div className="card">
          <ErrorState message={queue.error} onRetry={queue.reload} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)]">
          <Card bodyClassName="p-0" className="h-fit">
            <div className="space-y-2 border-b border-slate-100 p-3">
              <SearchInput value={search} onChange={setSearch} placeholder="Order # or table" />
              <Tabs
                value={tab}
                onChange={setTab}
                tabs={[
                  {
                    id: 'bills',
                    label: 'Bill requested',
                    count: (queue.data?.orders ?? []).filter((x) => x.bill_requested_at).length,
                    icon: <BellRing className="h-4 w-4" />,
                  },
                  { id: 'unpaid', label: 'All unpaid', count: queue.data?.orders.length ?? 0 },
                ]}
              />
            </div>
            {queue.loading && !queue.data ? (
              <div className="p-3">
                <Skeleton className="h-40 w-full" />
              </div>
            ) : !list.length ? (
              <EmptyState title={tab === 'bills' ? 'No bills requested' : 'Nothing to collect'} />
            ) : (
              <ul className="max-h-[60vh] divide-y divide-slate-100 overflow-y-auto" aria-label="Orders to pay">
                {list.map((x) => (
                  <li key={x.id}>
                    <button
                      type="button"
                      onClick={() => setParams({ order: x.id })}
                      aria-current={x.id === orderId}
                      className={cn(
                        'flex min-h-[60px] w-full items-center justify-between gap-2 px-4 py-2 text-left',
                        x.id === orderId ? 'bg-orange-50' : 'hover:bg-slate-50',
                      )}
                    >
                      <span className="min-w-0">
                        <b>#{x.order_number}</b>{' '}
                        <span className="text-sm text-slate-500">
                          {x.table_id ? `Table ${queue.data!.tables.get(x.table_id)}` : x.order_type.replace('_', '-')}
                        </span>
                        <span className="block text-xs text-slate-500">
                          {x.payment_status === 'partial' ? 'Partially paid' : 'Unpaid'}
                          {x.bill_requested_at ? ' · bill requested' : ''}
                        </span>
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums">
                        {formatMoney(orderBalance(x), r.currency)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <div className="min-w-0 space-y-4">
            <Card title={o ? `Order #${o.order_number}` : 'Select an order'}>
              {!orderId ? (
                <p className="text-sm text-slate-500">
                  Choose an order on the left, or open one from Active Orders or Bills.
                </p>
              ) : bundle.loading && !bundle.data ? (
                <Skeleton className="h-64 w-full" />
              ) : !bundle.data ? (
                <EmptyState title="Order not found" />
              ) : (
                <>
                  {byOther && (
                    <p className="mb-3 flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                      <ShieldAlert className="h-4 w-4" />
                      {byOther} opened this bill first. Coordinate before taking payment — duplicates are blocked either
                      way.
                    </p>
                  )}
                  <PaymentPanel
                    bundle={bundle.data}
                    blocked={shift.blocked}
                    onRecorded={() => {
                      void bundle.reload();
                      void queue.reload();
                    }}
                    onPrintReceipt={() => void printReceiptFor(bundle.data!.order.id, toast)}
                  />
                </>
              )}
            </Card>
            <Card title={`Mobile money awaiting verification (${queue.data?.pending.length ?? 0})`} bodyClassName="p-0">
              {!queue.data?.pending.length ? (
                <EmptyState title="Nothing awaiting verification" />
              ) : (
                <ul className="divide-y divide-slate-100" aria-label="Awaiting verification">
                  {queue.data.pending.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                      <div className="min-w-0 text-sm">
                        <p className="font-semibold">
                          {PAYMENT_METHOD_LABEL[p.method]} · {formatMoney(p.amount, r.currency)} · Ref{' '}
                          <span className="font-mono">{p.reference}</span>
                        </p>
                        <p className="text-xs text-slate-500">
                          Txn #{p.transaction_number} · {formatDateTime(p.created_at, r.timezone)} ·{' '}
                          {staff.nameOf(p.cashier_id)}
                        </p>
                      </div>
                      {canVerify ? (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="h-10"
                            variant="navy"
                            icon={<BadgeCheck className="h-4 w-4" />}
                            onClick={() => setVerify({ p, approve: true })}
                          >
                            Verified
                          </Button>
                          <Button
                            size="sm"
                            className="h-10"
                            variant="danger"
                            icon={<XCircle className="h-4 w-4" />}
                            onClick={() => setVerify({ p, approve: false })}
                          >
                            Not received
                          </Button>
                        </div>
                      ) : (
                        <Badge tone="yellow">Manager verification required</Badge>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={!!verify}
        danger={verify?.approve === false}
        requireReason={verify?.approve === false}
        title={verify?.approve ? 'Confirm the money was received?' : 'Mark as not received?'}
        message={
          verify
            ? `${PAYMENT_METHOD_LABEL[verify.p.method]} ${formatMoney(verify.p.amount, r.currency)}, reference ${verify.p.reference}. ${verify.approve ? 'Only confirm after checking the provider’s merchant app or statement. This cannot be undone.' : 'The amount returns to the outstanding balance.'}`
            : ''
        }
        confirmLabel={verify?.approve ? 'Yes, verified' : 'Not received'}
        onConfirm={doVerify}
        onClose={() => setVerify(null)}
      />
    </div>
  );
}
