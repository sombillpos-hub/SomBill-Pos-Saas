import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusCircle } from 'lucide-react';
import { useAuth, useRestaurant } from '@sombill/shared-hooks/AuthContext';
import { useQuery } from '@sombill/shared-hooks/useQuery';
import { useRealtime } from '@sombill/shared-hooks/useRealtime';
import { supabase, unwrap } from '@sombill/api-client/supabase';
import { presetRange, rangeToIso, type DateRange } from '@sombill/shared-utils/dates';
import { fetchTables } from '@sombill/api-client/queries';
import { formatDate, formatMoney } from '@sombill/shared-utils/format';
import type { Customer, Order, OrderStatus } from '@sombill/shared-types/types';
import { Card, EmptyState, PageHeader } from '@sombill/shared-ui/ui/Feedback';
import { DataTable, Pagination, type Column } from '@sombill/shared-ui/ui/DataTable';
import { DateRangeFilter, SearchInput, Tabs } from '@sombill/shared-ui/ui/Filters';
import { OrderStatusBadge, PaymentStatusBadge } from '@sombill/shared-ui/ui/StatusBadges';
import { Button } from '@sombill/shared-ui/ui/Button';
import { fetchItemsFor, fetchOrdersBetween, itemsByOrder } from '@sombill/api-client/orderData';

type Filter = 'active' | 'pending' | 'preparing' | 'ready' | 'served' | 'completed' | 'cancelled';
const FILTERS: Array<[Filter, string, OrderStatus[]]> = [
  ['active', 'Active', ['new', 'pending', 'accepted', 'preparing', 'ready', 'served']],
  ['pending', 'Pending', ['new', 'pending', 'accepted']],
  ['preparing', 'Preparing', ['preparing']],
  ['ready', 'Ready', ['ready']],
  ['served', 'Served', ['served']],
  ['completed', 'Completed', ['completed']],
  ['cancelled', 'Cancelled', ['cancelled']],
];
const PAGE = 20;

export default function MyOrdersPage() {
  const r = useRestaurant();
  const { session } = useAuth();
  const uid = session?.user.id;
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>('active');
  const [range, setRange] = useState<DateRange>(() => presetRange('today', r.timezone));
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const q = useQuery(async () => {
    const { fromIso, toIso } = rangeToIso(range, r.timezone);
    const [orders, tables] = await Promise.all([fetchOrdersBetween(r.id, fromIso, toIso, uid), fetchTables(r.id)]);
    const items = itemsByOrder(await fetchItemsFor(orders.map((o) => o.id)));
    const custIds = [...new Set(orders.map((o) => o.customer_id).filter(Boolean))] as string[];
    const customers = custIds.length
      ? (unwrap(await supabase.from('customers').select('id,name').in('id', custIds)) as Pick<
          Customer,
          'id' | 'name'
        >[])
      : [];
    return {
      orders,
      items,
      tables: new Map(tables.map((t) => [t.id, t.table_number])),
      customers: new Map(customers.map((c) => [c.id, c.name])),
    };
  }, [r.id, uid, range.from, range.to]);
  useRealtime(['orders', 'order_items', 'payments'], r.id, () => void q.reload());

  const statuses = FILTERS.find((f) => f[0] === filter)![2];
  const rows = useMemo(() => {
    const t = search.trim().toLowerCase().replace(/^#/, '');
    return (q.data?.orders ?? [])
      .filter((o) => statuses.includes(o.status))
      .filter((o) => {
        if (!t) return true;
        const table = o.table_id ? String(q.data!.tables.get(o.table_id) ?? '') : '';
        const cust = o.customer_id ? (q.data!.customers.get(o.customer_id)?.toLowerCase() ?? '') : '';
        const items = (q.data!.items.get(o.id) ?? []).map((i) => i.product_name.toLowerCase()).join(' ');
        return (
          String(o.order_number) === t || table === t || `table ${table}` === t || cust.includes(t) || items.includes(t)
        );
      });
  }, [q.data, statuses, search]);
  const count = (f: Filter) =>
    (q.data?.orders ?? []).filter((o) => FILTERS.find((x) => x[0] === f)![2].includes(o.status)).length;
  const time = (iso: string) =>
    new Intl.DateTimeFormat('en-GB', { timeZone: r.timezone, hour: '2-digit', minute: '2-digit' }).format(
      new Date(iso),
    );

  const columns: Column<Order>[] = [
    { key: 'no', header: 'Order', cell: (o) => <b>#{o.order_number}</b> },
    { key: 'table', header: 'Table', cell: (o) => (o.table_id ? (q.data?.tables.get(o.table_id) ?? '—') : '—') },
    {
      key: 'cust',
      header: 'Customer',
      cell: (o) => (o.customer_id ? (q.data?.customers.get(o.customer_id) ?? '—') : '—'),
    },
    {
      key: 'date',
      header: 'Date',
      cell: (o) => <span className="whitespace-nowrap">{formatDate(o.created_at, r.timezone)}</span>,
    },
    { key: 'time', header: 'Time', cell: (o) => time(o.created_at) },
    {
      key: 'items',
      header: 'Items',
      cell: (o) => {
        const its = (q.data?.items.get(o.id) ?? []).filter((i) => !i.is_voided);
        return (
          <span
            className="block max-w-[14rem] truncate text-slate-600"
            title={its.map((i) => `${Number(i.quantity)}× ${i.product_name}`).join(', ')}
          >
            {its.map((i) => `${Number(i.quantity)}× ${i.product_name}`).join(', ') || '—'}
          </span>
        );
      },
    },
    { key: 'total', header: 'Total', align: 'right', cell: (o) => formatMoney(o.total, r.currency) },
    { key: 'status', header: 'Status', cell: (o) => <OrderStatusBadge s={o.status} /> },
    { key: 'pay', header: 'Payment', cell: (o) => <PaymentStatusBadge s={o.payment_status} /> },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Floor · Service Tickets"
        title="My Orders"
        description="Orders you opened. Updates arrive live from the kitchen and cashier."
        actions={
          <Button icon={<PlusCircle className="h-4 w-4" />} onClick={() => navigate('/waiter/new-order')}>
            New order
          </Button>
        }
      />
      <Card bodyClassName="p-0">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 xl:flex-row xl:items-center xl:justify-between">
          <SearchInput
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Order #, table, customer or item"
            className="xl:w-80"
          />
          <DateRangeFilter
            value={range}
            onChange={(v) => {
              setRange(v);
              setPage(1);
            }}
            timeZone={r.timezone}
          />
        </div>
        <div className="px-4 pt-2">
          <Tabs
            value={filter}
            onChange={(v) => {
              setFilter(v);
              setPage(1);
            }}
            tabs={FILTERS.map(([id, label]) => ({ id, label, count: count(id) }))}
          />
        </div>
        <DataTable
          columns={columns}
          rows={rows.slice((page - 1) * PAGE, page * PAGE)}
          rowKey={(o) => o.id}
          loading={q.loading && !q.data}
          error={q.error}
          onRetry={q.reload}
          onRowClick={(o) => navigate(`/waiter/orders/${o.id}`)}
          empty={<EmptyState title="No orders here" message="Try another filter or date range." />}
        />
        <Pagination page={page} pageSize={PAGE} total={rows.length} onPage={setPage} />
      </Card>
    </div>
  );
}
