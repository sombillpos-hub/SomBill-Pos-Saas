import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Download } from 'lucide-react';
import { useRestaurant } from '@sombill/shared-hooks/AuthContext';
import { useQuery } from '@sombill/shared-hooks/useQuery';
import { useRealtime } from '@sombill/shared-hooks/useRealtime';
import { useStaffDirectory } from '@sombill/shared-hooks/useStaffDirectory';
import { fetchAll, supabase, unwrap } from '@sombill/api-client/supabase';
import { presetRange, rangeToIso, type DateRange } from '@sombill/shared-utils/dates';
import { fetchTables } from '@sombill/api-client/queries';
import { orderBalance } from '@sombill/shared-utils/reports';
import { downloadCsv } from '@sombill/shared-utils/csv';
import {
  formatDateTime,
  formatMoney,
  ORDER_STATUS_LABEL,
  ORDER_TYPE_LABEL,
  PAYMENT_STATUS_LABEL,
} from '@sombill/shared-utils/format';
import type { Customer, Order, OrderStatus, PaymentStatus } from '@sombill/shared-types/types';
import { Card, PageHeader, EmptyState } from '@sombill/shared-ui/ui/Feedback';
import { DataTable, Pagination, type Column, type SortState } from '@sombill/shared-ui/ui/DataTable';
import { DateRangeFilter, SearchInput, Tabs } from '@sombill/shared-ui/ui/Filters';
import { OrderStatusBadge, PaymentStatusBadge } from '@sombill/shared-ui/ui/StatusBadges';
import { Button } from '@sombill/shared-ui/ui/Button';
import { useToast } from '@sombill/shared-ui/ui/Toast';

const PAGE = 25;
type StatusTab = 'all' | OrderStatus;
const STATUS_TABS: StatusTab[] = ['all', 'new', 'accepted', 'preparing', 'ready', 'served', 'completed', 'cancelled'];

export default function OrdersPage() {
  const r = useRestaurant();
  const tz = r.timezone;
  const toast = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [range, setRange] = useState<DateRange>(() => presetRange('today', tz));
  const status = (params.get('status') as StatusTab) || 'all';
  const [payment, setPayment] = useState<'' | PaymentStatus>('');
  const [tableId, setTableId] = useState('');
  const [waiterId, setWaiterId] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState>({ key: 'created_at', dir: 'desc' });
  const [exporting, setExporting] = useState(false);
  const staff = useStaffDirectory(r.id);
  const tables = useQuery(() => fetchTables(r.id), [r.id]);
  const tableNo = (id: string | null) => (id ? (tables.data?.find((t) => t.id === id)?.table_number ?? '—') : '—');

  const resetPage =
    <T,>(fn: (v: T) => void) =>
    (v: T) => {
      fn(v);
      setPage(1);
    };

  // Builds the filtered query (shared by list, counts and CSV export).
  const buildQuery = async (select: string, withStatus: boolean, count = false) => {
    const { fromIso, toIso } = rangeToIso(range, tz);
    let q = supabase
      .from('orders')
      .select(select, count ? { count: 'exact' } : undefined)
      .eq('restaurant_id', r.id)
      .gte('created_at', fromIso)
      .lt('created_at', toIso);
    if (withStatus && status !== 'all') q = q.eq('status', status);
    if (payment) q = q.eq('payment_status', payment);
    if (tableId) q = q.eq('table_id', tableId);
    if (waiterId) q = q.eq('waiter_id', waiterId);
    const term = search.trim().replace(/^#/, '');
    if (term) {
      if (/^\d+$/.test(term)) q = q.eq('order_number', Number(term));
      else {
        const custs = unwrap(
          await supabase
            .from('customers')
            .select('id')
            .eq('restaurant_id', r.id)
            .or(`name.ilike.%${term.replace(/[%,()]/g, '')}%,phone.ilike.%${term.replace(/[%,()]/g, '')}%`)
            .limit(200),
        ) as Pick<Customer, 'id'>[];
        q = q.in('customer_id', custs.length ? custs.map((c) => c.id) : ['00000000-0000-0000-0000-000000000000']);
      }
    }
    return { q }; // wrapped: a bare builder is thenable and would execute when returned from async
  };

  const list = useQuery(async () => {
    const { q } = await buildQuery('*', true, true);
    const res = await q.order(sort.key, { ascending: sort.dir === 'asc' }).range((page - 1) * PAGE, page * PAGE - 1);
    const rows = unwrap(res) as unknown as Order[];
    const ids = [...new Set(rows.map((o) => o.customer_id).filter(Boolean))] as string[];
    const customers = ids.length
      ? (unwrap(await supabase.from('customers').select('id,name').in('id', ids)) as Pick<Customer, 'id' | 'name'>[])
      : [];
    return { rows, total: res.count ?? rows.length, customers: new Map(customers.map((c) => [c.id, c.name])) };
  }, [r.id, range.from, range.to, status, payment, tableId, waiterId, search, page, sort.key, sort.dir]);

  const counts = useQuery(async () => {
    const rows = await fetchAll<{ status: OrderStatus }>(async (a, b) => {
      const { q } = await buildQuery('status', false);
      return q.order('id').range(a, b) as unknown as { data: { status: OrderStatus }[] | null; error: null };
    });
    const c: Record<string, number> = { all: rows.length };
    for (const row of rows) c[row.status] = (c[row.status] ?? 0) + 1;
    return c;
  }, [r.id, range.from, range.to, payment, tableId, waiterId, search]);

  useRealtime(['orders', 'payments'], r.id, () => {
    void list.reload();
    void counts.reload();
  });

  const exportCsv = async () => {
    setExporting(true);
    try {
      const rows = await fetchAll<Order>(async (a, b) => {
        const { q } = await buildQuery('*', true);
        return q.order('created_at', { ascending: false }).order('id').range(a, b) as unknown as {
          data: Order[] | null;
          error: null;
        };
      });
      downloadCsv(
        `orders_${range.from}_${range.to}`,
        [
          'Order #',
          'Created',
          'Type',
          'Table',
          'Waiter',
          'Cashier',
          'Status',
          'Payment status',
          'Subtotal',
          'Discount',
          'Tax',
          'Total',
          'Paid',
          'Refunded',
          'Balance',
          'Cancel reason',
        ],
        rows.map((o) => [
          o.order_number,
          formatDateTime(o.created_at, tz),
          ORDER_TYPE_LABEL[o.order_type],
          tableNo(o.table_id),
          staff.nameOf(o.waiter_id),
          staff.nameOf(o.cashier_id),
          ORDER_STATUS_LABEL[o.status],
          PAYMENT_STATUS_LABEL[o.payment_status],
          o.subtotal,
          o.discount_amount,
          o.tax_amount,
          o.total,
          o.amount_paid,
          o.amount_refunded,
          orderBalance(o),
          o.cancel_reason,
        ]),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(false);
    }
  };

  const money = (n: number) => formatMoney(n, r.currency);
  const columns: Column<Order>[] = useMemo(
    () => [
      {
        key: 'order_number',
        header: 'Order',
        sortable: true,
        cell: (o) => <span className="font-semibold">#{o.order_number}</span>,
      },
      {
        key: 'created_at',
        header: 'Time',
        sortable: true,
        cell: (o) => <span className="whitespace-nowrap text-slate-600">{formatDateTime(o.created_at, tz)}</span>,
      },
      { key: 'type', header: 'Type', cell: (o) => ORDER_TYPE_LABEL[o.order_type] },
      { key: 'table', header: 'Table', cell: (o) => tableNo(o.table_id) },
      {
        key: 'customer',
        header: 'Customer',
        cell: (o) => (o.customer_id ? (list.data?.customers.get(o.customer_id) ?? '—') : '—'),
      },
      { key: 'waiter', header: 'Waiter', cell: (o) => staff.nameOf(o.waiter_id) },
      { key: 'status', header: 'Status', cell: (o) => <OrderStatusBadge s={o.status} /> },
      { key: 'payment', header: 'Payment', cell: (o) => <PaymentStatusBadge s={o.payment_status} /> },
      { key: 'total', header: 'Total', sortable: true, align: 'right', cell: (o) => money(o.total) },
      { key: 'balance', header: 'Balance', align: 'right', cell: (o) => money(orderBalance(o)) },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tz, list.data, staff.nameOf, tables.data],
  );

  const waiters = (staff.data ?? []).filter((s) => s.role === 'waiter' || s.role === 'manager');

  return (
    <div>
      <PageHeader
        eyebrow="Operations · Live Orders"
        title="Orders"
        description="Every order from Waiter and Cashier POS, updated live."
        actions={
          <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={exportCsv} loading={exporting}>
            Export CSV
          </Button>
        }
      />
      <Card bodyClassName="p-0">
        <div className="space-y-3 border-b border-slate-100 p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <SearchInput
              value={search}
              onChange={resetPage(setSearch)}
              placeholder="Order # or customer name / phone"
              className="xl:w-80"
            />
            <DateRangeFilter value={range} onChange={resetPage(setRange)} timeZone={tz} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <select
              className="input"
              aria-label="Payment status"
              value={payment}
              onChange={(e) => resetPage(setPayment)(e.target.value as PaymentStatus | '')}
            >
              <option value="">All payment statuses</option>
              {(Object.keys(PAYMENT_STATUS_LABEL) as PaymentStatus[]).map((k) => (
                <option key={k} value={k}>
                  {PAYMENT_STATUS_LABEL[k]}
                </option>
              ))}
            </select>
            <select
              className="input"
              aria-label="Table"
              value={tableId}
              onChange={(e) => resetPage(setTableId)(e.target.value)}
            >
              <option value="">All tables</option>
              {(tables.data ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  Table {t.table_number}
                  {t.name ? ` · ${t.name}` : ''}
                  {t.archived_at ? ' (archived)' : ''}
                </option>
              ))}
            </select>
            <select
              className="input"
              aria-label="Waiter"
              value={waiterId}
              onChange={(e) => resetPage(setWaiterId)(e.target.value)}
            >
              <option value="">All waiters</option>
              {waiters.map((w) => (
                <option key={w.user_id} value={w.user_id}>
                  {w.profile?.full_name || w.profile?.email}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="px-4 pt-2">
          <Tabs
            value={status}
            onChange={(v) => {
              setParams(v === 'all' ? {} : { status: v });
              setPage(1);
            }}
            tabs={STATUS_TABS.map((s) => ({
              id: s,
              label: s === 'all' ? 'All' : ORDER_STATUS_LABEL[s],
              count: counts.data?.[s] ?? 0,
            }))}
          />
        </div>
        <DataTable
          columns={columns}
          rows={list.data?.rows ?? []}
          rowKey={(o) => o.id}
          loading={list.loading && !list.data}
          error={list.error}
          onRetry={list.reload}
          sort={sort}
          onSort={(s) => {
            setSort(s);
            setPage(1);
          }}
          onRowClick={(o) => navigate(`/orders/${o.id}`)}
          empty={
            <EmptyState
              title="No orders match these filters"
              message="Try a different date range or clear the filters."
            />
          }
        />
        <Pagination page={page} pageSize={PAGE} total={list.data?.total ?? 0} onPage={setPage} />
      </Card>
    </div>
  );
}
