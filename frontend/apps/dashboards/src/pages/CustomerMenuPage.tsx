import { useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  BellRing,
  CheckCircle2,
  ChefHat,
  Clock,
  Minus,
  Moon,
  Plus,
  Receipt,
  Search,
  ShoppingBag,
  Sparkles,
  Sun,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { useQuery } from '@sombill/shared-hooks/useQuery';
import { friendlyError, supabase } from '@sombill/api-client/supabase';
import { formatMoney } from '@sombill/shared-utils/format';
import { cn } from '@sombill/shared-utils/cn';
import type { Category, Product, RestaurantTable } from '@sombill/shared-types/types';
import { Button } from '@sombill/shared-ui/ui/Button';
import { useToast } from '@sombill/shared-ui/ui/Toast';

interface CartEntry {
  product: Product;
  quantity: number;
}

/**
 * Public Customer View Menu Dashboard (`/table-menu/:tableId` & `/table-menu`).
 * Opened when a guest scans any table's QR code — mobile-first, desktop-responsive,
 * supports live category filtering, dish search, cart & kitchen ordering, waiter call, and bill request.
 */
export default function CustomerMenuPage() {
  const { tableId } = useParams();
  const [params] = useSearchParams();
  const toast = useToast();

  const [dark, setDark] = useState(false);
  const [search, setSearch] = useState('');
  const [catId, setCatId] = useState<string>('');
  const [cart, setCart] = useState<Record<string, CartEntry>>({});
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [callingWaiter, setCallingWaiter] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<{
    id: string;
    orderNumber: number;
    total: number;
    itemCount: number;
    placedAt: string;
  } | null>(null);

  const q = useQuery(async () => {
    const tablesRes = await supabase.from('restaurant_tables').select('*').is('archived_at', null);
    const tables = (tablesRes.data ?? []) as RestaurantTable[];
    const matchedTable =
      tables.find((t) => t.id === tableId) ??
      tables.find((t) => String(t.table_number) === params.get('table')) ??
      null;

    let catsQuery = supabase
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .is('archived_at', null)
      .order('display_order');
    let prodsQuery = supabase.from('products').select('*').is('archived_at', null).order('name');

    if (matchedTable?.restaurant_id) {
      catsQuery = catsQuery.eq('restaurant_id', matchedTable.restaurant_id);
      prodsQuery = prodsQuery.eq('restaurant_id', matchedTable.restaurant_id);
    }

    const [catsRes, prodsRes] = await Promise.all([catsQuery, prodsQuery]);
    const categories = (catsRes.data ?? []) as Category[];
    const products = (prodsRes.data ?? []) as Product[];
    return { matchedTable, categories, products };
  }, [tableId]);

  const tableNumber = q.data?.matchedTable?.table_number ?? (params.get('table') || '1');
  const tableName = q.data?.matchedTable?.name ?? params.get('name') ?? '';
  const tableSection = q.data?.matchedTable?.section ?? params.get('section') ?? 'Dining Floor';
  const venueName = params.get('venue') || 'SomBill Grand Restaurant & Cafe';
  const currency = 'USD';
  const taxRate = 0.05;

  const categories = q.data?.categories ?? [];
  const allProducts = useMemo(() => q.data?.products ?? [], [q.data?.products]);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return allProducts.filter((p) => {
      if (catId && p.category_id !== catId) return false;
      if (!term) return true;
      return p.name.toLowerCase().includes(term) || (p.description ?? '').toLowerCase().includes(term);
    });
  }, [allProducts, catId, search]);

  const cartItems = Object.values(cart);
  const cartCount = cartItems.reduce((sum, c) => sum + c.quantity, 0);
  const subtotal = cartItems.reduce((sum, c) => sum + Number(c.product.price) * c.quantity, 0);
  const tax = subtotal * taxRate;
  const total = subtotal + tax;

  const addOne = (product: Product) => {
    setCart((prev) => ({
      ...prev,
      [product.id]: { product, quantity: (prev[product.id]?.quantity ?? 0) + 1 },
    }));
  };

  const removeOne = (productId: string) => {
    setCart((prev) => {
      const existing = prev[productId];
      if (!existing) return prev;
      if (existing.quantity <= 1) {
        const next = { ...prev };
        delete next[productId];
        return next;
      }
      return { ...prev, [productId]: { ...existing, quantity: existing.quantity - 1 } };
    });
  };

  const resolvedTableId = q.data?.matchedTable?.id ?? tableId ?? null;

  const callWaiter = async (reason?: string) => {
    if (callingWaiter) return;
    setCallingWaiter(true);
    try {
      if (resolvedTableId) {
        const { error } = await supabase.rpc('call_table_waiter', {
          p_table_id: resolvedTableId,
          p_reason: reason ?? null,
        });
        if (error) throw error;
      }
      toast.success(
        reason
          ? `Bill request sent to waiter for Table #${tableNumber}.`
          : `Waiter notified for Table #${tableNumber}! Someone is on the way.`,
      );
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setCallingWaiter(false);
    }
  };

  const sendOrder = async () => {
    if (!cartItems.length) return;
    if (!resolvedTableId) {
      toast.error('Table QR link is missing a valid table. Please scan the table QR code again.');
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('place_qr_table_order', {
        p_table_id: resolvedTableId,
        p_items: cartItems.map((c) => ({
          product_id: c.product.id,
          quantity: c.quantity,
        })),
        p_guest_name: guestName.trim() || null,
        p_notes: notes.trim() || null,
      });

      if (error) throw error;

      const result = data as {
        order_id: string;
        order_number: number;
        total: number;
        appended?: boolean;
      };

      setPlacedOrder({
        id: result.order_id,
        orderNumber: result.order_number,
        total: Number(result.total ?? total),
        itemCount: cartCount,
        placedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
      setCart({});
      setNotes('');
      setDrawerOpen(false);
      toast.success(
        result.appended
          ? `Items added to Order #${result.order_number} · Your waiter has been notified!`
          : `Order #${result.order_number} sent to your waiter & kitchen for Table #${tableNumber}!`,
      );
    } catch (e) {
      toast.error(friendlyError(e) || 'Could not send order. Please call a waiter for assistance.');
    } finally {
      setSubmitting(false);
    }
  };

  const catNameOf = (id: string | null) => categories.find((c) => c.id === id)?.name ?? 'Specials';

  return (
    <div
      className={cn(
        'min-h-screen transition-colors duration-300',
        dark ? 'bg-[#080305] text-slate-100' : 'bg-[#fffaf9] text-slate-900',
      )}
      style={{
        backgroundImage: dark
          ? 'radial-gradient(ellipse 80% 45% at 50% -10%, rgba(220,38,38,0.22), transparent 68%), radial-gradient(rgba(249,115,22,0.12) 1px, transparent 1px)'
          : 'radial-gradient(ellipse 80% 45% at 50% -10%, rgba(220,38,38,0.08), transparent 68%), radial-gradient(rgba(249,115,22,0.11) 1px, transparent 1px)',
        backgroundSize: '100% 100%, 28px 28px',
      }}
    >
      {/* Top Sticky Glass Header */}
      <header
        className={cn(
          'sticky top-0 z-40 border-b backdrop-blur-xl',
          dark ? 'border-white/10 bg-[#0d0508]/90' : 'border-slate-200/80 bg-white/90',
        )}
      >
        <div className="h-[2px] w-full bg-gradient-to-r from-[#dc2626] via-[#f97316] to-[#fbbf24]" />
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src="/branding/sombill-logo.jpg"
              alt="SomBill"
              className="h-10 w-10 shrink-0 rounded-xl object-cover shadow-md ring-1 ring-red-500/30"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-black tracking-tight sm:text-base">{venueName}</p>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="inline-flex items-center gap-1 rounded-md bg-gradient-to-r from-[#dc2626] to-[#f97316] px-2 py-0.5 font-mono font-bold text-white">
                  Table #{tableNumber}
                </span>
                <span className={cn('truncate font-medium', dark ? 'text-slate-400' : 'text-slate-500')}>
                  {[tableName, tableSection].filter(Boolean).join(' · ')}
                </span>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              disabled={callingWaiter}
              onClick={() => void callWaiter()}
              className={cn(
                'inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold transition disabled:opacity-60',
                dark
                  ? 'border-orange-500/30 bg-orange-500/15 text-orange-200 hover:bg-orange-500/25'
                  : 'border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100',
              )}
            >
              <BellRing className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Call Waiter</span>
            </button>
            <button
              type="button"
              onClick={() => setDark((d) => !d)}
              aria-label="Toggle theme"
              className={cn(
                'inline-flex h-9 w-9 items-center justify-center rounded-xl border transition',
                dark
                  ? 'border-white/15 bg-white/5 text-amber-300 hover:bg-white/10'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
              )}
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-28 pt-5 sm:px-6 sm:pt-7">
        {/* Executive Welcome Hero */}
        <section className="relative overflow-hidden rounded-3xl border border-orange-500/25 bg-gradient-to-br from-[#160508] via-[#2b0b0d] to-[#120406] p-5 text-white shadow-xl sm:p-8">
          <div className="relative z-10 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="max-w-xl">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-400/30 bg-orange-500/15 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-amber-200">
                <Sparkles className="h-3 w-3" /> Live Digital Table Menu · Table #{tableNumber}
              </span>
              <h1 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">
                Fresh Somali Hospitality, Ordered From Your Table
              </h1>
              <p className="mt-1.5 text-xs leading-relaxed text-white/75 sm:text-sm">
                Browse dishes, customize your order, and send straight to our kitchen. Your waiter will serve Table #
                {tableNumber} as soon as it’s ready.
              </p>
            </div>

            {/* Search bar */}
            <div className="relative w-full md:w-72">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search dishes, grill, juices…"
                className="h-11 w-full rounded-xl border border-white/15 bg-white/10 pl-10 pr-4 text-sm text-white placeholder-white/50 backdrop-blur-md focus:border-orange-400 focus:outline-none"
              />
            </div>
          </div>
        </section>

        {/* Live Order Confirmation Banner */}
        {placedOrder && (
          <section
            className={cn(
              'mt-5 flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between',
              dark
                ? 'border-orange-500/35 bg-orange-500/10 text-white'
                : 'border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50/70 text-slate-900',
            )}
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#dc2626] to-[#f97316] text-white shadow">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-extrabold">
                  Order #{placedOrder.orderNumber} sent to Kitchen · Table #{tableNumber}
                </p>
                <p
                  className={cn(
                    'mt-0.5 flex flex-wrap items-center gap-2 text-xs',
                    dark ? 'text-slate-300' : 'text-slate-600',
                  )}
                >
                  <span className="inline-flex items-center gap-1">
                    <ChefHat className="h-3.5 w-3.5 text-orange-500" /> Preparing now
                  </span>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> {placedOrder.placedAt}
                  </span>
                  <span>·</span>
                  <span className="font-mono font-bold">{formatMoney(placedOrder.total, currency)}</span>
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="secondary"
              loading={callingWaiter}
              icon={<Receipt className="h-4 w-4" />}
              onClick={() => void callWaiter(`Guest at Table #${tableNumber} requested the bill.`)}
            >
              Request Bill
            </Button>
          </section>
        )}

        {/* Horizontal Scrollable Category Pills */}
        <div className="mt-5 flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
          <button
            type="button"
            onClick={() => setCatId('')}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-bold transition',
              catId === ''
                ? 'border-transparent bg-gradient-to-r from-[#dc2626] to-[#f97316] text-white shadow-md'
                : dark
                  ? 'border-white/10 bg-white/5 text-slate-300 hover:border-orange-500/40'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-orange-300',
            )}
          >
            All Menu <span className="opacity-75">({allProducts.length})</span>
          </button>
          {categories.map((c) => {
            const count = allProducts.filter((p) => p.category_id === c.id).length;
            const active = catId === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCatId(c.id)}
                className={cn(
                  'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-bold transition',
                  active
                    ? 'border-transparent bg-gradient-to-r from-[#dc2626] to-[#f97316] text-white shadow-md'
                    : dark
                      ? 'border-white/10 bg-white/5 text-slate-300 hover:border-orange-500/40'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-orange-300',
                )}
              >
                {c.name} <span className="opacity-75">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Menu Dish Cards Grid */}
        {q.loading && !q.data ? (
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={cn('h-40 animate-pulse rounded-2xl', dark ? 'bg-white/5' : 'bg-slate-200/70')} />
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div
            className={cn(
              'mt-8 rounded-3xl border p-10 text-center',
              dark ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200 bg-white',
            )}
          >
            <UtensilsCrossed className="mx-auto h-8 w-8 text-orange-500" />
            <p className="mt-3 text-base font-bold">No dishes found</p>
            <p className={cn('mt-1 text-xs', dark ? 'text-slate-400' : 'text-slate-500')}>
              Try another category or clear your search.
            </p>
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProducts.map((p) => {
              const qty = cart[p.id]?.quantity ?? 0;
              const available = p.is_available !== false;
              const showImage = Boolean(p.image_url && !brokenImages[p.id]);
              return (
                <article
                  key={p.id}
                  className={cn(
                    'group relative flex flex-col justify-between overflow-hidden rounded-2xl border transition-all duration-200',
                    dark
                      ? 'border-white/10 bg-[#14080c]/85 hover:border-orange-500/40'
                      : 'border-slate-200/80 bg-white/95 shadow-sm hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-lg',
                    !available && 'opacity-60',
                  )}
                >
                  <div>
                    <div
                      className={cn(
                        'relative aspect-[16/10] w-full overflow-hidden',
                        dark
                          ? 'bg-gradient-to-br from-[#230c12] to-[#120508]'
                          : 'bg-gradient-to-br from-orange-50 via-amber-50/70 to-rose-50',
                      )}
                    >
                      {showImage ? (
                        <img
                          src={p.image_url!}
                          alt={p.name}
                          loading="lazy"
                          onError={() => setBrokenImages((prev) => ({ ...prev, [p.id]: true }))}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-orange-400/70">
                          <UtensilsCrossed className="h-8 w-8" />
                          <span className="text-[10px] font-bold uppercase tracking-widest opacity-70">
                            {catNameOf(p.category_id)}
                          </span>
                        </div>
                      )}
                      <span
                        className={cn(
                          'absolute left-3 top-3 inline-block rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider shadow-sm backdrop-blur-md',
                          dark ? 'bg-black/65 text-orange-300' : 'bg-white/90 text-orange-700',
                        )}
                      >
                        {catNameOf(p.category_id)}
                      </span>
                      <span className="absolute right-3 top-3 rounded-lg bg-gradient-to-r from-[#dc2626] to-[#f97316] px-2.5 py-1 font-mono text-xs font-black text-white shadow">
                        {formatMoney(Number(p.price), currency)}
                      </span>
                    </div>

                    <div className="p-4 pb-0">
                      <h2 className="text-base font-extrabold leading-snug">{p.name}</h2>
                      {p.description && (
                        <p
                          className={cn(
                            'mt-1 line-clamp-2 text-xs leading-relaxed',
                            dark ? 'text-slate-400' : 'text-slate-500',
                          )}
                        >
                          {p.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-dashed border-slate-200/70 px-4 py-3 dark:border-white/10">
                    <span
                      className={cn(
                        'text-[11px] font-semibold',
                        available ? 'text-orange-600 dark:text-amber-300' : 'text-slate-400',
                      )}
                    >
                      {available ? 'Ready to order' : 'Sold out'}
                    </span>

                    {qty > 0 ? (
                      <div className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#dc2626] to-[#f97316] p-1 text-white shadow">
                        <button
                          type="button"
                          onClick={() => removeOne(p.id)}
                          aria-label={`Remove one ${p.name}`}
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20 hover:bg-white/30"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="min-w-[18px] text-center font-mono text-xs font-black">{qty}</span>
                        <button
                          type="button"
                          onClick={() => addOne(p)}
                          aria-label={`Add one more ${p.name}`}
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20 hover:bg-white/30"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={!available}
                        onClick={() => addOne(p)}
                        className={cn(
                          'inline-flex h-9 items-center gap-1.5 rounded-xl px-3.5 text-xs font-bold transition',
                          available
                            ? 'bg-gradient-to-r from-[#dc2626] to-[#f97316] text-white shadow-sm hover:brightness-110 active:scale-95'
                            : 'cursor-not-allowed bg-slate-200 text-slate-400',
                        )}
                      >
                        <Plus className="h-3.5 w-3.5" /> Add
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {/* Sticky Floating Order Cart Bar */}
      {cartCount > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-40 mx-auto max-w-xl px-4">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flex w-full items-center justify-between rounded-2xl bg-gradient-to-r from-[#dc2626] via-[#ea580c] to-[#f59e0b] px-5 py-3.5 text-white shadow-2xl transition hover:brightness-105 active:scale-[0.99]"
          >
            <span className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/20 font-mono text-sm font-black">
                {cartCount}
              </span>
              <span className="text-left">
                <span className="block text-xs font-bold uppercase tracking-wider text-white/85">
                  Table #{tableNumber} Order
                </span>
                <span className="block text-sm font-extrabold">Review &amp; Send to Kitchen</span>
              </span>
            </span>
            <span className="flex items-center gap-2 font-mono text-base font-black">
              {formatMoney(total, currency)}
              <ShoppingBag className="h-4 w-4" />
            </span>
          </button>
        </div>
      )}

      {/* Slide-Up / Modal Cart Checkout Sheet */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div
            className={cn(
              'flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border shadow-2xl sm:rounded-3xl',
              dark ? 'border-white/15 bg-[#120609] text-white' : 'border-slate-200 bg-white text-slate-900',
            )}
          >
            <div className="flex items-center justify-between border-b border-slate-200/70 px-5 py-4 dark:border-white/10">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-orange-600">Table #{tableNumber}</p>
                <h2 className="text-lg font-black">Your Table Order</h2>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close order cart"
                className="rounded-xl p-2 hover:bg-slate-100 dark:hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              <ul className="divide-y divide-slate-200/70 dark:divide-white/10">
                {cartItems.map(({ product, quantity }) => (
                  <li key={product.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      {product.image_url && !brokenImages[product.id] ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="h-11 w-11 shrink-0 rounded-xl object-cover ring-1 ring-slate-200/80 dark:ring-white/10"
                        />
                      ) : (
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-500 dark:bg-white/5">
                          <UtensilsCrossed className="h-4 w-4" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">{product.name}</p>
                        <p className="font-mono text-xs text-slate-500">
                          {formatMoney(Number(product.price), currency)} × {quantity}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => removeOne(product.id)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-300 dark:border-white/15"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-5 text-center font-mono text-xs font-bold">{quantity}</span>
                      <button
                        type="button"
                        onClick={() => addOne(product)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-300 dark:border-white/15"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="grid grid-cols-1 gap-3">
                <input
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Your name (optional)"
                  className={cn(
                    'h-10 w-full rounded-xl border px-3.5 text-sm',
                    dark ? 'border-white/15 bg-white/5 text-white' : 'border-slate-200 bg-slate-50 text-slate-900',
                  )}
                />
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Kitchen notes (e.g. extra bisbaas, well done, no onions)"
                  className={cn(
                    'w-full rounded-xl border px-3.5 py-2.5 text-sm',
                    dark ? 'border-white/15 bg-white/5 text-white' : 'border-slate-200 bg-slate-50 text-slate-900',
                  )}
                />
              </div>

              <div
                className={cn(
                  'space-y-1.5 rounded-2xl border p-4 text-sm',
                  dark ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200 bg-slate-50',
                )}
              >
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Subtotal</span>
                  <span className="font-mono">{formatMoney(subtotal, currency)}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>VAT (5%)</span>
                  <span className="font-mono">{formatMoney(tax, currency)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200/70 pt-2 text-base font-black dark:border-white/10">
                  <span>Total</span>
                  <span className="font-mono text-[#dc2626] dark:text-amber-300">{formatMoney(total, currency)}</span>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200/70 p-4 dark:border-white/10">
              <Button
                className="w-full py-3"
                loading={submitting}
                icon={<ChefHat className="h-4 w-4" />}
                onClick={() => void sendOrder()}
              >
                Send Order to Kitchen · {formatMoney(total, currency)}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
