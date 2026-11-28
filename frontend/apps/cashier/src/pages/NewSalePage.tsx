import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  CreditCard,
  Eye,
  MessageSquarePlus,
  Minus,
  PauseCircle,
  PlayCircle,
  Plus,
  Printer,
  Save,
  ScanBarcode,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
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
import { Modal } from '@sombill/shared-ui/ui/Modal';
import { useToast } from '@sombill/shared-ui/ui/Toast';
import { CatChip, CustomerPicker, ProductCard } from '@sombill/shared-ui/pos/PosComponents';
import { useCart, type CartLine } from '@sombill/shared-hooks/cart';
import { computeTotals, lineTotal, MAX_QTY, posErrorMessage } from '@sombill/shared-utils/posRules';
import { cashierErrorMessage, parseMoney, r2, type PosMethod } from '../features/payment';
import type { ReceiptData } from '../features/receiptModel';
import { ReceiptView } from '../components/ReceiptView';
import { printReceiptFor } from './PaymentProcessingPage';

const TYPES: OrderType[] = ['dine_in', 'takeaway', 'delivery'];

const SIMPLE_PAY_METHODS: Array<{ id: PosMethod; label: string; sub: string; tone: string }> = [
  { id: 'zaad', label: 'Zaad', sub: 'Mobile Money', tone: 'border-red-300 bg-red-50/70 text-red-900' },
  { id: 'somtel_money', label: 'e-Dahab', sub: 'Somtel Money', tone: 'border-emerald-300 bg-emerald-50/70 text-emerald-900' },
  { id: 'cash', label: 'Cash', sub: 'Counter Cash', tone: 'border-slate-300 bg-white text-brand-navy' },
  { id: 'evc_plus', label: 'EVC Plus', sub: 'Mobile Money', tone: 'border-orange-300 bg-orange-50/70 text-orange-950' },
];

interface HeldOrder {
  id: string;
  heldAt: string;
  orderType: OrderType;
  tableId: string | null;
  tableLabel: string | null;
  customerId: string | null;
  guestCount: string;
  orderNotes: string;
  lines: CartLine[];
}

export function printCashierKitchenTicket(opts: {
  restaurantName: string;
  orderNumber?: number | null;
  tableLabel?: string | null;
  orderNotes?: string | null;
  items: Array<{ name: string; quantity: number; notes?: string | null }>;
}): void {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const rows = opts.items
    .map(
      (i) =>
        `<div style="margin-bottom:6px"><div style="display:flex;gap:8px;font-size:13.5px;font-weight:700"><span style="min-width:28px">${esc(String(Number(i.quantity)))}×</span><span style="flex:1">${esc(i.name)}</span></div>${i.notes ? `<div style="padding-left:36px;font-size:11.5px">↳ ${esc(i.notes)}</div>` : ''}</div>`,
    )
    .join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"/><style>@page{size:80mm auto;margin:0}body{margin:0 auto;padding:4mm 3mm;width:72mm;font-family:monospace;font-size:12px;color:#000;background:#fff}hr{border:0;border-top:1px dashed #000;margin:8px 0}</style></head><body><div style="text-align:center"><p style="font-size:15px;font-weight:800;margin:0">${esc(opts.restaurantName)}</p><p style="font-size:11.5px;font-weight:800;margin:4px 0 0">KITCHEN TICKET · ITEMS ONLY</p></div><hr/>${opts.orderNumber ? `<div style="display:flex;justify-content:space-between"><span>Order</span><b>#${esc(String(opts.orderNumber))}</b></div>` : ''}${opts.tableLabel ? `<div style="display:flex;justify-content:space-between"><span>Table / Type</span><b>${esc(opts.tableLabel)}</b></div>` : ''}<div style="display:flex;justify-content:space-between"><span>Time</span><span>${esc(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))}</span></div><hr/>${rows}${opts.orderNotes ? `<div style="margin-top:6px;padding:4px 6px;border:1px dashed #000;font-size:11.5px"><b>Note:</b> ${esc(opts.orderNotes)}</div>` : ''}<hr/><div style="text-align:center;font-size:10px">SomBill POS · Kitchen Copy</div></body></html>`;
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
  if (!doc || !iframe.contentWindow) {
    iframe.remove();
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();
  setTimeout(() => {
    try {
      iframe.contentWindow?.print();
    } finally {
      setTimeout(() => iframe.remove(), 1000);
    }
  }, 150);
}

export function printDraftReceiptPreview(opts: {
  restaurantName: string;
  currency: string;
  tableLabel: string;
  cashierName: string;
  paymentLabel?: string | null;
  subtotal: number;
  discount: number;
  taxLabel: string;
  taxAmount: number;
  total: number;
  items: Array<{ name: string; quantity: number; unitPrice: number; notes?: string | null }>;
}): void {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const m = (n: number) => formatMoney(n, opts.currency);
  const rows = opts.items
    .map(
      (i) =>
        `<div style="margin-bottom:5px"><div style="font-weight:700">${esc(i.name)}</div>${i.notes ? `<div style="padding-left:8px;font-size:10.5px">↳ ${esc(i.notes)}</div>` : ''}<div style="display:flex;justify-content:space-between"><span>&nbsp;&nbsp;${esc(String(i.quantity))} × ${esc(m(i.unitPrice))}</span><b>${esc(m(lineTotal(i.quantity, i.unitPrice)))}</b></div></div>`,
    )
    .join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"/><style>@page{size:80mm auto;margin:0}body{margin:0 auto;padding:4mm 3mm;width:72mm;font-family:monospace;font-size:11.5px;color:#000;background:#fff}hr{border:0;border-top:1px dashed #000;margin:8px 0}</style></head><body><div style="text-align:center"><p style="font-size:14px;font-weight:800;margin:0">${esc(opts.restaurantName)}</p><p style="font-size:11px;font-weight:700;margin:4px 0 0">RECEIPT / BILL</p></div><hr/><div style="display:flex;justify-content:space-between"><span>Table / Type</span><b>${esc(opts.tableLabel)}</b></div><div style="display:flex;justify-content:space-between"><span>Cashier</span><span>${esc(opts.cashierName)}</span></div><div style="display:flex;justify-content:space-between"><span>Date</span><span>${esc(new Date().toLocaleString())}</span></div>${opts.paymentLabel ? `<div style="display:flex;justify-content:space-between"><span>Payment</span><b>${esc(opts.paymentLabel)}</b></div>` : ''}<hr/>${rows}<hr/><div style="display:flex;justify-content:space-between"><span>Subtotal</span><span>${esc(m(opts.subtotal))}</span></div>${opts.discount > 0 ? `<div style="display:flex;justify-content:space-between"><span>Discount</span><span>−${esc(m(opts.discount))}</span></div>` : ''}<div style="display:flex;justify-content:space-between"><span>${esc(opts.taxLabel)}</span><span>${esc(m(opts.taxAmount))}</span></div><div style="display:flex;justify-content:space-between;font-size:14px;font-weight:800;margin-top:4px"><span>TOTAL</span><span>${esc(m(opts.total))}</span></div><hr/><div style="text-align:center;font-size:10.5px">Thank you! · SomBill POS</div></body></html>`;
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
  if (!doc || !iframe.contentWindow) {
    iframe.remove();
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();
  setTimeout(() => {
    try {
      iframe.contentWindow?.print();
    } finally {
      setTimeout(() => iframe.remove(), 1000);
    }
  }, 150);
}

export default function NewSalePage() {
  const r = useRestaurant();
  const { role, profile } = useAuth();
  const cart = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const money = (n: number) => formatMoney(n, r.currency);
  const [catId, setCatId] = useState('');
  const [search, setSearch] = useState('');
  const [openNote, setOpenNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'save' | 'charge' | 'quickpay' | null>(null);
  const [payMethod, setPayMethod] = useState<PosMethod>('zaad');
  const [payRef, setPayRef] = useState('');
  const [receiptPreviewOpen, setReceiptPreviewOpen] = useState(false);
  const [lastPaidOrder, setLastPaidOrder] = useState<{
    orderId: string;
    orderNumber: number;
    total: number;
    methodLabel: string;
    receiptData: ReceiptData;
  } | null>(null);
  const inFlight = useRef(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const heldStorageKey = `sombill.cashier.held.${r.id}`;
  const [heldOrders, setHeldOrders] = useState<HeldOrder[]>(() => {
    try {
      const raw = localStorage.getItem(heldStorageKey);
      return raw ? (JSON.parse(raw) as HeldOrder[]) : [];
    } catch {
      return [];
    }
  });
  const [heldModalOpen, setHeldModalOpen] = useState(false);

  const saveHeldOrders = (next: HeldOrder[]) => {
    setHeldOrders(next);
    try {
      localStorage.setItem(heldStorageKey, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

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

  const draftReceiptData: ReceiptData = useMemo(
    () => ({
      kind: 'receipt',
      restaurant: r,
      order: {
        order_number: ex?.order_number ?? 0,
        order_type: cart.orderType,
        subtotal: t.subtotal,
        discount_amount: addMode ? 0 : (discount ?? 0),
        tax_amount: t.tax,
        total: t.total,
        amount_paid: t.total,
        amount_refunded: 0,
        tax_rate: taxRate,
        tax_inclusive: inclusive,
        created_at: new Date().toISOString(),
      },
      items: cart.lines.map((l) => ({
        product_name: l.name,
        quantity: l.quantity,
        unit_price: l.unit_price,
        line_total: lineTotal(l.quantity, l.unit_price),
        is_voided: false,
        notes: l.notes.trim() || null,
      })),
      payments: [
        {
          kind: 'payment',
          status: 'succeeded',
          method: payMethod,
          amount: t.total,
          reference: payRef.trim() || null,
          transaction_number: null,
          amount_received: payMethod === 'cash' ? t.total : null,
          change_given: 0,
          created_at: new Date().toISOString(),
        },
      ],
      receiptNumber: null,
      cashierName: profile?.full_name || 'Cashier',
      tableNumber: selectedTable?.table_number ?? null,
      printedAt: new Date(),
    }),
    [r, ex?.order_number, cart.orderType, cart.lines, t, addMode, discount, taxRate, inclusive, payMethod, payRef, profile?.full_name, selectedTable?.table_number],
  );

  const submit = async (mode: 'save' | 'charge' | 'quickpay') => {
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
    if (res.error) {
      inFlight.current = false;
      setBusy(null);
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
    const orderTotal = Number(d.total);

    if (mode === 'quickpay') {
      const methodLabel = SIMPLE_PAY_METHODS.find((m) => m.id === payMethod)?.label ?? payMethod;
      const autoRef =
        payMethod === 'cash'
          ? null
          : payRef.trim() || `${payMethod.toUpperCase().slice(0, 4)}-${d.order_number}-${Date.now().toString().slice(-4)}`;
      const payRes = await supabase.rpc('record_payments', {
        p_order: d.order_id,
        p_payments: [
          {
            method: payMethod,
            amount: orderTotal,
            reference: autoRef,
            amount_received: payMethod === 'cash' ? orderTotal : null,
          },
        ],
        p_idempotency_key: crypto.randomUUID(),
        p_close_order: true,
      });
      inFlight.current = false;
      setBusy(null);
      if (payRes.error) {
        cart.clear();
        toast.info(`Order #${d.order_number} created. Opening payment page (${friendlyError(payRes.error)}).`);
        navigate(`/cashier/payments?order=${d.order_id}`);
        return;
      }
      const receiptSnap: ReceiptData = {
        ...draftReceiptData,
        order: {
          ...draftReceiptData.order,
          order_number: d.order_number,
          total: orderTotal,
          amount_paid: orderTotal,
        },
      };
      setLastPaidOrder({
        orderId: d.order_id,
        orderNumber: d.order_number,
        total: orderTotal,
        methodLabel,
        receiptData: receiptSnap,
      });
      setPayRef('');
      cart.clear();
      void tables.reload();
      toast.success(`Order #${d.order_number} confirmed & paid via ${methodLabel} (${money(orderTotal)}).`);
      return;
    }

    inFlight.current = false;
    setBusy(null);
    cart.clear();
    toast.success(
      addMode
        ? `Items added to order #${d.order_number}.`
        : `Order #${d.order_number} created (${money(orderTotal)}).`,
    );
    if (mode === 'charge') navigate(`/cashier/payments?order=${d.order_id}`);
  };

  const holdCurrentOrder = () => {
    if (!cart.lines.length) {
      toast.info('Add at least one item before holding an order.');
      return;
    }
    const entry: HeldOrder = {
      id: crypto.randomUUID(),
      heldAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      orderType: cart.orderType,
      tableId: cart.tableId,
      tableLabel: selectedTable ? `Table ${selectedTable.table_number}` : ORDER_TYPE_LABEL[cart.orderType],
      customerId: cart.customerId,
      guestCount: cart.guestCount,
      orderNotes: cart.orderNotes,
      lines: cart.lines,
    };
    saveHeldOrders([entry, ...heldOrders]);
    cart.clear();
    toast.success(`Order parked (${entry.tableLabel} · ${entry.lines.reduce((s, l) => s + l.quantity, 0)} items).`);
  };

  const resumeHeldOrder = (h: HeldOrder) => {
    cart.clear();
    cart.setOrderType(h.orderType);
    if (h.tableId) cart.setTable(h.tableId);
    if (h.customerId) cart.setCustomer(h.customerId);
    if (h.guestCount) cart.setGuestCount(h.guestCount);
    if (h.orderNotes) cart.setOrderNotes(h.orderNotes);
    for (const line of h.lines) {
      const prod = menu.data?.products.find((p) => p.id === line.product_id);
      if (prod) {
        cart.addProduct(prod);
        if (line.quantity > 1) {
          // set exact quantity after adding
          setTimeout(() => cart.setQty(line.key, line.quantity), 0);
        }
      }
    }
    saveHeldOrders(heldOrders.filter((x) => x.id !== h.id));
    setHeldModalOpen(false);
    toast.success(`Resumed parked order (${h.tableLabel}).`);
  };

  // Keyboard shortcuts: F2 search, F4 charge, F8 hold, Esc clear search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === 'F4' && cart.lines.length > 0 && !busy) {
        e.preventDefault();
        void submit('charge');
      } else if (e.key === 'F8' && cart.lines.length > 0 && !addMode) {
        e.preventDefault();
        holdCurrentOrder();
      } else if (e.key === 'Escape' && search) {
        setSearch('');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="flex flex-col">
      <PageHeader
        title={addMode ? `Add items to order #${ex?.order_number ?? ''}` : 'New Sale'}
        description="1. Select Table & Add Items → 2. Preview & Print Receipt → 3. Choose Zaad, e-Dahab or Cash & Confirm."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {heldOrders.length > 0 && (
              <Button
                variant="secondary"
                icon={<PlayCircle className="h-4 w-4" />}
                onClick={() => setHeldModalOpen(true)}
              >
                Parked orders ({heldOrders.length})
              </Button>
            )}
            {addMode && (
              <Button variant="secondary" onClick={() => cart.clear()}>
                Cancel adding
              </Button>
            )}
          </div>
        }
      />
      <div className="grid grid-cols-1 items-start gap-4 pb-24 lg:grid-cols-[minmax(0,56fr)_minmax(360px,44fr)] lg:pb-6">
        <section aria-label="Menu" className="min-w-0 space-y-3">
          <div className="pos-search relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <ScanBarcode
              className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <input
              ref={searchRef}
              type="search"
              className="input h-12 pl-9 pr-11 text-base"
              placeholder="Search products or SKU (F2)"
              aria-label="Search products"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && search.trim()) {
                  const exactSku = products.find((p) => p.sku?.toLowerCase() === search.trim().toLowerCase());
                  const target = exactSku ?? (products.length === 1 ? products[0] : null);
                  if (target && target.is_available) {
                    e.preventDefault();
                    cart.addProduct(target);
                    setSearch('');
                  }
                }
              }}
              maxLength={60}
            />
          </div>
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Categories">
            <CatChip active={!catId} onClick={() => setCatId('')}>
              All
            </CatChip>
            {cats.map((c) => (
              <CatChip key={c.id} active={catId === c.id} onClick={() => setCatId(c.id)}>
                {c.name}
              </CatChip>
            ))}
          </div>
          <div className="space-y-3">
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

        <aside id="sale-panel" aria-label="Current sale" className="scroll-mt-20 lg:sticky lg:top-4">
          <Card className="pos-ticket flex flex-col" bodyClassName="flex flex-col p-0">
            <div className="space-y-3 border-b border-slate-100 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-brand-navy">
                    {addMode ? `Order #${ex?.order_number ?? '…'}` : 'Current order'}
                  </h2>
                  {cart.itemCount > 0 && (
                    <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-brand-orange/15 px-2 text-xs font-bold text-brand-orange">
                      {cart.itemCount}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {!addMode && cart.orderType === 'dine_in' && selectedTable && (
                    <span data-sb="table-pill">Table {selectedTable.table_number}</span>
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
            <div className="max-h-[380px] overflow-y-auto p-4">
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
            <div className="space-y-3 border-t border-slate-100 bg-slate-50/60 p-4" data-sb="totals">
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

              {/* Step 2: Preview & Print Receipt directly on New Sale */}
              {cart.lines.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="secondary"
                    className="h-11 text-xs font-bold"
                    icon={<Eye className="h-4 w-4" />}
                    onClick={() => setReceiptPreviewOpen(true)}
                  >
                    Preview Receipt
                  </Button>
                  <Button
                    variant="secondary"
                    className="h-11 text-xs font-bold"
                    icon={<Printer className="h-4 w-4" />}
                    onClick={() =>
                      printDraftReceiptPreview({
                        restaurantName: r.name,
                        currency: r.currency,
                        tableLabel: selectedTable
                          ? `Table ${selectedTable.table_number}`
                          : ORDER_TYPE_LABEL[cart.orderType],
                        cashierName: profile?.full_name || 'Cashier',
                        paymentLabel: SIMPLE_PAY_METHODS.find((m) => m.id === payMethod)?.label ?? null,
                        subtotal: t.subtotal,
                        discount: addMode ? 0 : (discount ?? 0),
                        taxLabel: `${r.tax_label} ${(taxRate * 100).toFixed(0)}%`,
                        taxAmount: t.tax,
                        total: t.total,
                        items: cart.lines.map((l) => ({
                          name: l.name,
                          quantity: l.quantity,
                          unitPrice: l.unit_price,
                          notes: l.notes.trim() || null,
                        })),
                      })
                    }
                  >
                    Print Receipt
                  </Button>
                </div>
              )}

              {/* Step 3: Simple Payment (Zaad, e-Dahab, Cash) + Confirm */}
              {!addMode && cart.lines.length > 0 && (
                <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-3">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-brand-navy">
                    <Sparkles className="h-4 w-4 text-brand-orange" /> Payment Method (Zaad · e-Dahab · Cash)
                  </p>
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                    {SIMPLE_PAY_METHODS.map((m) => {
                      const active = payMethod === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setPayMethod(m.id)}
                          className={cn(
                            'flex flex-col items-start rounded-lg border px-2.5 py-2 text-left transition',
                            active
                              ? 'border-brand-orange bg-white ring-2 ring-brand-orange/30'
                              : m.tone,
                          )}
                        >
                          <span className="text-xs font-extrabold">{m.label}</span>
                          <span className="text-[10px] opacity-75">{m.sub}</span>
                        </button>
                      );
                    })}
                  </div>
                  {payMethod !== 'cash' && (
                    <input
                      className="input mt-2 h-10 bg-white text-xs"
                      placeholder="Optional reference (auto-filled if blank)"
                      value={payRef}
                      onChange={(e) => setPayRef(e.target.value)}
                    />
                  )}
                  <Button
                    variant="orange"
                    className="mt-2 h-12 w-full text-sm font-bold"
                    icon={<CheckCircle2 className="h-4 w-4" />}
                    loading={busy === 'quickpay'}
                    disabled={!!busy || !cart.lines.length}
                    onClick={() => void submit('quickpay')}
                  >
                    Confirm &amp; Pay with {SIMPLE_PAY_METHODS.find((m) => m.id === payMethod)?.label} ({money(t.total)})
                  </Button>
                </div>
              )}

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
              {cart.lines.length > 0 && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {!addMode && (
                    <Button
                      variant="secondary"
                      className="h-10 text-xs"
                      icon={<PauseCircle className="h-4 w-4" />}
                      onClick={holdCurrentOrder}
                    >
                      Hold / Park (F8)
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    className={cn('h-10 text-xs', addMode && 'col-span-2')}
                    icon={<Printer className="h-4 w-4" />}
                    onClick={() =>
                      printCashierKitchenTicket({
                        restaurantName: r.name,
                        orderNumber: ex?.order_number ?? null,
                        tableLabel: selectedTable
                          ? `Table ${selectedTable.table_number}`
                          : ORDER_TYPE_LABEL[cart.orderType],
                        orderNotes: cart.orderNotes.trim() || null,
                        items: cart.lines.map((l) => ({
                          name: l.name,
                          quantity: l.quantity,
                          notes: l.notes.trim() || null,
                        })),
                      })
                    }
                  >
                    Print kitchen ticket
                  </Button>
                </div>
              )}
            </div>
          </Card>
        </aside>
      </div>

      {/* Live Receipt Preview Modal before or during checkout */}
      <Modal
        open={receiptPreviewOpen}
        onClose={() => setReceiptPreviewOpen(false)}
        size="md"
        title="Receipt Preview (80mm Thermal)"
        description="Preview the customer receipt before printing or confirming payment."
        footer={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setReceiptPreviewOpen(false)}>
              Close
            </Button>
            <Button
              variant="secondary"
              icon={<Printer className="h-4 w-4" />}
              onClick={() =>
                printDraftReceiptPreview({
                  restaurantName: r.name,
                  currency: r.currency,
                  tableLabel: selectedTable
                    ? `Table ${selectedTable.table_number}`
                    : ORDER_TYPE_LABEL[cart.orderType],
                  cashierName: profile?.full_name || 'Cashier',
                  paymentLabel: SIMPLE_PAY_METHODS.find((m) => m.id === payMethod)?.label ?? null,
                  subtotal: t.subtotal,
                  discount: addMode ? 0 : (discount ?? 0),
                  taxLabel: `${r.tax_label} ${(taxRate * 100).toFixed(0)}%`,
                  taxAmount: t.tax,
                  total: t.total,
                  items: cart.lines.map((l) => ({
                    name: l.name,
                    quantity: l.quantity,
                    unitPrice: l.unit_price,
                    notes: l.notes.trim() || null,
                  })),
                })
              }
            >
              Print Receipt Now
            </Button>
            {!addMode && (
              <Button
                variant="orange"
                icon={<CheckCircle2 className="h-4 w-4" />}
                loading={busy === 'quickpay'}
                onClick={() => {
                  setReceiptPreviewOpen(false);
                  void submit('quickpay');
                }}
              >
                Confirm &amp; Pay ({SIMPLE_PAY_METHODS.find((m) => m.id === payMethod)?.label})
              </Button>
            )}
          </div>
        }
      >
        <div className="rounded-xl border border-slate-200 bg-slate-100 p-4">
          <ReceiptView d={draftReceiptData} />
        </div>
      </Modal>

      {/* Post-Payment Confirmed & Print Receipt Modal */}
      <Modal
        open={!!lastPaidOrder}
        onClose={() => setLastPaidOrder(null)}
        size="md"
        title={lastPaidOrder ? `Order #${lastPaidOrder.orderNumber} Confirmed & Paid` : 'Payment Confirmed'}
        description={
          lastPaidOrder
            ? `Paid ${money(lastPaidOrder.total)} via ${lastPaidOrder.methodLabel}. Print the customer receipt below.`
            : ''
        }
        footer={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setLastPaidOrder(null)}>
              New Sale
            </Button>
            {lastPaidOrder && (
              <Button
                variant="orange"
                icon={<Printer className="h-4 w-4" />}
                onClick={() => void printReceiptFor(lastPaidOrder.orderId, toast)}
              >
                Print Receipt
              </Button>
            )}
          </div>
        }
      >
        {lastPaidOrder && (
          <div className="rounded-xl border border-slate-200 bg-slate-100 p-4">
            <ReceiptView d={lastPaidOrder.receiptData} />
          </div>
        )}
      </Modal>

      {/* Parked / Held Orders Modal */}
      <Modal
        open={heldModalOpen}
        onClose={() => setHeldModalOpen(false)}
        size="md"
        title={`Parked Orders (${heldOrders.length})`}
        description="Resume a held order back into the terminal or discard it."
        footer={
          <Button variant="secondary" onClick={() => setHeldModalOpen(false)}>
            Close
          </Button>
        }
      >
        {!heldOrders.length ? (
          <EmptyState title="No parked orders" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {heldOrders.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-bold text-brand-navy">
                    {h.tableLabel} · <span className="font-normal text-slate-500">Parked at {h.heldAt}</span>
                  </p>
                  <p className="truncate text-xs text-slate-600">
                    {h.lines.map((l) => `${l.quantity}× ${l.name}`).join(', ')}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button size="sm" variant="orange" onClick={() => resumeHeldOrder(h)}>
                    Resume
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => saveHeldOrders(heldOrders.filter((x) => x.id !== h.id))}
                  >
                    Discard
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Modal>
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
