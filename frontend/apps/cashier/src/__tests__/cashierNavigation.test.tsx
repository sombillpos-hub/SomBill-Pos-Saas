import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { asRole, authState } from '@sombill/shared-utils/testing/mockAuth';
import { renderWithProviders } from '@sombill/shared-utils/testing/render';
import { db, resetDb } from '@sombill/shared-utils/testing/mockSupabase';

vi.mock('@sombill/api-client/supabase', async (orig) => ({
  ...(await orig<typeof import('@sombill/api-client/supabase')>()),
  supabase: (await import('@sombill/shared-utils/testing/mockSupabase')).supabaseMock,
}));
vi.mock(
  '@sombill/shared-hooks/AuthContext',
  async () => (await import('@sombill/shared-utils/testing/mockAuth')).authModule,
);

const { AppRoutes } = await import('@/app/App');
const { CASHIER_NAV } = await import('@sombill/cashier/layouts/navigation');

const HEADINGS: Record<string, string | RegExp> = {
  '/cashier': /^Hello, Cali/,
  '/cashier/tables': 'Tables',
  '/cashier/new-sale': 'New Sale',
  '/cashier/active-orders': 'Active Orders',
  '/cashier/bills': 'Bills',
  '/cashier/payments': 'Payment Processing',
  '/cashier/transactions': 'Transactions',
  '/cashier/receipts': 'Receipts',
  '/cashier/refunds': 'Refunds',
  '/cashier/shift': 'Shift Management',
  '/cashier/profile': 'My Profile',
};

describe('cashier routing and protected routes', () => {
  beforeEach(() => {
    resetDb();
    sessionStorage.clear();
    asRole('cashier');
  });

  it('sidebar has the 10 cashier sections plus logout, each linked', async () => {
    expect(CASHIER_NAV.map((n) => n.to)).toEqual(Object.keys(HEADINGS));
    renderWithProviders(<AppRoutes />, '/cashier');
    const nav = await screen.findByRole('navigation', { name: 'Cashier navigation' });
    for (const item of CASHIER_NAV)
      expect(within(nav).getByRole('link', { name: new RegExp(item.label) })).toHaveAttribute('href', item.to);
    expect(within(nav).getByRole('button', { name: /logout/i })).toBeInTheDocument();
  });

  it.each(Object.entries(HEADINGS))('%s opens its working page', async (path, heading) => {
    renderWithProviders(<AppRoutes />, path);
    expect(await screen.findByRole('heading', { level: 1, name: heading }, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.queryByText('Page not found')).not.toBeInTheDocument();
    expect(screen.queryByText('Could not load data')).not.toBeInTheDocument();
    await waitFor(() => expect(db.calls.length).toBeGreaterThan(0));
  });

  it('login lands a cashier in the Cashier POS; manager pages and the Waiter POS are refused', async () => {
    renderWithProviders(<AppRoutes />, '/');
    expect(await screen.findByRole('heading', { level: 1, name: /^Hello, Cali/ })).toBeInTheDocument();
    cleanup();
    renderWithProviders(<AppRoutes />, '/settings');
    expect(await screen.findByRole('heading', { level: 1, name: /^Hello, Cali/ })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Settings' })).not.toBeInTheDocument();
    cleanup();
    renderWithProviders(<AppRoutes />, '/waiter/new-order');
    expect(await screen.findByRole('heading', { level: 1, name: /^Hello, Cali/ })).toBeInTheDocument();
  });

  it('waiters, kitchen staff and signed-out users cannot open cashier pages or print routes', async () => {
    asRole('waiter');
    renderWithProviders(<AppRoutes />, '/cashier/payments');
    expect(await screen.findByRole('heading', { level: 1, name: /^Hello, Warsame/ })).toBeInTheDocument();
    cleanup();
    asRole('kitchen');
    renderWithProviders(<AppRoutes />, '/cashier/refunds');
    expect(await screen.findByText('Not available for your role')).toBeInTheDocument();
    cleanup();
    asRole(null, 'signed_out');
    renderWithProviders(<AppRoutes />, '/cashier-print/receipt/o1');
    expect(await screen.findByRole('heading', { name: 'Welcome Back!' })).toBeInTheDocument();
  });

  it('logout asks for confirmation, clears the unsaved sale and signs out', async () => {
    sessionStorage.setItem(
      'sombill.cashier.sale',
      JSON.stringify({
        lines: [{ key: 'k', product_id: 'p1', name: 'X', unit_price: 1, quantity: 1, notes: '', tax_exempt: false }],
      }),
    );
    authState.signOut.mockClear();
    renderWithProviders(<AppRoutes />, '/cashier');
    const nav = await screen.findByRole('navigation', { name: 'Cashier navigation' });
    await userEvent.click(within(nav).getByRole('button', { name: /logout/i }));
    await userEvent.click(await screen.findByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(authState.signOut).toHaveBeenCalledTimes(1));
    expect(sessionStorage.getItem('sombill.cashier.sale') ?? '').not.toContain('p1');
  });
});
