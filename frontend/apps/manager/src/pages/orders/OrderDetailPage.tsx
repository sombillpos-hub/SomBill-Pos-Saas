import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Ban, Printer, RotateCcw } from 'lucide-react';
import { useRestaurant } from '@sombill/shared-hooks/AuthContext';
import { useQuery } from '@sombill/shared-hooks/useQuery';
import { useRealtime } from '@sombill/shared-hooks/useRealtime';
import { useStaffDirectory } from '@sombill/shared-hooks/useStaffDirectory';
import { supabase, unwrap, friendlyError } from '@sombill/api-client/supabase';
import { fetchAudit } from '@sombill/api-client/queries';
import { orderBalance } from '@sombill/shared-utils/reports';
import { refundSchema, type RefundForm } from '@sombill/shared-types/schemas';
import {
  formatDateTime,
  formatMoney,
  formatQty,
  ORDER_STATUS_LABEL,
  ORDER_TYPE_LABEL,
  PAYMENT_METHOD_LABEL,
} from '@sombill/shared-utils/format';
import type {
  Customer,
  Order,
  OrderItem,
  OrderStatus,
  Payment,
  PaymentMethod,
  RestaurantTable,
} from '@sombill/shared-types/types';
import { Badge, Card, ErrorState, PageHeader, Skeleton, EmptyState } from '@sombill/shared-ui/ui/Feedback';
import { OrderStatusBadge, PaymentStatusBadge } from '@sombill/shared-ui/ui/StatusBadges';
import { Button } from '@sombill/shared-ui/ui/Button';
import { Checkbox, Input, Select, Textarea } from '@sombill/shared-ui/ui/Field';
import { Modal } from '@sombill/shared-ui/ui/Modal';
import { ConfirmDialog } from '@sombill/shared-ui/ui/ConfirmDialog';
import { useToast } from '@sombill/shared-ui/ui/Toast';
import { describeAudit } from '@sombill/manager/pages/dashboard/DashboardPage';

const FLOW: OrderStatus[] = ['new', 'pending', 'accepted', 'preparing', 'ready', 'served', 'completed'];

export default function OrderDetailPage() {
  const { id = '' } = useParams();
  const r = useRestaurant();
  const tz = r.timezone;
  const toast = useToast();
  const staff = useStaffDirectory(r.id);
  const money = (n: number) => formatMoney(n, r.currency);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);

  const q = useQuery(async () => {
    const order = unwrap(
      await supabase.from('orders').select('*').eq('id', id).eq('restaurant_id', r.id).maybeSingle(),
    ) as Order | null;
    if (!order) return null;
    const [items, payments, table, customer] = await Promise.all([
      supabase
        .from('order_items')
        .select('*')
        .eq('order_id', id)
        .order('created_at')
        .then((x) => unwrap(x) as OrderItem[]),
      supabase
        .from('payments')
        .select('*')
        .eq('order_id', id)
        .order('created_at')
        .then((x) => unwrap(x) as Payment[]),
      order.table_id
        ? supabase
            .from('restaurant_tables')
            .select('*')
            .eq('id', order.table_id)
            .maybeSingle()
            .then((x) => unwrap(x) as RestaurantTable | null)
        : Promise.resolve(null),
      order.customer_id
        ? supabase
            .from('customers')
            .select('*')
            .eq('id', order.customer_id)
            .maybeSingle()
            .then((x) => unwrap(x) as Customer | null)
        : Promise.resolve(null),
    ]);
    const audit = await fetchAudit(r.id, { entityIds: [order.id, ...items.map((i) => i.id)], limit: 100 });
    return { order, items, payments, table, customer, audit };
  }, [id, r.id]);

  useRealtime(['orders', 'order_items', 'payments'], r.id, () => void q.reload());

  if (q.loading && !q.data)
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-60" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
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
            <Link to="/orders">
              <Button variant="secondary">Back to orders</Button>
            </Link>
          }
        />
      </div>
    );

  const { order: o, items, payments, table, customer, audit } = q.data;
  const net = o.amount_paid - o.amount_refunded;
  const terminal = o.status === 'completed' || o.status === 'cancelled';
  const nextStatuses = FLOW.slice(FLOW.indexOf(o.status) + 1);

  const setStatus = async (s: OrderStatus) => {
    setStatusBusy(true);
    try {
      unwrap(await supabase.from('orders').update({ status: s }).eq('id', o.id).select('id').single());
      toast.success(`Order #${o.order_number} marked ${ORDER_STATUS_LABEL[s].toLowerCase()}.`);
      await q.reload();
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setStatusBusy(false);
    }
  };

  const cancel = async (reason: string) => {
    const { error } = await supabase.rpc('cancel_order', { p_order: o.id, p_reason: reason });
    if (error) throw new Error(friendlyError(error));
    toast.success(`Order #${o.order_number} cancelled.`);
    setCancelOpen(false);
    await q.reload();
  };

  return (
    <div>
      <div className="no-print mb-2">
        <Link to="/orders" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-red">
          <ArrowLeft className="h-4 w-4" /> Orders
        </Link>
      </div>
      <PageHeader
        title={`Order #${o.order_number}`}
        description={`${ORDER_TYPE_LABEL[o.order_type]} · created ${formatDateTime(o.created_at, tz)}`}
        actions={
          <>
            {!terminal && nextStatuses.length > 0 && (
              <select
                className="input w-auto"
                aria-label="Update status"
                value=""
                disabled={statusBusy}
                onChange={(e) => e.target.value && void setStatus(e.target.value as OrderStatus)}
              >
                <option value="">Update status…</option>
                {nextStatuses.map((s) => (
                  <option key={s} value={s}>
                    Mark {ORDER_STATUS_LABEL[s].toLowerCase()}
                  </option>
                ))}
              </select>
            )}
            <Button variant="secondary" icon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>
              Print
            </Button>
            {net > 0 && (
              <Button variant="secondary" icon={<RotateCcw className="h-4 w-4" />} onClick={() => setRefundOpen(true)}>
                Refund
              </Button>
            )}
            {!terminal && (
              <Button
                variant="danger"
                icon={<Ban className="h-4 w-4" />}
                onClick={() => {
                  if (net > 0) toast.error('Refund the collected payments before cancelling this order.');
                  else setCancelOpen(true);
                }}
              >
                Cancel order
              </Button>
            )}
          </>
        }
      />

      <div className="print-only mb-4 text-center">
        <p className="text-lg font-bold">{r.name}</p>
        {r.address && <p className="text-xs">{r.address}</p>}
        {r.phone && <p className="text-xs">{r.phone}</p>}
        {r.receipt_header && <p className="mt-1 text-xs">{r.receipt_header}</p>}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card title="Items" bodyClassName="p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50/70">
                  <tr>
                    <th className="th">Item</th>
                    <th className="th text-right">Qty</th>
                    <th className="th text-right">Unit price</th>
                    <th className="th text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((it) => (
                    <tr key={it.id} className={it.is_voided ? 'text-slate-400' : ''}>
                      <td className="td">
                        <span className={it.is_voided ? 'line-through' : 'font-medium'}>{it.product_name}</span>
                        {it.notes && <div className="text-xs text-slate-500">{it.notes}</div>}
                        {it.is_voided && <div className="text-xs text-brand-red">Voided: {it.void_reason}</div>}
                      </td>
                      <td className="td text-right tabular-nums">{formatQty(it.quantity)}</td>
                      <td className="td text-right tabular-nums">{money(it.unit_price)}</td>
                      <td className="td text-right tabular-nums">{money(it.line_total)}</td>
                    </tr>
                  ))}
                  {!items.length && (
                    <tr>
                      <td className="td text-center text-slate-400" colSpan={4}>
                        No items
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <dl className="space-y-1.5 border-t border-slate-100 px-5 py-4 text-sm">
              <Row label="Subtotal" value={money(o.subtotal)} />
              {o.discount_amount > 0 && <Row label="Discount" value={`−${money(o.discount_amount)}`} />}
              <Row
                label={`${r.tax_label} (${(o.tax_rate * 100).toFixed(2)}%${o.tax_inclusive ? ', included' : ''})`}
                value={money(o.tax_amount)}
              />
              <Row label="Total" value={money(o.total)} strong />
              <Row label="Paid" value={money(o.amount_paid)} />
              {o.amount_refunded > 0 && <Row label="Refunded" value={`−${money(o.amount_refunded)}`} />}
              <Row label="Balance due" value={money(orderBalance(o))} strong />
            </dl>
            {r.receipt_footer && <p className="print-only pb-4 text-center text-xs">{r.receipt_footer}</p>}
          </Card>

          <Card title="Payments & refunds" bodyClassName="p-0">
            {!payments.length ? (
              <EmptyState title="No payments recorded" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div>
                      <p className="text-sm font-medium">
                        {p.kind === 'refund' ? 'Refund' : 'Payment'} · {PAYMENT_METHOD_LABEL[p.method]}{' '}
                        {p.status === 'failed' && <Badge tone="red">Failed</Badge>}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatDateTime(p.created_at, tz)} · {staff.nameOf(p.cashier_id)}
                        {p.reference ? ` · Ref ${p.reference}` : ''}
                        {p.notes ? ` · ${p.notes}` : ''}
                      </p>
                    </div>
                    <span
                      className={`text-sm font-semibold tabular-nums ${p.kind === 'refund' ? 'text-brand-red' : 'text-emerald-700'}`}
                    >
                      {p.kind === 'refund' ? '−' : '+'}
                      {money(p.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Details">
            <dl className="space-y-2.5 text-sm">
              <Row label="Status" value={<OrderStatusBadge s={o.status} />} />
              <Row label="Payment" value={<PaymentStatusBadge s={o.payment_status} />} />
              <Row
                label="Table"
                value={table ? `Table ${table.table_number}${table.name ? ` · ${table.name}` : ''}` : '—'}
              />
              <Row label="Guests" value={o.guest_count ?? '—'} />
              <Row label="Waiter" value={staff.nameOf(o.waiter_id)} />
              <Row label="Cashier" value={staff.nameOf(o.cashier_id)} />
              <Row
                label="Customer"
                value={
                  customer ? (
                    <Link className="text-brand-red hover:underline" to={`/customers/${customer.id}`}>
                      {customer.name}
                    </Link>
                  ) : (
                    '—'
                  )
                }
              />
              {customer?.phone && <Row label="Phone" value={customer.phone} />}
              {o.completed_at && <Row label="Completed" value={formatDateTime(o.completed_at, tz)} />}
              {o.stock_deducted_at && <Row label="Stock deducted" value={formatDateTime(o.stock_deducted_at, tz)} />}
              {o.stock_reversed_at && <Row label="Stock reversed" value={formatDateTime(o.stock_reversed_at, tz)} />}
            </dl>
            {o.notes && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{o.notes}</p>}
            {o.status === 'cancelled' && (
              <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">
                Cancelled {formatDateTime(o.cancelled_at, tz)} by {staff.nameOf(o.cancelled_by)}
                <br />
                <b>Reason:</b> {o.cancel_reason}
              </div>
            )}
          </Card>

          <Card title="Modification history" bodyClassName="p-0" className="no-print">
            {!audit.length ? (
              <EmptyState title="No changes recorded" />
            ) : (
              <ol className="divide-y divide-slate-100">
                {audit.map((a) => (
                  <li key={a.id} className="px-5 py-3 text-sm">
                    <p>
                      <b>{staff.nameOf(a.actor_id)}</b> {describeAudit(a.action, a.entity_type)}
                    </p>
                    <p className="text-xs text-slate-500">{formatDateTime(a.created_at, tz)}</p>
                    {a.new_data && a.action !== 'create' && (
                      <p className="mt-1 break-words font-mono text-[11px] text-slate-500">
                        {summarizeChange(a.old_data, a.new_data)}
                      </p>
                    )}
                    {a.reason && <p className="mt-1 text-xs italic text-slate-600">“{a.reason}”</p>}
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={cancelOpen}
        danger
        requireReason
        title={`Cancel order #${o.order_number}?`}
        message="The order will be kept for records and marked cancelled. This cannot be undone."
        confirmLabel="Cancel order"
        onConfirm={cancel}
        onClose={() => setCancelOpen(false)}
      />
      <RefundModal
        open={refundOpen}
        onClose={() => setRefundOpen(false)}
        order={o}
        maxAmount={net}
        currency={r.currency}
        onDone={async () => {
          setRefundOpen(false);
          await q.reload();
        }}
      />
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 ${strong ? 'font-bold text-brand-navy' : ''}`}>
      <dt className={strong ? '' : 'text-slate-500'}>{label}</dt>
      <dd className="text-right tabular-nums">{value}</dd>
    </div>
  );
}

function summarizeChange(oldD: Record<string, unknown> | null, newD: Record<string, unknown>): string {
  return Object.keys(newD)
    .filter((k) => !['updated_at'].includes(k))
    .slice(0, 6)
    .map((k) => `${k}: ${JSON.stringify(oldD?.[k] ?? null)} → ${JSON.stringify(newD[k])}`)
    .join(' · ');
}

function RefundModal({
  open,
  onClose,
  order,
  maxAmount,
  currency,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  order: Order;
  maxAmount: number;
  currency: string;
  onDone: () => Promise<void>;
}) {
  const toast = useToast();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RefundForm>({
    resolver: zodResolver(refundSchema),
    values: { amount: maxAmount, method: 'cash', reason: '', restock: false },
  });
  const submit = async (raw: RefundForm) => {
    const v = refundSchema.parse(raw);
    if (v.amount > maxAmount + 1e-9) {
      setError('amount', { message: `Cannot exceed ${formatMoney(maxAmount, currency)}` });
      return;
    }
    const { error } = await supabase.rpc('refund_order', {
      p_order: order.id,
      p_amount: v.amount,
      p_method: v.method,
      p_reason: v.reason,
      p_restock: v.restock,
    });
    if (error) {
      toast.error(friendlyError(error));
      return;
    }
    toast.success(`Refunded ${formatMoney(v.amount, currency)} on order #${order.order_number}.`);
    reset();
    await onDone();
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Refund order #${order.order_number}`}
      description={`Up to ${formatMoney(maxAmount, currency)} can be refunded.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button onClick={handleSubmit(submit)} loading={isSubmitting}>
            Record refund
          </Button>
        </>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit(submit)} noValidate>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Amount"
            type="number"
            step="0.01"
            min="0.01"
            {...register('amount')}
            error={errors.amount?.message}
            required
          />
          <Select label="Refund method" {...register('method')}>
            {(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD_LABEL[m]}
              </option>
            ))}
          </Select>
        </div>
        <Textarea label="Reason" {...register('reason')} error={errors.reason?.message} />
        {order.stock_deducted_at && !order.stock_reversed_at && (
          <Checkbox
            label="Return ingredients to stock"
            description="Reverses the stock deducted for this order. Only do this if the food was not prepared or can be reused."
            {...register('restock')}
          />
        )}
      </form>
    </Modal>
  );
}
