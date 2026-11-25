import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { asRole, authState, orgFixture } from '@sombill/shared-utils/testing/mockAuth';
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

const { AppRoutes } = await import('@/app/App');
const theme = () => document.documentElement.getAttribute('data-sb-theme');
const HQ = '/dashboard/super-admin';
const R2 = '99999999-9999-4999-8999-999999999999';

const branch = (id: string, name: string) => ({
  id,
  name,
  address: `${name} road`,
  phone: null,
  email: null,
  currency: 'USD',
  timezone: 'Africa/Mogadishu',
  tax_rate: 0.05,
  tax_label: 'VAT',
  tax_inclusive: false,
  receipt_footer: null,
  settings: {},
  organization_id: orgFixture.id,
});
const summary = (id: string, name: string, gross: number) => ({
  restaurant_id: id,
  name,
  address: null,
  phone: null,
  currency: 'USD',
  timezone: 'Africa/Mogadishu',
  tax_rate: 0.05,
  orders_count: 10,
  gross,
  net: gross,
  tax: gross * 0.05,
  discounts: 0,
  guests: 20,
  cancelled_count: 0,
  collected: gross,
  refunded: 0,
  open_orders: 1,
  tables_total: 10,
  tables_occupied: 4,
  open_cashier_shifts: 1,
  staff_on_duty: 3,
  staff_active: 8,
  last_order_at: new Date().toISOString(),
});

function seed() {
  db.tables.restaurants = [branch(RID, 'Hargeisa Main'), branch(R2, 'Berbera Port')];
  supabaseMock.rpc.mockImplementation(async (fn: string) => {
    if (fn === 'org_branch_summary') {
      return { data: [summary(RID, 'Hargeisa Main', 1000), summary(R2, 'Berbera Port', 500)], error: null };
    }
    if (fn === 'org_revenue_series') {
      return {
        data: [
          { bucket: new Date().toISOString(), restaurant_id: RID, gross: 1000, orders: 10 },
          { bucket: new Date().toISOString(), restaurant_id: R2, gross: 500, orders: 10 },
        ],
        error: null,
      };
    }
    if (fn === 'org_payment_mix') {
      return {
        data: [
          {
            restaurant_id: RID,
            method: 'zaad',
            kind: 'payment',
            status: 'completed',
            verification_status: 'verified',
            amount: 600,
            txns: 5,
          },
          {
            restaurant_id: RID,
            method: 'cash',
            kind: 'payment',
            status: 'completed',
            verification_status: 'not_required',
            amount: 900,
            txns: 5,
          },
        ],
        error: null,
      };
    }
    if (fn === 'org_broadcast') return { data: 7, error: null };
    if (fn === 'org_push_menu_item') {
      return {
        data: [
          { restaurant_id: RID, status: 'updated', product_id: 'p1' },
          { restaurant_id: R2, status: 'updated', product_id: 'p2' },
        ],
        error: null,
      };
    }
    if (fn === 'org_menu_matrix') {
      return {
        data: [
          {
            restaurant_id: RID,
            product_id: 'p1',
            name: 'Camel Burger',
            category: 'Mains',
            price: 6,
            is_available: true,
          },
          {
            restaurant_id: R2,
            product_id: 'p2',
            name: 'Camel Burger',
            category: 'Mains',
            price: 7,
            is_available: true,
          },
        ],
        error: null,
      };
    }
    return { data: [], error: null };
  });
}

describe('Super Admin HQ', () => {
  beforeEach(() => {
    resetDb();
    localStorage.clear();
    sessionStorage.clear();
    authState.enterBranch.mockClear();
    authState.leaveBranch.mockClear();
    authState.viewingBranch = false;
    asRole('owner');
    seed();
  });

  it('sends the owner to HQ from the root, and is light by default with a working dark toggle', async () => {
    const user = userEvent.setup();
    const first = renderWithProviders(<AppRoutes />, '/');
    await screen.findByRole('navigation', { name: 'Super Admin navigation' });
    expect(theme()).toBe('light');
    await user.click(screen.getByRole('button', { name: 'Dark mode' }));
    expect(theme()).toBe('obsidian');
    first.unmount();
    expect(theme()).toBeNull();
  });

  it('has the four navigation groups and every link points inside HQ', async () => {
    renderWithProviders(<AppRoutes />, HQ);
    const nav = await screen.findByRole('navigation', { name: 'Super Admin navigation' });
    for (const g of ['Global command', 'Consolidated finance', 'Central operations', 'Security & infra']) {
      expect(within(nav).getByText(g)).toBeInTheDocument();
    }
    const links = within(nav).getAllByRole('link');
    expect(links).toHaveLength(13);
    for (const l of links) expect(l.getAttribute('href')?.startsWith(HQ)).toBe(true);
  });

  it('shows real consolidated numbers and one card per branch on the overview', async () => {
    renderWithProviders(<AppRoutes />, HQ);
    expect(await screen.findByRole('heading', { name: /Horn Hospitality Group — Command HQ/ })).toBeInTheDocument();
    expect(await screen.findByText('Total multi-branch revenue')).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText(/1,500/).length).toBeGreaterThan(0));
    expect(screen.getByRole('article', { name: 'Hargeisa Main' })).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Berbera Port' })).toBeInTheDocument();
    expect(screen.getByText(/Subax|Galab|Habeen/)).toBeInTheDocument();
  });

  it('the branch switcher filters the overview to one branch', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppRoutes />, HQ);
    await screen.findByRole('article', { name: 'Berbera Port' });
    await user.selectOptions(screen.getByRole('combobox', { name: 'Branch scope' }), R2);
    await waitFor(() => expect(screen.queryByRole('article', { name: 'Hargeisa Main' })).not.toBeInTheDocument());
    expect(screen.getByRole('article', { name: 'Berbera Port' })).toBeInTheDocument();
    expect(localStorage.getItem('sombill.hq.scope')).toBe(R2);
  });

  it('"Switch to Branch View" enters that branch as manager', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppRoutes />, HQ);
    const card = await screen.findByRole('article', { name: 'Berbera Port' });
    await user.click(within(card).getByRole('button', { name: /Switch to Branch View/ }));
    await waitFor(() => expect(authState.enterBranch).toHaveBeenCalledWith(R2));
  });

  it('keeps non-owners out of HQ, and owners without a branch out of branch pages', async () => {
    asRole('waiter');
    const w = renderWithProviders(<AppRoutes />, HQ);
    await waitFor(() => expect(screen.queryByRole('navigation', { name: 'Super Admin navigation' })).toBeNull());
    expect(screen.queryByText(/Command HQ/)).toBeNull();
    w.unmount();

    asRole('manager');
    const m = renderWithProviders(<AppRoutes />, `${HQ}/audit`);
    await waitFor(() => expect(screen.queryByText('Audit & Anti-Fraud')).toBeNull());
    m.unmount();

    asRole('owner');
    renderWithProviders(<AppRoutes />, '/orders');
    await screen.findByRole('navigation', { name: 'Super Admin navigation' });
  });

  it('records an owner review of a flagged event', async () => {
    const user = userEvent.setup();
    db.tables.audit_logs = [
      {
        id: 1,
        restaurant_id: RID,
        actor_id: null,
        action: 'cancel',
        entity_type: 'order',
        entity_id: 'o1',
        old_data: null,
        new_data: { order_number: 41 },
        reason: 'customer left',
        created_at: new Date().toISOString(),
      },
    ];
    renderWithProviders(<AppRoutes />, `${HQ}/audit`);
    await user.click(await screen.findByRole('button', { name: /Approve/ }));
    await user.type(screen.getByLabelText(/Note/), 'Checked with cashier');
    await user.click(screen.getByRole('button', { name: 'Mark cleared' }));
    await waitFor(() => expect(db.tables.audit_reviews?.length).toBe(1));
    expect(db.tables.audit_reviews![0]).toMatchObject({ status: 'cleared', note: 'Checked with cashier' });
  });

  it('broadcasts a message through the server function', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppRoutes />, HQ);
    await user.click(await screen.findByRole('button', { name: /Broadcast/ }));
    await user.type(screen.getByLabelText(/Title/), 'Meeting at 3');
    await user.click(screen.getByRole('button', { name: 'Send broadcast' }));
    await waitFor(() =>
      expect(supabaseMock.rpc).toHaveBeenCalledWith(
        'org_broadcast',
        expect.objectContaining({ p_org: orgFixture.id, p_title: 'Meeting at 3' }),
      ),
    );
  });

  it('pushes a price to chosen branches only after confirmation, and flags differing prices', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppRoutes />, `${HQ}/menu-push`);
    expect(await screen.findByText('Prices differ')).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Dish name/), 'Camel Burger');
    await user.type(screen.getByLabelText('New price'), '8');
    await user.click(screen.getByRole('button', { name: /^Push/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Push to branches?' });
    expect(supabaseMock.rpc).not.toHaveBeenCalledWith('org_push_menu_item', expect.anything());
    await user.click(within(dialog).getByRole('button', { name: /Push/ }));
    await waitFor(() =>
      expect(supabaseMock.rpc).toHaveBeenCalledWith(
        'org_push_menu_item',
        expect.objectContaining({ p_name: 'Camel Burger', p_price: 8 }),
      ),
    );
  });

  it('shows plan usage on the subscription page without any billing controls', async () => {
    renderWithProviders(<AppRoutes />, `${HQ}/licenses`);
    expect(await screen.findByText('Growth')).toBeInTheDocument();
    expect(screen.getByText('2 of 4')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /upgrade|pay|subscribe/i })).toBeNull();
  });
});
