import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, MessageSquarePlus, Minus, Plus, Printer, Search, Send, Trash2 } from 'lucide-react';
import { CatChip, CustomerPicker, ProductCard } from '@sombill/shared-ui/pos/PosComponents';
import { KitchenTicketModal, type KitchenTicketData, type KitchenTicketItem } from '../components/KitchenTicket';
import { useAuth, useRestaurant } from '@sombill/shared-hooks/AuthContext';
import { useQuery } from '@sombill/shared-hooks/useQuery';
import { useRealtime } from '@sombill/shared-hooks/useRealtime';
import { supabase, unwrap, friendlyError } from '@sombill/api-client/supabase';
import { fetchCategories, fetchProducts, fetchTableStatus } from '@sombill/api-client/queries';
import { nullIfEmpty } from '@sombill/shared-types/schemas';
import { formatMoney } from '@sombill/shared-utils/format';
import { cn } from '@sombill/shared-utils/cn';
import type { Order, OrderItem } from '@sombill/shared-types/types';
import { Card, EmptyState, ErrorState, PageHeader, Skeleton } from '@sombill/shared-ui/ui/Feedback';
import { Button } from '@sombill/shared-ui/ui/Button';
import { Modal } from '@sombill/shared-ui/ui/Modal';
import { useToast } from '@sombill/shared-ui/ui/Toast';
import { useCart } from '@sombill/shared-hooks/cart';
import { canAddItems, computeTotals, lineTotal, MAX_QTY, posErrorMessage } from '@sombill/shared-utils/posRules';

interface Confirmation {
  orderId: string;
  orderNumber: number;
  total: number;
  added: boolean;
  tableNo: number | null;
  items: KitchenTicketItem[];
  orderNotes: string | null;
}

export default function NewOrderPage() {
  const r = useRestaurant();
  const { session, role, profile } = useAuth();
  const uid = session?.user.id;
  const cart = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const money = (n: number) => formatMoney(n, r.currency);
  const [catId, setCatId] = useState<string>('');
  const [catSearch, setCatSearch] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [openNote, setOpenNote] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [ticketPreview, setTicketPreview] = useState<KitchenTicketData | null>(null);

  const menu = useQuery(async () => {
    const [products, categories] = await Promise.all([fetchProducts(r.id), fetchCategories(r.id)]);
    return { products, categories };
  }, [r.id]);
  const tables = useQuery(() => fetchTableStatus(r.id), [r.id]);
  useRealtime(['products', 'categories'], r.id, () => void menu.reload());
  useRealtime(['orders', 'restaurant_tables'], r.id, () => void tables.reload());

  const existing = useQuery(async () => {
    if (!cart.existingOrderId) return null;
    const o = unwrap(
      await supabase.from('orders').select('*').eq('id', cart.existingOrderId).maybeSingle(),
    ) as Order | null;
    if (!o) return null;
    const items = unwrap(
      await supabase.from('order_items').select('*').eq('order_id', o.id).order('created_at'),
    ) as OrderItem[];
    return { order: o, items };
  }, [cart.existingOrderId]);

  const visibleCats = useMemo(
    () => (menu.data?.categories ?? []).filter((c) => c.is_active && !c.archived_at),
    [menu.data],
  );
  const activeCatIds = new Set(visibleCats.map((c) => c.id));
  const products = useMemo(() => {
    const t = search.trim().toLowerCase();
    return (menu.data?.products ?? [])
      .filter((p) => !p.archived_at && (!p.category_id || activeCatIds.has(p.category_id)))
      .filter((p) => !catId || p.category_id === catId)
      .filter(
        (p) =>
          !t ||
          p.name.toLowerCase().includes(t) ||
          p.sku?.toLowerCase().includes(t) ||
          p.description?.toLowerCase().includes(t),
      );
  }, [menu.data, catId, search]); // eslint-disable-line react-hooks/exhaustive-deps

  const order = existing.data?.order ?? null;
  const addMode = Boolean(cart.existingOrderId);
  const addAllowed = order ? canAddItems(order, uid, role, r.settings) : true;
  const taxRate = order ? Number(order.tax_rate) : Number(r.tax_rate);
  const inclusive = order ? order.tax_inclusive : r.tax_inclusive;
  const oldLines = (existing.data?.items ?? [])
    .filter((i) => !i.is_voided)
    .map((i) => ({ quantity: Number(i.quantity), unit_price: Number(i.unit_price), tax_exempt: i.tax_exempt }));
  const newTotals = computeTotals(cart.lines, taxRate, inclusive);
  const combined = computeTotals(
    [...oldLines, ...cart.lines],
    taxRate,
    inclusive,
    order ? Number(order.discount_amount) : 0,
  );
  const allTables = tables.data ?? [];
  const availableTables = allTables.filter(
    (t) => t.status === 'available' || r.settings.tables.allow_multiple_orders,
  );
  const occupiedTables = allTables.filter(
    (t) => t.status !== 'available' && !r.settings.tables.allow_multiple_orders,
  );
  const selectedTable = allTables.find((t) => t.id === cart.tableId) ?? null;
  const tableTaken =
    !addMode && selectedTable && selectedTable.status !== 'available' && !r.settings.tables.allow_multiple_orders;

  // If the chosen table was taken by someone else in the meantime, tell the waiter.
  useEffect(() => {
    if (tableTaken)
      setError(
        `Table ${selectedTable!.table_number} was just occupied. Choose another table or open its order from Tables.`,
      );
  }, [tableTaken]); // eslint-disable-line react-hooks/exhaustive-deps

  const productById = (id: string) => menu.data?.products.find((p) => p.id === id);
  const unavailableInCart = cart.lines.filter((l) => {
    const p = productById(l.product_id);
    return menu.data && (!p || p.archived_at || !p.is_available);
  });

  const send = async () => {
    if (inFlight.current) return; // duplicate-click guard (server is idempotent too)
    setError(null);
    if (!addMode && !cart.tableId) {
      setError('Select a table first.');
      return;
    }
    if (tableTaken) return;
    if (!cart.lines.length) {
      setError('Add at least one product.');
      return;
    }
    if (unavailableInCart.length) {
      setError(`${unavailableInCart.map((l) => l.name).join(', ')} is no longer available. Remove it to continue.`);
      return;
    }
    const guests = cart.guestCount ? Number(cart.guestCount) : null;
    if (guests !== null && (guests < 1 || guests > 50)) {
      setError('Guests must be between 1 and 50.');
      return;
    }
    inFlight.current = true;
    setBusy(true);
    const items = cart.lines.map((l) => ({
      product_id: l.product_id,
      quantity: l.quantity,
      unit_price: l.unit_price,
      notes: l.notes.trim() || null,
    }));
    const existingOrderId = cart.existingOrderId;
    const tableId = cart.tableId;
    if (!addMode && !tableId) {
      inFlight.current = false;
      setBusy(false);
      setError('Select a table.');
      return;
    }
    const res =
      addMode && existingOrderId
        ? await supabase.rpc('add_order_items', {
            p_order: existingOrderId,
            p_items: items,
            p_idempotency_key: cart.idempotencyKey,
          })
        : await supabase.rpc('submit_waiter_order', {
            p_restaurant: r.id,
            p_table: tableId as string,
            p_items: items,
            p_notes: nullIfEmpty(cart.orderNotes),
            p_customer: cart.customerId,
            p_guest_count: guests,
            p_idempotency_key: cart.idempotencyKey,
          });
    inFlight.current = false;
    setBusy(false);
    if (res.error) {
      const e = posErrorMessage(friendlyError(res.error));
      setError(e.message);
      if (e.kind === 'price' || e.kind === 'unavailable') {
        const fresh = await fetchProducts(r.id).catch(() => null);
        if (fresh) {
          cart.refreshPrices(fresh);
          await menu.reload();
        }
      }
      if (e.kind === 'occupied') await tables.reload();
      return;
    }
    const data = res.data as { order_id: string; order_number: number; total: number };
    const sentItems: KitchenTicketItem[] = cart.lines.map((l) => ({
      name: l.name,
      quantity: l.quantity,
      notes: l.notes.trim() || null,
    }));
    const sentOrderNotes = cart.orderNotes.trim() || null;
    setConfirmation({
      orderId: data.order_id,
      orderNumber: data.order_number,
      total: Number(data.total),
      added: addMode,
      tableNo: selectedTable?.table_number ?? null,
      items: sentItems,
      orderNotes: sentOrderNotes,
    });
    toast.success(
      addMode ? `Items added to order #${data.order_number}.` : `Order #${data.order_number} sent to the kitchen.`,
    );
    cart.clear();
  };

  const openDraftTicket = () => {
    if (!cart.lines.length) return;
    setTicketPreview({
      restaurantName: r.name,
      orderNumber: addMode ? (order?.order_number ?? null) : null,
      tableLabel: selectedTable ? `Table ${selectedTable.table_number}` : null,
      waiterName: profile?.full_name ?? null,
      orderNotes: cart.orderNotes.trim() || null,
      timezone: r.timezone,
      printedAt: new Date(),
      items: cart.lines.map((l) => ({ name: l.name, quantity: l.quantity, notes: l.notes.trim() || null })),
    });
  };

  return (
    <div className="flex flex-col">
      <PageHeader
        title={addMode ? `Add items to order #${order?.order_number ?? ''}` : 'New Order'}
        description={
          addMode
            ? 'New items are sent to the kitchen as an addition to the open order.'
            : 'Prices come from the manager’s menu and are confirmed by the server when you send.'
        }
        actions={
          addMode ? (
            <Button variant="secondary" onClick={() => cart.clear()}>
              Cancel adding
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 items-start gap-4 pb-24 lg:grid-cols-[minmax(0,56fr)_minmax(360px,44fr)] lg:pb-6">
        {/* LEFT: catalogue */}
        <section aria-label="Menu" className="min-w-0 space-y-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.7fr)]">
            <div className="pos-search relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                className="input h-12 pl-9 text-base"
                placeholder="Search products"
                aria-label="Search products"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                maxLength={60}
              />
            </div>
            <input
              type="search"
              className="input h-12 text-base"
              placeholder="Find category"
              aria-label="Search categories"
              value={catSearch}
              onChange={(e) => setCatSearch(e.target.value)}
              maxLength={40}
            />
          </div>
          <div className="flex flex-wrap gap-2 lg:shrink-0" role="tablist" aria-label="Categories">
            <CatChip active={!catId} onClick={() => setCatId('')}>
              All
            </CatChip>
            {visibleCats
              .filter((c) => !catSearch || c.name.toLowerCase().includes(catSearch.toLowerCase()))
              .map((c) => (
                <CatChip key={c.id} active={catId === c.id} onClick={() => setCatId(c.id)}>
                  {c.name}
                </CatChip>
              ))}
          </div>
          <div className="space-y-3 lg:-mx-1 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:px-1 lg:py-1">
            {menu.error ? (
              <div className="card">
                <ErrorState message={menu.error} onRetry={menu.reload} />
              </div>
            ) : menu.loading && !menu.data ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-24" />
                ))}
              </div>
            ) : !products.length ? (
              <div className="card">
                <EmptyState
                  title="No products found"
                  message={search ? 'Try another search.' : 'The manager has not added products to this category yet.'}
                />
              </div>
            ) : (
              <div
                className="grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-3"
                role="list"
                aria-label="Products"
              >
                {products.map((p) => (
                  <ProductCard
                    key={p.id}
                    p={p}
                    money={money}
                    disabled={!addAllowed}
                    onAdd={() => cart.addProduct(p)}
                    qty={cart.lines.filter((l) => l.product_id === p.id).reduce((s, l) => s + l.quantity, 0)}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* RIGHT: order summary */}
        <aside id="order-panel" aria-label="Current order" className="scroll-mt-20 lg:sticky lg:top-4">
          <Card className="pos-ticket flex flex-col" bodyClassName="flex flex-col p-0">
            <div className="space-y-3 border-b border-slate-100 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-brand-navy">
                    {addMode ? `Order #${order?.order_number ?? '…'}` : 'New order'}
                  </h2>
                  {cart.itemCount > 0 && (
                    <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-brand-orange/15 px-2 text-xs font-bold text-brand-orange">
                      {cart.itemCount} item{cart.itemCount === 1 ? '' : 's'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {addMode && order && (
                    <span className="text-xs text-slate-500">Current total {money(order.total)}</span>
                  )}
                  {cart.lines.length > 0 && (
                    <button
                      type="button"
                      onClick={() => cart.clear(true)}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Clear
                    </button>
                  )}
                </div>
              </div>
              {addMode ? (
                <p className="text-sm text-slate-600">
                  Table {(tables.data ?? []).find((t) => t.id === order?.table_id)?.table_number ?? '—'}
                </p>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-[1fr_80px] gap-2">
                    <label className="min-w-0">
                      <span className="label">Table</span>
                      <select
                        className="input h-11 text-base font-semibold"
                        aria-label="Table"
                        value={cart.tableId ?? ''}
                        onChange={(e) => {
                          cart.setTable(e.target.value || null);
                          setError(null);
                        }}
                      >
                        <option value="">Select table…</option>
                        {availableTables.map((t) => (
                          <option key={t.id} value={t.id}>
                            Table {t.table_number}
                            {t.name ? ` · ${t.name}` : ''} ({t.capacity} seats)
                          </option>
                        ))}
                        {occupiedTables.map((t) => (
                          <option key={t.id} value={t.id}>
                            Table {t.table_number}
                            {t.name ? ` · ${t.name}` : ''} (occupied)
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span className="label">Guests</span>
                      <input
                        className="input h-11 text-base"
                        inputMode="numeric"
                        aria-label="Guests"
                        value={cart.guestCount}
                        onChange={(e) => cart.setGuestCount(e.target.value)}
                        placeholder="—"
                      />
                    </label>
                  </div>
                  {availableTables.length > 0 && (
                    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quick select table">
                      {availableTables.map((tb) => {
                        const active = cart.tableId === tb.id;
                        return (
                          <button
                            key={tb.id}
                            type="button"
                            onClick={() => {
                              cart.setTable(tb.id);
                              setError(null);
                            }}
                            className={cn(
                              'inline-flex h-8 min-w-[38px] items-center justify-center rounded-lg border px-2 font-mono text-xs font-extrabold transition',
                              active
                                ? 'border-brand-orange bg-brand-orange text-white shadow-sm ring-2 ring-brand-orange/30'
                                : 'border-emerald-300 bg-emerald-50/70 text-emerald-900 hover:border-emerald-500',
                            )}
                          >
                            T{tb.table_number}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
              {!addMode && (
                <CustomerPicker
                  value={cart.customerId}
                  onChange={cart.setCustomer}
                  canCreate={r.settings.permissions.waiter_can_create_customers}
                />
              )}
            </div>

            <div className="max-h-[260px] overflow-y-auto p-3.5">
              {addMode && !addAllowed && order && (
                <p className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                  Items can’t be added:{' '}
                  {order.bill_requested_at
                    ? 'the bill has been requested (cancel the request in Bills first).'
                    : order.amount_paid > 0
                      ? 'payment has started.'
                      : order.status === 'completed' || order.status === 'cancelled'
                        ? `the order is ${order.status}.`
                        : 'this order belongs to another waiter.'}
                </p>
              )}
              {addMode && (existing.data?.items.length ?? 0) > 0 && (
                <div className="mb-3">
                  <p className="label">Already sent</p>
                  <ul className="space-y-1 text-sm text-slate-500">
                    {existing.data!.items.map((i) => (
                      <li key={i.id} className={cn('flex justify-between gap-2', i.is_voided && 'line-through')}>
                        <span className="truncate">
                          {Number(i.quantity)} × {i.product_name}
                        </span>
                        <span className="tabular-nums">{money(i.line_total)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {!cart.lines.length ? (
                <p className="py-10 text-center text-sm text-slate-400">Tap products to add them to the order.</p>
              ) : (
                <ul className="space-y-3" aria-label="Order items">
                  {cart.lines.map((l) => {
                    const gone = unavailableInCart.includes(l);
                    return (
                      <li
                        key={l.key}
                        data-sb="ticket-row"
                        className={cn('rounded-xl border p-3', gone ? 'border-red-200 bg-red-50' : 'border-slate-200')}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate font-semibold">{l.name}</p>
                            <p className="text-xs text-slate-500">
                              {money(l.unit_price)} each
                              {gone && <span className="ml-1 font-semibold text-red-700">· no longer available</span>}
                            </p>
                          </div>
                          <p className="shrink-0 font-semibold tabular-nums">
                            {money(lineTotal(l.quantity, l.unit_price))}
                          </p>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            type="button"
                            className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-40"
                            data-sb="stepper"
                            aria-label={`Decrease ${l.name}`}
                            onClick={() => cart.inc(l.key, -1)}
                            disabled={l.quantity <= 1}
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <input
                            className="input h-11 w-16 text-center text-base tabular-nums"
                            inputMode="numeric"
                            aria-label={`Quantity of ${l.name}`}
                            value={l.quantity}
                            onChange={(e) => {
                              const n = Number(e.target.value.replace(/\D/g, ''));
                              if (n) cart.setQty(l.key, n);
                            }}
                          />
                          <button
                            type="button"
                            className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-40"
                            data-sb="stepper"
                            aria-label={`Increase ${l.name}`}
                            onClick={() => cart.inc(l.key, 1)}
                            disabled={l.quantity >= MAX_QTY}
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className={cn(
                              'ml-auto flex h-11 w-11 items-center justify-center rounded-lg hover:bg-slate-100',
                              l.notes ? 'text-brand-orange' : 'text-slate-500',
                            )}
                            aria-label={`Note for ${l.name}`}
                            onClick={() => setOpenNote(openNote === l.key ? null : l.key)}
                          >
                            <MessageSquarePlus className="h-5 w-5" />
                          </button>
                          <button
                            type="button"
                            className="flex h-11 w-11 items-center justify-center rounded-lg border border-red-200 bg-red-50/70 text-red-600 hover:bg-red-100"
                            data-sb="row-remove"
                            aria-label={`Remove ${l.name}`}
                            onClick={() => cart.remove(l.key)}
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </div>
                        {(openNote === l.key || l.notes) && (
                          <input
                            className="input mt-2 h-11"
                            placeholder="Item note, e.g. no onions"
                            aria-label={`Item note for ${l.name}`}
                            value={l.notes}
                            maxLength={300}
                            onChange={(e) => cart.setLineNotes(l.key, e.target.value)}
                          />
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              {!addMode && (
                <label className="mt-3 block">
                  <span className="label">Special instructions</span>
                  <textarea
                    className="input text-xs"
                    rows={1}
                    maxLength={500}
                    placeholder="Allergies, timing, seating…"
                    aria-label="Special instructions"
                    value={cart.orderNotes}
                    onChange={(e) => cart.setOrderNotes(e.target.value)}
                  />
                </label>
              )}
            </div>

            <div className="space-y-2 border-t border-slate-100 bg-slate-50/60 p-3.5" data-sb="totals">
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">{addMode ? 'New items subtotal' : 'Subtotal'}</dt>
                  <dd className="tabular-nums" data-testid="subtotal">
                    {money(newTotals.subtotal)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">
                    {r.tax_label} {(taxRate * 100).toFixed((taxRate * 100) % 1 ? 2 : 0)}%
                    {inclusive ? ' (included)' : ''}
                  </dt>
                  <dd className="tabular-nums" data-testid="tax">
                    {money(newTotals.tax)}
                  </dd>
                </div>
                <div className="flex justify-between text-base font-bold text-brand-navy" data-sb="grand-total">
                  <dt>{addMode ? 'Order total after adding' : 'Total'}</dt>
                  <dd className="tabular-nums" data-testid="total">
                    {money(addMode ? combined.total : newTotals.total)}
                  </dd>
                </div>
              </dl>
              {error && (
                <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </p>
              )}
              <div className="flex flex-col gap-2">
                <Button
                  variant="orange"
                  data-sb="charge"
                  className="h-14 w-full text-base"
                  loading={busy}
                  disabled={
                    busy || !cart.lines.length || (!addMode && !cart.tableId) || !addAllowed || Boolean(tableTaken)
                  }
                  icon={<Send className="h-5 w-5" />}
                  onClick={() => void send()}
                >
                  {addMode ? 'Add to order' : 'Send order'}
                </Button>
                {cart.lines.length > 0 && (
                  <Button
                    variant="secondary"
                    className="h-11 w-full"
                    icon={<Printer className="h-4 w-4" />}
                    onClick={openDraftTicket}
                  >
                    Print food items receipt
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </aside>
      </div>

      {/* Portrait tablets / phones: keep the order one tap away while browsing the menu. */}
      {cart.lines.length > 0 && (
        <div
          data-sb="mobile-bar"
          className="no-print fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 p-3 shadow-[0_-4px_12px_rgba(23,45,69,0.08)] backdrop-blur lg:hidden"
        >
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-slate-500">
                {cart.itemCount} item{cart.itemCount === 1 ? '' : 's'}
                {selectedTable ? ` · Table ${selectedTable.table_number}` : addMode ? '' : ' · no table selected'}
              </p>
              <p className="text-lg font-bold tabular-nums text-brand-navy">
                {money(addMode ? combined.total : newTotals.total)}
              </p>
            </div>
            <Button
              variant="orange"
              className="h-12 px-5 text-base"
              onClick={() =>
                document.getElementById('order-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
            >
              Review &amp; send
            </Button>
          </div>
        </div>
      )}

      <Modal
        open={!!confirmation}
        onClose={() => setConfirmation(null)}
        size="sm"
        title={confirmation?.added ? 'Items added' : 'Order sent'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmation(null)}>
              New order
            </Button>
            <Button
              variant="secondary"
              icon={<Printer className="h-4 w-4" />}
              onClick={() => {
                if (!confirmation) return;
                setTicketPreview({
                  restaurantName: r.name,
                  orderNumber: confirmation.orderNumber,
                  tableLabel: confirmation.tableNo ? `Table ${confirmation.tableNo}` : null,
                  waiterName: profile?.full_name ?? null,
                  orderNotes: confirmation.orderNotes,
                  timezone: r.timezone,
                  printedAt: new Date(),
                  items: confirmation.items,
                });
              }}
            >
              Print items receipt
            </Button>
            <Button
              onClick={() => {
                const id = confirmation!.orderId;
                setConfirmation(null);
                navigate(`/waiter/orders/${id}`);
              }}
            >
              View order
            </Button>
          </>
        }
      >
        {confirmation && (
          <div className="text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
            <p className="mt-3 text-lg font-bold text-brand-navy">
              Order #{confirmation.orderNumber}
              {confirmation.tableNo ? ` · Table ${confirmation.tableNo}` : ''}
            </p>
            <p className="text-sm text-slate-600">
              {confirmation.added ? 'The new items were sent to the kitchen.' : 'Sent to the kitchen and cashier.'}
            </p>
            <p className="mt-2 text-xl font-bold tabular-nums">{money(confirmation.total)}</p>
          </div>
        )}
      </Modal>
      <KitchenTicketModal data={ticketPreview} onClose={() => setTicketPreview(null)} />
    </div>
  );
}
