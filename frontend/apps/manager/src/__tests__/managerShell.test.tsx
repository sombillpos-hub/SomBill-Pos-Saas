import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { authState } from '@sombill/shared-utils/testing/mockAuth';
import { renderWithProviders } from '@sombill/shared-utils/testing/render';
import { db, resetDb } from '@sombill/shared-utils/testing/mockSupabase';
import { RID } from '@sombill/shared-utils/testing/fixtures';

vi.mock('@sombill/api-client/supabase', async (orig) => ({
  ...(await orig<typeof import('@sombill/api-client/supabase')>()),
  supabase: (await import('@sombill/shared-utils/testing/mockSupabase')).supabaseMock,
}));
vi.mock(
  '@sombill/shared-hooks/AuthContext',
  async () => (await import('@sombill/shared-utils/testing/mockAuth')).authModule,
);

const { AppRoutes } = await import('@/app/App');

const table = (id: string, n: number, status: string) => ({
  id,
  restaurant_id: RID,
  table_number: n,
  name: null,
  capacity: 4,
  section: 'Main',
  floor: '1',
  pos_x: 0,
  pos_y: 0,
  shape: 'square',
  needs_cleaning: false,
  archived_at: null,
  status,
});
const theme = () => document.documentElement.getAttribute('data-sb-theme');

describe('manager shell (Obsidian Ruby design)', () => {
  beforeEach(() => {
    resetDb();
    localStorage.clear();
    authState.access = 'member';
    authState.role = 'manager';
  });

  it('is light by default and removes the theme attribute when the manager layout unmounts', async () => {
    const view = renderWithProviders(<AppRoutes />, '/dashboard');
    await screen.findByRole('navigation', { name: 'Main navigation' });
    expect(theme()).toBe('light');
    expect(screen.getByRole('button', { name: 'Dark mode' })).toHaveAttribute('aria-pressed', 'false');
    view.unmount();
    expect(theme()).toBeNull();
  });

  it('switches to the dark theme with the toggle, remembers it and switches back', async () => {
    const user = userEvent.setup();
    const first = renderWithProviders(<AppRoutes />, '/dashboard');
    await screen.findByRole('navigation', { name: 'Main navigation' });
    await user.click(screen.getByRole('button', { name: 'Dark mode' }));
    expect(theme()).toBe('obsidian');
    expect(screen.getByRole('button', { name: 'Dark mode' })).toHaveAttribute('aria-pressed', 'true');
    expect(localStorage.getItem('sombill.theme')).toBe('dark');
    first.unmount();

    // a new visit starts in the saved mode, with no flash of the light theme
    renderWithProviders(<AppRoutes />, '/dashboard');
    await screen.findByRole('navigation', { name: 'Main navigation' });
    expect(theme()).toBe('obsidian');
    await user.click(screen.getByRole('button', { name: 'Dark mode' }));
    expect(theme()).toBe('light');
    expect(localStorage.getItem('sombill.theme')).toBe('light');
  });

  it('falls back to light when the saved value is unknown', async () => {
    localStorage.setItem('sombill.theme', 'purple');
    renderWithProviders(<AppRoutes />, '/dashboard');
    await screen.findByRole('navigation', { name: 'Main navigation' });
    expect(theme()).toBe('light');
  });

  it('offers the theme switch in the command palette', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppRoutes />, '/dashboard');
    await screen.findByRole('navigation', { name: 'Main navigation' });
    await user.keyboard('{Control>}k{/Control}');
    await user.click(await screen.findByRole('option', { name: /Switch to dark mode/ }));
    expect(theme()).toBe('obsidian');
    await user.keyboard('{Control>}k{/Control}');
    expect(await screen.findByRole('option', { name: /Switch to light mode/ })).toBeInTheDocument();
  });

  it('shares the saved theme choice with the Waiter app', async () => {
    authState.role = 'waiter';
    localStorage.setItem('sombill.theme', 'dark');
    renderWithProviders(<AppRoutes />, '/waiter');
    await screen.findByRole('navigation', { name: 'Waiter navigation' });
    expect(theme()).toBe('obsidian');
  });

  it('groups the 13 modules under section headings without changing the links', async () => {
    renderWithProviders(<AppRoutes />, '/dashboard');
    const nav = await screen.findByRole('navigation', { name: 'Main navigation' });
    for (const heading of ['Overview', 'Operations', 'People', 'Supply chain', 'Finance & insights', 'System'])
      expect(within(nav).getByText(heading)).toBeInTheDocument();
    expect(within(nav).getAllByRole('link')).toHaveLength(13);
    expect(within(nav).getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
  });

  it('collapses and expands the sidebar and remembers the choice', async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<AppRoutes />, '/dashboard');
    await screen.findByRole('navigation', { name: 'Main navigation' });
    const root = () => container.querySelector('.manager-dashboard-root') as HTMLElement;
    expect(root().dataset.collapsed).toBe('false');
    await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    expect(root().dataset.collapsed).toBe('true');
    expect(localStorage.getItem('sombill.sidebar.collapsed')).toBe('1');
    expect(screen.getByRole('link', { name: 'Orders' })).toHaveAttribute('title', 'Orders'); // icon-only, still labelled
    await user.click(screen.getByRole('button', { name: 'Expand sidebar' }));
    expect(root().dataset.collapsed).toBe('false');
  });

  it('opens the command palette with Ctrl+K and jumps to a page', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppRoutes />, '/dashboard');
    await screen.findByRole('heading', { level: 1, name: 'Business Control Center' });
    await user.keyboard('{Control>}k{/Control}');
    const input = await screen.findByRole('combobox', { name: 'Jump to a page' });
    await user.type(input, 'inven');
    expect(screen.queryByRole('option', { name: 'Orders' })).not.toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('heading', { level: 1, name: 'Inventory' }, { timeout: 4000 })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('combobox', { name: 'Jump to a page' })).not.toBeInTheDocument());
  });

  it('shows how many tables need attention on the bell and lists them', async () => {
    const user = userEvent.setup();
    db.tables.table_status_v = [
      table('t1', 1, 'available'),
      table('t4', 4, 'bill_requested'),
      table('t7', 7, 'payment_pending'),
    ];
    renderWithProviders(<AppRoutes />, '/dashboard');
    const bell = await screen.findByRole('button', { name: 'Notifications, 2 need attention' });
    await user.click(bell);
    expect(await screen.findByText('Table 4 asked for the bill')).toBeInTheDocument();
    expect(screen.getByText('Table 7: payment pending')).toBeInTheDocument();
  });

  it('has no attention badge when nothing is waiting', async () => {
    const user = userEvent.setup();
    db.tables.table_status_v = [table('t1', 1, 'available')];
    renderWithProviders(<AppRoutes />, '/dashboard');
    const bell = await screen.findByRole('button', { name: 'Notifications' });
    await user.click(bell);
    expect(await screen.findByText(/All clear/)).toBeInTheDocument();
  });

  it('keeps the logout confirmation', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppRoutes />, '/dashboard');
    const nav = await screen.findByRole('navigation', { name: 'Main navigation' });
    await user.click(within(nav).getByRole('button', { name: /logout/i }));
    expect(await screen.findByRole('dialog', { name: 'Sign out?' })).toBeInTheDocument();
    cleanup();
  });
});
