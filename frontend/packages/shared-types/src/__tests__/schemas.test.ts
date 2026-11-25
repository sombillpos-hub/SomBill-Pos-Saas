import { describe, expect, it } from 'vitest';
import {
  categorySchema,
  customerSchema,
  expenseSchema,
  inventoryItemSchema,
  nullIfEmpty,
  passwordSchema,
  productSchema,
  purchaseOrderSchema,
  refundSchema,
  restaurantSchema,
  sanitizeText,
  staffSchema,
  stockOperationSchema,
  tableSchema,
} from '../schemas';

const product = {
  name: 'Bariis',
  description: '',
  sku: 'P-1',
  barcode: '',
  category_id: '',
  price: 12,
  cost_price: '' as const,
  tax_category: 'standard' as const,
  is_available: true,
  track_stock: false,
  inventory_item_id: '',
  preparation_station: 'kitchen' as const,
};
const errs = (r: { success: boolean; error?: { issues: Array<{ path: (string | number)[]; message: string }> } }) =>
  r.success ? [] : r.error!.issues.map((i) => i.path.join('.'));

describe('input validation', () => {
  it('sanitises text', () => {
    expect(sanitizeText('  Hilib\u0000 ari \u0007 ')).toBe('Hilib ari');
    expect(nullIfEmpty('   ')).toBeNull();
  });
  it('products', () => {
    expect(productSchema.safeParse(product).success).toBe(true);
    expect(errs(productSchema.safeParse({ ...product, price: -1 }))).toContain('price');
    expect(errs(productSchema.safeParse({ ...product, price: 1.234 }))).toContain('price');
    expect(errs(productSchema.safeParse({ ...product, sku: 'bad sku!' }))).toContain('sku');
    expect(errs(productSchema.safeParse({ ...product, name: '   ' }))).toContain('name');
    expect(productSchema.parse({ ...product, price: '7.50' as unknown as number }).price).toBe(7.5);
  });
  it('categories and tables', () => {
    expect(errs(categorySchema.safeParse({ name: '', description: '', display_order: 1, is_active: true }))).toContain(
      'name',
    );
    expect(
      errs(categorySchema.safeParse({ name: 'A', description: '', display_order: 1.5, is_active: true })),
    ).toContain('display_order');
    const t = {
      table_number: 1,
      name: '',
      capacity: 4,
      section: 'Main',
      floor: 'Ground',
      shape: 'square' as const,
      pos_x: 0,
      pos_y: 0,
    };
    expect(tableSchema.safeParse(t).success).toBe(true);
    expect(errs(tableSchema.safeParse({ ...t, table_number: 0, capacity: 51, pos_x: 12 }))).toEqual(
      expect.arrayContaining(['table_number', 'capacity', 'pos_x']),
    );
  });
  it('customers validate phone and email', () => {
    const c = { name: 'Hodan Ali', phone: '+252 63 4123456', email: 'hodan@example.com', address: '', notes: '' };
    expect(customerSchema.safeParse(c).success).toBe(true);
    expect(customerSchema.safeParse({ ...c, phone: '', email: '' }).success).toBe(true);
    expect(errs(customerSchema.safeParse({ ...c, phone: 'abc', email: 'not-email' }))).toEqual(['phone', 'email']);
  });
  it('inventory and stock operations', () => {
    const i = {
      name: 'Rice',
      sku: '',
      category: '',
      unit: 'kg',
      quantity: 0,
      unit_cost: 1,
      min_stock: 0,
      supplier_id: '',
      expiry_date: '',
      location: '',
    };
    expect(inventoryItemSchema.safeParse(i).success).toBe(true);
    expect(errs(inventoryItemSchema.safeParse({ ...i, quantity: -1 }))).toContain('quantity');
    const op = { type: 'wastage' as const, quantity: 1, unit_cost: '' as const, reason: 'Spoiled', target_item_id: '' };
    expect(stockOperationSchema.safeParse(op).success).toBe(true);
    expect(errs(stockOperationSchema.safeParse({ ...op, quantity: -1 }))).toContain('quantity');
    expect(stockOperationSchema.safeParse({ ...op, type: 'adjustment', quantity: -1 }).success).toBe(true);
    expect(errs(stockOperationSchema.safeParse({ ...op, quantity: 0 }))).toContain('quantity');
    expect(errs(stockOperationSchema.safeParse({ ...op, type: 'transfer' }))).toContain('target_item_id');
    expect(errs(stockOperationSchema.safeParse({ ...op, reason: 'x' }))).toContain('reason');
  });
  it('purchase orders reject duplicate and empty lines', () => {
    const line = { inventory_item_id: 'a', quantity_ordered: 1, unit_cost: 2 };
    expect(
      purchaseOrderSchema.safeParse({ supplier_id: 's', expected_date: '', notes: '', lines: [line] }).success,
    ).toBe(true);
    expect(errs(purchaseOrderSchema.safeParse({ supplier_id: '', expected_date: '', notes: '', lines: [] }))).toEqual([
      'supplier_id',
      'lines',
    ]);
    expect(
      errs(purchaseOrderSchema.safeParse({ supplier_id: 's', expected_date: '', notes: '', lines: [line, line] })),
    ).toContain('lines.1.inventory_item_id');
    expect(
      errs(
        purchaseOrderSchema.safeParse({
          supplier_id: 's',
          expected_date: '',
          notes: '',
          lines: [{ ...line, quantity_ordered: 0 }],
        }),
      ),
    ).toContain('lines.0.quantity_ordered');
  });
  it('expenses, refunds, staff, restaurant, passwords', () => {
    const e = {
      category: 'Rent',
      description: 'November',
      amount: 100,
      payment_method: 'cash' as const,
      expense_date: '2026-11-01',
      reference_number: '',
      supplier_id: '',
    };
    expect(expenseSchema.safeParse(e).success).toBe(true);
    expect(errs(expenseSchema.safeParse({ ...e, amount: 0, expense_date: '' }))).toEqual(['amount', 'expense_date']);
    expect(errs(refundSchema.safeParse({ amount: 0, method: 'cash', reason: 'ab', restock: false }))).toEqual([
      'amount',
      'reason',
    ]);
    expect(errs(staffSchema.safeParse({ full_name: 'A', email: 'x', phone: '', role: 'chef' }))).toEqual([
      'full_name',
      'email',
      'role',
    ]);
    const rest = {
      name: 'Grill',
      address: '',
      phone: '',
      email: '',
      currency: 'usd',
      timezone: 'Africa/Mogadishu',
      tax_rate_percent: 5,
      tax_inclusive: false,
      tax_label: 'VAT',
      receipt_header: '',
      receipt_footer: '',
    };
    expect(restaurantSchema.parse(rest).currency).toBe('USD');
    expect(
      errs(restaurantSchema.safeParse({ ...rest, currency: 'DOLLAR', timezone: 'Mars/Base', tax_rate_percent: 100 })),
    ).toEqual(['currency', 'timezone', 'tax_rate_percent']);
    expect(passwordSchema.safeParse({ password: 'short1', confirm: 'short1' }).success).toBe(false);
    expect(errs(passwordSchema.safeParse({ password: 'longenough123', confirm: 'different123' }))).toEqual(['confirm']);
    expect(passwordSchema.safeParse({ password: 'longenough123', confirm: 'longenough123' }).success).toBe(true);
  });
});
