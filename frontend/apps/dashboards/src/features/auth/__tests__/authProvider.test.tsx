import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { db, resetDb, supabaseMock } from '@sombill/shared-utils/testing/mockSupabase';
import { restaurant, MANAGER_ID } from '@sombill/shared-utils/testing/fixtures';

vi.mock('@sombill/api-client/supabase', async (orig) => ({
  ...(await orig<typeof import('@sombill/api-client/supabase')>()),
  supabase: (await import('@sombill/shared-utils/testing/mockSupabase')).supabaseMock,
}));
const { AuthProvider, useAuth } = await import('@sombill/shared-hooks/AuthContext');

function Probe() {
  const a = useAuth();
  return (
    <p>
      access:{a.access} role:{a.role ?? 'none'} restaurant:{a.restaurant?.name ?? 'none'}
    </p>
  );
}
const session = { user: { id: MANAGER_ID } };

describe('AuthProvider role resolution (real logic)', () => {
  it('resolves an active manager with their restaurant', async () => {
    resetDb();
    supabaseMock.auth.getSession.mockResolvedValueOnce({ data: { session } } as never);
    db.tables.restaurant_members = [
      { id: 'm', user_id: MANAGER_ID, restaurant_id: restaurant.id, role: 'manager', status: 'active' },
    ];
    db.tables.restaurants = [restaurant as unknown as Record<string, unknown>];
    db.tables.profiles = [{ id: MANAGER_ID, full_name: 'Amina' }];
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    expect(await screen.findByText('access:member role:manager restaurant:Hargeisa Grill')).toBeInTheDocument();
  });
  it('resolves a waiter as an active member with the waiter role', async () => {
    resetDb();
    supabaseMock.auth.getSession.mockResolvedValueOnce({ data: { session } } as never);
    db.tables.restaurant_members = [
      { id: 'm', user_id: MANAGER_ID, restaurant_id: restaurant.id, role: 'waiter', status: 'active' },
    ];
    db.tables.restaurants = [restaurant as unknown as Record<string, unknown>];
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    expect(await screen.findByText('access:member role:waiter restaurant:Hargeisa Grill')).toBeInTheDocument();
  });
  it('treats a suspended manager as suspended', async () => {
    resetDb();
    supabaseMock.auth.getSession.mockResolvedValueOnce({ data: { session } } as never);
    db.tables.restaurant_members = [
      { id: 'm', user_id: MANAGER_ID, restaurant_id: restaurant.id, role: 'manager', status: 'suspended' },
    ];
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    expect(await screen.findByText('access:suspended role:none restaurant:none')).toBeInTheDocument();
  });
  it('routes a user with no restaurant to setup', async () => {
    resetDb();
    supabaseMock.auth.getSession.mockResolvedValueOnce({ data: { session } } as never);
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    expect(await screen.findByText('access:no_restaurant role:none restaurant:none')).toBeInTheDocument();
  });
  it('is signed out without a session', async () => {
    resetDb();
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    expect(await screen.findByText('access:signed_out role:none restaurant:none')).toBeInTheDocument();
  });
});
