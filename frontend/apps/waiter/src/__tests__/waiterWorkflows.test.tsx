import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { asRole } from '@sombill/shared-utils/testing/mockAuth';
import { renderWithProviders } from '@sombill/shared-utils/testing/render';
import { db, resetDb, supabaseMock } from '@sombill/shared-utils/testing/mockSupabase';
import { RID, WAITER_ID } from '@sombill/shared-utils/testing/fixtures';
import {
  categories,
  item,
  order,
  OTHER_WAITER,
  products,
  tableStatus,
} from '@sombill/shared-utils/testing/posFixtures';

vi.mock('@sombill/api-client/supabase', async (orig) => ({
  ...(await orig<typeof import('@sombill/api-client/supabase')>()),
  supabase: (await import('@sombill/shared-utils/testing/mockSupabase')).supabaseMock,
}));
vi.mock(
  '@sombill/shared-hooks/AuthContext',
  async () => (await import('@sombill/shared-utils/testing/mockAuth')).authModule,
);

const { WaiterLayout } = await import('@sombill/waiter/layouts/WaiterLayout');
const Tables = (await import('@sombill/waiter/pages/WaiterTablesPage')).default;
const NewOrder = (await import('@sombill/waiter/pages/NewOrderPage')).default;
const Kitchen = (await import('@sombill/waiter/pages/KitchenStatusPage')).default;
const Bills = (await import('@sombill/waiter/pages/BillsPage')).default;
const Notifications = (await import('@sombill/waiter/pages/NotificationsPage')).default;
const Profile = (await import('@sombill/shared-ui/pos/ProfilePage')).default;
const Dashboard = (await import('@sombill/waiter/pages/WaiterDashboardPage')).default;
const Menu = (await import('@sombill/waiter/pages/WaiterMenuPage')).default;
const OrderDetail = (await import('@sombill/waiter/pages/WaiterOrderDetailPage')).default;

function App({ children }: { children?: React.ReactNode }) {
  return (
    <Routes>
      <Route path="/waiter" element={<WaiterLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="tables" element={<Tables />} />
        <Route path="new-order" element={<NewOrder />} />
        <Route path="kitchen" element={<Kitchen />} />
        <Route path="bills" element={<Bills />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="profile" element={<Profile />} />
        <Route path="menu" element={<Menu />} />
        <Route path="orders/:id" element={<OrderDetail />} />
      </Route>
      {children}
    </Routes>
  );
}
const user = () => userEvent.setup();
const rpcCalls = (name: string) => supabaseMock.rpc.mock.calls.filter((c) => c[0] === name);
const seedMenu = () => {
  db.tables.categories = categories;
  db.tables.products = products;
  db.tables.table_status_v = tableStatus();
  db.tables.restaurant_tables = tableStatus();
};

beforeEach(() => {
  resetDb();
  sessionStorage.clear();
  asRole('waiter');
});

describe('Tables', () => {
  it('shows live status, lets the waiter start an order on an available table and protects others’ tables', async () => {
    seedMenu();
    db.tables.orders = [
      order('o9', 9, { table_id: 't3', waiter_id: OTHER_WAITER }),
      order('o7', 7, { table_id: 't5' }),
    ];
    const u = user();
    renderWithProviders(<App />, '/waiter/tables');
    const t4 = await screen.findByRole('listitem', { name: 'Table 4, Available' });
    expect(screen.getByRole('listitem', { name: 'Table 3, Occupied' })).toBeInTheDocument();
    // someone else's table: view only
    await u.click(screen.getByRole('listitem', { name: 'Table 3, Occupied' }));
    expect(await screen.findByText(/You can view it but not change it/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add items/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start new order' })).not.toBeInTheDocument();
    // own occupied table: add items allowed
    await u.click(screen.getByRole('listitem', { name: 'Table 5, Occupied' }));
    expect(await screen.findByRole('button', { name: 'Add items to #7' })).toBeInTheDocument();
    // available table: start order → POS with table preselected
    await u.click(t4);
    await u.click(screen.getByRole('button', { name: 'Start new order' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'New Order' })).toBeInTheDocument();
    expect(screen.getByLabelText('Table')).toHaveValue('t4');
  });
});

describe('New Order POS', () => {
  it('loads real categories/products, hides archived and inactive, disables unavailable, searches', async () => {
    seedMenu();
    const u = user();
    renderWithProviders(<App />, '/waiter/new-order');
    const grid = await screen.findByRole('list', { name: 'Products' });
    expect(within(grid).getByRole('listitem', { name: /Bariis iyo Hilib, \$12.00$/ })).toBeEnabled();
    expect(within(grid).getByRole('listitem', { name: /Sold-out Suqaar.*unavailable/ })).toBeDisabled();
    expect(within(grid).queryByText('Old Dish')).not.toBeInTheDocument();
    expect(within(grid).queryByText('Secret Item')).not.toBeInTheDocument();
    const tabs = screen.getByRole('tablist', { name: 'Categories' });
    expect(
      within(tabs)
        .getAllByRole('tab')
        .map((t) => t.textContent),
    ).toEqual(['All', 'Mains', 'Drinks']);
    await u.click(within(tabs).getByRole('tab', { name: 'Drinks' }));
    expect(within(grid).queryByText('Bariis iyo Hilib')).not.toBeInTheDocument();
    expect(within(grid).getByText('Shaah')).toBeInTheDocument();
    await u.click(within(tabs).getByRole('tab', { name: 'All' }));
    await u.type(screen.getByLabelText('Search products'), 'bari');
    expect(within(grid).getAllByRole('listitem')).toHaveLength(1);
  });

  it('builds an order: quantities, notes, tax totals — and sends it exactly once', async () => {
    seedMenu();
    let resolve!: (v: unknown) => void;
    supabaseMock.rpc.mockImplementation((name: string) =>
      name === 'submit_waiter_order'
        ? new Promise((r) => {
            resolve = r;
          })
        : Promise.resolve({ data: null, error: null }),
    );
    const u = user();
    renderWithProviders(<App />, '/waiter/new-order');
    const grid = await screen.findByRole('list', { name: 'Products' });
    await u.selectOptions(screen.getByLabelText('Table'), 't4');
    await u.click(within(grid).getByRole('listitem', { name: /Bariis iyo Hilib/ }));
    await u.click(within(grid).getByRole('listitem', { name: /Shaah/ }));
    await u.click(screen.getByRole('button', { name: 'Increase Bariis iyo Hilib' }));
    await u.click(screen.getByRole('button', { name: 'Increase Shaah' }));
    await u.click(screen.getByRole('button', { name: 'Increase Shaah' }));
    await u.click(screen.getByRole('button', { name: 'Increase Shaah' }));
    await u.click(screen.getByRole('button', { name: 'Decrease Shaah' }));
    await u.click(screen.getByRole('button', { name: 'Note for Bariis iyo Hilib' }));
    await u.type(screen.getByLabelText('Item note for Bariis iyo Hilib'), 'No onions');
    await u.type(screen.getByLabelText('Special instructions'), 'Allergy: nuts');
    await u.type(screen.getByLabelText('Guests'), '4');
    // 2×12 + 3×1.50 = 28.50 ; VAT 10% on 24 = 2.40 ; total 30.90 (same as the database test)
    expect(screen.getByTestId('subtotal')).toHaveTextContent('$28.50');
    expect(screen.getByTestId('tax')).toHaveTextContent('$2.40');
    expect(screen.getByTestId('total')).toHaveTextContent('$30.90');
    const send = screen.getByRole('button', { name: 'Send order' });
    await u.click(send);
    await u.click(send); // double tap while in flight
    expect(rpcCalls('submit_waiter_order')).toHaveLength(1);
    const [, args] = rpcCalls('submit_waiter_order')[0] as [string, Record<string, unknown>];
    expect(args).toMatchObject({
      p_restaurant: RID,
      p_table: 't4',
      p_notes: 'Allergy: nuts',
      p_customer: null,
      p_guest_count: 4,
      p_items: [
        { product_id: 'p1', quantity: 2, unit_price: 12, notes: 'No onions' },
        { product_id: 'p2', quantity: 3, unit_price: 1.5, notes: null },
      ],
    });
    expect(typeof args.p_idempotency_key).toBe('string');
    await act(async () => {
      resolve({ data: { order_id: 'o42', order_number: 42, total: 30.9 }, error: null });
    });
    const dialog = await screen.findByRole('dialog', { name: 'Order sent' });
    expect(within(dialog).getByText('Order #42 · Table 4')).toBeInTheDocument();
    expect(within(dialog).getByText('$30.90')).toBeInTheDocument();
    await u.click(within(dialog).getByRole('button', { name: 'New order' }));
    expect(screen.getByText('Tap products to add them to the order.')).toBeInTheDocument();
    expect(JSON.parse(sessionStorage.getItem('sombill.waiter.cart')!).idempotencyKey).not.toBe(args.p_idempotency_key);
  });

  it('requires a table and blocks sending an empty order', async () => {
    seedMenu();
    const u = user();
    renderWithProviders(<App />, '/waiter/new-order');
    const grid = await screen.findByRole('list', { name: 'Products' });
    expect(screen.getByRole('button', { name: 'Send order' })).toBeDisabled();
    await u.click(within(grid).getByRole('listitem', { name: /Bariis iyo Hilib/ }));
    expect(screen.getByRole('button', { name: 'Send order' })).toBeDisabled();
    expect(rpcCalls('submit_waiter_order')).toHaveLength(0);
  });

  it('recovers from a manager price change: refreshes price, keeps the same key on resend', async () => {
    seedMenu();
    supabaseMock.rpc
      .mockResolvedValueOnce({ data: null, error: { message: 'PRICE_CHANGED: "Bariis iyo Hilib" now costs 13.50' } })
      .mockResolvedValueOnce({ data: { order_id: 'o43', order_number: 43, total: 14.85 }, error: null });
    const u = user();
    renderWithProviders(<App />, '/waiter/new-order');
    const grid = await screen.findByRole('list', { name: 'Products' });
    await u.selectOptions(screen.getByLabelText('Table'), 't4');
    await u.click(within(grid).getByRole('listitem', { name: /Bariis iyo Hilib/ }));
    db.tables.products = products.map((p) => (p.id === 'p1' ? { ...p, price: 13.5 } : p)); // manager changed the price
    await u.click(screen.getByRole('button', { name: 'Send order' }));
    expect(await screen.findByText(/now costs 13.50. Prices were refreshed/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('total')).toHaveTextContent('$14.85'));
    await u.click(screen.getByRole('button', { name: 'Send order' }));
    await screen.findByRole('dialog', { name: 'Order sent' });
    const calls = rpcCalls('submit_waiter_order') as Array<
      [string, { p_idempotency_key: string; p_items: Array<{ unit_price: number }> }]
    >;
    expect(calls).toHaveLength(2);
    expect(calls[1]![1].p_items[0]!.unit_price).toBe(13.5);
    expect(calls[1]![1].p_idempotency_key).toBe(calls[0]![1].p_idempotency_key);
  });

  it('shows a clear message when the table was taken by someone else', async () => {
    seedMenu();
    supabaseMock.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'TABLE_OCCUPIED: Table 4 already has an active order' },
    });
    const u = user();
    renderWithProviders(<App />, '/waiter/new-order');
    const grid = await screen.findByRole('list', { name: 'Products' });
    await u.selectOptions(screen.getByLabelText('Table'), 't4');
    await u.click(within(grid).getByRole('listitem', { name: /Shaah/ }));
    await u.click(screen.getByRole('button', { name: 'Send order' }));
    expect(
      await screen.findByText(/Table 4 already has an active order. Open the existing order from Tables/),
    ).toBeInTheDocument();
  });

  it('adds items to an existing unpaid order via add_order_items', async () => {
    seedMenu();
    db.tables.orders = [order('o7', 7)];
    db.tables.order_items = [
      item('i1', 'o7', 'Bariis iyo Hilib', 1, 12),
      item('i2', 'o7', 'Shaah', 2, 1.5, { tax_exempt: true }),
    ];
    sessionStorage.setItem(
      'sombill.waiter.cart',
      JSON.stringify({ existingOrderId: 'o7', tableId: 't5', lines: [], idempotencyKey: 'key-add-1' }),
    );
    supabaseMock.rpc.mockResolvedValue({ data: { order_id: 'o7', order_number: 7, total: 17.85 }, error: null });
    const u = user();
    renderWithProviders(<App />, '/waiter/new-order');
    expect(await screen.findByRole('heading', { level: 1, name: 'Add items to order #7' })).toBeInTheDocument();
    expect(screen.getByText('Already sent')).toBeInTheDocument();
    await u.click(within(screen.getByRole('list', { name: 'Products' })).getByRole('listitem', { name: /Shaah/ }));
    expect(screen.getByTestId('total')).toHaveTextContent('$17.70'); // 12+1.2 tax + 4.50 exempt
    await u.click(screen.getByRole('button', { name: 'Add to order' }));
    await waitFor(() => expect(rpcCalls('add_order_items')).toHaveLength(1));
    expect(rpcCalls('add_order_items')[0]![1]).toEqual({
      p_order: 'o7',
      p_items: [{ product_id: 'p2', quantity: 1, unit_price: 1.5, notes: null }],
      p_idempotency_key: 'key-add-1',
    });
  });

  it('refuses to add items once the bill has been requested', async () => {
    seedMenu();
    db.tables.orders = [order('o7', 7, { bill_requested_at: '2026-11-21T10:00:00Z' })];
    sessionStorage.setItem(
      'sombill.waiter.cart',
      JSON.stringify({ existingOrderId: 'o7', tableId: 't5', lines: [], idempotencyKey: 'k' }),
    );
    renderWithProviders(<App />, '/waiter/new-order');
    expect(await screen.findByText(/the bill has been requested/)).toBeInTheDocument();
    expect(
      within(screen.getByRole('list', { name: 'Products' })).getByRole('listitem', { name: /Shaah/ }),
    ).toBeDisabled();
  });
});

describe('Menu', () => {
  it('shows manager products and adds to the current order', async () => {
    seedMenu();
    const u = user();
    renderWithProviders(<App />, '/waiter/menu');
    const list = await screen.findByRole('list', { name: 'Menu products' });
    expect(within(list).getByText('Unavailable')).toBeInTheDocument();
    await u.click(within(list).getByRole('button', { name: 'Add Shaah to order' }));
    expect(await screen.findByRole('button', { name: 'Go to order (1)' })).toBeInTheDocument();
  });
});

describe('Kitchen status', () => {
  it('shows preparation progress; waiters can only serve their Ready orders', async () => {
    db.tables.orders = [
      order('o1', 11, { status: 'preparing' }),
      order('o2', 12, { status: 'ready' }),
      order('o3', 13, { status: 'ready', waiter_id: OTHER_WAITER }),
    ];
    db.tables.order_items = [
      item('i1', 'o1', 'Bariis iyo Hilib', 2, 12, { notes: 'No onions' }),
      item('i2', 'o2', 'Shaah', 3, 1.5),
    ];
    db.tables.restaurant_tables = tableStatus();
    const u = user();
    renderWithProviders(<App />, '/waiter/kitchen');
    const prep = await screen.findByTestId('kitchen-11');
    expect(within(prep).getByText(/No onions/)).toBeInTheDocument();
    expect(within(prep).queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('kitchen-13')).not.toBeInTheDocument(); // "My orders" by default
    await u.click(within(screen.getByTestId('kitchen-12')).getByRole('button', { name: 'Mark served' }));
    await waitFor(() =>
      expect(db.calls.find((c) => c.table === 'orders' && c.op === 'update')?.payload).toEqual({ status: 'served' }),
    );
    await u.click(screen.getByRole('button', { name: 'All orders' }));
    expect(
      within(await screen.findByTestId('kitchen-13')).queryByRole('button', { name: 'Mark served' }),
    ).not.toBeInTheDocument();
  });
});

describe('Bills and payment status', () => {
  it('requests and cancels a bill through the RPCs and shows the balance', async () => {
    db.tables.orders = [order('o7', 7, { status: 'served' })];
    db.tables.order_items = [item('i1', 'o7', 'Bariis iyo Hilib', 1, 12)];
    db.tables.restaurant_tables = tableStatus();
    supabaseMock.rpc.mockImplementation(async (name: string) => {
      if (name === 'request_bill') Object.assign(db.tables.orders![0]!, { bill_requested_at: '2026-11-21T10:00:00Z' });
      if (name === 'cancel_bill_request') Object.assign(db.tables.orders![0]!, { bill_requested_at: null });
      return { data: null, error: null };
    });
    const u = user();
    renderWithProviders(<App />, '/waiter/bills?order=o7');
    expect(await screen.findByTestId('balance')).toHaveTextContent('$16.20');
    await u.click(screen.getByRole('button', { name: 'Request bill' }));
    await u.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Request bill' }));
    await waitFor(() => expect(rpcCalls('request_bill')).toEqual([['request_bill', { p_order: 'o7' }]]));
    await u.click(await screen.findByRole('button', { name: 'Cancel bill request' }));
    await u.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel request' }));
    await waitFor(() => expect(rpcCalls('cancel_bill_request')).toHaveLength(1));
    expect(
      supabaseMock.from.mock.calls.some((c) => c[0] === 'payments') &&
        db.calls.some((c) => c.table === 'payments' && c.op !== 'select'),
    ).toBe(false);
  });

  it('updates live when the cashier records payment', async () => {
    db.tables.orders = [
      order('o7', 7, {
        status: 'served',
        bill_requested_at: '2026-11-21T10:00:00Z',
        bill_acknowledged_at: '2026-11-21T10:01:00Z',
      }),
    ];
    db.tables.order_items = [item('i1', 'o7', 'Bariis iyo Hilib', 1, 12)];
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderWithProviders(<App />, '/waiter/bills?order=o7');
    expect(await screen.findAllByText('Cashier processing')).not.toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Cancel bill request' })).not.toBeInTheDocument();
    // Cashier records the payment → realtime event
    Object.assign(db.tables.orders[0]!, { amount_paid: 16.2, payment_status: 'paid' });
    db.tables.payments = [
      {
        id: 'pay1',
        restaurant_id: RID,
        order_id: 'o7',
        kind: 'payment',
        method: 'cash',
        amount: 16.2,
        status: 'succeeded',
        created_at: '2026-11-21T10:02:00Z',
      },
    ];
    const ch = db.channels.find((c) =>
      (c.ons as Array<[string, { table: string }]>).some((o) => o[1].table === 'payments'),
    )!;
    act(() => {
      (ch.ons[0] as [string, unknown, () => void])[2]();
      vi.advanceTimersByTime(500);
    });
    vi.useRealTimers();
    expect(await screen.findByText('Receipt available — payment completed by the cashier.')).toBeInTheDocument();
    expect(screen.getByTestId('balance')).toHaveTextContent('$0.00');
    expect(screen.getByRole('button', { name: 'Print receipt' })).toBeInTheDocument();
  });
});

describe('Notifications', () => {
  it('lists, marks read and clears read notifications', async () => {
    db.tables.notifications = [
      {
        id: 'n1',
        restaurant_id: RID,
        user_id: WAITER_ID,
        type: 'order_ready',
        title: 'Order #7 is ready to serve',
        body: null,
        order_id: 'o7',
        table_id: null,
        read_at: null,
        created_at: '2026-11-21T10:00:00Z',
      },
      {
        id: 'n2',
        restaurant_id: RID,
        user_id: WAITER_ID,
        type: 'payment_completed',
        title: 'Payment completed – Order #6',
        body: null,
        order_id: 'o6',
        table_id: null,
        read_at: '2026-11-21T09:00:00Z',
        created_at: '2026-11-21T09:00:00Z',
      },
    ];
    const u = user();
    renderWithProviders(<App />, '/waiter/notifications');
    expect(await screen.findByRole('button', { name: 'Unread: Order #7 is ready to serve' })).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Mark all read' }));
    await waitFor(() =>
      expect(db.calls.find((c) => c.table === 'notifications' && c.op === 'update')?.payload).toHaveProperty('read_at'),
    );
    await u.click(screen.getByRole('button', { name: 'Clear read' }));
    await u.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Clear' }));
    await waitFor(() => expect(db.calls.some((c) => c.table === 'notifications' && c.op === 'delete')).toBe(true));
    const del = db.calls.find((c) => c.table === 'notifications' && c.op === 'delete')!;
    expect(del.filters).toEqual(
      expect.arrayContaining([
        ['eq', 'user_id', WAITER_ID],
        ['not', 'read_at', 'is', null],
      ]),
    );
  });
});

describe('Profile', () => {
  it('validates and saves permitted fields only', async () => {
    db.tables.profiles = [{ id: WAITER_ID, full_name: 'Warsame Waiter' }];
    const u = user();
    renderWithProviders(<App />, '/waiter/profile');
    const phone = await screen.findByLabelText('Phone');
    await u.clear(phone);
    await u.type(phone, 'abc');
    await u.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Enter a valid phone number')).toBeInTheDocument();
    await u.clear(phone);
    await u.type(phone, '+252 63 999 0000');
    await u.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(db.calls.find((c) => c.table === 'profiles' && c.op === 'update')?.payload).toEqual({
        full_name: 'Warsame Waiter',
        phone: '+252 63 999 0000',
      }),
    );
    expect(screen.getByText('Email, role and restaurant are managed by your manager.')).toBeInTheDocument();
    expect(screen.getByText('Waiter')).toBeInTheDocument();
  });
});

describe('Dashboard', () => {
  it('calculates the waiter’s figures from records and controls the shift', async () => {
    db.tables.orders = [
      order('o1', 1, { status: 'ready' }),
      order('o2', 2, { status: 'preparing' }),
      order('o3', 3, { status: 'served', bill_requested_at: 'x' }),
      order('o4', 4, { status: 'completed', payment_status: 'paid', total: 30.9 }),
      order('o5', 5, { status: 'new', waiter_id: OTHER_WAITER }),
    ];
    db.tables.table_status_v = tableStatus();
    const u = user();
    renderWithProviders(<App />, '/waiter');
    const card = async (label: string) => (await screen.findByText(label)).closest('.card') as HTMLElement;
    await waitFor(async () => expect(within(await card('My active orders')).getByText('3')).toBeInTheDocument());
    expect(within(await card('Ready to serve')).getByText('1')).toBeInTheDocument();
    expect(within(await card('Pending in kitchen')).getByText('1')).toBeInTheDocument();
    expect(within(await card('Bill requests')).getByText('1')).toBeInTheDocument();
    expect(within(await card('Available tables')).getByText('1')).toBeInTheDocument();
    expect(within(await card('Occupied tables')).getByText('2')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Start shift' }));
    await waitFor(() => expect(rpcCalls('start_shift')).toEqual([['start_shift', { p_restaurant: RID }]]));
    expect(screen.getByRole('button', { name: /New Order/ })).toBeInTheDocument();
  });
});

describe('Order detail', () => {
  it('shows items, notes and history and lets the waiter serve a Ready order', async () => {
    db.tables.orders = [order('o7', 7, { status: 'ready', notes: 'Allergy: nuts' })];
    db.tables.order_items = [
      item('i1', 'o7', 'Bariis iyo Hilib', 2, 12, { notes: 'No onions' }),
      item('i2', 'o7', 'Shaah', 1, 1.5, { created_at: '2026-11-21T09:20:00Z' }),
    ];
    const u = user();
    renderWithProviders(<App />, '/waiter/orders/o7');
    expect(await screen.findByText('Note: No onions')).toBeInTheDocument();
    expect(screen.getByText(/Allergy: nuts/)).toBeInTheDocument();
    expect(screen.getByText(/^Order sent/)).toBeInTheDocument();
    expect(screen.getByText(/^Items added/)).toBeInTheDocument();
    expect(screen.getByRole('listitem', { current: 'step' })).toHaveTextContent('Ready');
    await u.click(screen.getByRole('button', { name: 'Mark served' }));
    await waitFor(() =>
      expect(db.calls.find((c) => c.table === 'orders' && c.op === 'update')?.payload).toEqual({ status: 'served' }),
    );
  });
});

describe('Realtime resilience', () => {
  it('does not recurse when removeChannel emits CLOSED synchronously (found in real-browser run)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { useRealtime } = await import('@sombill/shared-hooks/useRealtime');
    const { render } = await import('@testing-library/react');
    supabaseMock.removeChannel.mockImplementation(async (ch: { status: null | ((s: string) => void) }) => {
      ch.status?.('CLOSED');
      return 'ok';
    });
    function Probe() {
      useRealtime(['orders'], RID, () => {});
      return null;
    }
    const { unmount } = render(<Probe />);
    expect(() =>
      act(() => {
        db.channels[0]!.status!('CHANNEL_ERROR');
      }),
    ).not.toThrow();
    expect(supabaseMock.removeChannel).toHaveBeenCalledTimes(1);
    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(db.channels).toHaveLength(2); // exactly one retry scheduled
    unmount();
    supabaseMock.removeChannel.mockReset().mockResolvedValue('ok');
    vi.useRealTimers();
  });

  it('resubscribes after a dropped connection and resyncs data', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { useRealtime } = await import('@sombill/shared-hooks/useRealtime');
    const { render } = await import('@testing-library/react');
    const cb = vi.fn();
    function Probe() {
      useRealtime(['orders'], RID, cb);
      return null;
    }
    const { unmount } = render(<Probe />);
    const first = db.channels[0]!;
    act(() => {
      first.status!('SUBSCRIBED');
    });
    act(() => {
      first.status!('CHANNEL_ERROR');
    });
    expect(supabaseMock.removeChannel).toHaveBeenCalledWith(first);
    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(db.channels).toHaveLength(2);
    act(() => {
      db.channels[1]!.status!('SUBSCRIBED');
      vi.advanceTimersByTime(500);
    });
    expect(cb).toHaveBeenCalledTimes(1); // resync after reconnect
    act(() => {
      window.dispatchEvent(new Event('online'));
      vi.advanceTimersByTime(500);
    });
    expect(cb).toHaveBeenCalledTimes(2);
    unmount();
    expect(supabaseMock.removeChannel).toHaveBeenLastCalledWith(db.channels[1]);
    vi.useRealTimers();
  });
});
