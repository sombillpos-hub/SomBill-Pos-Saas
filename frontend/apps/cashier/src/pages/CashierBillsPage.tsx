import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CreditCard, Printer } from 'lucide-react';
import { useRestaurant } from '@sombill/shared-hooks/AuthContext';
import { useQuery } from '@sombill/shared-hooks/useQuery';
import { useRealtime } from '@sombill/shared-hooks/useRealtime';
import { useStaffDirectory } from '@sombill/shared-hooks/useStaffDirectory';
import { fetchAll, supabase, unwrap } from '@sombill/api-client/supabase';
import { presetRange, rangeToIso, type DateRange } from '@sombill/shared-utils/dates';
import { fetchTables } from '@sombill/api-client/queries';
import { formatMoney } from '@sombill/shared-utils/format';
import { revealIfStacked } from '@sombill/shared-hooks/useMediaQuery';
import { cn } from '@sombill/shared-utils/cn';
import type { Customer, Order, Payment } from '@sombill/shared-types/types';
import { Card, EmptyState, ErrorState, PageHeader, Skeleton } from '@sombill/shared-ui/ui/Feedback';
import { DateRangeFilter, SearchInput, Tabs } from '@sombill/shared-ui/ui/Filters';
import { PaymentStatusBadge } from '@sombill/shared-ui/ui/StatusBadges';
import { Button } from '@sombill/shared-ui/ui/Button';
import { fetchOrderBundle, printDocument } from '../services/data';
import { BillDetail } from '../components/BillDetail';
import { balances } from '../features/payment';

type Section = 'unpaid' | 'partial' | 'pending' | 'paid' | 'refunded';
const SECTIONS: Array<[Section, string]> = [
  ['unpaid', 'Unpaid'],
  ['partial', 'Partially paid'],
  ['pending', 'Payment pending'],
  ['paid', 'Paid'],
  ['refunded', 'Refunded'],
];

export function sectionOf(o: Order, pendingOrders: Set<string>): Section {
  if (o.payment_status === 'refunded' || Number(o.amount_refunded) > 0) return 'refunded';
  if (pendingOrders.has(o.id) || (o.bill_requested_at && o.payment_status !== 'paid')) return 'pending';
  if (o.payment_status === 'paid') return 'paid';
  if (o.payment_status === 'partial') return 'partial';
  return 'unpaid';
}

export default function CashierBillsPage() {
  const r = useRestaurant();
  const navigate = useNavigate();
  const staff = useStaffDirectory(r.id);
  const [params, setParams] = useSearchParams();
  const selected = params.get('order');
  const [section, setSection] = useState<Section>('unpaid');
  const [range, setRange] = useState<DateRange>(() => presetRange('today', r.timezone));
  const [search, setSearch] = useState('');
  const [tableId, setTableId] = useState('');
  const detailRef = useRef<HTMLDivElement>(null);

  const q = useQuery(async () => {
    const { fromIso, toIso } = rangeToIso(range, r.timezone);
    const [orders, tables, pending] = await Promise.all([
      fetchAll<Order>((a, b) =>
        supabase
          .from('orders')
          .select('*')
          .eq('restaurant_id', r.id)
          .neq('status', 'cancelled')
          .gte('created_at', fromIso)
          .lt('created_at', toIso)
          .order('created_at', { ascending: false })
          .range(a, b),
      ),
      fetchTables(r.id),
      supabase
        .from('payments')
        .select('order_id')
        .eq('restaurant_id', r.id)
        .eq('status', 'pending')
        .then((x) => unwrap(x) as Pick<Payment, 'order_id'>[]),
    ]);
    const custIds = [...new Set(orders.map((o) => o.customer_id).filter(Boolean))] as string[];
    const customers = custIds.length
      ? (unwrap(await supabase.from('customers').select('id,name').in('id', custIds)) as Pick<
          Customer,
          'id' | 'name'
        >[])
      : [];
    return {
      orders,
      tables,
      pending: new Set(pending.map((p) => p.order_id)),
      customers: new Map(customers.map((c) => [c.id, c.name])),
    };
  }, [r.id, range.from, range.to]);
  const bundle = useQuery(() => (selected ? fetchOrderBundle(selected) : Promise.resolve(null)), [selected]);
  useRealtime(['orders', 'payments', 'order_items'], r.id, () => {
    void q.reload();
    void bundle.reload();
  });
  useEffect(() => {
    if (bundle.data && q.data) setSection(sectionOf(bundle.data.order, q.data.pending));
  }, [bundle.data?.order.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const tableNo = (id: string | null) => (id ? q.data?.tables.find((t) => t.id === id)?.table_number : undefined);
  const list = useMemo(() => {
    const t = search.trim().toLowerCase().replace(/^#/, '');
    return (q.data?.orders ?? [])
      .filter((o) => sectionOf(o, q.data!.pending) === section && (!tableId || o.table_id === tableId))
      .filter(
        (o) =>
          !t ||
          String(o.order_number) === t ||
          String(tableNo(o.table_id) ?? '') === t ||
          (o.customer_id && q.data!.customers.get(o.customer_id)?.toLowerCase().includes(t)),
      );
  }, [q.data, section, search, tableId]); // eslint-disable-line react-hooks/exhaustive-deps
  const count = (s: Section) => (q.data?.orders ?? []).filter((o) => sectionOf(o, q.data!.pending) === s).length;
  const b = bundle.data;

  return (
    <div>
      <PageHeader
        eyebrow="Point of Sale · Billing"
        title="Bills"
        description="Balances are calculated from recorded payments."
      />
      <Card bodyClassName="p-0">
        <div className="grid grid-cols-1 gap-3 border-b border-slate-100 p-4 lg:grid-cols-[1fr_200px_auto]">
          <SearchInput value={search} onChange={setSearch} placeholder="Order #, table or customer" />
          <select
            className="input h-11"
            aria-label="Table"
            value={tableId}
            onChange={(e) => setTableId(e.target.value)}
          >
            <option value="">All tables</option>
            {(q.data?.tables ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                Table {t.table_number}
              </option>
            ))}
          </select>
          <DateRangeFilter value={range} onChange={setRange} timeZone={r.timezone} />
        </div>
        <div className="px-4 pt-2">
          <Tabs
            value={section}
            onChange={setSection}
            tabs={SECTIONS.map(([id, label]) => ({ id, label, count: count(id) }))}
          />
        </div>
        {q.error ? (
          <ErrorState message={q.error} onRetry={q.reload} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)]">
            <div className="border-b border-slate-100 lg:border-b-0 lg:border-r">
              {q.loading && !q.data ? (
                <div className="p-4">
                  <Skeleton className="h-40 w-full" />
                </div>
              ) : !list.length ? (
                <EmptyState title="No bills here" />
              ) : (
                <ul className="max-h-[65vh] divide-y divide-slate-100 overflow-y-auto" aria-label="Bills">
                  {list.map((o) => (
                    <li key={o.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setParams({ order: o.id });
                          revealIfStacked(detailRef.current, '(max-width: 1023px)');
                        }}
                        aria-current={o.id === selected}
                        className={cn(
                          'flex min-h-[64px] w-full items-center justify-between gap-2 px-4 py-2 text-left',
                          o.id === selected ? 'bg-orange-50' : 'hover:bg-slate-50',
                        )}
                      >
                        <span className="min-w-0">
                          <b>#{o.order_number}</b>{' '}
                          <span className="text-sm text-slate-500">
                            {tableNo(o.table_id) ? `Table ${tableNo(o.table_id)}` : o.order_type.replace('_', '-')}
                            {o.customer_id ? ` · ${q.data!.customers.get(o.customer_id) ?? ''}` : ''}
                          </span>
                          <span className="mt-0.5 block">
                            <PaymentStatusBadge s={o.payment_status} />
                          </span>
                        </span>
                        <span className="shrink-0 text-right text-sm">
                          <b className="tabular-nums">{formatMoney(o.total, r.currency)}</b>
                          <span className="block text-xs text-slate-500">
                            due{' '}
                            {formatMoney(
                              Math.max(Number(o.total) - Number(o.amount_paid) + Number(o.amount_refunded), 0),
                              r.currency,
                            )}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div ref={detailRef} className="scroll-mt-20 p-4">
              {!selected ? (
                <p className="text-sm text-slate-500">Select a bill to see its details.</p>
              ) : bundle.loading && !b ? (
                <Skeleton className="h-64 w-full" />
              ) : !b ? (
                <EmptyState title="Bill not found" />
              ) : (
                <>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-lg font-bold text-brand-navy">Bill · Order #{b.order.order_number}</h2>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        className="h-11"
                        icon={<Printer className="h-4 w-4" />}
                        onClick={() => void printDocument(`/cashier-print/bill/${b.order.id}`)}
                      >
                        Print bill
                      </Button>
                      {balances(b.order, b.payments).payable > 0 && (
                        <Button
                          variant="orange"
                          className="h-11"
                          icon={<CreditCard className="h-4 w-4" />}
                          onClick={() => navigate(`/cashier/payments?order=${b.order.id}`)}
                        >
                          Process payment
                        </Button>
                      )}
                    </div>
                  </div>
                  <BillDetail
                    bundle={b}
                    waiterName={b.order.waiter_id ? staff.nameOf(b.order.waiter_id) : '—'}
                    onChanged={() => {
                      void bundle.reload();
                      void q.reload();
                    }}
                  />
                </>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
