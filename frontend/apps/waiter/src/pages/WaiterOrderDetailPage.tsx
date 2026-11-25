import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ConciergeBell, PlusCircle, Printer, Receipt } from 'lucide-react';
import { useState } from 'react';
import { KitchenTicketModal, type KitchenTicketData } from '../components/KitchenTicket';
import { useAuth, useRestaurant } from '@sombill/shared-hooks/AuthContext';
import { useQuery } from '@sombill/shared-hooks/useQuery';
import { useRealtime } from '@sombill/shared-hooks/useRealtime';
import { useStaffDirectory } from '@sombill/shared-hooks/useStaffDirectory';
import { supabase, unwrap, friendlyError } from '@sombill/api-client/supabase';
import { formatDateTime, formatMoney, ORDER_STATUS_LABEL } from '@sombill/shared-utils/format';
import { cn } from '@sombill/shared-utils/cn';
import type { Customer, Order, OrderItem, RestaurantTable } from '@sombill/shared-types/types';
import { Card, EmptyState, ErrorState, PageHeader, Skeleton } from '@sombill/shared-ui/ui/Feedback';
import { OrderStatusBadge, PaymentStatusBadge } from '@sombill/shared-ui/ui/StatusBadges';
import { Button } from '@sombill/shared-ui/ui/Button';
import { useToast } from '@sombill/shared-ui/ui/Toast';
import { useCart } from '@sombill/shared-hooks/cart';
import {
  BILL_STATE_LABEL,
  billState,
  canActOnOrder,
  canAddItems,
  canServe,
  KITCHEN_FLOW,
} from '@sombill/shared-utils/posRules';

export default function WaiterOrderDetailPage() {
  const { id = '' } = useParams();
  const r = useRestaurant();
  const { session, role } = useAuth();
  const uid = session?.user.id;
  const navigate = useNavigate();
  const toast = useToast();
  const cart = useCart();
  const staff = useStaffDirectory(r.id);
  const [serving, setServing] = useState(false);
  const [ticketPreview, setTicketPreview] = useState<KitchenTicketData | null>(null);
  const money = (n: number) => formatMoney(n, r.currency);
  const q = useQuery(async () => {
    const o = unwrap(
      await supabase.from('orders').select('*').eq('id', id).eq('restaurant_id', r.id).maybeSingle(),
    ) as Order | null;
    if (!o) return null;
    const [items, table, customer] = await Promise.all([
      supabase
        .from('order_items')
        .select('*')
        .eq('order_id', id)
        .order('created_at')
        .then((x) => unwrap(x) as OrderItem[]),
      o.table_id
        ? supabase
            .from('restaurant_tables')
            .select('*')
            .eq('id', o.table_id)
            .maybeSingle()
            .then((x) => unwrap(x) as RestaurantTable | null)
        : Promise.resolve(null),
      o.customer_id
        ? supabase
            .from('customers')
            .select('*')
            .eq('id', o.customer_id)
            .maybeSingle()
            .then((x) => unwrap(x) as Customer | null)
        : Promise.resolve(null),
    ]);
    return { o, items, table, customer };
  }, [id, r.id]);
  useRealtime(['orders', 'order_items', 'payments'], r.id, () => void q.reload());

  if (q.loading && !q.data) return <Skeleton className="h-72 w-full" />;
  if (q.error)
    return (
      <div className="card">
        <ErrorState message={q.error} onRetry={q.reload} />
      </div>
    );
  if (!q.data)
    return (
      <div className="card">
        <EmptyState
          title="Order not found"
          action={
            <Link to="/waiter/orders">
              <Button variant="secondary">My orders</Button>
            </Link>
          }
        />
      </div>
    );
  const { o, items, table, customer } = q.data;

  // Order history: items grouped by the moment they were sent (first round + additions).
  const rounds = new Map<string, OrderItem[]>();
  for (const it of items) {
    const k = it.created_at.slice(0, 16);
    rounds.set(k, [...(rounds.get(k) ?? []), it]);
  }
  const stepIdx = KITCHEN_FLOW.indexOf(o.status === 'pending' ? 'new' : o.status);

  const serve = async () => {
    setServing(true);
    try {
      unwrap(await supabase.from('orders').update({ status: 'served' }).eq('id', o.id).select('id').single());
      toast.success(`Order #${o.order_number} marked served.`);
      await q.reload();
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setServing(false);
    }
  };

  return (
    <div>
      <div className="mb-2">
        <Link
          to="/waiter/orders"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-red"
        >
          <ArrowLeft className="h-4 w-4" /> My orders
        </Link>
      </div>
      <PageHeader
        title={`Order #${o.order_number}`}
        description={`${table ? `Table ${table.table_number}${table.name ? ` · ${table.name}` : ''} · ` : ''}${formatDateTime(o.created_at, r.timezone)} · ${staff.nameOf(o.waiter_id)}`}
        actions={
          <>
            {canServe(o, uid, role, r.settings) && (
              <Button
                className="h-11"
                icon={<ConciergeBell className="h-4 w-4" />}
                loading={serving}
                onClick={() => void serve()}
              >
                Mark served
              </Button>
            )}
            {canAddItems(o, uid, role, r.settings) && (
              <Button
                className="h-11"
                variant="navy"
                icon={<PlusCircle className="h-4 w-4" />}
                onClick={() => {
                  cart.startExistingOrder(o.id, o.table_id);
                  navigate('/waiter/new-order');
                }}
              >
                Add items
              </Button>
            )}
            <Button
              className="h-11"
              variant="secondary"
              icon={<Printer className="h-4 w-4" />}
              onClick={() =>
                setTicketPreview({
                  restaurantName: r.name,
                  orderNumber: o.order_number,
                  tableLabel: table ? `Table ${table.table_number}${table.name ? ` · ${table.name}` : ''}` : null,
                  waiterName: o.waiter_id ? staff.nameOf(o.waiter_id) : 'QR Self-Order',
                  orderNotes: o.notes,
                  timezone: r.timezone,
                  printedAt: new Date(),
                  items: items
                    .filter((i) => !i.is_voided)
                    .map((i) => ({ name: i.product_name, quantity: Number(i.quantity), notes: i.notes })),
                })
              }
            >
              Print items receipt
            </Button>
            {canActOnOrder(o, uid, role, r.settings) && (
              <Button
                className="h-11"
                variant="secondary"
                icon={<Receipt className="h-4 w-4" />}
                onClick={() => navigate(`/waiter/bills?order=${o.id}`)}
              >
                Bill
              </Button>
            )}
          </>
        }
      />

      {o.status !== 'cancelled' && o.status !== 'completed' && (
        <ol className="mb-6 grid grid-cols-5 gap-2" aria-label="Preparation progress">
          {KITCHEN_FLOW.map((s, i) => (
            <li
              key={s}
              className={cn(
                'rounded-lg px-2 py-2 text-center text-xs font-semibold sm:text-sm',
                i <= stepIdx ? 'bg-brand-orange text-white' : 'bg-white text-slate-400 ring-1 ring-slate-200',
              )}
              aria-current={i === stepIdx ? 'step' : undefined}
            >
              {ORDER_STATUS_LABEL[s]}
            </li>
          ))}
        </ol>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card title="Items" className="lg:col-span-2" bodyClassName="p-0">
          <ul className="divide-y divide-slate-100">
            {items.map((it) => (
              <li
                key={it.id}
                className={cn('flex items-start justify-between gap-3 px-5 py-3', it.is_voided && 'text-slate-400')}
              >
                <div className="min-w-0">
                  <p className={cn('font-medium', it.is_voided && 'line-through')}>
                    {Number(it.quantity)} × {it.product_name}
                  </p>
                  {it.notes && <p className="text-sm text-brand-orange">Note: {it.notes}</p>}
                  {it.is_voided && <p className="text-xs text-red-600">Voided: {it.void_reason}</p>}
                </div>
                <div className="shrink-0 text-right text-sm tabular-nums">
                  <p className="font-semibold">{money(it.line_total)}</p>
                  <p className="text-xs text-slate-500">{money(it.unit_price)} each</p>
                </div>
              </li>
            ))}
          </ul>
          <dl className="space-y-1 border-t border-slate-100 px-5 py-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Subtotal</dt>
              <dd className="tabular-nums">{money(o.subtotal)}</dd>
            </div>
            {o.discount_amount > 0 && (
              <div className="flex justify-between">
                <dt className="text-slate-500">Discount</dt>
                <dd className="tabular-nums">−{money(o.discount_amount)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-slate-500">{r.tax_label}</dt>
              <dd className="tabular-nums">{money(o.tax_amount)}</dd>
            </div>
            <div className="flex justify-between text-base font-bold text-brand-navy">
              <dt>Total</dt>
              <dd className="tabular-nums">{money(o.total)}</dd>
            </div>
          </dl>
        </Card>
        <div className="space-y-6">
          <Card title="Status">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Order</dt>
                <dd>
                  <OrderStatusBadge s={o.status} />
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Payment</dt>
                <dd>
                  <PaymentStatusBadge s={o.payment_status} />
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Bill</dt>
                <dd className="text-right">{BILL_STATE_LABEL[billState(o)]}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Customer</dt>
                <dd>{customer?.name ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Guests</dt>
                <dd>{o.guest_count ?? '—'}</dd>
              </div>
            </dl>
            {o.notes && (
              <p className="mt-3 rounded-lg bg-orange-50 p-3 text-sm text-orange-900">
                <b>Instructions:</b> {o.notes}
              </p>
            )}
            {o.status === 'cancelled' && (
              <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">Cancelled: {o.cancel_reason}</p>
            )}
          </Card>
          <Card title="Order history" bodyClassName="p-0">
            <ol className="divide-y divide-slate-100">
              {[...rounds.entries()].map(([k, its], i) => (
                <li key={k} className="px-5 py-3 text-sm">
                  <p className="font-semibold">
                    {i === 0 ? 'Order sent' : 'Items added'} · {formatDateTime(its[0]!.created_at, r.timezone)}
                  </p>
                  <p className="text-slate-600">
                    {its.map((x) => `${Number(x.quantity)}× ${x.product_name}`).join(', ')}
                  </p>
                </li>
              ))}
              {o.bill_requested_at && (
                <li className="px-5 py-3 text-sm">
                  <p className="font-semibold">Bill requested · {formatDateTime(o.bill_requested_at, r.timezone)}</p>
                </li>
              )}
              {o.completed_at && (
                <li className="px-5 py-3 text-sm">
                  <p className="font-semibold">Completed · {formatDateTime(o.completed_at, r.timezone)}</p>
                </li>
              )}
            </ol>
          </Card>
        </div>
      </div>
      <KitchenTicketModal data={ticketPreview} onClose={() => setTicketPreview(null)} />
    </div>
  );
}
