import { beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { CartProvider, useCart } from '@sombill/shared-hooks/cart';
import type { Product } from '@sombill/shared-types/types';

const p = (o: Partial<Product>): Product => ({
  id: 'p1',
  restaurant_id: 'r',
  category_id: null,
  name: 'Bariis',
  description: null,
  sku: null,
  barcode: null,
  image_url: null,
  price: 12,
  cost_price: null,
  tax_category: 'standard',
  is_available: true,
  track_stock: false,
  inventory_item_id: null,
  preparation_station: 'kitchen',
  archived_at: null,
  created_at: '',
  updated_at: '',
  ...o,
});
const wrapper = ({ children }: { children: ReactNode }) => <CartProvider>{children}</CartProvider>;

describe('waiter cart', () => {
  beforeEach(() => sessionStorage.clear());

  it('adds, merges, changes quantity, notes and removes lines', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => {
      result.current.addProduct(p({}));
    });
    act(() => {
      result.current.addProduct(p({}));
    });
    act(() => {
      result.current.addProduct(p({ id: 'p2', name: 'Shaah', price: 1.5, tax_category: 'exempt' }));
    });
    expect(result.current.lines.map((l) => [l.name, l.quantity])).toEqual([
      ['Bariis', 2],
      ['Shaah', 1],
    ]);
    expect(result.current.lines[1]!.tax_exempt).toBe(true);
    const k = result.current.lines[0]!.key;
    act(() => {
      result.current.inc(k, 3);
    });
    expect(result.current.lines[0]!.quantity).toBe(5);
    act(() => {
      result.current.inc(k, -10);
    });
    expect(result.current.lines[0]!.quantity).toBe(1);
    act(() => {
      result.current.setQty(k, 5000);
    });
    expect(result.current.lines[0]!.quantity).toBe(999);
    act(() => {
      result.current.setLineNotes(k, 'No onions');
    });
    expect(result.current.lines[0]!.notes).toBe('No onions');
    act(() => {
      result.current.remove(k);
    });
    expect(result.current.lines.map((l) => l.name)).toEqual(['Shaah']);
    expect(result.current.itemCount).toBe(1);
  });

  it('never adds unavailable or archived products', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => {
      result.current.addProduct(p({ is_available: false }));
      result.current.addProduct(p({ id: 'x', archived_at: '2026-01-01' }));
    });
    expect(result.current.lines).toHaveLength(0);
  });

  it('keeps one idempotency key per draft and renews it after clearing', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    const key = result.current.idempotencyKey;
    act(() => {
      result.current.addProduct(p({}));
      result.current.setTable('t4');
      result.current.setOrderNotes('Allergy: nuts');
    });
    expect(result.current.idempotencyKey).toBe(key);
    act(() => {
      result.current.clear();
    });
    expect(result.current.idempotencyKey).not.toBe(key);
    expect(result.current.tableId).toBeNull();
  });

  it('refreshes prices from the server and reports what changed', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => {
      result.current.addProduct(p({}));
    });
    let changed: string[] = [];
    act(() => {
      changed = result.current.refreshPrices([p({ price: 13.5 })]);
    });
    expect(changed).toEqual(['Bariis']);
    expect(result.current.lines[0]!.unit_price).toBe(13.5);
  });

  it('locks the table while adding to an existing order and survives reloads', () => {
    const { result, unmount } = renderHook(() => useCart(), { wrapper });
    act(() => {
      result.current.startExistingOrder('o1', 't4');
    });
    act(() => {
      result.current.setTable('t9');
    });
    expect(result.current.tableId).toBe('t4');
    act(() => {
      result.current.addProduct(p({}));
    });
    unmount();
    const again = renderHook(() => useCart(), { wrapper });
    expect(again.result.current.existingOrderId).toBe('o1');
    expect(again.result.current.lines).toHaveLength(1);
  });
});
