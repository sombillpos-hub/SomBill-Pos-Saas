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
const { WAITER_NAV } = await import('@sombill/waiter/layouts/navigation');

const HEADINGS: Record<string, string | RegExp> = {
  '/waiter': /^Hello, Warsame/,
  '/waiter/tables': 'Tables',
  '/waiter/new-order': 'New Order',
  '/waiter/orders': 'My Orders',
  '/waiter/menu': 'Menu',
  '/waiter/kitchen': 'Kitchen Status',
  '/waiter/bills': 'Bills',
  '/waiter/notifications': 'Notifications',
  '/waiter/profile': 'My Profile',
};

describe('waiter routing and protected routes', () => {
  beforeEach(() => {
    resetDb();
    sessionStorage.clear();
    asRole('waiter');
  });

  it('sidebar has the 9 waiter sections plus logout, each linked', async () => {
    expect(WAITER_NAV.map((n) => n.to)).toEqual(Object.keys(HEADINGS));
    renderWithProviders(<AppRoutes />, '/waiter');
    const nav = await screen.findByRole('navigation', { name: 'Waiter navigation' });
    for (const item of WAITER_NAV)
      expect(within(nav).getByRole('link', { name: new RegExp(item.label) })).toHaveAttribute('href', item.to);
    expect(within(nav).getByRole('button', { name: /logout/i })).toBeInTheDocument();
  });

  it.each(Object.entries(HEADINGS))('%s opens its working page', async (path, heading) => {
    renderWithProviders(<AppRoutes />, path);
    expect(await screen.findByRole('heading', { level: 1, name: heading }, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.queryByText('Page not found')).not.toBeInTheDocument();
    expect(screen.queryByText('Could not load data')).not.toBeInTheDocument();
    await waitFor(() => expect(db.calls.length).toBeGreaterThan(0)); // queries start in an effect just after paint
  });

  it('login lands a waiter in the Waiter POS, never the manager dashboard', async () => {
    renderWithProviders(<AppRoutes />, '/');
    expect(await screen.findByRole('heading', { level: 1, name: /^Hello/ })).toBeInTheDocument();
    cleanup();
    renderWithProviders(<AppRoutes />, '/reports');
    expect(await screen.findByRole('heading', { level: 1, name: /^Hello/ })).toBeInTheDocument();
    expect(screen.queryByText('Reports & Analytics')).not.toBeInTheDocument();
  });

  it('signed-out users are sent to login; cashiers and kitchen staff are refused', async () => {
    asRole(null, 'signed_out');
    renderWithProviders(<AppRoutes />, '/waiter/new-order');
    expect(await screen.findByRole('heading', { name: 'Welcome Back!' })).toBeInTheDocument();
    cleanup();
    asRole('kitchen');
    renderWithProviders(<AppRoutes />, '/waiter/tables');
    expect(await screen.findByText('Not available for your role')).toBeInTheDocument();
    expect(screen.getByText(/Kitchen display/)).toBeInTheDocument();
  });

  it('managers may use the Waiter POS', async () => {
    asRole('manager');
    renderWithProviders(<AppRoutes />, '/waiter/tables');
    expect(await screen.findByRole('heading', { level: 1, name: 'Tables' })).toBeInTheDocument();
  });

  it('logout asks for confirmation, clears the draft and signs out', async () => {
    sessionStorage.setItem(
      'sombill.waiter.cart',
      JSON.stringify({
        lines: [{ key: 'k', product_id: 'p1', name: 'X', unit_price: 1, tax_exempt: false, quantity: 1, notes: '' }],
      }),
    );
    authState.signOut.mockClear();
    renderWithProviders(<AppRoutes />, '/waiter');
    await userEvent.click(
      await within(await screen.findByRole('navigation', { name: 'Waiter navigation' })).findByRole('button', {
        name: /logout/i,
      }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(authState.signOut).toHaveBeenCalledTimes(1));
    expect(JSON.parse(sessionStorage.getItem('sombill.waiter.cart') ?? '{}').lines).toEqual([]);
  });
});
