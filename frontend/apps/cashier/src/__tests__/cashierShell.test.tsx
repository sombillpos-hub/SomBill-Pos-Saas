import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { asRole } from '@sombill/shared-utils/testing/mockAuth';
import { renderWithProviders } from '@sombill/shared-utils/testing/render';
import { db, resetDb } from '@sombill/shared-utils/testing/mockSupabase';
import { categories, products, tableStatus } from '@sombill/shared-utils/testing/posFixtures';
import { CASHIER_ID, RID } from '@sombill/shared-utils/testing/fixtures';

vi.mock('@sombill/api-client/supabase', async (orig) => ({
  ...(await orig<typeof import('@sombill/api-client/supabase')>()),
  supabase: (await import('@sombill/shared-utils/testing/mockSupabase')).supabaseMock,
}));
vi.mock(
  '@sombill/shared-hooks/AuthContext',
  async () => (await import('@sombill/shared-utils/testing/mockAuth')).authModule,
);

const { AppRoutes } = await import('@/app/App');
const theme = () => document.documentElement.getAttribute('data-sb-theme');

describe('cashier POS shell (terminal design)', () => {
  beforeEach(() => {
    resetDb();
    localStorage.clear();
    sessionStorage.clear();
    asRole('cashier');
    db.tables.categories = categories;
    db.tables.products = products;
    db.tables.table_status_v = tableStatus();
    db.tables.restaurant_tables = tableStatus();
    db.tables.cashier_shifts = [
      {
        id: 'sh1',
        restaurant_id: RID,
        cashier_id: CASHIER_ID,
        status: 'open',
        opened_at: new Date().toISOString(),
        opening_cash: 50,
        opening_notes: null,
        closed_at: null,
        closed_by: null,
        expected_cash: null,
        counted_cash: null,
        cash_difference: null,
        closing_notes: null,
        summary: null,
      },
    ];
  });

  it('is light by default, switches to dark with the toggle, remembers it, and is removed on unmount', async () => {
    const user = userEvent.setup();
    const first = renderWithProviders(<AppRoutes />, '/cashier');
    await screen.findByRole('navigation', { name: 'Cashier navigation' });
    expect(theme()).toBe('light');
    await user.click(screen.getByRole('button', { name: 'Dark mode' }));
    expect(theme()).toBe('obsidian');
    expect(localStorage.getItem('sombill.theme')).toBe('dark');
    first.unmount();
    expect(theme()).toBeNull();

    renderWithProviders(<AppRoutes />, '/cashier');
    await screen.findByRole('navigation', { name: 'Cashier navigation' });
    expect(theme()).toBe('obsidian');
  });

  it('shows the operational topbar: clock, connection, shift and notifications', async () => {
    renderWithProviders(<AppRoutes />, '/cashier');
    await screen.findByRole('navigation', { name: 'Cashier navigation' });
    const header = document.querySelector('.sb-topbar') as HTMLElement;
    expect(header.querySelector('.sb-pos-title')).toHaveTextContent('Cashier POS');
    expect(within(header).getByLabelText('Restaurant local time')).toBeInTheDocument();
    expect(within(header).getByRole('status', { name: /^Connection:/ })).toBeInTheDocument();
    expect(await within(header).findByRole('link', { name: /cash shift/i })).toHaveAttribute('href', '/cashier/shift');
    expect(within(header).getByRole('link', { name: /^Notifications \(\d+ unread\)$/ })).toHaveAttribute(
      'href',
      '/cashier/notifications',
    );
  });

  it('has a bottom status bar with real values only', async () => {
    renderWithProviders(<AppRoutes />, '/cashier');
    await screen.findByRole('navigation', { name: 'Cashier navigation' });
    const bar = screen.getByRole('contentinfo');
    expect(bar).toHaveTextContent(/^Cashier: /);
    expect(bar).toHaveTextContent(/SomBill POS · Live updates: /);
  });

  it('marks the payment methods and menu tiles for styling without changing their behaviour', async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<AppRoutes />, '/cashier/new-sale');
    await screen.findByRole('heading', { level: 1, name: 'New Sale' });
    const grid = await screen.findByRole('list', { name: 'Products' });
    expect(within(grid).getAllByRole('listitem').length).toBeGreaterThan(0);
    expect(container.querySelector('[data-sb="product-card"]')).not.toBeNull();
    expect(container.querySelector('[data-sb="dining-tabs"]')).not.toBeNull();
    await user.click(screen.getByRole('radio', { name: 'Delivery' }));
    expect(screen.getByRole('radio', { name: 'Delivery' })).toHaveAttribute('aria-checked', 'true');
  });
});
