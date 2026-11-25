import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, MessageSquarePlus, Minus, Plus, Save, ScanBarcode, Search, Trash2 } from 'lucide-react';
import { useAuth, useRestaurant } from '@sombill/shared-hooks/AuthContext';
import { useQuery } from '@sombill/shared-hooks/useQuery';
import { useRealtime } from '@sombill/shared-hooks/useRealtime';
import { supabase, unwrap, friendlyError } from '@sombill/api-client/supabase';
import { fetchCategories, fetchProducts, fetchTableStatus } from '@sombill/api-client/queries';
import { nullIfEmpty } from '@sombill/shared-types/schemas';
import { formatMoney, ORDER_TYPE_LABEL } from '@sombill/shared-utils/format';
import { cn } from '@sombill/shared-utils/cn';
import type { Order, OrderItem, OrderType } from '@sombill/shared-types/types';
import { Card, EmptyState, ErrorState, PageHeader, Skeleton } from '@sombill/shared-ui/ui/Feedback';
import { Button } from '@sombill/shared-ui/ui/Button';
import { useToast } from '@sombill/shared-ui/ui/Toast';
import { CatChip, CustomerPicker, ProductCard } from '@sombill/shared-ui/pos/PosComponents';
import { useCart } from '@sombill/shared-hooks/cart';
import { computeTotals, lineTotal, MAX_QTY, posErrorMessage } from '@sombill/shared-utils/posRules';
import { cashierErrorMessage, parseMoney, r2 } from '../features/payment';

const TYPES: OrderType[] = ['dine_in', 'takeaway', 'delivery'];

export default function NewSalePage() {
  const r = useRestaurant();
  const { role } = useAuth();
  const cart = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const money = (n: number) => formatMoney(n, r.currency);
  const [catId, setCatId] = useState('');
  const [search, setSearch] = useState('');
  const [openNote, setOpenNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'save' | 'charge' | null>(null);
  const inFlight = useRef(false);

  const menu = useQuery(
    async () => ({ products: await fetchProducts(r.id), categories: await fetchCategories(r.id) }),
    [r.id],
  );
  const tables = useQuery(() => fetchTableStatus(r.id), [r.id]);
  useRealtime(['products', 'categories'], r.id, () => void menu.reload());
  useRealtime(['orders', 'restaurant_tables'], r.id, () => void tables.reload());
  const existing = useQuery(async () => {
    if (!cart.existingOrderId) return null;
    const o = unwrap(
      await supabase.from('orders').select('*').eq('id', cart.existingOrderId).maybeSingle(),
    ) as Order | null;
    const items = o ? (unwrap(await supabase.from('order_items').select('*').eq('order_id', o.id)) as OrderItem[]) : [];
    return o ? { o, items } : null;
  }, [cart.existingOrderId]);

  const cats = (menu.data?.categories ?? []).filter((c) => c.is_active && !c.archived_at);
  const products = useMemo(() => {
    const ids = new Set(cats.map((c) => c.id));
    const t = search.trim().toLowerCase();
    return (menu.data?.products ?? [])
      .filter((p) => !p.archived_at && (!p.category_id || ids.has(p.category_id)))
      .filter((p) => !catId || p.category_id === catId)
      .filter((p) => !t || p.name.toLowerCase().includes(t) || p.sku?.toLowerCase().includes(t));
  }, [menu.data, catId, search]); // eslint-disable-line react-hooks/exhaustive-deps

  const addMode = Boolean(cart.existingOrderId);
  const ex = existing.data?.o ?? null;
  const taxRate = ex ? Number(ex.tax_rate) : Number(r.tax_rate);
  const inclusive = ex ? ex.tax_inclusive : r.tax_inclusive;
  const discount = parseMoney(cart.discount || '0');
  const t = computeTotals(cart.lines, taxRate, inclusive, addMode ? 0 : (discount ?? 0));
  const maxPct = r.settings.permissions.cashier_max_discount_percent;
  const maxDiscount = role === 'manager' ? t.subtotal : r2((t.subtotal * maxPct) / 100);
  const discountError =
    discount === null
      ? 'Invalid amount'
      : discount > t.subtotal
        ? 'Cannot exceed the subtotal'
        : discount > maxDiscount + 0.001
          ? `Your limit is ${maxPct}% (${money(maxDiscount)}). Ask a manager.`
          : discount > 0 && cart.discountReason.trim().length < 3
            ? 'Enter a reason'
            : null;
  const selectedTable = (tables.data ?? []).find((x) => x.id === cart.tableId);
  const available = (tables.data ?? []).filter(
    (x) => x.status === 'available' || r.settings.tables.allow_multiple_orders,
  );
  const unavailable = cart.lines.filter((l) => {
    const p = menu.data?.products.find((x) => x.id === l.product_id);
    return menu.data && (!p || !p.is_available || p.archived_at);
  });

  const submit = async (mode: 'save' | 'charge') => {
    if (inFlight.current) return;
    setError(null);
    if (!cart.lines.length) {
      setError('Add at least one product.');
      return;
    }
    if (unavailable.length) {
      setError(`${unavailable.map((l) => l.name).join(', ')} is no longer available.`);
      return;
    }
    if (!addMode) {
      if (cart.orderType === 'dine_in' && !cart.tableId) {
        setError('Select a table for dine-in.');
        return;
      }
      if (cart.orderType === 'delivery' && !cart.customerId) {
        setError('Select the customer for delivery.');
        return;
      }
      if (discountError) {
        setError(`Discount: ${discountError}`);
        return;
      }
    }
    inFlight.current = true;
    setBusy(mode);
    const items = cart.lines.map((l) => ({
      product_id: l.product_id,
      quantity: l.quantity,
      unit_price: l.unit_price,
      notes: l.notes.trim() || null,
    }));
    const res =
      addMode && cart.existingOrderId
        ? await supabase.rpc('add_order_items', {
            p_order: cart.existingOrderId,
            p_items: items,
            p_idempotency_key: cart.idempotencyKey,
          })
        : await supabase.rpc('submit_pos_order', {
            p_restaurant: r.id,
            p_order_type: cart.orderType,
            p_table: cart.orderType === 'dine_in' ? cart.tableId : null,
            p_items: items,
            p_notes: nullIfEmpty(cart.orderNotes),
            p_customer: cart.customerId,
            p_guest_count: cart.guestCount ? Number(cart.guestCount) : null,
            p_discount: discount ?? 0,
            p_discount_reason: nullIfEmpty(cart.discountReason),
            p_idempotency_key: cart.idempotencyKey,
          });
    inFlight.current = false;
    setBusy(null);
    if (res.error) {
      const e = posErrorMessage(cashierErrorMessage(friendlyError(res.error)));
      setError(e.message);
      if (e.kind === 'price' || e.kind === 'unavailable') {
        const fresh = await fetchProducts(r.id).catch(() => null);
        if (fresh) {
          cart.refreshPrices(fresh);
          void menu.reload();
        }
      }
      if (e.kind === 'occupied') void tables.reload();
      return;
    }
    const d = res.data as { order_id: string; order_number: number; total: number };
    cart.clear();
    toast.success(
      addMode
        ? `Items added to order #${d.order_number}.`
        : `Order #${d.order_number} created (${money(Number(d.total))}).`,
    );
    if (mode === 'charge') navigate(`/cashier/payments?order=${d.order_id}`);
  };

  return (
    <div className="lg:flex lg:h-[calc(100vh-134px)] lg:flex-col">
      <PageHeader
        title={addMode ? `Add items to order #${ex?.order_number ?? ''}` : 'New Sale'}
        description="Prices come from the manager’s menu. Totals, tax and discounts are recalculated by the server."
        actions={
          addMode ? (
            <Button variant="secondary" onClick={() => cart.clear()}>
              Cancel adding
            </Button>
          ) : undefined
        }
      />
      <div className="grid grid-cols-1 gap-4 pb-24 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,58fr)_minmax(340px,42fr)] lg:grid-rows-[minmax(0,1fr)] lg:pb-0">
        <section aria-label="Menu" className="min-w-0 space-y-3 lg:flex lg:min-h-0 lg:flex-col lg:space-y-0 lg:gap-3">
          <div className="pos-search relative lg:shrink-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <ScanBarcode
              className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <input
              type="search"
              className="input h-12 pl-9 pr-11 text-base"
              placeholder="Search products or SKU"
              aria-label="Search products"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              maxLength={60}
            />
          </div>
          <div className="flex flex-wrap gap-2 lg:shrink-0" role="tablist" aria-label="Categories">
            <CatChip active={!catId} onClick={() => setCatId('')}>
              All
            </CatChip>
            {cats.map((c) => (
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
              <Skeleton className="h-64 w-full" />
            ) : !products.length ? (
              <div className="card">
                <EmptyState title="No products found" />
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
                    disabled={false}
                    onAdd={() => cart.addProduct(p)}
                    qty={cart.lines.filter((l) => l.product_id === p.id).reduce((s, l) => s + l.quantity, 0)}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        <aside id="sale-panel" aria-label="Current sale" className="scroll-mt-20 lg:min-h-0">
          <Card className="pos-ticket flex h-full flex-col" bodyClassName="flex min-h-0 flex-1 flex-col p-0">
            <div className="space-y-3 border-b border-slate-100 p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-bold text-brand-navy">
                  {addMode ? `Order #${ex?.order_number ?? '…'}` : 'Current order'}
                </h2>
                {!addMode && cart.orderType === 'dine_in' && selectedTable && (
                  <span data-sb="table-pill">Table {selectedTable.table_number}</span>
                )}
              </div>
              {!addMode && (
                <>
                  <div
                    className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1"
                    data-sb="dining-tabs"
                    role="radiogroup"
                    aria-label="Order type"
                  >
                    {TYPES.map((ty) => (
                      <button
                        key={ty}
                        type="button"
                        role="radio"
                        data-sb="dining-tab"
                        aria-checked={cart.orderType === ty}
                        onClick={() => cart.setOrderType(ty)}
                        className={cn(
                          'h-11 rounded-lg text-sm font-semibold',
                          cart.orderType === ty ? 'bg-white text-brand-navy shadow' : 'text-slate-600',
                        )}
                      >
                        {ORDER_TYPE_LABEL[ty]}
                      </button>
                    ))}
                  </div>
                  {cart.orderType === 'dine_in' && (
                    <div className="grid grid-cols-[1fr_80px] gap-2">
                      <select
                        className="input h-12"
                        aria-label="Table"
                        value={cart.tableId ?? ''}
                        onChange={(e) => cart.setTable(e.target.value || null)}
                      >
                        <option value="">Select table…</option>
                        {available.map((x) => (
                          <option key={x.id} value={x.id}>
                            Table {x.table_number}
                            {x.name ? ` · ${x.name}` : ''}
                          </option>
                        ))}
                      </select>
                      <input
                        className="input h-12"
                        inputMode="numeric"
                        aria-label="Guests"
                        placeholder="Guests"
                        value={cart.guestCount}
                        onChange={(e) => cart.setGuestCount(e.target.value)}
                      />
                    </div>
                  )}
                  <CustomerPicker
                    value={cart.customerId}
                    onChange={cart.setCustomer}
                    canCreate={role === 'manager' || r.settings.permissions.cashier_can_create_customers}
                    label={cart.orderType === 'delivery' ? 'Customer (required for delivery)' : 'Customer (optional)'}
                  />
                </>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {!cart.lines.length ? (
                <p className="py-10 text-center text-sm text-slate-400">Tap products to add them.</p>
              ) : (
                <ul className="space-y-3" aria-label="Sale items">
                  {cart.lines.map((l) => (
                    <li
                      key={l.key}
                      data-sb="ticket-row"
                      className={cn(
                        'rounded-xl border p-3',
                        unavailable.includes(l) ? 'border-red-200 bg-red-50' : 'border-slate-200',
                      )}
                    >
                      <div className="flex justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{l.name}</p>
                          <p className="text-xs text-slate-500">{money(l.unit_price)} each</p>
                        </div>
                        <p className="shrink-0 font-semibold tabular-nums">
                          {money(lineTotal(l.quantity, l.unit_price))}
                        </p>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          type="button"
                          className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-300 disabled:opacity-40"
                          data-sb="stepper"
                          aria-label={`Decrease ${l.name}`}
                          disabled={l.quantity <= 1}
                          onClick={() => cart.inc(l.key, -1)}
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <input
                          className="input h-11 w-16 text-center tabular-nums"
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
                          className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-300 disabled:opacity-40"
                          data-sb="stepper"
                          aria-label={`Increase ${l.name}`}
                          disabled={l.quantity >= MAX_QTY}
                          onClick={() => cart.inc(l.key, 1)}
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
                          className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
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
                          aria-label={`Item note for ${l.name}`}
                          placeholder="Item note"
                          value={l.notes}
                          maxLength={300}
                          onChange={(e) => cart.setLineNotes(l.key, e.target.value)}
                        />
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {!addMode && (
                <div className="mt-4 space-y-3">
                  <label className="block">
                    <span className="label">Order notes</span>
                    <textarea
                      className="input"
                      rows={2}
                      maxLength={500}
                      aria-label="Order notes"
                      value={cart.orderNotes}
                      onChange={(e) => cart.setOrderNotes(e.target.value)}
                    />
                  </label>
                  <div className="grid grid-cols-[110px_1fr] gap-2">
                    <label>
                      <span className="label">Discount</span>
                      <input
                        className="input h-11 tabular-nums"
                        inputMode="decimal"
                        aria-label="Discount amount"
                        placeholder="0.00"
                        value={cart.discount}
                        onChange={(e) => cart.setDiscount(e.target.value)}
                      />
                    </label>
                    <label>
                      <span className="label">Reason</span>
                      <input
                        className="input h-11"
                        aria-label="Discount reason"
                        maxLength={200}
                        value={cart.discountReason}
                        onChange={(e) => cart.setDiscount(cart.discount, e.target.value)}
                        placeholder={role === 'manager' ? 'Required' : `Up to ${maxPct}%`}
                      />
                    </label>
                  </div>
                  {cart.discount.trim().length > 0 && discountError && (
                    <p role="alert" className="text-xs text-red-700">
                      {discountError}
                    </p>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-2 border-t border-slate-100 bg-slate-50/60 p-4" data-sb="totals">
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Subtotal</dt>
                  <dd className="tabular-nums" data-testid="sale-subtotal">
                    {money(t.subtotal)}
                  </dd>
                </div>
                {!addMode && (discount ?? 0) > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Discount</dt>
                    <dd className="tabular-nums" data-testid="sale-discount">
                      −{money(discount ?? 0)}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-slate-500">
                    {r.tax_label} {(taxRate * 100).toFixed(0)}%{inclusive ? ' (incl.)' : ''}
                  </dt>
                  <dd className="tabular-nums" data-testid="sale-tax">
                    {money(t.tax)}
                  </dd>
                </div>
                <div className="flex justify-between text-base font-bold text-brand-navy" data-sb="grand-total">
                  <dt>{addMode ? 'New items total' : 'Grand total'}</dt>
                  <dd className="tabular-nums" data-testid="sale-total">
                    {money(t.total)}
                  </dd>
                </div>
              </dl>
              {error && (
                <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="secondary"
                  className="h-14"
                  icon={<Save className="h-5 w-5" />}
                  loading={busy === 'save'}
                  disabled={!!busy || !cart.lines.length}
                  onClick={() => void submit('save')}
                >
                  {addMode ? 'Add to order' : 'Save order'}
                </Button>
                <Button
                  variant="orange"
                  data-sb="charge"
                  className="h-14 text-base"
                  icon={<CreditCard className="h-5 w-5" />}
                  loading={busy === 'charge'}
                  disabled={!!busy || !cart.lines.length}
                  onClick={() => void submit('charge')}
                >
                  {addMode ? 'Add & charge' : 'Charge'}
                </Button>
              </div>
            </div>
          </Card>
        </aside>
      </div>
      {cart.lines.length > 0 && (
        <div
          data-sb="mobile-bar"
          className="no-print fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 p-3 backdrop-blur lg:hidden"
        >
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-slate-500">
                {cart.itemCount} items · {ORDER_TYPE_LABEL[cart.orderType]}
              </p>
              <p className="text-lg font-bold tabular-nums text-brand-navy">{money(t.total)}</p>
            </div>
            <Button
              variant="orange"
              className="h-12 px-5"
              onClick={() => document.getElementById('sale-panel')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Review &amp; charge
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
