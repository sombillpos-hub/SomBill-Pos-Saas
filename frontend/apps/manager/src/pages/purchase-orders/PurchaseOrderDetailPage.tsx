import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Ban, PackageCheck, Pencil, Printer, Send, Wallet } from 'lucide-react';
import { useRestaurant } from '@sombill/shared-hooks/AuthContext';
import { useQuery } from '@sombill/shared-hooks/useQuery';
import { useStaffDirectory } from '@sombill/shared-hooks/useStaffDirectory';
import { supabase, unwrap, friendlyError } from '@sombill/api-client/supabase';
import { fetchInventory, fetchSuppliers } from '@sombill/api-client/queries';
import { formatDate, formatDateTime, formatMoney, formatQty } from '@sombill/shared-utils/format';
import type { PurchaseOrder, PurchaseOrderItem } from '@sombill/shared-types/types';
import { Card, EmptyState, ErrorState, PageHeader, Skeleton } from '@sombill/shared-ui/ui/Feedback';
import { POStatusBadge } from '@sombill/shared-ui/ui/StatusBadges';
import { Button } from '@sombill/shared-ui/ui/Button';
import { Input } from '@sombill/shared-ui/ui/Field';
import { Modal } from '@sombill/shared-ui/ui/Modal';
import { ConfirmDialog } from '@sombill/shared-ui/ui/ConfirmDialog';
import { useToast } from '@sombill/shared-ui/ui/Toast';
import { POFormModal } from './PurchaseOrdersPage';

interface Receipt {
  id: string;
  created_at: string;
  received_by: string | null;
  lines: Array<{ line_id: string; quantity: number }>;
}

export default function PurchaseOrderDetailPage() {
  const { id = '' } = useParams();
  const r = useRestaurant();
  const toast = useToast();
  const staff = useStaffDirectory(r.id);
  const money = (n: number) => formatMoney(n, r.currency);
  const [editing, setEditing] = useState(false);
  const [receiving, setReceiving] = useState(false);
  const [paying, setPaying] = useState(false);
  const [confirm, setConfirm] = useState<'order' | 'cancel' | null>(null);

  const q = useQuery(async () => {
    const po = unwrap(
      await supabase.from('purchase_orders').select('*').eq('id', id).eq('restaurant_id', r.id).maybeSingle(),
    ) as PurchaseOrder | null;
    if (!po) return null;
    const [lines, receipts, suppliers, inventory] = await Promise.all([
      supabase
        .from('purchase_order_items')
        .select('*')
        .eq('purchase_order_id', id)
        .order('created_at')
        .then((x) => unwrap(x) as PurchaseOrderItem[]),
      supabase
        .from('purchase_order_receipts')
        .select('*')
        .eq('purchase_order_id', id)
        .order('created_at')
        .then((x) => unwrap<Receipt[]>(x)),
      fetchSuppliers(r.id),
      fetchInventory(r.id),
    ]);
    return { po, lines, receipts, suppliers, inventory };
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
          title="Purchase order not found"
          action={
            <Link to="/purchase-orders">
              <Button variant="secondary">Back</Button>
            </Link>
          }
        />
      </div>
    );

  const { po, lines, receipts, suppliers, inventory } = q.data;
  const supplier = suppliers.find((s) => s.id === po.supplier_id);
  const itemOf = (iid: string) => inventory.find((i) => i.id === iid);
  const receivedValue = lines.reduce((s, l) => s + l.quantity_received * l.unit_cost, 0);
  const canReceive = po.status === 'ordered' || po.status === 'partially_received';

  const changeStatus = async (status: 'ordered' | 'cancelled') => {
    unwrap(await supabase.from('purchase_orders').update({ status }).eq('id', po.id).select('id').single());
    toast.success(status === 'ordered' ? 'Purchase order placed.' : 'Purchase order cancelled.');
    setConfirm(null);
    await q.reload();
  };

  return (
    <div>
      <div className="no-print mb-2">
        <Link
          to="/purchase-orders"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-red"
        >
          <ArrowLeft className="h-4 w-4" /> Purchase orders
        </Link>
      </div>
      <PageHeader
        title={`PO-${po.po_number}`}
        description={`${supplier?.name ?? ''} · created ${formatDateTime(po.created_at, r.timezone)}`}
        actions={
          <>
            <Button variant="secondary" icon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>
              Print
            </Button>
            {po.status === 'draft' && (
              <Button variant="secondary" icon={<Pencil className="h-4 w-4" />} onClick={() => setEditing(true)}>
                Edit
              </Button>
            )}
            {po.status === 'draft' && (
              <Button
                variant="navy"
                icon={<Send className="h-4 w-4" />}
                onClick={() => setConfirm('order')}
                disabled={!lines.length}
              >
                Place order
              </Button>
            )}
            {canReceive && (
              <Button icon={<PackageCheck className="h-4 w-4" />} onClick={() => setReceiving(true)}>
                Receive stock
              </Button>
            )}
            {po.status !== 'draft' && po.status !== 'cancelled' && (
              <Button variant="secondary" icon={<Wallet className="h-4 w-4" />} onClick={() => setPaying(true)}>
                Record payment
              </Button>
            )}
            {(po.status === 'draft' || po.status === 'ordered' || po.status === 'partially_received') && (
              <Button variant="danger" icon={<Ban className="h-4 w-4" />} onClick={() => setConfirm('cancel')}>
                Cancel
              </Button>
            )}
          </>
        }
      />

      <div className="print-only mb-4">
        <p className="text-lg font-bold">
          {r.name} — Purchase Order PO-{po.po_number}
        </p>
        <p className="text-sm">
          Supplier: {supplier?.name} {supplier?.phone ? `· ${supplier.phone}` : ''}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card title="Lines" bodyClassName="p-0" className="xl:col-span-2">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50/70">
                <tr>
                  <th className="th">Item</th>
                  <th className="th text-right">Ordered</th>
                  <th className="th text-right">Received</th>
                  <th className="th text-right">Unit cost</th>
                  <th className="th text-right">Line total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lines.map((l) => (
                  <tr key={l.id}>
                    <td className="td font-medium">{itemOf(l.inventory_item_id)?.name ?? '—'}</td>
                    <td className="td text-right tabular-nums">
                      {formatQty(l.quantity_ordered)} {itemOf(l.inventory_item_id)?.unit}
                    </td>
                    <td
                      className={`td text-right tabular-nums ${l.quantity_received >= l.quantity_ordered ? 'text-emerald-700' : l.quantity_received > 0 ? 'text-brand-orange' : ''}`}
                    >
                      {formatQty(l.quantity_received)}
                    </td>
                    <td className="td text-right tabular-nums">{money(l.unit_cost)}</td>
                    <td className="td text-right tabular-nums">{money(l.line_total)}</td>
                  </tr>
                ))}
                {!lines.length && (
                  <tr>
                    <td colSpan={5} className="td text-center text-slate-400">
                      No lines
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="bg-slate-50 font-semibold">
                <tr>
                  <td className="td" colSpan={4}>
                    Total
                  </td>
                  <td className="td text-right tabular-nums">{money(po.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
        <div className="space-y-6">
          <Card title="Summary">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Status</dt>
                <dd>
                  <POStatusBadge s={po.status} />
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Expected</dt>
                <dd>{formatDate(po.expected_date)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Ordered</dt>
                <dd>{po.ordered_at ? formatDateTime(po.ordered_at, r.timezone) : '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Fully received</dt>
                <dd>{po.received_at ? formatDateTime(po.received_at, r.timezone) : '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Received value</dt>
                <dd className="tabular-nums">{money(receivedValue)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Paid</dt>
                <dd className="tabular-nums">{money(po.amount_paid)}</dd>
              </div>
              <div className="flex justify-between font-bold text-brand-navy">
                <dt>Supplier balance</dt>
                <dd className="tabular-nums">{money(Math.max(receivedValue - po.amount_paid, 0))}</dd>
              </div>
            </dl>
            {po.notes && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{po.notes}</p>}
          </Card>
          <Card title="Receiving history" bodyClassName="p-0" className="no-print">
            {!receipts.length ? (
              <EmptyState title="Nothing received yet" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {receipts.map((rc) => (
                  <li key={rc.id} className="px-5 py-3 text-sm">
                    <p className="font-medium">
                      {formatDateTime(rc.created_at, r.timezone)} · {staff.nameOf(rc.received_by)}
                    </p>
                    <ul className="mt-1 text-xs text-slate-600">
                      {rc.lines
                        .filter((x) => Number(x.quantity) > 0)
                        .map((x) => {
                          const l = lines.find((y) => y.id === x.line_id);
                          const it = l && itemOf(l.inventory_item_id);
                          return (
                            <li key={x.line_id}>
                              +{formatQty(Number(x.quantity))} {it?.unit} {it?.name}
                            </li>
                          );
                        })}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {editing && (
        <POFormModal
          po={po}
          lines={lines}
          suppliers={suppliers}
          inventory={inventory}
          restaurantId={r.id}
          currency={r.currency}
          onClose={() => setEditing(false)}
          onSaved={async () => {
            setEditing(false);
            await q.reload();
          }}
        />
      )}
      {receiving && (
        <ReceiveModal
          po={po}
          lines={lines}
          itemName={(iid) => `${itemOf(iid)?.name ?? ''} (${itemOf(iid)?.unit ?? ''})`}
          onClose={() => setReceiving(false)}
          onDone={async () => {
            setReceiving(false);
            await q.reload();
          }}
        />
      )}
      {paying && (
        <PaymentModal
          po={po}
          max={Math.max(po.total - po.amount_paid, 0)}
          currency={r.currency}
          onClose={() => setPaying(false)}
          onDone={async () => {
            setPaying(false);
            await q.reload();
          }}
        />
      )}
      <ConfirmDialog
        open={confirm !== null}
        danger={confirm === 'cancel'}
        title={confirm === 'order' ? `Place PO-${po.po_number}?` : `Cancel PO-${po.po_number}?`}
        message={
          confirm === 'order'
            ? 'Lines will be locked. Stock is added only when you receive the goods.'
            : po.status === 'partially_received'
              ? 'Stock already received stays in inventory. Remaining quantities will not be received.'
              : 'This purchase order will be closed without receiving stock.'
        }
        confirmLabel={confirm === 'order' ? 'Place order' : 'Cancel PO'}
        onConfirm={async () => {
          try {
            await changeStatus(confirm === 'order' ? 'ordered' : 'cancelled');
          } catch (e) {
            throw new Error(friendlyError(e));
          }
        }}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}

function ReceiveModal({
  po,
  lines,
  itemName,
  onClose,
  onDone,
}: {
  po: PurchaseOrder;
  lines: PurchaseOrderItem[];
  itemName: (id: string) => string;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const toast = useToast();
  // One idempotency key per modal session: double-clicks or retries cannot receive twice.
  const key = useMemo(() => crypto.randomUUID(), []);
  const open = lines.filter((l) => l.quantity_received < l.quantity_ordered);
  const [qty, setQty] = useState<Record<string, string>>(() =>
    Object.fromEntries(open.map((l) => [l.id, String(l.quantity_ordered - l.quantity_received)])),
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    const payload: Array<{ line_id: string; quantity: number }> = [];
    for (const l of open) {
      const n = Number(qty[l.id] ?? 0);
      const remaining = l.quantity_ordered - l.quantity_received;
      if (!Number.isFinite(n) || n < 0) {
        setError('Quantities must be zero or more.');
        return;
      }
      if (n > remaining + 1e-9) {
        setError(`${itemName(l.inventory_item_id)}: only ${formatQty(remaining)} outstanding.`);
        return;
      }
      if (n > 0) payload.push({ line_id: l.id, quantity: n });
    }
    if (!payload.length) {
      setError('Enter at least one quantity to receive.');
      return;
    }
    setBusy(true);
    const { data, error: e } = await supabase.rpc('receive_purchase_order', {
      p_po: po.id,
      p_lines: payload,
      p_idempotency_key: key,
    });
    setBusy(false);
    if (e) {
      setError(friendlyError(e));
      return;
    }
    const res = data as { status: string; po_status: string };
    toast.success(
      res.status === 'duplicate_ignored'
        ? 'This delivery was already recorded.'
        : res.po_status === 'received'
          ? 'All goods received. Stock updated.'
          : 'Partial delivery received. Stock updated.',
    );
    await onDone();
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`Receive stock · PO-${po.po_number}`}
      description="Enter what actually arrived. Partial deliveries are supported."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy} icon={<PackageCheck className="h-4 w-4" />}>
            Confirm receipt
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {open.map((l) => (
          <div key={l.id} className="flex items-end gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{itemName(l.inventory_item_id)}</p>
              <p className="text-xs text-slate-500">
                Ordered {formatQty(l.quantity_ordered)} · received {formatQty(l.quantity_received)} · outstanding{' '}
                {formatQty(l.quantity_ordered - l.quantity_received)}
              </p>
            </div>
            <Input
              aria-label={`Receive quantity for ${itemName(l.inventory_item_id)}`}
              wrapClassName="w-32"
              type="number"
              step="0.001"
              min="0"
              value={qty[l.id] ?? ''}
              onChange={(e) => setQty((s) => ({ ...s, [l.id]: e.target.value }))}
            />
          </div>
        ))}
        {error && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

function PaymentModal({
  po,
  max,
  currency,
  onClose,
  onDone,
}: {
  po: PurchaseOrder;
  max: number;
  currency: string;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const toast = useToast();
  const [amount, setAmount] = useState(String(max));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      setError('Enter an amount greater than zero.');
      return;
    }
    if (n > max + 1e-9) {
      setError(`Cannot exceed the remaining ${formatMoney(max, currency)}.`);
      return;
    }
    setBusy(true);
    try {
      unwrap(
        await supabase
          .from('purchase_orders')
          .update({ amount_paid: Math.round((po.amount_paid + n) * 100) / 100 })
          .eq('id', po.id)
          .select('id')
          .single(),
      );
      toast.success(`Recorded ${formatMoney(n, currency)} paid to supplier.`);
      await onDone();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title="Record supplier payment"
      description={`Already paid ${formatMoney(po.amount_paid, currency)} of ${formatMoney(po.total, currency)}.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy}>
            Record
          </Button>
        </>
      }
    >
      <Input
        label={`Amount (${currency})`}
        type="number"
        step="0.01"
        min="0.01"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        error={error ?? undefined}
      />
      <p className="mt-3 text-xs text-slate-500">
        Supplier payments are tracked against the purchase order, separate from sales and expenses. Don’t also enter
        this as an expense: ingredient costs already reach the profit estimate through cost of goods sold, so it would
        be counted twice.
      </p>
    </Modal>
  );
}
