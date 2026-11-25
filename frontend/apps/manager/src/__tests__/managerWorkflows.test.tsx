import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { authState } from '@sombill/shared-utils/testing/mockAuth';
import { renderWithProviders } from '@sombill/shared-utils/testing/render';
import { db, resetDb, supabaseMock } from '@sombill/shared-utils/testing/mockSupabase';
import { RID } from '@sombill/shared-utils/testing/fixtures';

vi.mock('@sombill/api-client/supabase', async (orig) => ({
  ...(await orig<typeof import('@sombill/api-client/supabase')>()),
  supabase: (await import('@sombill/shared-utils/testing/mockSupabase')).supabaseMock,
}));
vi.mock(
  '@sombill/shared-hooks/AuthContext',
  async () => (await import('@sombill/shared-utils/testing/mockAuth')).authModule,
);

const CategoriesPage = (await import('@sombill/manager/pages/categories/CategoriesPage')).default;
const ProductsPage = (await import('@sombill/manager/pages/menu/ProductsPage')).default;
const TablesPage = (await import('@sombill/manager/pages/tables/TablesPage')).default;
const CustomersPage = (await import('@sombill/manager/pages/customers/CustomersPage')).default;
const InventoryPage = (await import('@sombill/manager/pages/inventory/InventoryPage')).default;
const SuppliersPage = (await import('@sombill/manager/pages/suppliers/SuppliersPage')).default;
const PurchaseOrderDetailPage = (await import('@sombill/manager/pages/purchase-orders/PurchaseOrderDetailPage'))
  .default;
const ExpensesPage = (await import('@sombill/manager/pages/expenses/ExpensesPage')).default;
const StaffPage = (await import('@sombill/manager/pages/staff/StaffPage')).default;
const OrderDetailPage = (await import('@sombill/manager/pages/orders/OrderDetailPage')).default;
const ReportsPage = (await import('@sombill/manager/pages/reports/ReportsPage')).default;
const { useRealtime } = await import('@sombill/shared-hooks/useRealtime');

const user = () => userEvent.setup();
const inserts = (table: string) =>
  db.calls.filter((c) => c.table === table && (c.op === 'insert' || c.op === 'upsert'));
const updates = (table: string) => db.calls.filter((c) => c.table === table && c.op === 'update');
const ts = { created_at: '2026-11-20T08:00:00Z', updated_at: '2026-11-20T08:00:00Z', archived_at: null };

beforeEach(() => {
  resetDb();
  authState.access = 'member';
  authState.role = 'manager';
});

describe('Category CRUD', () => {
  it('validates, prevents duplicates and creates', async () => {
    db.tables.categories = [
      {
        id: 'c1',
        restaurant_id: RID,
        name: 'Mains',
        description: null,
        image_url: null,
        display_order: 1,
        is_active: true,
        ...ts,
      },
    ];
    const u = user();
    renderWithProviders(<CategoriesPage />);
    await screen.findByText('Mains');
    await u.click(screen.getByRole('button', { name: 'New category' }));
    const dialog = screen.getByRole('dialog');
    await u.clear(within(dialog).getByLabelText(/Name/));
    await u.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await within(dialog).findByText(/Name must be at least 1/)).toBeInTheDocument();
    await u.type(within(dialog).getByLabelText(/Name/), '  mains ');
    await u.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await within(dialog).findByText('A category with this name already exists')).toBeInTheDocument();
    expect(inserts('categories')).toHaveLength(0);
    await u.clear(within(dialog).getByLabelText(/Name/));
    await u.type(within(dialog).getByLabelText(/Name/), '  Drinks ');
    await u.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(inserts('categories')).toHaveLength(1));
    expect(inserts('categories')[0]!.payload).toMatchObject({
      name: 'Drinks',
      restaurant_id: RID,
      display_order: 2,
      is_active: true,
    });
  });
  it('edits and archives', async () => {
    db.tables.categories = [
      {
        id: 'c1',
        restaurant_id: RID,
        name: 'Mains',
        description: null,
        image_url: null,
        display_order: 1,
        is_active: true,
        ...ts,
      },
    ];
    const u = user();
    renderWithProviders(<CategoriesPage />);
    await screen.findByText('Mains');
    await u.click(screen.getByRole('button', { name: 'Edit' }));
    const dialog = screen.getByRole('dialog');
    await u.clear(within(dialog).getByLabelText(/Name/));
    await u.type(within(dialog).getByLabelText(/Name/), 'Main dishes');
    await u.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(updates('categories')[0]?.payload).toMatchObject({ name: 'Main dishes' }));
    await u.click(await screen.findByRole('button', { name: 'Archive' }));
    await u.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Archive' }));
    await waitFor(() => expect(updates('categories').at(-1)?.payload).toHaveProperty('archived_at'));
    expect((updates('categories').at(-1)!.payload as { archived_at: string | null }).archived_at).not.toBeNull();
  });
});

describe('Product CRUD', () => {
  const product = {
    id: 'p1',
    restaurant_id: RID,
    category_id: null,
    name: 'Bariis',
    description: null,
    sku: 'P-001',
    barcode: null,
    image_url: null,
    price: 12,
    cost_price: 5,
    tax_category: 'standard',
    is_available: true,
    track_stock: false,
    inventory_item_id: null,
    preparation_station: 'kitchen',
    ...ts,
  };
  it('blocks duplicate SKU and creates a valid product', async () => {
    db.tables.products = [product];
    const u = user();
    renderWithProviders(<ProductsPage />);
    await screen.findByText('Bariis');
    await u.click(screen.getByRole('button', { name: 'New product' }));
    const d = screen.getByRole('dialog');
    await u.type(within(d).getByLabelText(/Product name/), 'Shaah');
    await u.clear(within(d).getByLabelText(/Selling price/));
    await u.type(within(d).getByLabelText(/Selling price/), '1.5');
    await u.type(within(d).getByLabelText('SKU'), 'p-001');
    await u.click(within(d).getByRole('button', { name: 'Create product' }));
    expect(await within(d).findByText('Another product already uses this SKU')).toBeInTheDocument();
    await u.clear(within(d).getByLabelText('SKU'));
    await u.type(within(d).getByLabelText('SKU'), 'DRK-1');
    await u.click(within(d).getByRole('button', { name: 'Create product' }));
    await waitFor(() => expect(inserts('products')).toHaveLength(1));
    expect(inserts('products')[0]!.payload).toMatchObject({
      name: 'Shaah',
      sku: 'DRK-1',
      price: 1.5,
      cost_price: null,
      restaurant_id: RID,
      is_available: true,
    });
  });
  it('archives instead of deleting', async () => {
    db.tables.products = [{ ...product }];
    const u = user();
    renderWithProviders(<ProductsPage />);
    await screen.findByText('Bariis');
    await u.click(screen.getByRole('button', { name: 'Archive' }));
    await u.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Archive' }));
    await waitFor(() => expect(updates('products').at(-1)?.payload).toHaveProperty('archived_at'));
    expect((updates('products').at(-1)!.payload as { archived_at: string | null }).archived_at).not.toBeNull();
    expect(db.calls.some((c) => c.table === 'products' && c.op === 'delete')).toBe(false);
  });
  it('toggles POS availability', async () => {
    db.tables.products = [{ ...product }];
    const u = user();
    renderWithProviders(<ProductsPage />);
    await screen.findByText('Bariis');
    await u.click(screen.getByTitle('Toggle availability'));
    await waitFor(() => expect(updates('products')[0]?.payload).toEqual({ is_available: false }));
  });
});

describe('Table CRUD', () => {
  it('rejects a duplicate table number and creates a new table', async () => {
    db.tables.restaurant_tables = [
      {
        id: 't1',
        restaurant_id: RID,
        table_number: 1,
        name: null,
        capacity: 4,
        section: 'Main',
        floor: 'Ground',
        pos_x: 0,
        pos_y: 0,
        shape: 'square',
        needs_cleaning: false,
        ...ts,
      },
    ];
    const u = user();
    renderWithProviders(<TablesPage />);
    await u.click(await screen.findByRole('button', { name: 'New table' }));
    const d = screen.getByRole('dialog');
    await u.clear(within(d).getByLabelText(/Table number/));
    await u.type(within(d).getByLabelText(/Table number/), '1');
    await u.click(within(d).getByRole('button', { name: 'Save' }));
    expect(await within(d).findByText('Table number already in use')).toBeInTheDocument();
    await u.clear(within(d).getByLabelText(/Table number/));
    await u.type(within(d).getByLabelText(/Table number/), '7');
    await u.click(within(d).getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(inserts('restaurant_tables')[0]?.payload).toMatchObject({
        table_number: 7,
        capacity: 4,
        restaurant_id: RID,
      }),
    );
  });
});

describe('Customer CRUD', () => {
  it('validates phone/email and saves', async () => {
    const u = user();
    renderWithProviders(<CustomersPage />);
    await u.click(await screen.findByRole('button', { name: 'New customer' }));
    const d = screen.getByRole('dialog');
    await u.type(within(d).getByLabelText(/^Name/), 'Hodan Ali');
    await u.type(within(d).getByLabelText('Phone'), 'abc');
    await u.type(within(d).getByLabelText('Email'), 'nope');
    await u.click(within(d).getByRole('button', { name: 'Save' }));
    expect(await within(d).findByText(/valid phone/)).toBeInTheDocument();
    expect(within(d).getByText('Enter a valid email address')).toBeInTheDocument();
    await u.clear(within(d).getByLabelText('Phone'));
    await u.type(within(d).getByLabelText('Phone'), '+252 63 4123456');
    await u.clear(within(d).getByLabelText('Email'));
    await u.type(within(d).getByLabelText('Email'), 'Hodan@Example.com');
    await u.click(within(d).getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(inserts('customers')[0]?.payload).toMatchObject({
        name: 'Hodan Ali',
        phone: '+252 63 4123456',
        email: 'hodan@example.com',
        restaurant_id: RID,
      }),
    );
  });
});

describe('Inventory operations', () => {
  const rice = {
    id: 'i1',
    restaurant_id: RID,
    name: 'Rice',
    sku: null,
    category: 'Dry',
    unit: 'kg',
    quantity: 10,
    unit_cost: 1.5,
    min_stock: 12,
    supplier_id: null,
    expiry_date: null,
    location: null,
    ...ts,
  };
  it('flags low stock, prevents negative wastage and records movements via RPC', async () => {
    db.tables.inventory_items = [rice];
    supabaseMock.rpc.mockResolvedValue({ data: 8, error: null });
    const u = user();
    renderWithProviders(<InventoryPage />);
    await screen.findByText('Rice');
    expect(screen.getByLabelText('Low stock')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Stock operation' }));
    const d = screen.getByRole('dialog');
    await u.selectOptions(within(d).getByLabelText('Operation'), 'wastage');
    await u.clear(within(d).getByLabelText(/Quantity/));
    await u.type(within(d).getByLabelText(/Quantity/), '20');
    await u.type(within(d).getByLabelText('Reason'), 'Flood');
    await u.click(within(d).getByRole('button', { name: 'Record movement' }));
    expect(await within(d).findByText('Only 10 kg on hand')).toBeInTheDocument();
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
    await u.clear(within(d).getByLabelText(/Quantity/));
    await u.type(within(d).getByLabelText(/Quantity/), '2');
    await u.click(within(d).getByRole('button', { name: 'Record movement' }));
    await waitFor(() =>
      expect(supabaseMock.rpc).toHaveBeenCalledWith('adjust_stock', {
        p_item: 'i1',
        p_type: 'wastage',
        p_quantity: 2,
        p_reason: 'Flood',
        p_unit_cost: null,
      }),
    );
    expect(updates('inventory_items')).toHaveLength(0); // never edits quantity directly
  });
  it('creates items with opening stock (recorded server-side as a movement)', async () => {
    const u = user();
    renderWithProviders(<InventoryPage />);
    await u.click(await screen.findByRole('button', { name: 'New item' }));
    const d = screen.getByRole('dialog');
    await u.type(within(d).getByLabelText(/Ingredient/), 'Goat meat');
    await u.clear(within(d).getByLabelText('Opening quantity'));
    await u.type(within(d).getByLabelText('Opening quantity'), '5');
    await u.click(within(d).getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(inserts('inventory_items')[0]?.payload).toMatchObject({
        name: 'Goat meat',
        quantity: 5,
        unit: 'kg',
        restaurant_id: RID,
      }),
    );
  });
});

describe('Supplier operations', () => {
  it('creates a supplier', async () => {
    const u = user();
    renderWithProviders(<SuppliersPage />);
    await u.click(await screen.findByRole('button', { name: 'New supplier' }));
    const d = screen.getByRole('dialog');
    await u.type(within(d).getByLabelText(/Supplier name/), 'Berbera Wholesale');
    await u.type(within(d).getByLabelText('Phone'), '+252634000000');
    await u.click(within(d).getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(inserts('suppliers')[0]?.payload).toMatchObject({
        name: 'Berbera Wholesale',
        phone: '+252634000000',
        is_active: true,
        restaurant_id: RID,
      }),
    );
  });
});

describe('Purchase order receiving', () => {
  it('validates quantities and reuses one idempotency key across retries', async () => {
    db.tables.purchase_orders = [
      {
        id: 'po1',
        restaurant_id: RID,
        po_number: 3,
        supplier_id: 's1',
        status: 'ordered',
        expected_date: null,
        notes: null,
        subtotal: 90,
        total: 90,
        amount_paid: 0,
        ordered_at: null,
        received_at: null,
        created_by: null,
        created_at: ts.created_at,
        updated_at: ts.updated_at,
      },
    ];
    db.tables.purchase_order_items = [
      {
        id: 'l1',
        restaurant_id: RID,
        purchase_order_id: 'po1',
        inventory_item_id: 'i1',
        quantity_ordered: 10,
        quantity_received: 4,
        unit_cost: 9,
        line_total: 90,
      },
    ];
    db.tables.inventory_items = [
      { id: 'i1', restaurant_id: RID, name: 'Goat meat', unit: 'kg', quantity: 1, unit_cost: 8, min_stock: 0, ...ts },
    ];
    db.tables.suppliers = [{ id: 's1', restaurant_id: RID, name: 'Berbera Wholesale', is_active: true, ...ts }];
    supabaseMock.rpc
      .mockResolvedValueOnce({ data: null, error: { message: 'Failed to fetch' } })
      .mockResolvedValue({ data: { status: 'received', po_status: 'received' }, error: null });
    const u = user();
    renderWithProviders(
      <Routes>
        <Route path="/purchase-orders/:id" element={<PurchaseOrderDetailPage />} />
      </Routes>,
      '/purchase-orders/po1',
    );
    await u.click(await screen.findByRole('button', { name: 'Receive stock' }));
    const d = screen.getByRole('dialog');
    const qty = within(d).getByLabelText(/Receive quantity/);
    expect(qty).toHaveValue(6);
    await u.clear(qty);
    await u.type(qty, '7');
    await u.click(within(d).getByRole('button', { name: 'Confirm receipt' }));
    expect(await within(d).findByText(/only 6 outstanding/)).toBeInTheDocument();
    await u.clear(qty);
    await u.type(qty, '6');
    await u.click(within(d).getByRole('button', { name: 'Confirm receipt' }));
    expect(await within(d).findByText(/Network error/)).toBeInTheDocument();
    await u.click(within(d).getByRole('button', { name: 'Confirm receipt' }));
    await waitFor(() => expect(supabaseMock.rpc).toHaveBeenCalledTimes(2));
    const [first, second] = supabaseMock.rpc.mock.calls as Array<
      [string, { p_idempotency_key: string; p_lines: unknown }]
    >;
    expect(first![0]).toBe('receive_purchase_order');
    expect(first![1].p_lines).toEqual([{ line_id: 'l1', quantity: 6 }]);
    expect(second![1].p_idempotency_key).toBe(first![1].p_idempotency_key);
  });
});

describe('Expense management', () => {
  it('rejects future dates and records an expense separately from sales', async () => {
    const u = user();
    renderWithProviders(<ExpensesPage />);
    await u.click(await screen.findByRole('button', { name: 'New expense' }));
    const d = screen.getByRole('dialog');
    await u.type(within(d).getByLabelText(/Category/), 'Utilities');
    await u.type(within(d).getByLabelText(/Amount/), '85');
    await u.type(within(d).getByLabelText(/Description/), 'Electricity November');
    const date = within(d).getByLabelText('Date');
    await u.clear(date);
    await u.type(date, '2099-01-01');
    await u.click(within(d).getByRole('button', { name: 'Save' }));
    expect(await within(d).findByText('Expense date cannot be in the future.')).toBeInTheDocument();
    await u.clear(date);
    await u.type(date, '2026-11-01');
    await u.click(within(d).getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(inserts('expenses')[0]?.payload).toMatchObject({
        category: 'Utilities',
        amount: 85,
        expense_date: '2026-11-01',
        restaurant_id: RID,
      }),
    );
    expect(db.calls.some((c) => c.table === 'payments' && c.op !== 'select')).toBe(false);
  });
});

describe('Staff account creation', () => {
  it('provisions through the edge function and never sends a password', async () => {
    supabaseMock.functions.invoke.mockResolvedValue({ data: { invited: true }, error: null });
    const u = user();
    renderWithProviders(<StaffPage />);
    await u.click(await screen.findByRole('button', { name: 'Add staff' }));
    const d = screen.getByRole('dialog');
    await u.type(within(d).getByLabelText(/Full name/), 'Nimco Cashier');
    await u.type(within(d).getByLabelText(/Email/), 'nimco@grill.test');
    await u.selectOptions(within(d).getByLabelText('Role'), 'cashier');
    await u.click(within(d).getByRole('button', { name: 'Send invitation' }));
    await waitFor(() => expect(supabaseMock.functions.invoke).toHaveBeenCalledTimes(1));
    const [fn, opts] = supabaseMock.functions.invoke.mock.calls[0] as [string, { body: Record<string, unknown> }];
    expect(fn).toBe('manage-staff');
    expect(opts.body).toMatchObject({
      action: 'create',
      restaurant_id: RID,
      email: 'nimco@grill.test',
      full_name: 'Nimco Cashier',
      role: 'cashier',
    });
    expect(Object.keys(opts.body)).not.toContain('password');
    expect(db.calls.some((c) => c.table === 'restaurant_members' && c.op !== 'select')).toBe(false);
  });
});

describe('Order cancellation and refunds', () => {
  const order = {
    id: 'o1',
    restaurant_id: RID,
    order_number: 42,
    order_type: 'dine_in',
    status: 'served',
    payment_status: 'unpaid',
    table_id: null,
    customer_id: null,
    waiter_id: null,
    cashier_id: null,
    tax_rate: 0.1,
    tax_inclusive: false,
    subtotal: 20,
    discount_amount: 0,
    tax_amount: 2,
    total: 22,
    amount_paid: 0,
    amount_refunded: 0,
    notes: null,
    guest_count: 2,
    bill_requested_at: null,
    completed_at: null,
    cancelled_at: null,
    cancelled_by: null,
    cancel_reason: null,
    stock_deducted_at: null,
    stock_reversed_at: null,
    created_by: null,
    created_at: ts.created_at,
    updated_at: ts.updated_at,
  };
  it('requires a reason and cancels via the authorised RPC', async () => {
    db.tables.orders = [{ ...order }];
    const u = user();
    renderWithProviders(
      <Routes>
        <Route path="/orders/:id" element={<OrderDetailPage />} />
      </Routes>,
      '/orders/o1',
    );
    await u.click(await screen.findByRole('button', { name: 'Cancel order' }));
    const d = screen.getByRole('dialog');
    await u.click(within(d).getByRole('button', { name: 'Cancel order' }));
    expect(await within(d).findByText(/Please enter a reason/)).toBeInTheDocument();
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
    await u.type(within(d).getByLabelText('Reason'), 'Customer left');
    await u.click(within(d).getByRole('button', { name: 'Cancel order' }));
    await waitFor(() =>
      expect(supabaseMock.rpc).toHaveBeenCalledWith('cancel_order', { p_order: 'o1', p_reason: 'Customer left' }),
    );
    expect(updates('orders')).toHaveLength(0);
  });
  it('blocks cancelling paid orders and offers a capped refund', async () => {
    db.tables.orders = [{ ...order, amount_paid: 22, payment_status: 'paid' }];
    const u = user();
    renderWithProviders(
      <Routes>
        <Route path="/orders/:id" element={<OrderDetailPage />} />
      </Routes>,
      '/orders/o1',
    );
    await u.click(await screen.findByRole('button', { name: 'Cancel order' }));
    expect(await screen.findByText(/Refund the collected payments/)).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Refund' }));
    const d = screen.getByRole('dialog');
    const amt = within(d).getByLabelText(/Amount/);
    await u.clear(amt);
    await u.type(amt, '50');
    await u.type(within(d).getByLabelText('Reason'), 'Cold food');
    await u.click(within(d).getByRole('button', { name: 'Record refund' }));
    expect(await within(d).findByText(/Cannot exceed/)).toBeInTheDocument();
    await u.clear(amt);
    await u.type(amt, '22');
    await u.click(within(d).getByRole('button', { name: 'Record refund' }));
    await waitFor(() =>
      expect(supabaseMock.rpc).toHaveBeenCalledWith('refund_order', {
        p_order: 'o1',
        p_amount: 22,
        p_method: 'cash',
        p_reason: 'Cold food',
        p_restock: false,
      }),
    );
  });
});

describe('Reports', () => {
  it('shows calculated figures from records and exports CSV', async () => {
    db.tables.orders = [
      {
        id: 'o1',
        restaurant_id: RID,
        status: 'completed',
        total: 33,
        tax_amount: 3,
        discount_amount: 0,
        amount_paid: 33,
        amount_refunded: 0,
        created_at: new Date().toISOString(),
        table_id: null,
        waiter_id: null,
        guest_count: null,
      },
      {
        id: 'o2',
        restaurant_id: RID,
        status: 'served',
        total: 10,
        tax_amount: 0,
        discount_amount: 0,
        amount_paid: 0,
        amount_refunded: 0,
        created_at: new Date().toISOString(),
        table_id: null,
        waiter_id: null,
        guest_count: null,
      },
    ];
    db.tables.payments = [
      {
        id: 'p1',
        restaurant_id: RID,
        order_id: 'o1',
        kind: 'payment',
        method: 'cash',
        amount: 33,
        status: 'succeeded',
        cashier_id: null,
        created_at: new Date().toISOString(),
      },
    ];
    const createObjectURL = vi.fn(() => 'blob:x');
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const u = user();
    renderWithProviders(<ReportsPage />);
    expect(await screen.findByText('$43.00')).toBeInTheDocument(); // gross sales
    expect(screen.getByText('$33.00')).toBeInTheDocument(); // collected
    expect(screen.getAllByText('$10.00').length).toBeGreaterThan(0); // outstanding
    await u.click(screen.getByRole('button', { name: 'Profit estimate' }));
    expect(await screen.findByText(/ESTIMATE UNAVAILABLE/)).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Export CSV' }));
    expect(createObjectURL).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    click.mockRestore();
  });
});

describe('Realtime', () => {
  function Probe({ rid, cb }: { rid: string; cb: () => void }) {
    useRealtime(['orders', 'payments'], rid, cb);
    return null;
  }
  it('subscribes with a restaurant filter and unsubscribes on unmount', async () => {
    vi.useFakeTimers();
    const cb = vi.fn();
    const { unmount } = render(<Probe rid={RID} cb={cb} />);
    expect(db.channels).toHaveLength(1);
    const ons = db.channels[0]!.ons as Array<[string, { table: string; filter: string }, () => void]>;
    expect(ons.map((o) => [o[1].table, o[1].filter])).toEqual([
      ['orders', `restaurant_id=eq.${RID}`],
      ['payments', `restaurant_id=eq.${RID}`],
    ]);
    act(() => {
      ons[0]![2]();
      ons[1]![2]();
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(cb).toHaveBeenCalledTimes(1); // debounced burst
    unmount();
    expect(supabaseMock.removeChannel).toHaveBeenCalledWith(db.channels[0]);
    vi.useRealTimers();
  });
});
