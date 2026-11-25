import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { authState } from '@sombill/shared-utils/testing/mockAuth';
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
const { NAV_ITEMS } = await import('@sombill/manager/layouts/navigation');

const HEADINGS: Record<string, string> = {
  '/manager': 'Business Control Center',
  '/manager/orders': 'Orders',
  '/manager/menu': 'Menu Management',
  '/manager/categories': 'Categories',
  '/manager/tables': 'Tables & Floor Plans',
  '/manager/staff': 'Staff Management',
  '/manager/customers': 'Customers',
  '/manager/inventory': 'Inventory',
  '/manager/suppliers': 'Suppliers',
  '/manager/purchase-orders': 'Purchase Orders',
  '/manager/expenses': 'Expenses',
  '/manager/reports': 'Reports & Analytics',
  '/manager/settings': 'Settings',
};

describe('manager sidebar', () => {
  beforeEach(() => {
    resetDb();
    authState.access = 'member';
    authState.role = 'manager';
  });

  it('has all 13 modules plus logout and no dead links', async () => {
    expect(NAV_ITEMS.map((n) => n.to)).toEqual(Object.keys(HEADINGS));
    renderWithProviders(<AppRoutes />, '/manager');
    const nav = await screen.findByRole('navigation', { name: 'Main navigation' });
    for (const item of NAV_ITEMS)
      expect(within(nav).getByRole('link', { name: item.label })).toHaveAttribute('href', item.to);
    expect(within(nav).getByRole('button', { name: /logout/i })).toBeInTheDocument();
  });

  it.each(Object.entries(HEADINGS))('route %s renders its working module page', async (path, heading) => {
    renderWithProviders(<AppRoutes />, path);
    expect(await screen.findByRole('heading', { level: 1, name: heading }, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.queryByText('Page not found')).not.toBeInTheDocument();
    expect(screen.queryByText('Could not load data')).not.toBeInTheDocument();
    // data modules query real tables (Settings reads the loaded restaurant). Queries start in an effect that can run
    // just after the heading paints, so wait for it rather than assuming it already happened.
    if (path !== '/manager/settings') await waitFor(() => expect(db.calls.length).toBeGreaterThan(0));
  });

  it('unknown routes show a not-found page inside the layout', async () => {
    renderWithProviders(<AppRoutes />, '/does-not-exist');
    expect(await screen.findByText('Page not found')).toBeInTheDocument();
  });
});
