import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRightLeft,
  Ban,
  CheckCheck,
  CreditCard,
  GitMerge,
  PlusCircle,
  Printer,
  RefreshCw,
  Scissors,
  Split,
  Undo2,
  Users,
} from 'lucide-react';
import { useAuth, useRestaurant } from '@sombill/shared-hooks/AuthContext';
import { useQuery } from '@sombill/shared-hooks/useQuery';
import { useRealtime } from '@sombill/shared-hooks/useRealtime';
import { useStaffDirectory } from '@sombill/shared-hooks/useStaffDirectory';
import { revealIfStacked } from '@sombill/shared-hooks/useMediaQuery';
import { supabase, friendlyError } from '@sombill/api-client/supabase';
import { fetchTableStatus } from '@sombill/api-client/queries';
import { fetchActiveOrders, fetchItemsFor, itemsByOrder } from '@sombill/api-client/orderData';
import { formatDateTime, formatDuration, formatMoney, ORDER_STATUS_LABEL } from '@sombill/shared-utils/format';
import { cn } from '@sombill/shared-utils/cn';
import type { Order, OrderItem, RestaurantTable, TableStatusRow } from '@sombill/shared-types/types';
import { Badge, Card, EmptyState, ErrorState, PageHeader, Skeleton } from '@sombill/shared-ui/ui/Feedback';
import { SearchInput } from '@sombill/shared-ui/ui/Filters';
import { OrderStatusBadge, PaymentStatusBadge } from '@sombill/shared-ui/ui/StatusBadges';
import { Button } from '@sombill/shared-ui/ui/Button';
import { Modal } from '@sombill/shared-ui/ui/Modal';
import { useToast } from '@sombill/shared-ui/ui/Toast';
import { useCart } from '@sombill/shared-hooks/cart';
import { fetchOrderBundle, printDocument } from '../services/data';
import { BillDetail } from '../components/BillDetail';
import { r2 } from '../features/payment';

type FloorVisualState =
  | 'free'
  | 'occupied'
  | 'in_kitchen'
  | 'served'
  | 'bill_requested'
  | 'cleaning'
  | 'merged';

const FLOOR_STYLE: Record<FloorVisualState, string> = {
  free: 'border-slate-200 bg-slate-50/80 hover:border-slate-400',
  occupied: 'border-sky-300 bg-sky-50/85 hover:border-sky-500',
  in_kitchen: 'border-amber-300 bg-amber-50/85 hover:border-amber-500',
  served: 'border-emerald-300 bg-emerald-50/85 hover:border-emerald-500',
  bill_requested: 'border-orange-400 bg-orange-50 ring-2 ring-orange-400/40 animate-pulse',
  cleaning: 'border-violet-300 bg-violet-50/85 hover:border-violet-500',
  merged: 'border-indigo-300 border-dashed bg-indigo-50/60 hover:border-indigo-500',
};

const FLOOR_LABEL: Record<FloorVisualState, string> = {
  free: 'Free',
  occupied: 'Occupied',
  in_kitchen: 'In Kitchen',
  served: 'Served',
  bill_requested: 'Bill Requested',
  cleaning: 'Paid · Cleaning',
  merged: 'Merged',
};

function playOrderChime() {
  try {
    const AudioCtx =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.38);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    /* audio blocked by browser autoplay policy */
  }
}

type ExtendedTable = RestaurantTable & { merged_into_id?: string | null };
type ExtendedOrder = Order & {
  merged_table_ids?: string[];
  merged_table_numbers?: number[];
  parent_order_id?: string | null;
  split_label?: string | null;
};
type ExtendedOrderItem = OrderItem & {
  source_table_id?: string | null;
  source_table_number?: number | null;
};

export default function CashierTablesPage() {
  const r = useRestaurant();
  const { role } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const cart = useCart();
  const staff = useStaffDirectory(r.id);
  const money = (n: number) => formatMoney(n, r.currency);

  const [filter, setFilter] = useState<'all' | 'occupied' | 'bill_requested' | 'free'>('all');
  const [section, setSection] = useState('');
  const [search, setSearch] = useState('');
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [highlightedTables, setHighlightedTables] = useState<Record<string, boolean>>({});
  const knownOrderIds = useRef<Set<string> | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [, tick] = useState(0);

  // Modals: Merge, Transfer, Split, Void Item
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeTargets, setMergeTargets] = useState<string[]>([]);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState('');
  const [splitOpen, setSplitOpen] = useState(false);
  const [splitMode, setSplitMode] = useState<'equal' | 'items' | 'amount'>('equal');
  const [equalGuests, setEqualGuests] = useState(2);
  const [itemSplits, setItemSplits] = useState<Record<string, number>>({});
  const [splitLabel, setSplitLabel] = useState('Guest 2');
  const [customAmounts, setCustomAmounts] = useState<string[]>(['', '']);
  const [voidItemTarget, setVoidItemTarget] = useState<ExtendedOrderItem | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [actionBusy, setActionBusy] = useState(false);

  const q = useQuery(async () => {
    const [statusRows, rawTables, activeOrders] = await Promise.all([
      fetchTableStatus(r.id),
      supabase
        .from('restaurant_tables')
        .select('*')
        .eq('restaurant_id', r.id)
        .is('archived_at', null)
        .order('table_number')
        .then((x) => (x.data ?? []) as ExtendedTable[]),
      fetchActiveOrders(r.id) as Promise<ExtendedOrder[]>,
    ]);
    const itemsMap = itemsByOrder(await fetchItemsFor(activeOrders.map((o) => o.id))) as Map<
      string,
      ExtendedOrderItem[]
    >;
    const rawById = new Map(rawTables.map((t) => [t.id, t]));
    const ordersByTable = new Map<string, ExtendedOrder[]>();
    for (const o of activeOrders) {
      if (!o.table_id) continue;
      ordersByTable.set(o.table_id, [...(ordersByTable.get(o.table_id) ?? []), o]);
    }
    return { statusRows, rawById, activeOrders, ordersByTable, itemsMap };
  }, [r.id]);

  // Real-time subscription + 10-second polling fallback
  useRealtime(['orders', 'order_items', 'payments', 'restaurant_tables'], r.id, () => void q.reload(), {
    debounceMs: 250,
  });
  useEffect(() => {
    const timer = setInterval(() => {
      tick((x) => x + 1);
      void q.reload();
    }, 10000);
    return () => clearInterval(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Detect newly arrived waiter / QR orders and fire toast + sound + card highlight
  useEffect(() => {
    if (!q.data) return;
    const currentIds = new Set(q.data.activeOrders.map((o) => o.id));
    if (knownOrderIds.current === null) {
      knownOrderIds.current = currentIds;
      return;
    }
    for (const o of q.data.activeOrders) {
      if (!knownOrderIds.current.has(o.id) && o.table_id) {
        const tbl = q.data.rawById.get(o.table_id);
        const its = (q.data.itemsMap.get(o.id) ?? []).filter((i) => !i.is_voided);
        const count = its.reduce((s, i) => s + Number(i.quantity), 0);
        const who = o.waiter_id ? `Waiter ${staff.nameOf(o.waiter_id)}` : 'QR Table Self-Order';
        toast.info(
          `Table ${tbl?.table_number ?? '—'} – new order #${o.order_number} from ${who} – ${count} item${count === 1 ? '' : 's'} – ${money(o.total)}`,
        );
        playOrderChime();
        const tid = o.table_id;
        setHighlightedTables((prev) => ({ ...prev, [tid]: true }));
        setTimeout(() => {
          setHighlightedTables((prev) => {
            const next = { ...prev };
            delete next[tid];
            return next;
          });
        }, 8000);
      }
    }
    knownOrderIds.current = currentIds;
  }, [q.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const visualStateOf = (t: TableStatusRow): FloorVisualState => {
    const raw = q.data?.rawById.get(t.id);
    if (raw?.merged_into_id) return 'merged';
    const tOrders = q.data?.ordersByTable.get(t.id) ?? [];
    const primary = tOrders[0];
    if (!primary) return t.status === 'cleaning' ? 'cleaning' : 'free';
    if (primary.bill_requested_at && primary.payment_status !== 'paid') return 'bill_requested';
    if (primary.payment_status === 'paid') return 'cleaning';
    if (primary.status === 'served') return 'served';
    if (['new', 'pending', 'accepted', 'preparing', 'ready'].includes(primary.status)) return 'in_kitchen';
    return 'occupied';
  };

  const sections = useMemo(() => [...new Set((q.data?.statusRows ?? []).map((t) => t.section))].sort(), [q.data]);

  const filteredTables = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (q.data?.statusRows ?? []).filter((t) => {
      const vs = visualStateOf(t);
      if (section && t.section !== section) return false;
      if (filter === 'occupied' && vs === 'free') return false;
      if (filter === 'bill_requested' && vs !== 'bill_requested') return false;
      if (filter === 'free' && vs !== 'free') return false;
      if (!term) return true;
      return (
        String(t.table_number).includes(term) ||
        (t.name ?? '').toLowerCase().includes(term) ||
        t.section.toLowerCase().includes(term)
      );
    });
  }, [q.data, filter, section, search]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedTable = (q.data?.statusRows ?? []).find((t) => t.id === selectedTableId) ?? null;
  const selectedRaw = selectedTable ? (q.data?.rawById.get(selectedTable.id) ?? null) : null;
  const tableOrders = selectedTable ? (q.data?.ordersByTable.get(selectedTable.id) ?? []) : [];
  const activeOrder =
    tableOrders.find((o) => o.id === selectedOrderId) ??
    tableOrders[0] ??
    null;

  const bundle = useQuery(
    () => (activeOrder ? fetchOrderBundle(activeOrder.id) : Promise.resolve(null)),
    [activeOrder?.id],
  );

  const openNewOrderOnTable = (t: TableStatusRow) => {
    cart.clear();
    cart.setOrderType('dine_in');
    cart.setTable(t.id);
    navigate('/cashier/new-sale');
  };

  const appendItemsToOrder = (o: Order) => {
    cart.startExistingOrder(o.id, o.table_id);
    navigate('/cashier/new-sale');
  };

  const closeOrder = async (o: Order) => {
    setActionBusy(true);
    const { error } = await supabase.rpc('close_paid_order', { p_order: o.id });
    setActionBusy(false);
    if (error) {
      toast.error(friendlyError(error));
      return;
    }
    toast.success(`Order #${o.order_number} closed. Table is now free.`);
    await Promise.all([q.reload(), bundle.reload()]);
  };

  const runMerge = async () => {
    if (!selectedTable || !mergeTargets.length) return;
    setActionBusy(true);
    const { data, error } = await supabase.rpc('merge_table_orders', {
      p_primary_table: selectedTable.id,
      p_secondary_tables: mergeTargets,
    });
    setActionBusy(false);
    if (error) {
      toast.error(friendlyError(error));
      return;
    }
    const res = data as { order_number: number; merged_table_numbers: number[] };
    toast.success(
      `Merged Table ${(res.merged_table_numbers ?? []).join(', ')} into Table ${selectedTable.table_number} (Order #${res.order_number}).`,
    );
    setMergeOpen(false);
    setMergeTargets([]);
    await Promise.all([q.reload(), bundle.reload()]);
  };

  const runUnmerge = async () => {
    if (!selectedTable) return;
    setActionBusy(true);
    const { data, error } = await supabase.rpc('unmerge_table_orders', {
      p_primary_table: selectedTable.id,
    });
    setActionBusy(false);
    if (error) {
      toast.error(friendlyError(error));
      return;
    }
    const res = data as { restored_tables: number[] };
    toast.success(
      res.restored_tables?.length
        ? `Unmerged Table ${res.restored_tables.join(', ')} back to separate bills.`
        : `Table ${selectedTable.table_number} unmerged.`,
    );
    await Promise.all([q.reload(), bundle.reload()]);
  };

  const runTransfer = async () => {
    if (!activeOrder || !transferTarget) return;
    setActionBusy(true);
    const { data, error } = await supabase.rpc('transfer_table_order', {
      p_order: activeOrder.id,
      p_to_table: transferTarget,
    });
    setActionBusy(false);
    if (error) {
      toast.error(friendlyError(error));
      return;
    }
    const res = data as { to_table_number: number };
    toast.success(`Order #${activeOrder.order_number} transferred to Table ${res.to_table_number}.`);
    setTransferOpen(false);
    setSelectedTableId(transferTarget);
    setTransferTarget('');
    await Promise.all([q.reload(), bundle.reload()]);
  };

  const runVoidItem = async () => {
    if (!voidItemTarget || voidReason.trim().length < 3) return;
    setActionBusy(true);
    const { error } = await supabase.rpc('void_order_item', {
      p_item: voidItemTarget.id,
      p_reason: voidReason.trim(),
    });
    setActionBusy(false);
    if (error) {
      toast.error(friendlyError(error));
      return;
    }
    toast.success(`Voided ${voidItemTarget.product_name}.`);
    setVoidItemTarget(null);
    setVoidReason('');
    await Promise.all([q.reload(), bundle.reload()]);
  };

  const runSplitByItems = async () => {
    if (!activeOrder) return;
    const payload = Object.entries(itemSplits)
      .filter(([, qty]) => qty > 0)
      .map(([item_id, quantity]) => ({ item_id, quantity }));
    if (!payload.length) {
      toast.error('Select at least one item quantity to split into the new check.');
      return;
    }
    setActionBusy(true);
    const { data, error } = await supabase.rpc('split_order_by_items', {
      p_order: activeOrder.id,
      p_items: payload,
      p_split_label: splitLabel.trim() || 'Guest 2',
    });
    setActionBusy(false);
    if (error) {
      toast.error(friendlyError(error));
      return;
    }
    const res = data as { child_order_id: string; child_order_number: number; child_total: number };
    toast.success(`Created split check #${res.child_order_number} (${money(Number(res.child_total))}).`);
    setSplitOpen(false);
    setItemSplits({});
    setSelectedOrderId(res.child_order_id);
    await Promise.all([q.reload(), bundle.reload()]);
  };

  // Group non-voided items by round (minute + waiter)
  const activeItems = useMemo(
    () => (q.data?.itemsMap.get(activeOrder?.id ?? '') ?? []) as ExtendedOrderItem[],
    [q.data?.itemsMap, activeOrder?.id],
  );
  const rounds = useMemo(() => {
    const map = new Map<string, ExtendedOrderItem[]>();
    for (const it of activeItems) {
      const key = it.created_at.slice(0, 16);
      map.set(key, [...(map.get(key) ?? []), it]);
    }
    return [...map.entries()];
  }, [activeItems]);

  // Equal split share calculation (puts rounding cent on the last share)
  const orderBalance = activeOrder
    ? r2(Math.max(Number(activeOrder.total) - Number(activeOrder.amount_paid) + Number(activeOrder.amount_refunded), 0))
    : 0;
  const equalShares = useMemo(() => {
    const n = Math.min(20, Math.max(2, equalGuests));
    if (orderBalance <= 0) return [] as number[];
    const base = Math.floor((orderBalance * 100) / n) / 100;
    const shares = Array.from({ length: n }, () => base);
    const rem = r2(orderBalance - base * n);
    shares[n - 1] = r2(shares[n - 1]! + rem);
    return shares;
  }, [orderBalance, equalGuests]);

  const occupiedOtherTables = (q.data?.statusRows ?? []).filter(
    (t) =>
      t.id !== selectedTable?.id &&
      (q.data?.ordersByTable.get(t.id)?.length ?? 0) > 0 &&
      !q.data?.rawById.get(t.id)?.merged_into_id,
  );
  const freeOtherTables = (q.data?.statusRows ?? []).filter(
    (t) =>
      t.id !== selectedTable?.id &&
      (q.data?.ordersByTable.get(t.id)?.length ?? 0) === 0 &&
      !q.data?.rawById.get(t.id)?.merged_into_id,
  );

  return (
    <div>
      <PageHeader
        eyebrow="Point of Sale · Live Dining Floor"
        title="Tables"
        description="Real-time waiter orders by table. Click any table to view rounds, add items, merge, split, transfer, print pre-bill, or take payment."
        actions={
          <Button variant="secondary" icon={<RefreshCw className="h-4 w-4" />} onClick={() => void q.reload()}>
            Refresh floor
          </Button>
        }
      />

      {/* Floor Filter Bar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(
          [
            ['all', 'All Tables', (q.data?.statusRows ?? []).length],
            [
              'occupied',
              'Occupied / Active',
              (q.data?.statusRows ?? []).filter((t) => visualStateOf(t) !== 'free').length,
            ],
            [
              'bill_requested',
              'Bill Requested',
              (q.data?.statusRows ?? []).filter((t) => visualStateOf(t) === 'bill_requested').length,
            ],
            ['free', 'Free', (q.data?.statusRows ?? []).filter((t) => visualStateOf(t) === 'free').length],
          ] as const
        ).map(([id, label, cnt]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={cn(
              'inline-flex h-10 items-center gap-2 rounded-full border px-4 text-xs font-bold transition',
              filter === id
                ? 'border-brand-navy bg-brand-navy text-white shadow-sm'
                : 'border-slate-300 bg-white text-slate-700 hover:border-brand-orange',
            )}
          >
            {label}
            <span
              className={cn(
                'rounded-full px-1.5 py-0.5 font-mono text-[11px]',
                filter === id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600',
              )}
            >
              {cnt}
            </span>
          </button>
        ))}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search table # or section"
            className="w-52"
          />
          {sections.length > 1 && (
            <select
              className="input h-10 w-auto"
              aria-label="Filter by area"
              value={section}
              onChange={(e) => setSection(e.target.value)}
            >
              <option value="">All areas</option>
              {sections.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {q.error ? (
        <div className="card">
          <ErrorState message={q.error} onRetry={q.reload} />
        </div>
      ) : q.loading && !q.data ? (
        <Skeleton className="h-80 w-full" />
      ) : !filteredTables.length ? (
        <div className="card">
          <EmptyState title="No tables match this filter" message="Try switching filter tabs or clearing your search." />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_430px]">
          {/* LEFT: Floor Grid */}
          <div
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 2xl:grid-cols-5"
            role="list"
            aria-label="Floor tables"
          >
            {filteredTables.map((t) => {
              const vs = visualStateOf(t);
              const raw = q.data?.rawById.get(t.id);
              const mergedInto = raw?.merged_into_id ? q.data?.rawById.get(raw.merged_into_id) : null;
              const tOrders = q.data?.ordersByTable.get(t.id) ?? [];
              const pri = tOrders[0] ?? null;
              const mergedNums = pri?.merged_table_numbers ?? [];
              const totalRunning = tOrders.reduce((s, o) => s + Number(o.total), 0);
              const totalBalance = tOrders.reduce(
                (s, o) => s + Math.max(Number(o.total) - Number(o.amount_paid) + Number(o.amount_refunded), 0),
                0,
              );
              const isHighlighted = Boolean(highlightedTables[t.id]);

              return (
                <button
                  key={t.id}
                  type="button"
                  role="listitem"
                  data-sb="table-card"
                  data-state={t.status}
                  onClick={() => {
                    if (mergedInto) {
                      setSelectedTableId(mergedInto.id);
                      setSelectedOrderId(null);
                    } else {
                      setSelectedTableId(t.id);
                      setSelectedOrderId(pri?.id ?? null);
                    }
                    revealIfStacked(panelRef.current);
                  }}
                  aria-pressed={selectedTableId === t.id}
                  className={cn(
                    'flex min-h-[142px] flex-col justify-between rounded-2xl border-2 p-3.5 text-left transition-all',
                    FLOOR_STYLE[vs],
                    selectedTableId === t.id && 'ring-4 ring-brand-orange/40',
                    isHighlighted && 'ring-4 ring-red-500 animate-bounce',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-mono text-2xl font-black leading-none text-brand-navy">
                          T{t.table_number}
                          {mergedNums.length > 0 ? ` + T${mergedNums.join('+T')}` : ''}
                        </p>
                      </div>
                      <p className="mt-1 truncate text-xs text-slate-500">
                        {t.name ? `${t.name} · ${t.section}` : t.section}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-0.5 text-xs font-semibold text-slate-600">
                      <Users className="h-3.5 w-3.5" />
                      {pri?.guest_count ?? t.capacity}
                    </span>
                  </div>

                  {mergedInto ? (
                    <div className="mt-2 rounded-lg bg-indigo-100/80 px-2.5 py-1.5 text-xs font-bold text-indigo-900">
                      Merged into Table {mergedInto.table_number}
                    </div>
                  ) : pri ? (
                    <div className="mt-2 space-y-0.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-brand-navy">
                          #{pri.order_number}
                          {tOrders.length > 1 ? ` (+${tOrders.length - 1} split)` : ''}
                        </span>
                        <span className="font-mono text-[11px] text-slate-500">
                          {formatDuration(pri.created_at)}
                        </span>
                      </div>
                      <p className="truncate text-slate-600">
                        {pri.waiter_id ? staff.nameOf(pri.waiter_id) : 'QR Self-Order'}
                      </p>
                      <div className="flex items-baseline justify-between pt-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                          {FLOOR_LABEL[vs]}
                        </span>
                        <span className="font-mono text-sm font-black tabular-nums text-brand-red">
                          {money(totalBalance > 0 ? totalBalance : totalRunning)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="font-bold text-emerald-700">{FLOOR_LABEL[vs]}</span>
                      <span className="text-slate-400">Tap to open</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* RIGHT: Table Detail Drawer */}
          <div ref={panelRef} className="scroll-mt-20">
            <Card
              title={
                selectedTable
                  ? `Table ${selectedTable.table_number}${
                      (activeOrder?.merged_table_numbers?.length ?? 0) > 0
                        ? ` + Table ${activeOrder!.merged_table_numbers!.join(', ')}`
                        : ''
                    }`
                  : 'Select a table'
              }
              className="h-fit xl:sticky xl:top-20"
            >
              {!selectedTable ? (
                <p className="text-sm text-slate-500">
                  Tap any table on the floor to view waiter rounds, print a pre-bill, merge, split, transfer, or take
                  payment.
                </p>
              ) : !activeOrder ? (
                <div className="space-y-4">
                  <dl className="grid grid-cols-2 gap-2 text-sm">
                    <dt className="text-slate-500">Area / Section</dt>
                    <dd className="font-semibold">{selectedTable.section}</dd>
                    <dt className="text-slate-500">Capacity</dt>
                    <dd className="font-semibold">{selectedTable.capacity} guests</dd>
                    <dt className="text-slate-500">Status</dt>
                    <dd>
                      <Badge tone="green">Free / Available</Badge>
                    </dd>
                  </dl>
                  {selectedRaw?.merged_into_id && (
                    <div className="rounded-xl bg-indigo-50 p-3 text-xs text-indigo-900">
                      This table is currently merged into another table.
                    </div>
                  )}
                  <Button
                    variant="orange"
                    className="h-12 w-full"
                    icon={<PlusCircle className="h-5 w-5" />}
                    onClick={() => openNewOrderOnTable(selectedTable)}
                  >
                    Start new dine-in order
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Multiple split checks selector on this table */}
                  {tableOrders.length > 1 && (
                    <div>
                      <span className="label">Checks on Table {selectedTable.table_number}</span>
                      <div className="flex flex-wrap gap-1.5">
                        {tableOrders.map((ord, idx) => (
                          <button
                            key={ord.id}
                            type="button"
                            onClick={() => setSelectedOrderId(ord.id)}
                            className={cn(
                              'rounded-lg border px-3 py-1.5 text-xs font-bold transition',
                              ord.id === activeOrder.id
                                ? 'border-brand-navy bg-brand-navy text-white'
                                : 'border-slate-200 bg-white text-slate-700 hover:border-brand-orange',
                            )}
                          >
                            #{ord.order_number} {ord.split_label ? `(${ord.split_label})` : `(Check ${idx + 1})`} ·{' '}
                            {money(ord.total)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Header summary badges */}
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 p-3 text-xs">
                    <div>
                      <span className="font-bold text-brand-navy">Order #{activeOrder.order_number}</span>
                      <span className="ml-2 text-slate-500">
                        {activeOrder.waiter_id ? `Waiter: ${staff.nameOf(activeOrder.waiter_id)}` : 'QR Self-Order'}
                      </span>
                      <span className="block text-slate-500">
                        Seated {formatDuration(activeOrder.created_at)} ago · {activeOrder.guest_count ?? 1} guest(s)
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <OrderStatusBadge s={activeOrder.status} />
                      <PaymentStatusBadge s={activeOrder.payment_status} />
                    </div>
                  </div>

                  {/* Merged tables notice + Unmerge action */}
                  {(activeOrder.merged_table_numbers?.length ?? 0) > 0 && (
                    <div className="flex items-center justify-between gap-2 rounded-xl border border-indigo-200 bg-indigo-50/70 px-3 py-2 text-xs text-indigo-950">
                      <span>
                        <b>Merged Tables:</b> Table {selectedTable.table_number},{' '}
                        {activeOrder.merged_table_numbers!.map((n) => `Table ${n}`).join(', ')}
                      </span>
                      {Number(activeOrder.amount_paid) === 0 && (
                        <button
                          type="button"
                          disabled={actionBusy}
                          onClick={() => void runUnmerge()}
                          className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 font-bold text-indigo-700 shadow-sm hover:bg-indigo-100"
                        >
                          <Undo2 className="h-3.5 w-3.5" /> Unmerge
                        </button>
                      )}
                    </div>
                  )}

                  {/* Rounds grouped by time + waiter with item kitchen status & Void button */}
                  <div className="space-y-2">
                    <span className="label">Order rounds &amp; kitchen status</span>
                    <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
                      {rounds.map(([minuteKey, rItems], idx) => (
                        <div key={minuteKey} className="rounded-xl border border-slate-200 p-2.5 text-xs">
                          <div className="mb-1.5 flex items-center justify-between text-[11px] font-bold text-slate-500">
                            <span>
                              Round {idx + 1} ·{' '}
                              {activeOrder.waiter_id ? staff.nameOf(activeOrder.waiter_id) : 'QR Self-Order'}
                            </span>
                            <span>{formatDateTime(rItems[0]!.created_at, r.timezone)}</span>
                          </div>
                          <ul className="divide-y divide-slate-100">
                            {rItems.map((it) => (
                              <li
                                key={it.id}
                                className={cn(
                                  'flex items-start justify-between gap-2 py-1.5',
                                  it.is_voided && 'text-slate-400 line-through',
                                )}
                              >
                                <div className="min-w-0">
                                  <span className="font-semibold">
                                    {Number(it.quantity)}× {it.product_name}
                                  </span>
                                  {it.source_table_number && (
                                    <span className="ml-1.5 rounded bg-indigo-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-indigo-800 no-underline">
                                      T{it.source_table_number}
                                    </span>
                                  )}
                                  {it.notes && (
                                    <span className="block text-[11px] text-brand-orange no-underline">
                                      ↳ {it.notes}
                                    </span>
                                  )}
                                  {it.is_voided && (
                                    <span className="block text-[11px] text-red-600 no-underline">
                                      Voided: {it.void_reason}
                                    </span>
                                  )}
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
                                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                                    {ORDER_STATUS_LABEL[activeOrder.status]}
                                  </span>
                                  <span className="font-mono font-bold tabular-nums">{money(it.line_total)}</span>
                                  {!it.is_voided && Number(activeOrder.amount_paid) === 0 && (
                                    <button
                                      type="button"
                                      title="Void item"
                                      aria-label={`Void ${it.product_name}`}
                                      onClick={() => {
                                        setVoidItemTarget(it);
                                        setVoidReason('');
                                      }}
                                      className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                                    >
                                      <Ban className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Full Bill Breakdown + Discount Form */}
                  {bundle.data && (
                    <BillDetail
                      bundle={bundle.data}
                      waiterName={activeOrder.waiter_id ? staff.nameOf(activeOrder.waiter_id) : 'QR Self-Order'}
                      onChanged={() => {
                        void bundle.reload();
                        void q.reload();
                      }}
                    />
                  )}

                  {/* Primary Action Buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {activeOrder.payment_status !== 'paid' && (
                      <Button
                        variant="orange"
                        className="col-span-2 h-12 text-base"
                        icon={<CreditCard className="h-5 w-5" />}
                        onClick={() => navigate(`/cashier/payments?order=${activeOrder.id}`)}
                      >
                        Take payment · {money(orderBalance)}
                      </Button>
                    )}
                    {activeOrder.payment_status === 'paid' && (
                      <Button
                        variant="navy"
                        className="col-span-2 h-12"
                        loading={actionBusy}
                        icon={<CheckCheck className="h-5 w-5" />}
                        onClick={() => void closeOrder(activeOrder)}
                      >
                        Close paid order &amp; free table
                      </Button>
                    )}
                    {activeOrder.payment_status !== 'paid' && (
                      <Button
                        variant="secondary"
                        className="h-11"
                        icon={<PlusCircle className="h-4 w-4" />}
                        onClick={() => appendItemsToOrder(activeOrder)}
                      >
                        Add items
                      </Button>
                    )}
                    <Button
                      variant="secondary"
                      className="h-11"
                      icon={<Printer className="h-4 w-4" />}
                      onClick={() => void printDocument(`/cashier-print/bill/${activeOrder.id}`)}
                    >
                      Print pre-bill
                    </Button>
                    {activeOrder.payment_status !== 'paid' && (
                      <>
                        <Button
                          variant="secondary"
                          className="h-11"
                          icon={<GitMerge className="h-4 w-4" />}
                          disabled={!occupiedOtherTables.length}
                          onClick={() => {
                            setMergeTargets([]);
                            setMergeOpen(true);
                          }}
                        >
                          Merge tables
                        </Button>
                        <Button
                          variant="secondary"
                          className="h-11"
                          icon={<Scissors className="h-4 w-4" />}
                          onClick={() => {
                            setSplitMode('equal');
                            setItemSplits({});
                            setSplitOpen(true);
                          }}
                        >
                          Split bill
                        </Button>
                        <Button
                          variant="secondary"
                          className="col-span-2 h-11"
                          icon={<ArrowRightLeft className="h-4 w-4" />}
                          disabled={!freeOtherTables.length}
                          onClick={() => {
                            setTransferTarget(freeOtherTables[0]?.id ?? '');
                            setTransferOpen(true);
                          }}
                        >
                          Transfer to another free table
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* MERGE TABLES MODAL */}
      <Modal
        open={mergeOpen}
        onClose={() => setMergeOpen(false)}
        size="sm"
        title={`Merge into Table ${selectedTable?.table_number ?? ''}`}
        description="All open order lines from the selected tables will be combined into one bill on this table."
        footer={
          <>
            <Button variant="secondary" onClick={() => setMergeOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="orange"
              loading={actionBusy}
              disabled={!mergeTargets.length}
              icon={<GitMerge className="h-4 w-4" />}
              onClick={() => void runMerge()}
            >
              Merge {mergeTargets.length > 0 ? `(${mergeTargets.length})` : ''}
            </Button>
          </>
        }
      >
        {!occupiedOtherTables.length ? (
          <p className="text-sm text-slate-500">No other occupied tables available to merge.</p>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-slate-500">
              Select one or more occupied tables to merge with <b>Table {selectedTable?.table_number}</b>:
            </p>
            <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
              {occupiedOtherTables.map((t) => {
                const checked = mergeTargets.includes(t.id);
                const ord = q.data?.ordersByTable.get(t.id)?.[0];
                return (
                  <li key={t.id}>
                    <label className="flex cursor-pointer items-center justify-between gap-3 px-3.5 py-3 hover:bg-slate-50">
                      <span className="flex items-center gap-2.5 text-sm">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-brand-red"
                          checked={checked}
                          onChange={(e) =>
                            setMergeTargets((prev) =>
                              e.target.checked ? [...prev, t.id] : prev.filter((id) => id !== t.id),
                            )
                          }
                        />
                        <span>
                          <b>Table {t.table_number}</b>
                          {ord ? ` · Order #${ord.order_number}` : ''}
                        </span>
                      </span>
                      <span className="font-mono text-sm font-bold">{money(ord?.total ?? t.balance)}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </Modal>

      {/* TRANSFER TABLE MODAL */}
      <Modal
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        size="sm"
        title={`Transfer Table ${selectedTable?.table_number ?? ''}`}
        description="Move this open order and all its items to a free table."
        footer={
          <>
            <Button variant="secondary" onClick={() => setTransferOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="orange"
              loading={actionBusy}
              disabled={!transferTarget}
              icon={<ArrowRightLeft className="h-4 w-4" />}
              onClick={() => void runTransfer()}
            >
              Transfer table
            </Button>
          </>
        }
      >
        <label className="block">
          <span className="label">Destination free table</span>
          <select
            className="input h-12"
            value={transferTarget}
            onChange={(e) => setTransferTarget(e.target.value)}
          >
            {freeOtherTables.map((t) => (
              <option key={t.id} value={t.id}>
                Table {t.table_number} · {t.section} ({t.capacity} seats)
              </option>
            ))}
          </select>
        </label>
      </Modal>

      {/* VOID ITEM MODAL */}
      <Modal
        open={!!voidItemTarget}
        onClose={() => setVoidItemTarget(null)}
        size="sm"
        title={voidItemTarget ? `Void ${voidItemTarget.product_name}?` : 'Void item'}
        description="Voiding removes this item from the bill and logs an audit entry."
        footer={
          <>
            <Button variant="secondary" onClick={() => setVoidItemTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={actionBusy}
              disabled={voidReason.trim().length < 3}
              onClick={() => void runVoidItem()}
            >
              Confirm void
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {role === 'cashier' && !r.settings.permissions.cashier_can_cancel_orders && (
            <p className="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-900">
              Manager authorisation reason required for cashier item voids.
            </p>
          )}
          <label className="block">
            <span className="label">Reason for voiding (required)</span>
            <input
              className="input h-11"
              placeholder="e.g. Guest changed mind before kitchen prep"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              maxLength={200}
            />
          </label>
        </div>
      </Modal>

      {/* SPLIT BILL MODAL (3 MODES: EQUAL, BY ITEM, BY AMOUNT) */}
      <Modal
        open={splitOpen}
        onClose={() => setSplitOpen(false)}
        size="lg"
        title={activeOrder ? `Split Bill · Order #${activeOrder.order_number}` : 'Split Bill'}
        description="Split equally, move items into a separate guest check, or pay custom amounts per person."
        footer={
          <>
            <Button variant="secondary" onClick={() => setSplitOpen(false)}>
              Close
            </Button>
            {splitMode === 'items' && (
              <Button
                variant="orange"
                loading={actionBusy}
                icon={<Split className="h-4 w-4" />}
                onClick={() => void runSplitByItems()}
              >
                Create separate check
              </Button>
            )}
          </>
        }
      >
        {activeOrder && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
              {(
                [
                  ['equal', '1. Split Equally'],
                  ['items', '2. Split by Item'],
                  ['amount', '3. Split by Amount'],
                ] as const
              ).map(([m, label]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setSplitMode(m)}
                  className={cn(
                    'h-10 rounded-lg text-xs font-bold transition',
                    splitMode === m ? 'bg-white text-brand-navy shadow' : 'text-slate-600',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {splitMode === 'equal' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 p-3">
                  <div>
                    <span className="label">Number of guests (2–20)</span>
                    <input
                      type="number"
                      min={2}
                      max={20}
                      value={equalGuests}
                      onChange={(e) => setEqualGuests(Math.min(20, Math.max(2, Number(e.target.value) || 2)))}
                      className="input h-11 w-28 font-mono text-base font-bold"
                    />
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-500">Outstanding balance</span>
                    <p className="font-mono text-xl font-black text-brand-navy">{money(orderBalance)}</p>
                  </div>
                </div>
                <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                  {equalShares.map((share, idx) => (
                    <li key={idx} className="flex items-center justify-between px-4 py-2.5 text-sm">
                      <span>
                        <b>Guest {idx + 1}</b>
                        {idx === equalShares.length - 1 && equalShares[0] !== share && (
                          <span className="ml-2 text-xs text-slate-500">(includes rounding cent)</span>
                        )}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold">{money(share)}</span>
                        <Button
                          size="sm"
                          variant="orange"
                          onClick={() => {
                            setSplitOpen(false);
                            navigate(`/cashier/payments?order=${activeOrder.id}&amount=${share.toFixed(2)}`);
                          }}
                        >
                          Pay share
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {splitMode === 'items' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <label className="flex-1">
                    <span className="label">New check label</span>
                    <input
                      className="input h-10"
                      value={splitLabel}
                      onChange={(e) => setSplitLabel(e.target.value)}
                      placeholder="e.g. Guest 2"
                    />
                  </label>
                  <div className="text-right text-xs text-slate-500">
                    Choose quantity of each item to move into the new check (supports ½ = 0.5 shared items).
                  </div>
                </div>
                <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
                  {activeItems
                    .filter((i) => !i.is_voided)
                    .map((it) => {
                      const picked = itemSplits[it.id] ?? 0;
                      const max = Number(it.quantity);
                      return (
                        <li key={it.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                          <div className="min-w-0">
                            <p className="font-semibold">
                              {max}× {it.product_name}
                            </p>
                            <p className="font-mono text-xs text-slate-500">{money(it.unit_price)} each</p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                setItemSplits((p) => ({ ...p, [it.id]: Math.max(0, r2((p[it.id] ?? 0) - 0.5)) }))
                              }
                              className="h-8 rounded border border-slate-300 px-2 text-xs font-bold hover:bg-slate-50"
                            >
                              −½
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setItemSplits((p) => ({ ...p, [it.id]: Math.max(0, Math.trunc((p[it.id] ?? 0) - 1)) }))
                              }
                              className="h-8 rounded border border-slate-300 px-2 text-xs font-bold hover:bg-slate-50"
                            >
                              −1
                            </button>
                            <span className="w-12 text-center font-mono text-sm font-black">{picked}</span>
                            <button
                              type="button"
                              onClick={() =>
                                setItemSplits((p) => ({ ...p, [it.id]: Math.min(max, (p[it.id] ?? 0) + 1) }))
                              }
                              className="h-8 rounded border border-slate-300 px-2 text-xs font-bold hover:bg-slate-50"
                            >
                              +1
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setItemSplits((p) => ({ ...p, [it.id]: Math.min(max, r2((p[it.id] ?? 0) + 0.5)) }))
                              }
                              className="h-8 rounded border border-slate-300 px-2 text-xs font-bold hover:bg-slate-50"
                            >
                              +½
                            </button>
                          </div>
                        </li>
                      );
                    })}
                </ul>
              </div>
            )}

            {splitMode === 'amount' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-sm">
                  <span>
                    Outstanding balance: <b className="font-mono">{money(orderBalance)}</b>
                  </span>
                  <span>
                    Remaining unassigned:{' '}
                    <b className="font-mono text-brand-red">
                      {money(
                        r2(
                          Math.max(
                            orderBalance - customAmounts.reduce((s, a) => s + (Number(a) || 0), 0),
                            0,
                          ),
                        ),
                      )}
                    </b>
                  </span>
                </div>
                <div className="space-y-2">
                  {customAmounts.map((amt, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="w-20 text-xs font-bold text-slate-600">Guest {idx + 1}</span>
                      <input
                        className="input h-10 flex-1 font-mono"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={amt}
                        onChange={(e) =>
                          setCustomAmounts((prev) => prev.map((v, i) => (i === idx ? e.target.value : v)))
                        }
                      />
                      <Button
                        size="sm"
                        variant="orange"
                        disabled={!(Number(amt) > 0)}
                        onClick={() => {
                          setSplitOpen(false);
                          navigate(`/cashier/payments?order=${activeOrder.id}&amount=${Number(amt).toFixed(2)}`);
                        }}
                      >
                        Pay {Number(amt) > 0 ? money(Number(amt)) : ''}
                      </Button>
                    </div>
                  ))}
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setCustomAmounts((prev) => [...prev, ''])}
                  >
                    + Add another guest share
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
