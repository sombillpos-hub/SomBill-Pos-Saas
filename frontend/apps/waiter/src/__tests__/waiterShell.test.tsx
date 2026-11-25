import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { asRole } from '@sombill/shared-utils/testing/mockAuth';
import { renderWithProviders } from '@sombill/shared-utils/testing/render';
import { resetDb } from '@sombill/shared-utils/testing/mockSupabase';

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

/** Pretends the viewport is a phone: only max-width queries match. */
function phoneViewport() {
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        matches: query.includes('max-width'),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  );
}

describe('waiter floor app shell (touch design)', () => {
  beforeEach(() => {
    resetDb();
    localStorage.clear();
    sessionStorage.clear();
    asRole('waiter');
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is light by default, switches to dark with the toggle, remembers it, and is removed on unmount', async () => {
    const user = userEvent.setup();
    const { unmount } = renderWithProviders(<AppRoutes />, '/waiter');
    await screen.findByRole('navigation', { name: 'Waiter navigation' });
    expect(theme()).toBe('light');
    await user.click(screen.getByRole('button', { name: 'Dark mode' }));
    expect(theme()).toBe('obsidian');
    expect(localStorage.getItem('sombill.theme')).toBe('dark');
    unmount();
    expect(theme()).toBeNull();
  });

  it('keeps the full navigation and adds a floating dock on phones, with the order button on the middle', async () => {
    phoneViewport();
    const { container } = renderWithProviders(<AppRoutes />, '/waiter');
    const dock = await screen.findByRole('navigation', { name: 'Quick navigation' });
    expect(container.querySelector('.pos-root')).toHaveAttribute('data-dock');
    expect(within(dock).getByRole('link', { name: /Tables/ })).toHaveAttribute('href', '/waiter/tables');
    expect(within(dock).getByRole('link', { name: /My Orders/ })).toHaveAttribute('href', '/waiter/orders');
    expect(within(dock).getByRole('link', { name: /Kitchen Status/ })).toHaveAttribute('href', '/waiter/kitchen');
    expect(within(dock).getByRole('link', { name: 'New Order' })).toHaveAttribute('href', '/waiter/new-order');
    // "More" opens the complete 9-section menu
    await userEvent.setup().click(within(dock).getByRole('button', { name: /More/ }));
    const full = await screen.findAllByRole('navigation', { name: 'Waiter navigation' });
    expect(within(full.at(-1)!).getAllByRole('link').length).toBeGreaterThanOrEqual(9);
  });

  it('shows no dock on wide screens', async () => {
    renderWithProviders(<AppRoutes />, '/waiter');
    await screen.findByRole('navigation', { name: 'Waiter navigation' });
    expect(screen.queryByRole('navigation', { name: 'Quick navigation' })).not.toBeInTheDocument();
  });

  it('announces when the connection is lost and clears the notice when it returns', async () => {
    renderWithProviders(<AppRoutes />, '/waiter');
    await screen.findByRole('navigation', { name: 'Waiter navigation' });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(/offline/i);
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
