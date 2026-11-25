import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCheck, CreditCard, Eye, PlusCircle, Printer, Receipt } from 'lucide-react';
import { useAuth, useRestaurant } from '@sombill/shared-hooks/AuthContext';
import { useQuery } from '@sombill/shared-hooks/useQuery';
import { useRealtime } from '@sombill/shared-hooks/useRealtime';
import { useStaffDirectory } from '@sombill/shared-hooks/useStaffDirectory';
import { supabase, friendlyError } from '@sombill/api-client/supabase';
import { fetchTables } from '@sombill/api-client/queries';
import { formatDateTime, formatMoney, ORDER_STATUS_LABEL, ORDER_TYPE_LABEL } from '@sombill/shared-utils/format';
import type { Order, OrderStatus, OrderType, PaymentStatus } from '@sombill/shared-types/types';
import { Card, EmptyState, PageHeader, Skeleton } from '@sombill/shared-ui/ui/Feedback';
import { DataTable, type Column } from '@sombill/shared-ui/ui/DataTable';
import { SearchInput } from '@sombill/shared-ui/ui/Filters';
import { OrderStatusBadge, PaymentStatusBadge } from '@sombill/shared-ui/ui/StatusBadges';
import { Button } from '@sombill/shared-ui/ui/Button';
import { Modal } from '@sombill/shared-ui/ui/Modal';
import { useToast } from '@sombill/shared-ui/ui/Toast';
import { useCart } from '@sombill/shared-hooks/cart';
import { fetchActiveOrders, fetchItemsFor, itemsByOrder } from '@sombill/api-client/orderData';
import { fetchOrderBundle, printDocument } from '../services/data';
import { BillDetail } from '../components/BillDetail';

export default function ActiveOrdersPage() {
  const r = useRestaurant();
  const { session } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const cart = useCart();
  const staff = useStaffDirectory(r.id);
  const [search, setSearch] = useState('');
  const [prep, setPrep] = useState<'' | OrderStatus>('');
  const [pay, setPay] = useState<'' | PaymentStatus>('');
  const [type, setType] = useState<'' | OrderType>('');
  const [viewId, setViewId] = useState<string | null>(null);
  const q = useQuery(async () => {
    const [orders, tables] = await Promise.all([fetchActiveOrders(r.id), fetchTables(r.id)]);
    const items = itemsByOrder(await fetchItemsFor(orders.map((o) => o.id)));
    return { orders, items, tables: new Map(tables.map((t) => [t.id, t.table_number])) };
  }, [r.id]);
  useRealtime(['orders', 'order_items', 'payments'], r.id, () => void q.reload(), { debounceMs: 250 });
  const view = useQuery(() => (viewId ? fetchOrderBundle(viewId) : Promise.resolve(null)), [viewId]);

  const rows = useMemo(() => {
    const t = search.trim().toLowerCase().replace(/^#/, '');
    return (q.data?.orders ?? [])
      .filter(
        (o) => (!prep || o.status === prep) && (!pay || o.payment_status === pay) && (!type || o.order_type === type),
      )
      .filter(
        (o) =>
          !t ||
          String(o.order_number) === t ||
          String(q.data!.tables.get(o.table_id ?? '') ?? '') === t ||
          (q.data!.items.get(o.id) ?? []).some((i) => i.product_name.toLowerCase().includes(t)) ||
          staff.nameOf(o.waiter_id).toLowerCase().includes(t),
      );
  }, [q.data, search, prep, pay, type, staff]);

  const close = async (o: Order) => {
    const { error } = await supabase.rpc('close_paid_order', { p_order: o.id });
    if (error) toast.error(friendlyError(error));
    else {
      toast.success(`Order #${o.order_number} closed.`);
      void q.reload();
      setViewId(null);
    }
  };
  const addItems = (o: Order) => {
    cart.startExistingOrder(o.id, o.table_id);
    navigate('/cashier/new-sale');
  };

  const columns: Column<Order>[] = [
    { key: 'no', header: 'Order', cell: (o) => <b>#{o.order_number}</b> },
    { key: 'table', header: 'Table', cell: (o) => (o.table_id ? q.data?.tables.get(o.table_id) : '—') },
    { key: 'waiter', header: 'Waiter', cell: (o) => (o.waiter_id ? staff.nameOf(o.waiter_id) : '—') },
    { key: 'type', header: 'Type', cell: (o) => ORDER_TYPE_LABEL[o.order_type] },
    {
      key: 'items',
      header: 'Products',
      cell: (o) => {
        const its = (q.data?.items.get(o.id) ?? []).filter((i) => !i.is_voided);
        const txt = its.map((i) => `${Number(i.quantity)}× ${i.product_name}`).join(', ');
        return (
          <span className="block max-w-[14rem] truncate text-slate-600" title={txt}>
            {txt || '—'}
          </span>
        );
      },
    },
    { key: 'sub', header: 'Subtotal', align: 'right', cell: (o) => formatMoney(o.subtotal, r.currency) },
    { key: 'tax', header: 'Tax', align: 'right', cell: (o) => formatMoney(o.tax_amount, r.currency) },
    { key: 'total', header: 'Total', align: 'right', cell: (o) => <b>{formatMoney(o.total, r.currency)}</b> },
    { key: 'pay', header: 'Payment', cell: (o) => <PaymentStatusBadge s={o.payment_status} /> },
    { key: 'prep', header: 'Preparation', cell: (o) => <OrderStatusBadge s={o.status} /> },
    {
      key: 'time',
      header: 'Created',
      cell: (o) => <span className="whitespace-nowrap text-slate-600">{formatDateTime(o.created_at, r.timezone)}</span>,
    },
    {
      key: 'act',
      header: '',
      align: 'right',
      cell: (o) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <IconAction label={`View order ${o.order_number}`} onClick={() => setViewId(o.id)}>
            <Eye className="h-5 w-5" />
          </IconAction>
          {o.payment_status !== 'paid' && (
            <IconAction
              label={`Take payment for ${o.order_number}`}
              onClick={() => navigate(`/cashier/payments?order=${o.id}`)}
            >
              <CreditCard className="h-5 w-5" />
            </IconAction>
          )}
        </div>
      ),
    },
  ];

  const vb = view.data;
  return (
    <div>
      <PageHeader
        eyebrow="Point of Sale · Live Queue"
        title="Active Orders"
        description="All open orders from waiters and the counter, updated live."
      />
      <Card bodyClassName="p-0">
        <div className="grid grid-cols-1 gap-3 border-b border-slate-100 p-4 md:grid-cols-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Order #, table, waiter or item" />
          <select
            className="input h-11"
            aria-label="Preparation status"
            value={prep}
            onChange={(e) => setPrep(e.target.value as OrderStatus | '')}
          >
            <option value="">All preparation statuses</option>
            {(['new', 'accepted', 'preparing', 'ready', 'served'] as OrderStatus[]).map((s) => (
              <option key={s} value={s}>
                {ORDER_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <select
            className="input h-11"
            aria-label="Payment status"
            value={pay}
            onChange={(e) => setPay(e.target.value as PaymentStatus | '')}
          >
            <option value="">All payment statuses</option>
            <option value="unpaid">Unpaid</option>
            <option value="partial">Partially paid</option>
            <option value="paid">Paid</option>
          </select>
          <select
            className="input h-11"
            aria-label="Order type"
            value={type}
            onChange={(e) => setType(e.target.value as OrderType | '')}
          >
            <option value="">All order types</option>
            {(['dine_in', 'takeaway', 'delivery'] as OrderType[]).map((s) => (
              <option key={s} value={s}>
                {ORDER_TYPE_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(o) => o.id}
          loading={q.loading && !q.data}
          error={q.error}
          onRetry={q.reload}
          onRowClick={(o) => setViewId(o.id)}
          empty={<EmptyState title="No active orders" message="New waiter orders appear here instantly." />}
        />
      </Card>
      <Modal
        open={!!viewId}
        onClose={() => setViewId(null)}
        size="lg"
        title={vb ? `Order #${vb.order.order_number}` : 'Order'}
        description={
          vb
            ? `${formatDateTime(vb.order.created_at, r.timezone)}${vb.order.bill_acknowledged_by && vb.order.bill_acknowledged_by !== session?.user.id ? ` · being processed by ${staff.nameOf(vb.order.bill_acknowledged_by)}` : ''}`
            : undefined
        }
        footer={
          vb ? (
            <>
              <Button
                variant="secondary"
                icon={<Printer className="h-4 w-4" />}
                onClick={() => void printDocument(`/cashier-print/bill/${vb.order.id}`)}
              >
                Print order
              </Button>
              <Button
                variant="secondary"
                icon={<Receipt className="h-4 w-4" />}
                onClick={() => navigate(`/cashier/bills?order=${vb.order.id}`)}
              >
                Full bill
              </Button>
              {vb.order.status !== 'completed' && vb.order.payment_status !== 'paid' && (
                <Button
                  variant="secondary"
                  icon={<PlusCircle className="h-4 w-4" />}
                  onClick={() => addItems(vb.order)}
                >
                  Add items
                </Button>
              )}
              {vb.order.payment_status === 'paid' && ['ready', 'served'].includes(vb.order.status) && (
                <Button variant="navy" icon={<CheckCheck className="h-4 w-4" />} onClick={() => void close(vb.order)}>
                  Close order
                </Button>
              )}
              {vb.order.payment_status !== 'paid' && (
                <Button
                  variant="orange"
                  icon={<CreditCard className="h-4 w-4" />}
                  onClick={() => navigate(`/cashier/payments?order=${vb.order.id}`)}
                >
                  Take payment
                </Button>
              )}
            </>
          ) : undefined
        }
      >
        {view.loading && !vb ? (
          <Skeleton className="h-48 w-full" />
        ) : vb ? (
          <BillDetail bundle={vb} waiterName={vb.order.waiter_id ? staff.nameOf(vb.order.waiter_id) : '—'} />
        ) : (
          <EmptyState title="Order not found" />
        )}
      </Modal>
    </div>
  );
}

export function IconAction({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-brand-navy"
    >
      {children}
    </button>
  );
}
