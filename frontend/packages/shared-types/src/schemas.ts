import { z } from 'zod';

// Input validation shared by every manager form. The database enforces the
// same rules (constraints/triggers) so a bypassed client still fails safely.

export const PAYMENT_METHODS = [
  'cash',
  'card',
  'evc_plus',
  'zaad',
  'somtel_money',
  'mobile_money',
  'bank_transfer',
  'credit',
  'other',
] as const;

export const PHONE_RE = /^\+?[0-9 ()-]{6,20}$/;
const SKU_RE = /^[A-Za-z0-9._-]{1,40}$/;

/** Strips control characters and trims; keeps normal punctuation. */
export function sanitizeText(v: string): string {
  // eslint-disable-next-line no-control-regex
  return v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
}

export function nullIfEmpty(v: string | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  const s = sanitizeText(v);
  return s === '' ? null : s;
}

const text = (min: number, max: number, label: string) =>
  z
    .string()
    .transform(sanitizeText)
    .pipe(
      z
        .string()
        .min(min, `${label} must be at least ${min} character${min === 1 ? '' : 's'}`)
        .max(max, `${label} must be at most ${max} characters`),
    );
const optText = (max: number) => z.string().max(max, `Must be at most ${max} characters`);
const optPhone = z
  .string()
  .refine((v) => v.trim() === '' || PHONE_RE.test(v.trim()), 'Enter a valid phone number, e.g. +252 63 4123456');
const optEmail = z
  .string()
  .refine((v) => v.trim() === '' || z.string().email().safeParse(v.trim()).success, 'Enter a valid email address');
const money = (label: string) =>
  z.coerce
    .number({ invalid_type_error: `${label} must be a number` })
    .min(0, `${label} cannot be negative`)
    .max(10_000_000, `${label} is too large`)
    .refine(
      (n) => Math.round(n * 100) === n * 100 || Math.abs(Math.round(n * 100) - n * 100) < 1e-6,
      `${label} can have at most 2 decimals`,
    );

export const productSchema = z.object({
  name: text(1, 120, 'Name'),
  description: optText(1000),
  sku: z
    .string()
    .refine(
      (v) => v.trim() === '' || SKU_RE.test(v.trim()),
      'SKU may only contain letters, numbers, dot, dash and underscore',
    ),
  barcode: z.string().refine((v) => v.trim() === '' || /^[0-9A-Za-z-]{4,64}$/.test(v.trim()), 'Barcode is invalid'),
  category_id: z.string(),
  price: money('Selling price'),
  cost_price: z.union([z.literal(''), money('Cost price')]),
  tax_category: z.enum(['standard', 'exempt']),
  is_available: z.boolean(),
  track_stock: z.boolean(),
  inventory_item_id: z.string(),
  preparation_station: z.enum(['kitchen', 'bar', 'grill', 'bakery', 'none']),
});
export type ProductForm = z.input<typeof productSchema>;

export const categorySchema = z.object({
  name: text(1, 80, 'Name'),
  description: optText(500),
  display_order: z.coerce.number().int('Must be a whole number').min(0).max(9999),
  is_active: z.boolean(),
});
export type CategoryForm = z.input<typeof categorySchema>;

export const tableSchema = z.object({
  table_number: z.coerce
    .number({ invalid_type_error: 'Table number is required' })
    .int()
    .min(1, 'Must be 1 or more')
    .max(9999),
  name: optText(60),
  capacity: z.coerce.number().int().min(1, 'At least 1 seat').max(50, 'At most 50 seats'),
  section: text(1, 40, 'Section'),
  floor: text(1, 40, 'Floor'),
  shape: z.enum(['square', 'round', 'rect']),
  pos_x: z.coerce.number().int().min(0).max(11),
  pos_y: z.coerce.number().int().min(0).max(11),
});
export type TableForm = z.input<typeof tableSchema>;

export const customerSchema = z.object({
  name: text(2, 120, 'Name'),
  phone: optPhone,
  email: optEmail,
  address: optText(300),
  notes: optText(1000),
});
export type CustomerForm = z.input<typeof customerSchema>;

export const supplierSchema = z.object({
  name: text(2, 120, 'Name'),
  contact_person: optText(120),
  phone: optPhone,
  email: optEmail,
  address: optText(300),
  notes: optText(1000),
  is_active: z.boolean(),
});
export type SupplierForm = z.input<typeof supplierSchema>;

export const inventoryItemSchema = z.object({
  name: text(1, 120, 'Name'),
  sku: z
    .string()
    .refine(
      (v) => v.trim() === '' || SKU_RE.test(v.trim()),
      'SKU may only contain letters, numbers, dot, dash and underscore',
    ),
  category: optText(60),
  unit: text(1, 16, 'Unit'),
  quantity: z.coerce.number().min(0, 'Opening stock cannot be negative').max(1e9),
  unit_cost: z.coerce.number().min(0, 'Cost cannot be negative').max(1e7),
  min_stock: z.coerce.number().min(0, 'Minimum cannot be negative').max(1e9),
  supplier_id: z.string(),
  expiry_date: z.string().refine((v) => v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v), 'Invalid date'),
  location: optText(60),
});
export type InventoryItemForm = z.input<typeof inventoryItemSchema>;

export const stockOperationSchema = z
  .object({
    type: z.enum(['receive', 'adjustment', 'wastage', 'transfer']),
    quantity: z.coerce
      .number({ invalid_type_error: 'Enter a quantity' })
      .refine((n) => n !== 0, 'Quantity cannot be zero'),
    unit_cost: z.union([z.literal(''), z.coerce.number().min(0)]),
    reason: text(3, 300, 'Reason'),
    target_item_id: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.type !== 'adjustment' && v.quantity < 0)
      ctx.addIssue({ code: 'custom', path: ['quantity'], message: 'Quantity must be positive' });
    if (v.type === 'transfer' && !v.target_item_id)
      ctx.addIssue({ code: 'custom', path: ['target_item_id'], message: 'Choose the destination item' });
  });
export type StockOperationForm = z.input<typeof stockOperationSchema>;

export const purchaseOrderSchema = z.object({
  supplier_id: z.string().min(1, 'Choose a supplier'),
  expected_date: z.string(),
  notes: optText(1000),
  lines: z
    .array(
      z.object({
        inventory_item_id: z.string().min(1, 'Choose an item'),
        quantity_ordered: z.coerce.number().positive('Quantity must be positive').max(1e7),
        unit_cost: z.coerce.number().min(0, 'Cost cannot be negative').max(1e7),
      }),
    )
    .min(1, 'Add at least one line')
    .superRefine((lines, ctx) => {
      const seen = new Set<string>();
      lines.forEach((l, i) => {
        if (l.inventory_item_id && seen.has(l.inventory_item_id)) {
          ctx.addIssue({ code: 'custom', path: [i, 'inventory_item_id'], message: 'Item already added' });
        }
        seen.add(l.inventory_item_id);
      });
    }),
});
export type PurchaseOrderForm = z.input<typeof purchaseOrderSchema>;

export const expenseSchema = z.object({
  category: text(2, 60, 'Category'),
  description: text(2, 500, 'Description'),
  amount: money('Amount').refine((n) => n > 0, 'Amount must be greater than zero'),
  payment_method: z.enum(PAYMENT_METHODS),
  expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date'),
  reference_number: optText(60),
  supplier_id: z.string(),
});
export type ExpenseForm = z.input<typeof expenseSchema>;

export const staffSchema = z.object({
  full_name: text(2, 120, 'Full name'),
  email: z.string().trim().email('Enter a valid email address').max(254),
  phone: optPhone,
  role: z.enum(['manager', 'cashier', 'waiter', 'kitchen']),
});
export type StaffForm = z.input<typeof staffSchema>;

export const restaurantSchema = z.object({
  name: text(2, 120, 'Restaurant name'),
  address: optText(300),
  phone: optPhone,
  email: optEmail,
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, 'Use a 3-letter ISO currency code, e.g. USD'),
  timezone: z.string().refine((tz) => {
    try {
      new Intl.DateTimeFormat('en', { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, 'Unknown time zone'),
  tax_rate_percent: z.coerce.number().min(0, 'Cannot be negative').max(99.99, 'Must be below 100%'),
  tax_inclusive: z.boolean(),
  tax_label: text(1, 20, 'Tax label'),
  receipt_header: optText(300),
  receipt_footer: optText(300),
});
export type RestaurantForm = z.input<typeof restaurantSchema>;

export const reasonSchema = z.object({ reason: text(3, 500, 'Reason') });

export const refundSchema = z.object({
  amount: money('Amount').refine((n) => n > 0, 'Amount must be greater than zero'),
  method: z.enum(PAYMENT_METHODS),
  reason: text(3, 500, 'Reason'),
  restock: z.boolean(),
});
export type RefundForm = z.input<typeof refundSchema>;

export const passwordSchema = z
  .object({
    password: z
      .string()
      .min(10, 'Use at least 10 characters')
      .regex(/[A-Za-z]/, 'Include a letter')
      .regex(/[0-9]/, 'Include a number'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });

export const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});
