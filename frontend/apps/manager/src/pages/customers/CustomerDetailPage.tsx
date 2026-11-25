import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Mail, MapPin, Pencil, Phone } from 'lucide-react';
import { useRestaurant } from '@sombill/shared-hooks/AuthContext';
import { useQuery } from '@sombill/shared-hooks/useQuery';
import { fetchAll, supabase, unwrap } from '@sombill/api-client/supabase';
import { orderBalance } from '@sombill/shared-utils/reports';
import { formatDateTime, formatMoney, ORDER_TYPE_LABEL } from '@sombill/shared-utils/format';
import type { Customer, Order } from '@sombill/shared-types/types';
import { Card, EmptyState, ErrorState, PageHeader, Skeleton, StatCard, Badge } from '@sombill/shared-ui/ui/Feedback';
import { DataTable, type Column } from '@sombill/shared-ui/ui/DataTable';
import { OrderStatusBadge, PaymentStatusBadge } from '@sombill/shared-ui/ui/StatusBadges';
import { Button } from '@sombill/shared-ui/ui/Button';
import { CustomerModal } from './CustomersPage';

export default function CustomerDetailPage() {
  const { id = '' } = useParams();
  const r = useRestaurant();
  const navigate = useNavigate();
  const money = (n: number) => formatMoney(n, r.currency);
  const [editing, setEditing] = useState(false);
  const q = useQuery(async () => {
    const customer = unwrap(
      await supabase.from('customers').select('*').eq('id', id).eq('restaurant_id', r.id).maybeSingle(),
    ) as Customer | null;
    if (!customer) return null;
    const orders = await fetchAll<Order>((a, b) =>
      supabase.from('orders').select('*').eq('customer_id', id).order('created_at', { ascending: false }).range(a, b),
    );
    return { customer, orders };
  }, [id, r.id]);

  if (q.loading && !q.data) return <Skeleton className="h-64 w-full" />;
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
          title="Customer not found"
          action={
            <Link to="/customers">
              <Button variant="secondary">Back</Button>
            </Link>
          }
        />
      </div>
    );
  const { customer: c, orders } = q.data;
  const live = orders.filter((o) => o.status !== 'cancelled');
  const spent = live.reduce((s, o) => s + o.amount_paid - o.amount_refunded, 0);
  const outstanding = live.reduce((s, o) => s + orderBalance(o), 0);

  const columns: Column<Order>[] = [
    { key: 'no', header: 'Order', cell: (o) => <b>#{o.order_number}</b> },
    { key: 'date', header: 'Date', cell: (o) => formatDateTime(o.created_at, r.timezone) },
    { key: 'type', header: 'Type', cell: (o) => ORDER_TYPE_LABEL[o.order_type] },
    { key: 'status', header: 'Status', cell: (o) => <OrderStatusBadge s={o.status} /> },
    { key: 'pay', header: 'Payment', cell: (o) => <PaymentStatusBadge s={o.payment_status} /> },
    { key: 'total', header: 'Total', align: 'right', cell: (o) => money(o.total) },
    { key: 'bal', header: 'Balance', align: 'right', cell: (o) => money(orderBalance(o)) },
  ];

  return (
    <div>
      <div className="mb-2">
        <Link to="/customers" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-red">
          <ArrowLeft className="h-4 w-4" /> Customers
        </Link>
      </div>
      <PageHeader
        title={c.name}
        description={`Customer since ${formatDateTime(c.created_at, r.timezone)}`}
        actions={
          !c.archived_at ? (
            <Button variant="secondary" icon={<Pencil className="h-4 w-4" />} onClick={() => setEditing(true)}>
              Edit
            </Button>
          ) : (
            <Badge tone="gray">Archived</Badge>
          )
        }
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Orders" value={live.length} />
        <StatCard label="Total purchases" value={money(spent)} tone="green" sub="Payments net of refunds" />
        <StatCard label="Outstanding balance" value={money(outstanding)} tone="red" />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card title="Contact">
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-slate-400" />
              {c.phone ?? '—'}
            </li>
            <li className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-slate-400" />
              {c.email ?? '—'}
            </li>
            <li className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-slate-400" />
              {c.address ?? '—'}
            </li>
          </ul>
          {c.notes && (
            <p className="mt-4 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{c.notes}</p>
          )}
        </Card>
        <Card title="Order history" bodyClassName="p-0" className="xl:col-span-2">
          <DataTable
            columns={columns}
            rows={orders}
            rowKey={(o) => o.id}
            onRowClick={(o) => navigate(`/orders/${o.id}`)}
            empty={<EmptyState title="No orders yet" />}
          />
        </Card>
      </div>
      {editing && (
        <CustomerModal
          customer={c}
          restaurantId={r.id}
          onClose={() => setEditing(false)}
          onSaved={async () => {
            setEditing(false);
            await q.reload();
          }}
        />
      )}
    </div>
  );
}
