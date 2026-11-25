import { useMemo, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { useRestaurant } from '@sombill/shared-hooks/AuthContext';
import { useQuery } from '@sombill/shared-hooks/useQuery';
import { useRealtime } from '@sombill/shared-hooks/useRealtime';
import { useStaffDirectory } from '@sombill/shared-hooks/useStaffDirectory';
import { fetchAll, supabase, unwrap } from '@sombill/api-client/supabase';
import { presetRange, rangeToIso, type DateRange } from '@sombill/shared-utils/dates';
import { downloadCsv } from '@sombill/shared-utils/csv';
import { formatDateTime, formatMoney, PAYMENT_METHOD_LABEL } from '@sombill/shared-utils/format';
import type { Customer, Order, Payment, PaymentMethod } from '@sombill/shared-types/types';
import { Badge, Card, EmptyState, PageHeader } from '@sombill/shared-ui/ui/Feedback';
import { DataTable, Pagination, type Column } from '@sombill/shared-ui/ui/DataTable';
import { DateRangeFilter, SearchInput } from '@sombill/shared-ui/ui/Filters';
import { Button } from '@sombill/shared-ui/ui/Button';
import { Modal } from '@sombill/shared-ui/ui/Modal';
import { printDocument } from '../services/data';
import { VERIFICATION_LABEL } from '../features/payment';

const PAGE = 25;
type StatusFilter = '' | 'succeeded' | 'pending' | 'failed' | 'refund';
export const txStatus = (p: Payment) =>
  p.kind === 'refund'
    ? 'Refund'
    : p.status === 'succeeded'
      ? 'Completed'
      : p.status === 'pending'
        ? 'Pending'
        : 'Failed';

export default function TransactionsPage() {
  const r = useRestaurant();
  const staff = useStaffDirectory(r.id);
  const [range, setRange] = useState<DateRange>(() => presetRange('today', r.timezone));
  const [method, setMethod] = useState<'' | PaymentMethod>('');
  const [status, setStatus] = useState<StatusFilter>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<Payment | null>(null);

  const q = useQuery(async () => {
    const { fromIso, toIso } = rangeToIso(range, r.timezone);
    const payments = await fetchAll<Payment>((a, b) =>
      supabase
        .from('payments')
        .select('*')
        .eq('restaurant_id', r.id)
        .gte('created_at', fromIso)
        .lt('created_at', toIso)
        .order('created_at', { ascending: false })
        .range(a, b),
    );
    const orderIds = [...new Set(payments.map((p) => p.order_id))];
    const orders = orderIds.length
      ? (unwrap(await supabase.from('orders').select('id,order_number,customer_id').in('id', orderIds)) as Pick<
          Order,
          'id' | 'order_number' | 'customer_id'
        >[])
      : [];
    const custIds = [...new Set(orders.map((o) => o.customer_id).filter(Boolean))] as string[];
    const customers = custIds.length
      ? (unwrap(await supabase.from('customers').select('id,name').in('id', custIds)) as Pick<
          Customer,
          'id' | 'name'
        >[])
      : [];
    const cmap = new Map(customers.map((c) => [c.id, c.name]));
    return {
      payments,
      orders: new Map(
        orders.map((o) => [
          o.id,
          { no: o.order_number, customer: o.customer_id ? (cmap.get(o.customer_id) ?? '') : '' },
        ]),
      ),
    };
  }, [r.id, range.from, range.to]);
  useRealtime(['payments'], r.id, () => void q.reload());

  const rows = useMemo(() => {
    const t = search.trim().toLowerCase().replace(/^#/, '');
    return (q.data?.payments ?? [])
      .filter(
        (p) =>
          (!method || p.method === method) &&
          (!status || (status === 'refund' ? p.kind === 'refund' : p.kind === 'payment' && p.status === status)),
      )
      .filter((p) => {
        if (!t) return true;
        const o = q.data!.orders.get(p.order_id);
        return (
          String(p.transaction_number) === t ||
          String(o?.no) === t ||
          p.reference?.toLowerCase().includes(t) ||
          o?.customer.toLowerCase().includes(t)
        );
      });
  }, [q.data, method, status, search]);
  const sumOk = rows
    .filter((p) => p.kind === 'payment' && p.status === 'succeeded')
    .reduce((s, p) => s + Number(p.amount), 0);
  const sumRef = rows.filter((p) => p.kind === 'refund').reduce((s, p) => s + Number(p.amount), 0);

  const columns: Column<Payment>[] = [
    { key: 'txn', header: 'Txn #', cell: (p) => <b>#{p.transaction_number ?? '—'}</b> },
    { key: 'order', header: 'Order', cell: (p) => `#${q.data?.orders.get(p.order_id)?.no ?? '—'}` },
    { key: 'ref', header: 'Reference', cell: (p) => <span className="font-mono text-xs">{p.reference ?? '—'}</span> },
    { key: 'cust', header: 'Customer', cell: (p) => q.data?.orders.get(p.order_id)?.customer || '—' },
    { key: 'method', header: 'Method', cell: (p) => PAYMENT_METHOD_LABEL[p.method] },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      cell: (p) => (
        <b className={p.kind === 'refund' ? 'text-brand-red' : ''}>
          {p.kind === 'refund' ? '−' : ''}
          {formatMoney(p.amount, r.currency)}
        </b>
      ),
    },
    { key: 'cashier', header: 'Cashier', cell: (p) => staff.nameOf(p.cashier_id) },
    {
      key: 'date',
      header: 'Date',
      cell: (p) => <span className="whitespace-nowrap">{formatDateTime(p.created_at, r.timezone)}</span>,
    },
    {
      key: 'ver',
      header: 'Verification',
      cell: (p) =>
        p.kind === 'refund' ? (
          '—'
        ) : (
          <Badge
            tone={
              p.status === 'pending'
                ? 'yellow'
                : p.status === 'failed'
                  ? 'red'
                  : p.verification_status === 'verified'
                    ? 'green'
                    : 'gray'
            }
          >
            {VERIFICATION_LABEL[p.verification_status ?? 'not_required']}
          </Badge>
        ),
    },
    {
      key: 'st',
      header: 'Status',
      cell: (p) => (
        <Badge
          tone={
            p.kind === 'refund'
              ? 'purple'
              : p.status === 'succeeded'
                ? 'green'
                : p.status === 'pending'
                  ? 'yellow'
                  : 'red'
          }
        >
          {txStatus(p)}
        </Badge>
      ),
    },
  ];
  const exportCsv = () =>
    downloadCsv(
      `transactions_${range.from}_${range.to}`,
      [
        'Transaction #',
        'Order #',
        'Kind',
        'Method',
        'Amount',
        'Reference',
        'Customer',
        'Cashier',
        'Date',
        'Verification',
        'Status',
        'Cash received',
        'Change',
      ],
      rows.map((p) => [
        p.transaction_number,
        q.data?.orders.get(p.order_id)?.no,
        p.kind,
        PAYMENT_METHOD_LABEL[p.method],
        p.amount,
        p.reference,
        q.data?.orders.get(p.order_id)?.customer,
        staff.nameOf(p.cashier_id),
        formatDateTime(p.created_at, r.timezone),
        VERIFICATION_LABEL[p.verification_status ?? 'not_required'],
        txStatus(p),
        p.amount_received,
        p.change_given,
      ]),
    );

  return (
    <div>
      <PageHeader
        eyebrow="Ledger & Cash · History"
        title="Transactions"
        description="Every payment and refund. The history is permanent — nothing can be deleted."
        actions={
          <Button
            variant="secondary"
            icon={<Download className="h-4 w-4" />}
            disabled={!rows.length}
            onClick={exportCsv}
          >
            Export CSV
          </Button>
        }
      />
      <Card bodyClassName="p-0">
        <div className="grid grid-cols-1 gap-3 border-b border-slate-100 p-4 lg:grid-cols-[1fr_180px_180px_auto]">
          <SearchInput
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Txn #, order #, reference, customer"
          />
          <select
            className="input h-11"
            aria-label="Payment method"
            value={method}
            onChange={(e) => {
              setMethod(e.target.value as PaymentMethod | '');
              setPage(1);
            }}
          >
            <option value="">All methods</option>
            {(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD_LABEL[m]}
              </option>
            ))}
          </select>
          <select
            className="input h-11"
            aria-label="Status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as StatusFilter);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            <option value="succeeded">Completed</option>
            <option value="pending">Pending verification</option>
            <option value="failed">Failed / rejected</option>
            <option value="refund">Refunds</option>
          </select>
          <DateRangeFilter
            value={range}
            onChange={(v) => {
              setRange(v);
              setPage(1);
            }}
            timeZone={r.timezone}
          />
        </div>
        <p className="border-b border-slate-100 px-4 py-2 text-sm text-slate-600">
          Completed payments <b>{formatMoney(sumOk, r.currency)}</b> · Refunds <b>{formatMoney(sumRef, r.currency)}</b>{' '}
          · Net <b>{formatMoney(sumOk - sumRef, r.currency)}</b>
        </p>
        <DataTable
          columns={columns}
          rows={rows.slice((page - 1) * PAGE, page * PAGE)}
          rowKey={(p) => p.id}
          loading={q.loading && !q.data}
          error={q.error}
          onRetry={q.reload}
          onRowClick={setDetail}
          empty={<EmptyState title="No transactions in this period" />}
        />
        <Pagination page={page} pageSize={PAGE} total={rows.length} onPage={setPage} />
      </Card>
      {detail && (
        <Modal
          open
          onClose={() => setDetail(null)}
          title={`Transaction #${detail.transaction_number ?? ''}`}
          size="sm"
          footer={
            <>
              <Button variant="secondary" onClick={() => setDetail(null)}>
                Close
              </Button>
              <Button
                variant="navy"
                icon={<Printer className="h-4 w-4" />}
                onClick={() => void printDocument(`/cashier-print/transaction/${detail.id}`)}
              >
                Print record
              </Button>
            </>
          }
        >
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
            <dt className="text-slate-500">Order</dt>
            <dd>#{q.data?.orders.get(detail.order_id)?.no}</dd>
            <dt className="text-slate-500">Kind</dt>
            <dd className="capitalize">{detail.kind}</dd>
            <dt className="text-slate-500">Method</dt>
            <dd>{PAYMENT_METHOD_LABEL[detail.method]}</dd>
            <dt className="text-slate-500">Amount</dt>
            <dd className="font-semibold">{formatMoney(detail.amount, r.currency)}</dd>
            <dt className="text-slate-500">Reference</dt>
            <dd className="font-mono">{detail.reference ?? '—'}</dd>
            {detail.amount_received != null && (
              <>
                <dt className="text-slate-500">Cash received</dt>
                <dd>{formatMoney(detail.amount_received, r.currency)}</dd>
                <dt className="text-slate-500">Change</dt>
                <dd>{formatMoney(detail.change_given ?? 0, r.currency)}</dd>
              </>
            )}
            <dt className="text-slate-500">Cashier</dt>
            <dd>{staff.nameOf(detail.cashier_id)}</dd>
            <dt className="text-slate-500">Date</dt>
            <dd>{formatDateTime(detail.created_at, r.timezone)}</dd>
            <dt className="text-slate-500">Status</dt>
            <dd>{txStatus(detail)}</dd>
            <dt className="text-slate-500">Verification</dt>
            <dd>{VERIFICATION_LABEL[detail.verification_status ?? 'not_required']}</dd>
            {detail.verified_by && (
              <>
                <dt className="text-slate-500">Verified by</dt>
                <dd>
                  {staff.nameOf(detail.verified_by)} · {formatDateTime(detail.verified_at, r.timezone)}
                </dd>
              </>
            )}
            {detail.verification_note && (
              <>
                <dt className="text-slate-500">Note</dt>
                <dd>{detail.verification_note}</dd>
              </>
            )}
            {detail.notes && (
              <>
                <dt className="text-slate-500">Notes</dt>
                <dd>{detail.notes}</dd>
              </>
            )}
          </dl>
        </Modal>
      )}
    </div>
  );
}
