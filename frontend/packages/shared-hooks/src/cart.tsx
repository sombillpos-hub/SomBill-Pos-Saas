import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { OrderType, Product } from '@sombill/shared-types/types';
import { clampQty } from '@sombill/shared-utils/posRules';

export interface CartLine {
  key: string;
  product_id: string;
  name: string;
  unit_price: number;
  tax_exempt: boolean;
  quantity: number;
  notes: string;
}
export interface CartState {
  tableId: string | null;
  existingOrderId: string | null; // set when adding items to an open order
  lines: CartLine[];
  orderNotes: string;
  customerId: string | null;
  guestCount: string;
  orderType: OrderType; // cashier POS
  discount: string; // cashier POS (amount, validated server-side)
  discountReason: string;
  idempotencyKey: string;
}

interface CartApi extends CartState {
  setTable: (id: string | null) => void;
  startExistingOrder: (orderId: string, tableId: string | null) => void;
  addProduct: (p: Product) => void;
  setQty: (key: string, qty: number) => void;
  inc: (key: string, delta: number) => void;
  remove: (key: string) => void;
  setLineNotes: (key: string, notes: string) => void;
  setOrderNotes: (v: string) => void;
  setCustomer: (id: string | null) => void;
  setGuestCount: (v: string) => void;
  setOrderType: (t: OrderType) => void;
  setDiscount: (amount: string, reason?: string) => void;
  refreshPrices: (products: Product[]) => string[];
  clear: (keepTable?: boolean) => void;
  itemCount: number;
}

const uuid = () => crypto.randomUUID();
const empty = (): CartState => ({
  tableId: null,
  existingOrderId: null,
  lines: [],
  orderNotes: '',
  customerId: null,
  guestCount: '',
  orderType: 'dine_in',
  discount: '',
  discountReason: '',
  idempotencyKey: uuid(),
});

function load(key: string): CartState {
  try {
    const raw = sessionStorage.getItem(key);
    if (raw) return { ...empty(), ...(JSON.parse(raw) as Partial<CartState>) };
  } catch {
    /* storage unavailable */
  }
  return empty();
}

const Ctx = createContext<CartApi | null>(null);

/**
 * Draft order held on this device until sent. The idempotency key stays the same for
 * every retry of one draft, so a double tap or a network retry cannot create two orders.
 */
export function CartProvider({
  children,
  storageKey = 'sombill.waiter.cart',
}: {
  children: ReactNode;
  storageKey?: string;
}) {
  const [state, setState] = useState<CartState>(() => load(storageKey));
  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state, storageKey]);

  const patch = useCallback((fn: (s: CartState) => CartState) => setState(fn), []);
  const api = useMemo<CartApi>(
    () => ({
      ...state,
      itemCount: state.lines.reduce((s, l) => s + l.quantity, 0),
      setTable: (id) => patch((s) => (s.existingOrderId ? s : { ...s, tableId: id })),
      startExistingOrder: (orderId, tableId) => patch(() => ({ ...empty(), existingOrderId: orderId, tableId })),
      addProduct: (p) =>
        patch((s) => {
          if (!p.is_available || p.archived_at) return s;
          const same = s.lines.find((l) => l.product_id === p.id && !l.notes);
          if (same)
            return { ...s, lines: s.lines.map((l) => (l === same ? { ...l, quantity: clampQty(l.quantity + 1) } : l)) };
          return {
            ...s,
            lines: [
              ...s.lines,
              {
                key: uuid(),
                product_id: p.id,
                name: p.name,
                unit_price: Number(p.price),
                tax_exempt: p.tax_category === 'exempt',
                quantity: 1,
                notes: '',
              },
            ],
          };
        }),
      setQty: (key, qty) =>
        patch((s) => ({ ...s, lines: s.lines.map((l) => (l.key === key ? { ...l, quantity: clampQty(qty) } : l)) })),
      inc: (key, delta) =>
        patch((s) => ({
          ...s,
          lines: s.lines.map((l) => (l.key === key ? { ...l, quantity: clampQty(l.quantity + delta) } : l)),
        })),
      remove: (key) => patch((s) => ({ ...s, lines: s.lines.filter((l) => l.key !== key) })),
      setLineNotes: (key, notes) =>
        patch((s) => ({ ...s, lines: s.lines.map((l) => (l.key === key ? { ...l, notes: notes.slice(0, 300) } : l)) })),
      setOrderNotes: (v) => patch((s) => ({ ...s, orderNotes: v.slice(0, 500) })),
      setCustomer: (id) => patch((s) => ({ ...s, customerId: id })),
      setGuestCount: (v) => patch((s) => ({ ...s, guestCount: v.replace(/\D/g, '').slice(0, 2) })),
      setOrderType: (t) => patch((s) => ({ ...s, orderType: t, tableId: t === 'dine_in' ? s.tableId : null })),
      setDiscount: (amount, reason) =>
        patch((s) => ({
          ...s,
          discount: amount.replace(/[^0-9.]/g, '').slice(0, 10),
          discountReason: reason ?? s.discountReason,
        })),
      refreshPrices: (products) => {
        // Compute synchronously from the current state (updaters run lazily).
        const changed = state.lines
          .filter((l) => {
            const p = products.find((x) => x.id === l.product_id);
            return p && Number(p.price) !== l.unit_price;
          })
          .map((l) => products.find((x) => x.id === l.product_id)!.name);
        if (changed.length) {
          patch((s) => ({
            ...s,
            lines: s.lines.map((l) => {
              const p = products.find((x) => x.id === l.product_id);
              return p
                ? { ...l, unit_price: Number(p.price), name: p.name, tax_exempt: p.tax_category === 'exempt' }
                : l;
            }),
          }));
        }
        return changed;
      },
      clear: (keepTable = false) => patch((s) => ({ ...empty(), tableId: keepTable ? s.tableId : null })),
    }),
    [state, patch],
  );
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useCart(): CartApi {
  const c = useContext(Ctx);
  if (!c) throw new Error('useCart must be used inside CartProvider');
  return c;
}
