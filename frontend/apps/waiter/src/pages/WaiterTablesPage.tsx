import { useEffect, useMemo, useRef, useState } from 'react';
import { revealIfStacked } from '@sombill/shared-hooks/useMediaQuery';
import { useNavigate } from 'react-router-dom';
import { History, PlusCircle, Receipt, RefreshCw, Users, Eye } from 'lucide-react';
import { useAuth, useRestaurant } from '@sombill/shared-hooks/AuthContext';
import { useQuery } from '@sombill/shared-hooks/useQuery';
import { useRealtime } from '@sombill/shared-hooks/useRealtime';
import { useStaffDirectory } from '@sombill/shared-hooks/useStaffDirectory';
import { supabase, unwrap } from '@sombill/api-client/supabase';
import { fetchTableStatus } from '@sombill/api-client/queries';
import { formatDateTime, formatDuration, formatMoney, TABLE_STATUS_LABEL } from '@sombill/shared-utils/format';
import { cn } from '@sombill/shared-utils/cn';
import type { Order, TableStatus, TableStatusRow } from '@sombill/shared-types/types';
import { Card, EmptyState, ErrorState, PageHeader, Skeleton } from '@sombill/shared-ui/ui/Feedback';
import { OrderStatusBadge, PaymentStatusBadge, TableStatusBadge } from '@sombill/shared-ui/ui/StatusBadges';
import { Button } from '@sombill/shared-ui/ui/Button';
import { Modal } from '@sombill/shared-ui/ui/Modal';
import { useCart } from '@sombill/shared-hooks/cart';
import { canActOnOrder, canAddItems } from '@sombill/shared-utils/posRules';

const STYLE: Record<TableStatus, string> = {
  available: 'border-emerald-300 bg-emerald-50 hover:border-emerald-500',
  occupied: 'border-orange-300 bg-orange-50 hover:border-orange-500',
  bill_requested: 'border-violet-300 bg-violet-50 hover:border-violet-500',
  payment_pending: 'border-red-300 bg-red-50 hover:border-red-500',
  cleaning: 'border-sky-300 bg-sky-50',
};
const WAITER_STATUSES: TableStatus[] = ['available', 'occupied', 'bill_requested', 'payment_pending'];

export default function WaiterTablesPage() {
  const r = useRestaurant();
  const { session, role } = useAuth();
  const uid = session?.user.id;
  const navigate = useNavigate();
  const cart = useCart();
  const staff = useStaffDirectory(r.id);
  const [section, setSection] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [historyFor, setHistoryFor] = useState<TableStatusRow | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [, tick] = useState(0);

  const q = useQuery(async () => {
    const tables = await fetchTableStatus(r.id);
    const ids = tables.map((t) => t.order_id).filter(Boolean) as string[];
    const orders = ids.length ? (unwrap(await supabase.from('orders').select('*').in('id', ids)) as Order[]) : [];
    return { tables, orders: new Map(orders.map((o) => [o.id, o])) };
  }, [r.id]);
  useRealtime(['orders', 'payments', 'restaurant_tables'], r.id, () => void q.reload());
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const sections = useMemo(() => [...new Set((q.data?.tables ?? []).map((t) => t.section))].sort(), [q.data]);
  const tables = (q.data?.tables ?? []).filter((t) => !section || t.section === section);
  const selected = q.data?.tables.find((t) => t.id === selectedId) ?? null;
  const selOrder = selected?.order_id ? (q.data?.orders.get(selected.order_id) ?? null) : null;
  const counts = (q.data?.tables ?? []).reduce<Record<string, number>>(
    (m, t) => ({ ...m, [t.status]: (m[t.status] ?? 0) + 1 }),
    {},
  );

  const startOrder = (t: TableStatusRow) => {
    if (t.status !== 'available' && !r.settings.tables.allow_multiple_orders) return;
    if (cart.existingOrderId) cart.clear();
    cart.setTable(t.id);
    navigate('/waiter/new-order');
  };
  const addItems = (o: Order) => {
    cart.startExistingOrder(o.id, o.table_id);
    navigate('/waiter/new-order');
  };

  return (
    <div>
      <PageHeader
        eyebrow="Floor · Live Seating"
        title="Tables"
        description="Live floor plan. Status comes from open orders and payments."
        actions={
          <Button variant="secondary" icon={<RefreshCw className="h-4 w-4" />} onClick={() => void q.reload()}>
            Refresh
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2" data-sb="status-pills">
        {WAITER_STATUSES.map((s) => (
          <span
            key={s}
            data-sb="status-pill"
            data-state={s}
            className={cn(
              'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold',
              STYLE[s],
            )}
          >
            {TABLE_STATUS_LABEL[s]} <span className="tabular-nums">{counts[s] ?? 0}</span>
          </span>
        ))}
        {sections.length > 1 && (
          <select
            className="input ml-auto h-10 w-auto"
            aria-label="Section"
            value={section}
            onChange={(e) => setSection(e.target.value)}
          >
            <option value="">All sections</option>
            {sections.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
      </div>

      {q.error ? (
        <div className="card">
          <ErrorState message={q.error} onRetry={q.reload} />
        </div>
      ) : q.loading && !q.data ? (
        <Skeleton className="h-80 w-full" />
      ) : !tables.length ? (
        <div className="card">
          <EmptyState title="No tables configured" message="Ask your manager to add tables in the Manager dashboard." />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 2xl:grid-cols-5"
            role="list"
            aria-label="Tables"
          >
            {tables.map((t) => {
              const mine = t.waiter_id === uid;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="listitem"
                  data-sb="table-card"
                  data-state={t.status}
                  data-shape={t.shape}
                  data-mine={mine || undefined}
                  onClick={() => {
                    setSelectedId(t.id);
                    revealIfStacked(panelRef.current);
                  }}
                  aria-pressed={selectedId === t.id}
                  aria-label={`Table ${t.table_number}, ${TABLE_STATUS_LABEL[t.status]}`}
                  className={cn(
                    'flex min-h-[120px] flex-col justify-between rounded-xl border-2 p-3 text-left transition-shadow',
                    STYLE[t.status],
                    t.shape === 'round' && 'rounded-[1.75rem]',
                    selectedId === t.id && 'ring-4 ring-brand-orange/40',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p data-sb="table-no" className="text-2xl font-bold leading-none text-brand-navy">
                        {t.table_number}
                      </p>
                      <p className="truncate text-xs text-slate-500">{t.name ?? t.section}</p>
                    </div>
                    <span className="inline-flex items-center gap-0.5 text-xs text-slate-500">
                      <Users className="h-3.5 w-3.5" />
                      {t.capacity}
                    </span>
                  </div>
                  {t.order_id ? (
                    <div className="mt-2 text-xs">
                      <p className="font-semibold" data-sb="table-timer">
                        #{t.order_number} · {formatDuration(t.order_started_at)}
                      </p>
                      <p className="truncate text-slate-600">{mine ? 'You' : staff.nameOf(t.waiter_id)}</p>
                      <p data-sb="table-total" className="font-semibold tabular-nums text-brand-red">
                        {formatMoney(t.balance, r.currency)}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs font-semibold text-emerald-700">{TABLE_STATUS_LABEL[t.status]}</p>
                  )}
                </button>
              );
            })}
          </div>

          <div ref={panelRef} className="scroll-mt-20">
            <Card
              title={selected ? `Table ${selected.table_number}` : 'Select a table'}
              className="h-fit xl:sticky xl:top-20"
            >
              {!selected ? (
                <p className="text-sm text-slate-500">Tap a table to see its details and actions.</p>
              ) : (
                <div className="space-y-4">
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                    <dt className="text-slate-500">Name</dt>
                    <dd>{selected.name ?? '—'}</dd>
                    <dt className="text-slate-500">Section</dt>
                    <dd>{selected.section}</dd>
                    <dt className="text-slate-500">Seats</dt>
                    <dd>{selected.capacity}</dd>
                    <dt className="text-slate-500">Status</dt>
                    <dd>
                      <TableStatusBadge s={selected.status} />
                    </dd>
                    {selected.order_id && (
                      <>
                        <dt className="text-slate-500">Waiter</dt>
                        <dd>{selected.waiter_id === uid ? 'You' : staff.nameOf(selected.waiter_id)}</dd>
                        <dt className="text-slate-500">Order</dt>
                        <dd>#{selected.order_number}</dd>
                        <dt className="text-slate-500">Amount</dt>
                        <dd className="font-semibold">{formatMoney(selected.order_total ?? 0, r.currency)}</dd>
                        <dt className="text-slate-500">Balance</dt>
                        <dd className="font-semibold text-brand-red">{formatMoney(selected.balance, r.currency)}</dd>
                        <dt className="text-slate-500">Occupied for</dt>
                        <dd>{formatDuration(selected.order_started_at)}</dd>
                      </>
                    )}
                  </dl>
                  {selOrder && (
                    <div className="flex gap-2">
                      <OrderStatusBadge s={selOrder.status} />
                      <PaymentStatusBadge s={selOrder.payment_status} />
                    </div>
                  )}
                  <div className="grid gap-2">
                    {(selected.status === 'available' || r.settings.tables.allow_multiple_orders) && (
                      <Button
                        className="h-12"
                        icon={<PlusCircle className="h-5 w-5" />}
                        onClick={() => startOrder(selected)}
                      >
                        Start new order
                      </Button>
                    )}
                    {selOrder && canAddItems(selOrder, uid, role, r.settings) && (
                      <Button
                        className="h-12"
                        icon={<PlusCircle className="h-5 w-5" />}
                        onClick={() => addItems(selOrder)}
                      >
                        Add items to #{selOrder.order_number}
                      </Button>
                    )}
                    {selOrder && (
                      <Button
                        variant="secondary"
                        className="h-12"
                        icon={<Eye className="h-5 w-5" />}
                        onClick={() => navigate(`/waiter/orders/${selOrder.id}`)}
                      >
                        View order
                      </Button>
                    )}
                    {selOrder && canActOnOrder(selOrder, uid, role, r.settings) && (
                      <Button
                        variant="secondary"
                        className="h-12"
                        icon={<Receipt className="h-5 w-5" />}
                        onClick={() => navigate(`/waiter/bills?order=${selOrder.id}`)}
                      >
                        Bill
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      className="h-12"
                      icon={<History className="h-5 w-5" />}
                      onClick={() => setHistoryFor(selected)}
                    >
                      Table history
                    </Button>
                  </div>
                  {selOrder && !canActOnOrder(selOrder, uid, role, r.settings) && (
                    <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                      This table is served by {staff.nameOf(selected.waiter_id)}. You can view it but not change it.
                    </p>
                  )}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
      {historyFor && <TableHistoryModal table={historyFor} onClose={() => setHistoryFor(null)} />}
    </div>
  );
}

function TableHistoryModal({ table, onClose }: { table: TableStatusRow; onClose: () => void }) {
  const r = useRestaurant();
  const navigate = useNavigate();
  const staff = useStaffDirectory(r.id);
  const q = useQuery(
    async () =>
      unwrap(
        await supabase
          .from('orders')
          .select('*')
          .eq('table_id', table.id)
          .order('created_at', { ascending: false })
          .limit(20),
      ) as Order[],
    [table.id],
  );
  return (
    <Modal open onClose={onClose} size="lg" title={`Table ${table.table_number} – recent orders`}>
      {q.loading ? (
        <Skeleton className="h-40 w-full" />
      ) : !q.data?.length ? (
        <EmptyState title="No orders yet for this table" />
      ) : (
        <ul className="divide-y divide-slate-100">
          {q.data.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                className="flex w-full flex-wrap items-center justify-between gap-2 py-3 text-left hover:bg-slate-50"
                onClick={() => navigate(`/waiter/orders/${o.id}`)}
              >
                <span className="min-w-0">
                  <b>#{o.order_number}</b>{' '}
                  <span className="text-sm text-slate-500">
                    {formatDateTime(o.created_at, r.timezone)} · {staff.nameOf(o.waiter_id)}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <OrderStatusBadge s={o.status} />
                  <span className="font-semibold tabular-nums">{formatMoney(o.total, r.currency)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
