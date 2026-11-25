import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ConciergeBell } from 'lucide-react';
import { useAuth, useRestaurant } from '@sombill/shared-hooks/AuthContext';
import { useQuery } from '@sombill/shared-hooks/useQuery';
import { useRealtime } from '@sombill/shared-hooks/useRealtime';
import { supabase, unwrap, friendlyError } from '@sombill/api-client/supabase';
import { fetchTables } from '@sombill/api-client/queries';
import { formatDuration, ORDER_STATUS_LABEL } from '@sombill/shared-utils/format';
import { cn } from '@sombill/shared-utils/cn';
import type { Order, OrderStatus } from '@sombill/shared-types/types';
import { EmptyState, ErrorState, PageHeader, Skeleton } from '@sombill/shared-ui/ui/Feedback';
import { Button } from '@sombill/shared-ui/ui/Button';
import { useToast } from '@sombill/shared-ui/ui/Toast';
import { fetchActiveOrders, fetchItemsFor, itemsByOrder } from '@sombill/api-client/orderData';
import { canServe, KITCHEN_FLOW } from '@sombill/shared-utils/posRules';

const COLUMN_TONE: Record<string, string> = {
  new: 'border-t-sky-500',
  accepted: 'border-t-indigo-500',
  preparing: 'border-t-brand-orange',
  ready: 'border-t-emerald-500',
  served: 'border-t-slate-400',
};

/** Read-only kitchen board for waiters. Status changes belong to kitchen staff; waiters can only serve Ready orders. */
export default function KitchenStatusPage() {
  const r = useRestaurant();
  const { session, role } = useAuth();
  const uid = session?.user.id;
  const toast = useToast();
  const [mineOnly, setMineOnly] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const q = useQuery(async () => {
    const [orders, tables] = await Promise.all([fetchActiveOrders(r.id), fetchTables(r.id)]);
    const items = itemsByOrder(await fetchItemsFor(orders.map((o) => o.id)));
    return { orders, items, tables: new Map(tables.map((t) => [t.id, t.table_number])) };
  }, [r.id]);
  useRealtime(['orders', 'order_items'], r.id, () => void q.reload(), { debounceMs: 250 });

  const orders = (q.data?.orders ?? []).filter((o) => !mineOnly || o.waiter_id === uid);
  const col = (s: OrderStatus) =>
    orders
      .filter((o) => (s === 'new' ? o.status === 'new' || o.status === 'pending' : o.status === s))
      .sort((a, b) => a.created_at.localeCompare(b.created_at));

  const serve = async (o: Order) => {
    setBusy(o.id);
    try {
      unwrap(await supabase.from('orders').update({ status: 'served' }).eq('id', o.id).select('id').single());
      toast.success(`Order #${o.order_number} served.`);
      await q.reload();
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Service · Kitchen Dispatch"
        title="Kitchen Status"
        description="Live preparation progress. Only kitchen staff change preparation status."
        actions={
          <div className="flex rounded-lg border border-slate-200 bg-white p-0.5" data-sb="seg">
            {[true, false].map((v) => (
              <button
                key={String(v)}
                type="button"
                onClick={() => setMineOnly(v)}
                aria-pressed={mineOnly === v}
                data-sb="seg-btn"
                className={cn(
                  'h-10 rounded-md px-4 text-sm font-semibold',
                  mineOnly === v ? 'bg-brand-navy text-white' : 'text-slate-600',
                )}
              >
                {v ? 'My orders' : 'All orders'}
              </button>
            ))}
          </div>
        }
      />
      {q.error ? (
        <div className="card">
          <ErrorState message={q.error} onRetry={q.reload} />
        </div>
      ) : q.loading && !q.data ? (
        <Skeleton className="h-80 w-full" />
      ) : !orders.length ? (
        <div className="card">
          <EmptyState
            title="No active orders"
            message={mineOnly ? 'You have no orders in the kitchen right now.' : 'The kitchen is clear.'}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          {KITCHEN_FLOW.map((s) => (
            <section key={s} aria-label={ORDER_STATUS_LABEL[s]} className="min-w-0">
              <h2 className="mb-2 flex items-center justify-between text-sm font-bold uppercase tracking-wide text-slate-600">
                {ORDER_STATUS_LABEL[s]}
                <span className="rounded-full bg-white px-2 py-0.5 text-xs ring-1 ring-slate-200">{col(s).length}</span>
              </h2>
              <div className="space-y-3">
                {col(s).map((o) => (
                  <article
                    key={o.id}
                    className={cn('card border-t-4 p-3', COLUMN_TONE[s])}
                    data-sb="kitchen-ticket"
                    data-state={s}
                    data-testid={`kitchen-${o.order_number}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        to={`/waiter/orders/${o.id}`}
                        className="-m-2 inline-flex min-h-[40px] items-center p-2 font-bold text-brand-navy hover:underline"
                      >
                        #{o.order_number}
                      </Link>
                      <span className="text-xs text-slate-500">
                        {o.table_id ? `Table ${q.data!.tables.get(o.table_id)}` : ''} · {formatDuration(o.created_at)}
                      </span>
                    </div>
                    <ul className="mt-2 space-y-1 text-sm">
                      {(q.data!.items.get(o.id) ?? [])
                        .filter((i) => !i.is_voided)
                        .map((i) => (
                          <li key={i.id}>
                            <b className="tabular-nums">{Number(i.quantity)}×</b> {i.product_name}
                            {i.notes && <span className="block text-xs text-brand-orange">↳ {i.notes}</span>}
                          </li>
                        ))}
                    </ul>
                    {o.notes && <p className="mt-2 rounded bg-orange-50 p-2 text-xs text-orange-900">{o.notes}</p>}
                    {canServe(o, uid, role, r.settings) && (
                      <Button
                        className="mt-3 h-11 w-full"
                        icon={<ConciergeBell className="h-4 w-4" />}
                        loading={busy === o.id}
                        onClick={() => void serve(o)}
                      >
                        Mark served
                      </Button>
                    )}
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
