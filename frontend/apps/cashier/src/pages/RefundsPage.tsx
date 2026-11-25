import { useMemo, useState } from 'react';
import { Check, RotateCcw, Search, X } from 'lucide-react';
import { useAuth, useRestaurant } from '@sombill/shared-hooks/AuthContext';
import { useQuery } from '@sombill/shared-hooks/useQuery';
import { useRealtime } from '@sombill/shared-hooks/useRealtime';
import { useStaffDirectory } from '@sombill/shared-hooks/useStaffDirectory';
import { fetchAll, supabase, unwrap, friendlyError } from '@sombill/api-client/supabase';
import { formatDateTime, formatMoney, PAYMENT_METHOD_LABEL } from '@sombill/shared-utils/format';
import { cn } from '@sombill/shared-utils/cn';
import type { Order, Payment, Refund } from '@sombill/shared-types/types';
import { Badge, Card, EmptyState, PageHeader } from '@sombill/shared-ui/ui/Feedback';
import { Tabs } from '@sombill/shared-ui/ui/Filters';
import { Button } from '@sombill/shared-ui/ui/Button';
import { Checkbox, Input, Select, Textarea } from '@sombill/shared-ui/ui/Field';
import { ConfirmDialog } from '@sombill/shared-ui/ui/ConfirmDialog';
import { useToast } from '@sombill/shared-ui/ui/Toast';
import { fetchOrderBundle, type OrderBundle } from '../services/data';
import {
  cashierErrorMessage,
  itemsRefundSuggestion,
  parseMoney,
  POS_METHODS,
  refundEligible,
  refundedQty,
  type PosMethod,
} from '../features/payment';
import { useOpenShift } from '../hooks/useShift';

type Tab = 'new' | 'history' | 'approvals';
const STATUS_TONE = { completed: 'green', pending_approval: 'yellow', rejected: 'red' } as const;
const STATUS_LABEL = {
  completed: 'Completed',
  pending_approval: 'Awaiting manager approval',
  rejected: 'Rejected',
} as const;

export default function RefundsPage() {
  const r = useRestaurant();
  const { role } = useAuth();
  const staff = useStaffDirectory(r.id);
  const [tab, setTab] = useState<Tab>('new');
  const history = useQuery(async () => {
    const refunds = await fetchAll<Refund>((a, b) =>
      supabase
        .from('refunds')
        .select('*')
        .eq('restaurant_id', r.id)
        .order('created_at', { ascending: false })
        .range(a, b),
    );
    const ids = [...new Set(refunds.map((x) => x.order_id))];
    const orders = ids.length
      ? (unwrap(await supabase.from('orders').select('id,order_number').in('id', ids)) as Pick<
          Order,
          'id' | 'order_number'
        >[])
      : [];
    return { refunds, orders: new Map(orders.map((o) => [o.id, o.order_number])) };
  }, [r.id]);
  useRealtime(['refunds', 'payments'], r.id, () => void history.reload());
  const pending = (history.data?.refunds ?? []).filter((x) => x.status === 'pending_approval');

  return (
    <div>
      <PageHeader
        eyebrow="Ledger & Cash · Reversals"
        title="Refunds"
        description="Refunds never delete the original payment: each is a separate, audited record."
      />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'new', label: 'New refund', icon: <RotateCcw className="h-4 w-4" /> },
          { id: 'history', label: 'Refund history', count: history.data?.refunds.length ?? 0 },
          { id: 'approvals', label: role === 'manager' ? 'Approvals' : 'Awaiting approval', count: pending.length },
        ]}
      />
      <div className="mt-4">
        {tab === 'new' && (
          <NewRefund
            onDone={() => {
              void history.reload();
              setTab('history');
            }}
          />
        )}
        {tab !== 'new' && (
          <Card bodyClassName="p-0">
            {!(tab === 'history' ? history.data?.refunds : pending)?.length ? (
              <EmptyState title={tab === 'history' ? 'No refunds yet' : 'Nothing awaiting approval'} />
            ) : (
              <ul
                className="divide-y divide-slate-100"
                aria-label={tab === 'history' ? 'Refund history' : 'Refund approvals'}
              >
                {(tab === 'history' ? history.data!.refunds : pending).map((x) => (
                  <RefundRow
                    key={x.id}
                    x={x}
                    orderNo={history.data!.orders.get(x.order_id)}
                    nameOf={staff.nameOf}
                    canDecide={role === 'manager' && x.status === 'pending_approval'}
                    onChanged={() => void history.reload()}
                  />
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

function RefundRow({
  x,
  orderNo,
  nameOf,
  canDecide,
  onChanged,
}: {
  x: Refund;
  orderNo?: number;
  nameOf: (id: string | null) => string;
  canDecide: boolean;
  onChanged: () => void;
}) {
  const r = useRestaurant();
  const toast = useToast();
  const [decide, setDecide] = useState<boolean | null>(null);
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
      <div className="min-w-0 text-sm">
        <p className="font-semibold">
          Order #{orderNo ?? '—'} · {formatMoney(x.amount, r.currency)} · {PAYMENT_METHOD_LABEL[x.method]}
          {x.reference ? ` · Ref ${x.reference}` : ''}
        </p>
        <p className="text-slate-600">
          {x.reason}
          {x.items.length ? ` · ${x.items.reduce((s, i) => s + Number(i.quantity), 0)} item(s)` : ''}
          {x.restock ? ' · restocked' : ''}
        </p>
        <p className="text-xs text-slate-500">
          {formatDateTime(x.created_at, r.timezone)} · requested by {nameOf(x.requested_by)}
          {x.approved_by ? ` · ${x.status === 'rejected' ? 'rejected' : 'approved'} by ${nameOf(x.approved_by)}` : ''}
          {x.decision_note ? ` · “${x.decision_note}”` : ''}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Badge tone={STATUS_TONE[x.status]}>{STATUS_LABEL[x.status]}</Badge>
        {canDecide && (
          <>
            <Button
              size="sm"
              className="h-10"
              variant="navy"
              icon={<Check className="h-4 w-4" />}
              onClick={() => setDecide(true)}
            >
              Approve
            </Button>
            <Button
              size="sm"
              className="h-10"
              variant="danger"
              icon={<X className="h-4 w-4" />}
              onClick={() => setDecide(false)}
            >
              Reject
            </Button>
          </>
        )}
      </div>
      <ConfirmDialog
        open={decide !== null}
        danger={decide === false}
        requireReason={decide === false}
        title={decide ? 'Approve this refund?' : 'Reject this refund?'}
        message={`${formatMoney(x.amount, r.currency)} by ${PAYMENT_METHOD_LABEL[x.method]} — ${x.reason}`}
        confirmLabel={decide ? 'Approve & pay out' : 'Reject'}
        onClose={() => setDecide(null)}
        onConfirm={async (note) => {
          if (decide === null) return;
          const { error } = await supabase.rpc('decide_refund', {
            p_refund: x.id,
            p_approve: decide,
            p_note: note || null,
          });
          if (error) throw new Error(friendlyError(error));
          toast.success(decide ? 'Refund approved and recorded.' : 'Refund rejected.');
          setDecide(null);
          onChanged();
        }}
      />
    </li>
  );
}

function NewRefund({ onDone }: { onDone: () => void }) {
  const r = useRestaurant();
  const { role } = useAuth();
  const toast = useToast();
  const shift = useOpenShift();
  const [lookup, setLookup] = useState('');
  const [bundle, setBundle] = useState<OrderBundle | null>(null);
  const [lookErr, setLookErr] = useState<string | null>(null);
  const [payId, setPayId] = useState('');
  const [picks, setPicks] = useState<Record<string, number>>({});
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PosMethod>('cash');
  const [reason, setReason] = useState('');
  const [reference, setReference] = useState('');
  const [restock, setRestock] = useState(false);
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const find = async () => {
    setLookErr(null);
    setBundle(null);
    setPayId('');
    const t = lookup.trim().replace(/^#/, '');
    if (!/^\d+$/.test(t)) {
      setLookErr('Enter an order number or transaction number.');
      return;
    }
    let orderId: string | null = null;
    const byTxn = unwrap(
      await supabase
        .from('payments')
        .select('id,order_id')
        .eq('restaurant_id', r.id)
        .eq('transaction_number', Number(t))
        .maybeSingle(),
    ) as Pick<Payment, 'id' | 'order_id'> | null;
    if (byTxn) {
      orderId = byTxn.order_id;
      setPayId(byTxn.id);
    } else {
      const o = unwrap(
        await supabase
          .from('orders')
          .select('id')
          .eq('restaurant_id', r.id)
          .eq('order_number', Number(t))
          .maybeSingle(),
      ) as Pick<Order, 'id'> | null;
      orderId = o?.id ?? null;
    }
    if (!orderId) {
      setLookErr('No order or transaction with that number.');
      return;
    }
    const b = await fetchOrderBundle(orderId);
    setBundle(b);
    setPicks({});
    setAmount('');
    setKey(crypto.randomUUID());
  };

  const pays = (bundle?.payments ?? []).filter((p) => p.kind === 'payment' && p.status === 'succeeded');
  const pay = pays.find((p) => p.id === payId) ?? null;
  const eligible = pay ? refundEligible(pay, bundle!.refunds) : 0;
  const suggestion = useMemo(
    () => (bundle ? Math.min(itemsRefundSuggestion(bundle.order, bundle.items, picks), eligible) : 0),
    [bundle, picks, eligible],
  );
  const amt = parseMoney(amount || '');
  const needsApproval =
    role !== 'manager' &&
    (!r.settings.permissions.cashier_can_refund || (amt ?? 0) > r.settings.permissions.cashier_refund_limit);
  const canRestock =
    !!bundle?.order.stock_deducted_at && !bundle.order.stock_reversed_at && Object.values(picks).some((v) => v > 0);

  const submit = async () => {
    setErr(null);
    if (!pay) {
      setErr('Choose the original transaction.');
      return;
    }
    if (amt === null || amt <= 0) {
      setErr('Enter a valid refund amount.');
      return;
    }
    if (amt > eligible) {
      setErr(`At most ${formatMoney(eligible, r.currency)} can be refunded on this transaction.`);
      return;
    }
    if (reason.trim().length < 3) {
      setErr('Enter the refund reason.');
      return;
    }
    if (method !== 'cash' && reference.trim().length < 4) {
      setErr('Enter the refund reference (wallet/terminal transaction ID).');
      return;
    }
    setBusy(true);
    const items = Object.entries(picks)
      .filter(([, q]) => q > 0)
      .map(([order_item_id, quantity]) => ({ order_item_id, quantity }));
    const { data, error } = await supabase.rpc('process_refund', {
      p_payment: pay.id,
      p_amount: amt,
      p_method: method,
      p_reason: reason.trim(),
      p_reference: reference.trim() || null,
      p_items: items,
      p_restock: restock && canRestock,
      p_idempotency_key: key,
    });
    setBusy(false);
    if (error) {
      setErr(cashierErrorMessage(friendlyError(error)));
      return;
    }
    const res = data as { status: string };
    toast.success(
      res.status === 'completed'
        ? `Refund of ${formatMoney(amt, r.currency)} recorded.`
        : 'Refund sent to a manager for approval.',
    );
    onDone();
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card title="1. Find the original transaction">
        <div className="flex gap-2">
          <input
            className="input h-12"
            inputMode="numeric"
            aria-label="Order or transaction number"
            placeholder="Order # or transaction #"
            value={lookup}
            onChange={(e) => setLookup(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void find();
            }}
          />
          <Button className="h-12" variant="navy" icon={<Search className="h-4 w-4" />} onClick={() => void find()}>
            Find
          </Button>
        </div>
        {lookErr && (
          <p role="alert" className="mt-2 text-sm text-red-700">
            {lookErr}
          </p>
        )}
        {bundle && (
          <div className="mt-4 space-y-3">
            <p className="text-sm">
              Order <b>#{bundle.order.order_number}</b> · total {formatMoney(bundle.order.total, r.currency)} · net paid{' '}
              {formatMoney(Number(bundle.order.amount_paid) - Number(bundle.order.amount_refunded), r.currency)}
            </p>
            {!pays.length ? (
              <p className="text-sm text-slate-500">No confirmed payments on this order.</p>
            ) : (
              <ul className="space-y-2" aria-label="Original transactions">
                {pays.map((p) => {
                  const el = refundEligible(p, bundle.refunds);
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        disabled={el <= 0}
                        onClick={() => {
                          setPayId(p.id);
                          setMethod(
                            (['cash', 'card', 'evc_plus', 'zaad', 'somtel_money'].includes(p.method)
                              ? p.method
                              : 'cash') as PosMethod,
                          );
                        }}
                        className={cn(
                          'flex min-h-[52px] w-full items-center justify-between rounded-xl border px-3 text-left text-sm disabled:opacity-50',
                          p.id === payId ? 'border-brand-orange bg-orange-50' : 'border-slate-200',
                        )}
                      >
                        <span>
                          #{p.transaction_number} · {PAYMENT_METHOD_LABEL[p.method]} ·{' '}
                          {formatMoney(p.amount, r.currency)}
                          {p.reference ? ` · ${p.reference}` : ''}
                        </span>
                        <span className="text-xs text-slate-500">refundable {formatMoney(el, r.currency)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </Card>
      <Card title="2. Refund details">
        {!pay ? (
          <p className="text-sm text-slate-500">Select a transaction first.</p>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="label">Items (optional)</p>
              <ul className="space-y-2">
                {bundle!.items
                  .filter((i) => !i.is_voided)
                  .map((i) => {
                    const left = Number(i.quantity) - refundedQty(bundle!.refunds, i.id);
                    return (
                      <li key={i.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="min-w-0 truncate">
                          {i.product_name}{' '}
                          <span className="text-slate-500">
                            ({left} of {Number(i.quantity)} refundable)
                          </span>
                        </span>
                        <input
                          className="input h-10 w-20 text-center"
                          inputMode="numeric"
                          aria-label={`Refund quantity for ${i.product_name}`}
                          value={picks[i.id] ?? ''}
                          disabled={left <= 0}
                          onChange={(e) => {
                            const n = Math.min(Math.max(Number(e.target.value.replace(/\D/g, '')) || 0, 0), left);
                            setPicks((p) => ({ ...p, [i.id]: n }));
                          }}
                        />
                      </li>
                    );
                  })}
              </ul>
              {suggestion > 0 && (
                <button
                  type="button"
                  className="mt-2 text-sm font-semibold text-brand-red hover:underline"
                  onClick={() => setAmount(suggestion.toFixed(2))}
                >
                  Use items value {formatMoney(suggestion, r.currency)}
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label={`Amount (max ${formatMoney(eligible, r.currency)})`}
                name="refund-amount"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <Select
                label="Refund method"
                name="refund-method"
                value={method}
                onChange={(e) => setMethod(e.target.value as PosMethod)}
              >
                {POS_METHODS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </div>
            {method !== 'cash' && (
              <Input
                label="Refund reference"
                name="refund-reference"
                value={reference}
                maxLength={60}
                onChange={(e) => setReference(e.target.value)}
                hint="Wallet or terminal transaction ID of the refund"
              />
            )}
            <Textarea
              label="Reason"
              name="refund-reason"
              value={reason}
              maxLength={500}
              onChange={(e) => setReason(e.target.value)}
            />
            {canRestock && (
              <Checkbox
                name="refund-restock"
                label="Return selected items to stock"
                description="Only if the items were inspected and can be reused"
                checked={restock}
                onChange={(e) => setRestock(e.target.checked)}
              />
            )}
            {needsApproval && (
              <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                This refund needs manager approval
                {r.settings.permissions.cashier_can_refund
                  ? ` (above your ${formatMoney(r.settings.permissions.cashier_refund_limit, r.currency)} limit)`
                  : ''}
                . No money is recorded until a manager approves.
              </p>
            )}
            {shift.blocked && (
              <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                Open your cash shift before refunding.
              </p>
            )}
            {err && (
              <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {err}
              </p>
            )}
            <Button
              variant="orange"
              className="h-12 w-full"
              loading={busy}
              disabled={shift.blocked}
              onClick={() => void submit()}
            >
              {needsApproval ? 'Request refund approval' : 'Record refund'}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
