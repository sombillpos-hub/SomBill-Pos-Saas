import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router-dom';
import { asRole } from '@sombill/shared-utils/testing/mockAuth';
import { renderWithProviders } from '@sombill/shared-utils/testing/render';
import { db, resetDb, supabaseMock } from '@sombill/shared-utils/testing/mockSupabase';
import { CASHIER_ID, RID, WAITER_ID, restaurant } from '@sombill/shared-utils/testing/fixtures';
import { categories, item, order, products, tableStatus } from '@sombill/shared-utils/testing/posFixtures';

vi.mock('@sombill/api-client/supabase', async (orig) => ({
  ...(await orig<typeof import('@sombill/api-client/supabase')>()),
  supabase: (await import('@sombill/shared-utils/testing/mockSupabase')).supabaseMock,
}));
vi.mock(
  '@sombill/shared-hooks/AuthContext',
  async () => (await import('@sombill/shared-utils/testing/mockAuth')).authModule,
);

const { CashierLayout } = await import('@sombill/cashier/layouts/CashierLayout');
const NewSale = (await import('@sombill/cashier/pages/NewSalePage')).default;
const Payments = (await import('@sombill/cashier/pages/PaymentProcessingPage')).default;
const Active = (await import('@sombill/cashier/pages/ActiveOrdersPage')).default;
const Bills = (await import('@sombill/cashier/pages/CashierBillsPage')).default;
const Transactions = (await import('@sombill/cashier/pages/TransactionsPage')).default;
const Receipts = (await import('@sombill/cashier/pages/ReceiptsPage')).default;
const Refunds = (await import('@sombill/cashier/pages/RefundsPage')).default;
const Shift = (await import('@sombill/cashier/pages/ShiftPage')).default;
const Dashboard = (await import('@sombill/cashier/pages/CashierDashboardPage')).default;

function Where() {
  const l = useLocation();
  return (
    <p data-testid="where">
      {l.pathname}
      {l.search}
    </p>
  );
}
function App() {
  return (
    <>
      <Routes>
        <Route path="/cashier" element={<CashierLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="new-sale" element={<NewSale />} />
          <Route path="active-orders" element={<Active />} />
          <Route path="bills" element={<Bills />} />
          <Route path="payments" element={<Payments />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="receipts" element={<Receipts />} />
          <Route path="refunds" element={<Refunds />} />
          <Route path="shift" element={<Shift />} />
        </Route>
      </Routes>
      <Where />
    </>
  );
}
const user = () => userEvent.setup();
const rpcCalls = (name: string) => supabaseMock.rpc.mock.calls.filter((c) => c[0] === name);
const openShift = {
  id: 'sh1',
  restaurant_id: RID,
  cashier_id: CASHIER_ID,
  status: 'open',
  opening_cash: 50,
  opened_at: '2026-11-21T08:00:00Z',
  opening_notes: null,
  closed_at: null,
  expected_cash: null,
  counted_cash: null,
  cash_difference: null,
  closing_notes: null,
  summary: null,
  created_at: '2026-11-21T08:00:00Z',
};
const pay = (id: string, orderId: string, extra: Record<string, unknown> = {}) => ({
  id,
  restaurant_id: RID,
  order_id: orderId,
  kind: 'payment',
  method: 'cash',
  amount: 10,
  status: 'succeeded',
  reference: null,
  transaction_number: 7,
  verification_status: 'not_required',
  cashier_id: CASHIER_ID,
  amount_received: null,
  change_given: null,
  created_at: '2026-11-21T10:00:00Z',
  ...extra,
});
/** A 23.10 order: 2 × 10.50 + 10% VAT. */
const o1 = (extra: Record<string, unknown> = {}) =>
  order('o1', 41, { subtotal: 21, tax_amount: 2.1, total: 23.1, ...extra });
const okResult = (extra: Record<string, unknown> = {}) => ({
  data: {
    payment_status: 'paid',
    order_status: 'served',
    balance: 0,
    change: 0,
    paid: 23.1,
    pending_verification: 0,
    transaction_numbers: [7],
    awaiting_verification: false,
    duplicate: false,
    close: null,
    ...extra,
  },
  error: null,
});

beforeEach(() => {
  resetDb();
  sessionStorage.clear();
  asRole('cashier');
  db.tables.categories = categories;
  db.tables.products = products;
  db.tables.table_status_v = tableStatus();
  db.tables.restaurant_tables = tableStatus();
  db.tables.cashier_shifts = [openShift];
});

describe('New Sale', () => {
  it('loads only sellable products, searches, calculates tax and enforces the cashier discount limit', async () => {
    const u = user();
    renderWithProviders(<App />, '/cashier/new-sale');
    const grid = await screen.findByRole('list', { name: 'Products' });
    expect(within(grid).getByRole('listitem', { name: /Bariis iyo Hilib, \$12.00$/ })).toBeEnabled();
    expect(within(grid).getByRole('listitem', { name: /Sold-out Suqaar.*unavailable/ })).toBeDisabled();
    expect(within(grid).queryByText('Old Dish')).not.toBeInTheDocument(); // archived
    expect(within(grid).queryByText('Secret Item')).not.toBeInTheDocument(); // inactive category
    await u.type(screen.getByLabelText('Search products'), 'shaah');
    expect(within(grid).queryByText('Bariis iyo Hilib')).not.toBeInTheDocument();
    await u.click(within(grid).getByRole('listitem', { name: /Shaah/ }));
    await u.clear(screen.getByLabelText('Search products'));
    await u.click(within(grid).getByRole('listitem', { name: /Bariis iyo Hilib/ }));
    await u.click(screen.getByRole('button', { name: 'Increase Bariis iyo Hilib' }));
    // 2 × 12 + 1.5 (tax-exempt) = 25.50; VAT 10% on 24 = 2.40
    expect(screen.getByTestId('sale-subtotal')).toHaveTextContent('$25.50');
    expect(screen.getByTestId('sale-tax')).toHaveTextContent('$2.40');
    expect(screen.getByTestId('sale-total')).toHaveTextContent('$27.90');
    // Discount above 10% (2.55) is refused on screen; the server enforces it again.
    await u.type(screen.getByLabelText('Discount amount'), '3');
    expect(screen.getByText(/Your limit is 10% \(\$2.55\)/)).toBeInTheDocument();
    await u.clear(screen.getByLabelText('Discount amount'));
    await u.type(screen.getByLabelText('Discount amount'), '2');
    await u.type(screen.getByLabelText('Discount reason'), 'Regular customer');
    expect(screen.getByTestId('sale-discount')).toHaveTextContent('−$2.00');
    expect(screen.getByTestId('sale-total')).toHaveTextContent('$25.71'); // tax is recalculated on the discounted amount
  });

  it('Charge creates the order once (double-click safe) with manager prices, then opens payment', async () => {
    let resolve!: (v: unknown) => void;
    supabaseMock.rpc.mockImplementation((name: string) =>
      name === 'submit_pos_order'
        ? new Promise((r) => {
            resolve = r;
          })
        : Promise.resolve({ data: null, error: null }),
    );
    const u = user();
    renderWithProviders(<App />, '/cashier/new-sale');
    const grid = await screen.findByRole('list', { name: 'Products' });
    await u.click(within(grid).getByRole('listitem', { name: /Bariis iyo Hilib/ }));
    await u.click(screen.getByRole('radio', { name: /Takeaway/ }));
    const charge = screen.getByRole('button', { name: /Charge/ });
    await u.dblClick(charge);
    await u.click(charge);
    expect(rpcCalls('submit_pos_order')).toHaveLength(1);
    const args = rpcCalls('submit_pos_order')[0]![1] as Record<string, unknown>;
    expect(args).toMatchObject({ p_restaurant: RID, p_order_type: 'takeaway', p_table: null, p_discount: 0 });
    expect(args.p_items).toEqual([{ product_id: 'p1', quantity: 1, unit_price: 12, notes: null }]);
    expect(typeof args.p_idempotency_key).toBe('string');
    await act(async () => resolve({ data: { order_id: 'o-new', order_number: 50, total: 13.2 }, error: null }));
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/cashier/payments?order=o-new'));
  });

  it('dine-in needs a table and delivery needs a customer', async () => {
    const u = user();
    renderWithProviders(<App />, '/cashier/new-sale');
    const grid = await screen.findByRole('list', { name: 'Products' });
    await u.click(within(grid).getByRole('listitem', { name: /Bariis iyo Hilib/ }));
    await u.click(screen.getByRole('button', { name: /Save order/ }));
    expect(await screen.findByText('Select a table for dine-in.')).toBeInTheDocument();
    await u.click(screen.getByRole('radio', { name: /Delivery/ }));
    await u.click(screen.getByRole('button', { name: /Save order/ }));
    expect(await screen.findByText('Select the customer for delivery.')).toBeInTheDocument();
    expect(rpcCalls('submit_pos_order')).toHaveLength(0);
  });
});

describe('Payment Processing', () => {
  const setup = (orderExtra: Record<string, unknown> = {}, payments: unknown[] = []) => {
    db.tables.orders = [o1(orderExtra)];
    db.tables.order_items = [item('i1', 'o1', 'Suqaar', 2, 10.5)];
    db.tables.payments = payments as never;
  };

  it('cash: shows change from the amount received and records exactly one payment on double-click', async () => {
    setup();
    let resolve!: (v: unknown) => void;
    supabaseMock.rpc.mockImplementation((name: string) =>
      name === 'record_payments'
        ? new Promise((r) => {
            resolve = r;
          })
        : Promise.resolve({ data: null, error: null }),
    );
    const u = user();
    renderWithProviders(<App />, '/cashier/payments?order=o1');
    expect(await screen.findByTestId('pp-outstanding')).toHaveTextContent('$23.10');
    await u.click(screen.getByRole('button', { name: 'Cash' }));
    expect(screen.getByLabelText('Cash amount')).toHaveValue('23.10');
    await u.type(screen.getByLabelText('Cash received'), '30');
    expect(screen.getByTestId('change-preview')).toHaveTextContent('Change $6.90');
    const confirm = screen.getByRole('button', { name: /Confirm payment \$23.10/ });
    await u.dblClick(confirm);
    expect(rpcCalls('record_payments')).toHaveLength(1);
    expect(rpcCalls('record_payments')[0]![1]).toMatchObject({
      p_order: 'o1',
      p_payments: [{ method: 'cash', amount: 23.1, amount_received: 30 }],
      p_close_order: true,
    });
    await act(async () => resolve(okResult({ change: 6.9 })));
    expect(await screen.findByTestId('change-due')).toHaveTextContent('Change: $6.90');
    expect(screen.getByTestId('payment-done')).toHaveTextContent('Fully paid');
  });

  it('cash received below the amount is refused', async () => {
    setup();
    const u = user();
    renderWithProviders(<App />, '/cashier/payments?order=o1');
    await u.click(await screen.findByRole('button', { name: 'Cash' }));
    await u.type(screen.getByLabelText('Cash received'), '20');
    expect(screen.getByText('Cash received is less than 23.10.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirm payment/ })).toBeDisabled();
  });

  it('card: cannot be confirmed without the terminal ID and the cashier confirming APPROVED', async () => {
    setup();
    supabaseMock.rpc.mockImplementation((name: string) =>
      Promise.resolve(name === 'record_payments' ? okResult() : { data: null, error: null }),
    );
    const u = user();
    renderWithProviders(<App />, '/cashier/payments?order=o1');
    await u.click(await screen.findByRole('button', { name: 'Card' }));
    const confirm = screen.getByRole('button', { name: /Confirm payment/ });
    expect(confirm).toBeDisabled();
    await u.type(screen.getByLabelText('Card reference'), 'TID-55821');
    expect(screen.getByText('Confirm the card terminal shows APPROVED.')).toBeInTheDocument();
    expect(confirm).toBeDisabled();
    await u.click(screen.getByRole('checkbox', { name: /APPROVED/ }));
    await u.click(confirm);
    expect(rpcCalls('record_payments')[0]![1]).toMatchObject({
      p_payments: [{ method: 'card', amount: 23.1, reference: 'TID-55821', terminal_confirmed: true }],
    });
  });

  it.each([
    ['EVC Plus', 'evc_plus'],
    ['Zaad', 'zaad'],
    ['Somtel Money', 'somtel_money'],
  ])('%s: a typed reference is recorded as awaiting verification, never as verified', async (label, method) => {
    setup();
    supabaseMock.rpc.mockImplementation((name: string) =>
      Promise.resolve(
        name === 'record_payments'
          ? okResult({
              payment_status: 'unpaid',
              balance: 23.1,
              paid: 0,
              pending_verification: 23.1,
              awaiting_verification: true,
            })
          : { data: null, error: null },
      ),
    );
    const u = user();
    renderWithProviders(<App />, '/cashier/payments?order=o1');
    await u.click(await screen.findByRole('button', { name: label }));
    expect(screen.getByText(/A typed reference is not proof of payment/)).toBeInTheDocument();
    await u.type(screen.getByLabelText(`${label} reference`), 'MM-778899');
    await u.click(screen.getByRole('button', { name: /Confirm payment/ }));
    const payload = (rpcCalls('record_payments')[0]![1] as { p_payments: Array<Record<string, unknown>> })
      .p_payments[0]!;
    expect(payload).toEqual({ method, amount: 23.1, reference: 'MM-778899' });
    expect(payload).not.toHaveProperty('verified');
    expect(await screen.findByTestId('payment-done')).toHaveTextContent('awaiting mobile money verification');
  });

  it('split payment: cash + card for the remainder, partial balance shown', async () => {
    setup();
    supabaseMock.rpc.mockImplementation((name: string) =>
      Promise.resolve(name === 'record_payments' ? okResult() : { data: null, error: null }),
    );
    const u = user();
    renderWithProviders(<App />, '/cashier/payments?order=o1');
    await u.click(await screen.findByRole('button', { name: 'Cash' }));
    await u.clear(screen.getByLabelText('Cash amount'));
    await u.type(screen.getByLabelText('Cash amount'), '10');
    expect(screen.getByTestId('pp-remaining')).toHaveTextContent('$13.10');
    await u.click(screen.getByRole('button', { name: 'Card' }));
    expect(screen.getByLabelText('Card amount')).toHaveValue('13.10');
    await u.type(screen.getByLabelText('Card reference'), 'TID-0042');
    await u.click(screen.getByRole('checkbox', { name: /APPROVED/ }));
    expect(screen.getByTestId('pp-entered')).toHaveTextContent('$23.10');
    expect(screen.getByTestId('pp-remaining')).toHaveTextContent('$0.00');
    await u.click(screen.getByRole('button', { name: /Confirm payment \$23.10/ }));
    expect((rpcCalls('record_payments')[0]![1] as { p_payments: unknown[] }).p_payments).toEqual([
      { method: 'cash', amount: 10 },
      { method: 'card', amount: 13.1, reference: 'TID-0042', terminal_confirmed: true },
    ]);
  });

  it('a previous partial payment is honoured and overpayment is refused', async () => {
    setup({ amount_paid: 10, payment_status: 'partial' }, [pay('pp1', 'o1')]);
    const u = user();
    renderWithProviders(<App />, '/cashier/payments?order=o1');
    expect(await screen.findByTestId('pp-paid')).toHaveTextContent('$10.00');
    expect(screen.getByTestId('pp-outstanding')).toHaveTextContent('$13.10');
    await u.click(screen.getByRole('button', { name: 'Cash' }));
    await u.clear(screen.getByLabelText('Cash amount'));
    await u.type(screen.getByLabelText('Cash amount'), '20');
    expect(screen.getByText('Payments total 20.00 but only 13.10 is outstanding.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirm payment/ })).toBeDisabled();
  });

  it('server-side duplicate reference and "already settled" errors are explained', async () => {
    setup();
    supabaseMock.rpc.mockImplementation((name: string) =>
      Promise.resolve(
        name === 'record_payments'
          ? { data: null, error: { message: 'DUPLICATE_REFERENCE: zaad reference ZD-1234 was already used' } }
          : { data: null, error: null },
      ),
    );
    const u = user();
    renderWithProviders(<App />, '/cashier/payments?order=o1');
    await u.click(await screen.findByRole('button', { name: 'Zaad' }));
    await u.type(screen.getByLabelText('Zaad reference'), 'ZD-1234');
    await u.click(screen.getByRole('button', { name: /Confirm payment/ }));
    expect(await screen.findByText(/Duplicate reference: zaad reference ZD-1234 was already used/)).toBeInTheDocument();
  });

  it('without an open shift the cashier cannot take payments', async () => {
    setup();
    db.tables.cashier_shifts = [];
    renderWithProviders(<App />, '/cashier/payments?order=o1');
    expect(await screen.findByText(/Open your cash shift before taking payments/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cash' })).toBeDisabled();
  });

  it('opening a requested bill acknowledges it for the waiter', async () => {
    setup({ bill_requested_at: '2026-11-21T10:00:00Z' });
    renderWithProviders(<App />, '/cashier/payments?order=o1');
    await waitFor(() =>
      expect(rpcCalls('acknowledge_bill_request')).toEqual([['acknowledge_bill_request', { p_order: 'o1' }]]),
    );
  });

  it('mobile money verification: Verified needs confirmation; Not received needs a reason', async () => {
    setup({}, [
      pay('pm1', 'o1', {
        method: 'evc_plus',
        amount: 23.1,
        status: 'pending',
        verification_status: 'pending',
        reference: 'EVC-990011',
        transaction_number: 9,
      }),
    ]);
    const u = user();
    renderWithProviders(<App />, '/cashier/payments');
    const list = await screen.findByRole('list', { name: 'Awaiting verification' });
    expect(within(list).getByText(/EVC-990011/)).toBeInTheDocument();
    await u.click(within(list).getByRole('button', { name: 'Not received' }));
    const dlg = await screen.findByRole('dialog');
    await u.click(within(dlg).getByRole('button', { name: 'Not received' }));
    expect(within(dlg).getByText('Please enter a reason (at least 3 characters).')).toBeInTheDocument();
    expect(rpcCalls('verify_payment')).toHaveLength(0);
    await u.type(within(dlg).getByLabelText('Reason'), 'Not in merchant statement');
    await u.click(within(dlg).getByRole('button', { name: 'Not received' }));
    await waitFor(() =>
      expect(rpcCalls('verify_payment')).toEqual([
        ['verify_payment', { p_payment: 'pm1', p_approve: false, p_note: 'Not in merchant statement' }],
      ]),
    );
    await u.click(within(list).getByRole('button', { name: 'Verified' }));
    await u.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Yes, verified' }));
    await waitFor(() => expect(rpcCalls('verify_payment')[1]![1]).toMatchObject({ p_payment: 'pm1', p_approve: true }));
  });

  it('when cashiers may not verify, only a manager badge is shown', async () => {
    setup({}, [
      pay('pm1', 'o1', { method: 'zaad', status: 'pending', verification_status: 'pending', reference: 'ZD-1' }),
    ]);
    const original = restaurant.settings.permissions.cashier_can_verify_mobile_money;
    restaurant.settings.permissions.cashier_can_verify_mobile_money = false;
    try {
      renderWithProviders(<App />, '/cashier/payments');
      expect(await screen.findByText('Manager verification required')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Verified' })).not.toBeInTheDocument();
    } finally {
      restaurant.settings.permissions.cashier_can_verify_mobile_money = original;
    }
  });
});

describe('Active Orders and Bills', () => {
  it('waiter orders appear and refresh live; the cashier can open the bill and go to payment', async () => {
    db.tables.orders = [order('o7', 7, { waiter_id: WAITER_ID })];
    db.tables.order_items = [item('i1', 'o7', 'Bariis iyo Hilib', 1, 12)];
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderWithProviders(<App />, '/cashier/active-orders');
    expect(await screen.findByText('#7')).toBeInTheDocument();
    // A waiter submits a new order → realtime event → the list reloads.
    db.tables.orders.push(order('o8', 8, { waiter_id: WAITER_ID }));
    const ch = db.channels.find((c) =>
      (c.ons as Array<[string, { table: string }]>).some((o) => o[1].table === 'orders'),
    )!;
    act(() => {
      (ch.ons[0] as [string, unknown, () => void])[2]();
      vi.advanceTimersByTime(600);
    });
    vi.useRealTimers();
    expect(await screen.findByText('#8')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Take payment for 7' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/cashier/payments?order=o7');
  });

  it('bills are grouped by payment state and balances come from recorded payments', async () => {
    db.tables.orders = [
      o1({ amount_paid: 10, payment_status: 'partial' }),
      order('o2', 42),
      order('o3', 43, { bill_requested_at: '2026-11-21T10:00:00Z' }),
    ];
    db.tables.order_items = [item('i1', 'o1', 'Suqaar', 2, 10.5)];
    db.tables.payments = [pay('pp1', 'o1')];
    const u = user();
    renderWithProviders(<App />, '/cashier/bills');
    const tabs = await screen.findByRole('tablist');
    expect(within(tabs).getByRole('tab', { name: /Unpaid/ })).toHaveTextContent('1');
    expect(within(tabs).getByRole('tab', { name: /Partially paid/ })).toHaveTextContent('1');
    expect(within(tabs).getByRole('tab', { name: /Payment pending/ })).toHaveTextContent('1');
    await u.click(within(tabs).getByRole('tab', { name: /Partially paid/ }));
    await u.click(await screen.findByRole('button', { name: /#41/ }));
    expect(await screen.findByTestId('bill-total')).toHaveTextContent('$23.10');
    expect(screen.getByTestId('bill-paid')).toHaveTextContent('$10.00');
    expect(screen.getByTestId('bill-balance')).toHaveTextContent('$13.10');
    expect(screen.getByTestId('bill-tax')).toHaveTextContent('$2.10');
    // A discount is only possible before any payment.
    expect(screen.queryByText(/Apply discount/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Process payment/ })).toBeInTheDocument();
  });

  it('an authorised discount goes through apply_discount and its limit message is shown', async () => {
    db.tables.orders = [o1()];
    db.tables.order_items = [item('i1', 'o1', 'Suqaar', 2, 10.5)];
    supabaseMock.rpc.mockImplementation((name: string) =>
      Promise.resolve(
        name === 'apply_discount'
          ? {
              data: null,
              error: { message: 'DISCOUNT_LIMIT: Cashiers may discount at most 10% (2.10). Ask a manager.' },
            }
          : { data: null, error: null },
      ),
    );
    const u = user();
    renderWithProviders(<App />, '/cashier/bills?order=o1');
    await u.click(await screen.findByText(/Apply discount/));
    await u.type(screen.getByLabelText('Bill discount amount'), '5');
    await u.type(screen.getByLabelText('Bill discount reason'), 'Complaint');
    await u.click(screen.getByRole('button', { name: 'Apply' }));
    expect(rpcCalls('apply_discount')[0]![1]).toEqual({ p_order: 'o1', p_amount: 5, p_reason: 'Complaint' });
    expect(await screen.findByText('Cashiers may discount at most 10% (2.10). Ask a manager.')).toBeInTheDocument();
  });
});

describe('Refunds', () => {
  const seed = () => {
    db.tables.orders = [o1({ amount_paid: 23.1, payment_status: 'paid' })];
    db.tables.order_items = [item('i1', 'o1', 'Suqaar', 2, 10.5)];
    db.tables.payments = [pay('pp1', 'o1', { amount: 23.1, transaction_number: 7 })];
    db.tables.refunds = [];
  };

  it('a cashier refund above the limit becomes a request for manager approval; amounts are capped', async () => {
    seed();
    supabaseMock.rpc.mockImplementation((name: string) =>
      Promise.resolve(
        name === 'process_refund' ? { data: { status: 'pending_approval' }, error: null } : { data: null, error: null },
      ),
    );
    const u = user();
    renderWithProviders(<App />, '/cashier/refunds');
    await u.type(await screen.findByLabelText('Order or transaction number'), '41');
    await u.click(screen.getByRole('button', { name: 'Find' }));
    await u.click(await screen.findByRole('button', { name: /#7 · Cash · \$23.10/ }));
    await u.type(screen.getByLabelText('Refund quantity for Suqaar'), '1');
    await u.click(screen.getByRole('button', { name: /Use items value \$11.55/ }));
    expect(screen.getByLabelText(/^Amount/)).toHaveValue('11.55');
    expect(screen.getByText(/This refund needs manager approval/)).toBeInTheDocument();
    await u.clear(screen.getByLabelText(/^Amount/));
    await u.type(screen.getByLabelText(/^Amount/), '30');
    await u.type(screen.getByLabelText('Reason'), 'Cold food');
    await u.click(screen.getByRole('button', { name: 'Request refund approval' }));
    expect(await screen.findByText('At most $23.10 can be refunded on this transaction.')).toBeInTheDocument();
    expect(rpcCalls('process_refund')).toHaveLength(0);
    await u.clear(screen.getByLabelText(/^Amount/));
    await u.type(screen.getByLabelText(/^Amount/), '11.55');
    await u.click(screen.getByRole('button', { name: 'Request refund approval' }));
    await waitFor(() => expect(rpcCalls('process_refund')).toHaveLength(1));
    expect(rpcCalls('process_refund')[0]![1]).toMatchObject({
      p_payment: 'pp1',
      p_amount: 11.55,
      p_method: 'cash',
      p_reason: 'Cold food',
      p_items: [{ order_item_id: 'i1', quantity: 1 }],
      p_restock: false,
    });
  });

  it('managers approve or reject pending refunds; cashiers cannot', async () => {
    seed();
    db.tables.refunds = [
      {
        id: 'rf1',
        restaurant_id: RID,
        order_id: 'o1',
        payment_id: 'pp1',
        amount: 5,
        method: 'cash',
        reason: 'Late',
        reference: null,
        items: [],
        restock: false,
        status: 'pending_approval',
        requested_by: CASHIER_ID,
        approved_by: null,
        decision_note: null,
        created_at: '2026-11-21T11:00:00Z',
      },
    ];
    const u = user();
    renderWithProviders(<App />, '/cashier/refunds');
    await u.click(await screen.findByRole('tab', { name: /Awaiting approval/ }));
    expect(await screen.findByText('Awaiting manager approval')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
    asRole('manager');
    const { unmount } = renderWithProviders(<App />, '/cashier/refunds');
    const tabs = screen.getAllByRole('tab', { name: /Approvals/ });
    await u.click(tabs[tabs.length - 1]!);
    await u.click(await screen.findByRole('button', { name: 'Approve' }));
    await u.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Approve & pay out' }));
    await waitFor(() =>
      expect(rpcCalls('decide_refund')).toEqual([
        ['decide_refund', { p_refund: 'rf1', p_approve: true, p_note: null }],
      ]),
    );
    unmount();
  });
});

describe('Shift Management', () => {
  it('opens a shift with a validated opening float', async () => {
    db.tables.cashier_shifts = [];
    const u = user();
    renderWithProviders(<App />, '/cashier/shift');
    await u.type(await screen.findByLabelText(/Opening cash/), '-5');
    await u.click(screen.getByRole('button', { name: 'Open shift' }));
    expect(await screen.findByText(/Enter the opening cash/)).toBeInTheDocument();
    await u.clear(screen.getByLabelText(/Opening cash/));
    await u.type(screen.getByLabelText(/Opening cash/), '50');
    await u.click(screen.getByRole('button', { name: 'Open shift' }));
    expect(rpcCalls('open_cashier_shift')[0]![1]).toEqual({ p_restaurant: RID, p_opening_cash: 50, p_notes: null });
  });

  it('reconciles expected vs counted cash, demands a note for a difference and confirms before closing', async () => {
    supabaseMock.rpc.mockImplementation((name: string) =>
      Promise.resolve(
        name === 'cashier_shift_summary'
          ? {
              data: {
                opening_cash: 50,
                cash_sales: 33.1,
                cash_refunds: 5,
                pay_in: 0,
                pay_out: 5,
                expected_cash: 73.1,
                by_method: { cash: 33.1, card: 13.1, evc_plus: 10 },
                pending_verification: 7,
                refunds_total: 5,
                transactions: 4,
              },
              error: null,
            }
          : { data: null, error: null },
      ),
    );
    const u = user();
    renderWithProviders(<App />, '/cashier/shift');
    expect(await screen.findByTestId('expected-cash')).toHaveTextContent('$73.10');
    await u.type(screen.getByLabelText('Actual cash counted'), '70');
    expect(screen.getByTestId('cash-difference')).toHaveTextContent('-$3.10 short');
    await u.click(screen.getByRole('button', { name: 'Close shift' }));
    expect(await screen.findByText('Explain the cash difference in the closing notes.')).toBeInTheDocument();
    await u.type(screen.getByLabelText(/Closing notes/), 'Gave wrong change once');
    await u.click(screen.getByRole('button', { name: 'Close shift' }));
    const dlg = await screen.findByRole('dialog');
    expect(dlg).toHaveTextContent('cannot be changed');
    await u.click(within(dlg).getByRole('button', { name: 'Close shift' }));
    await waitFor(() =>
      expect(rpcCalls('close_cashier_shift')).toEqual([
        ['close_cashier_shift', { p_shift: 'sh1', p_counted_cash: 70, p_notes: 'Gave wrong change once' }],
      ]),
    );
  });

  it('records a cash movement with a reason', async () => {
    supabaseMock.rpc.mockImplementation((name: string) =>
      Promise.resolve(
        name === 'cashier_shift_summary'
          ? {
              data: {
                opening_cash: 50,
                cash_sales: 0,
                cash_refunds: 0,
                pay_in: 0,
                pay_out: 0,
                expected_cash: 50,
                by_method: {},
                pending_verification: 0,
                refunds_total: 0,
                transactions: 0,
              },
              error: null,
            }
          : { data: null, error: null },
      ),
    );
    const u = user();
    renderWithProviders(<App />, '/cashier/shift');
    await u.type(await screen.findByLabelText('Amount'), '5');
    await u.click(screen.getByRole('button', { name: 'Record movement' }));
    expect(await screen.findByText('Give a reason for the cash movement.')).toBeInTheDocument();
    await u.type(screen.getByLabelText('Reason'), 'Bought ice');
    await u.click(screen.getByRole('button', { name: 'Record movement' }));
    await waitFor(() =>
      expect(rpcCalls('add_cash_movement')[0]![1]).toEqual({
        p_shift: 'sh1',
        p_type: 'pay_out',
        p_amount: 5,
        p_reason: 'Bought ice',
      }),
    );
  });
});

describe('Transactions, receipts and dashboard', () => {
  const seed = () => {
    db.tables.orders = [o1({ amount_paid: 23.1, payment_status: 'paid', status: 'completed' }), order('o2', 42)];
    db.tables.order_items = [item('i1', 'o1', 'Suqaar', 2, 10.5)];
    db.tables.payments = [
      pay('pp1', 'o1', { amount: 13.1, amount_received: 20, change_given: 6.9 }),
      pay('pp2', 'o1', {
        method: 'card',
        amount: 10,
        reference: 'TID-1',
        transaction_number: 8,
        verification_status: 'terminal_confirmed',
      }),
      pay('pp3', 'o2', {
        method: 'zaad',
        amount: 7,
        status: 'pending',
        verification_status: 'pending',
        reference: 'ZD-77',
        transaction_number: 9,
      }),
    ];
  };

  it('lists every transaction with filters and exports CSV', async () => {
    seed();
    const createObjectURL = vi.fn((_b: Blob) => 'blob:x');
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    const u = user();
    renderWithProviders(<App />, '/cashier/transactions');
    expect(await screen.findByText('#9')).toBeInTheDocument();
    expect(screen.getByText(/Completed payments/)).toHaveTextContent('$23.10'); // the pending Zaad payment is excluded
    await u.selectOptions(screen.getByLabelText('Status'), 'pending');
    expect(screen.queryByText('#7')).not.toBeInTheDocument();
    expect(screen.getByText('#9')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Export CSV' }));
    const blob = createObjectURL.mock.calls[0]![0];
    const text = await new Promise<string>((res) => {
      const fr = new FileReader();
      fr.onload = () => res(String(fr.result));
      fr.readAsText(blob);
    });
    expect(text).toContain('Transaction #,Order #,Kind,Method,Amount,Reference');
    expect(text).toContain('9,42,payment,Zaad,7,ZD-77');
    expect(text).not.toContain('TID-1');
  });

  it('receipt preview is 80mm and printing issues the receipt and counts the print', async () => {
    seed();
    supabaseMock.rpc.mockImplementation((name: string) =>
      Promise.resolve(
        name === 'issue_receipt'
          ? { data: { receipt_id: 'rc1', receipt_number: 3 }, error: null }
          : { data: null, error: null },
      ),
    );
    const u = user();
    renderWithProviders(<App />, '/cashier/receipts?order=o1');
    const r = await screen.findByTestId('receipt');
    expect(r.getAttribute('style') ?? r.className).toMatch(/72mm|80mm/);
    expect(r).toHaveTextContent('Suqaar');
    expect(screen.getByText(/has not yet been tested on a physical printer/)).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: /Issue & print receipt/ }));
    await waitFor(() =>
      expect(rpcCalls('mark_receipt_printed')).toEqual([['mark_receipt_printed', { p_receipt: 'rc1' }]]),
    );
    expect(rpcCalls('issue_receipt')[0]![1]).toEqual({ p_order: 'o1' });
    expect(document.querySelector('iframe')?.getAttribute('src')).toBe('/cashier-print/receipt/o1?autoprint=1');
  });

  it('dashboard counts only confirmed payments as collected', async () => {
    seed();
    renderWithProviders(<App />, '/cashier');
    expect(await screen.findByTestId('stat-collected')).toHaveTextContent('$23.10');
    expect(screen.getByTestId('stat-pending')).toHaveTextContent('$7.00');
    expect(screen.getByTestId('stat-cash')).toHaveTextContent('$13.10');
    expect(screen.getByTestId('stat-card')).toHaveTextContent('$10.00');
    expect(screen.getByTestId('stat-mobile')).toHaveTextContent('$0.00');
    expect(screen.getByTestId('stat-unpaid')).toHaveTextContent('1');
    expect(screen.getByTestId('current-shift')).toHaveTextContent('Shift open since');
  });
});
