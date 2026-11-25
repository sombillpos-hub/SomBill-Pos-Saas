import { vi } from 'vitest';
import type { ReactNode } from 'react';
import type { AccessState } from '@sombill/shared-hooks/AuthContext';
import type { Organization, SessionRole } from '@sombill/shared-types/types';
import { CASHIER_ID, MANAGER_ID, WAITER_ID, restaurant } from './fixtures';

export const authState = {
  access: 'member' as AccessState,
  role: 'manager' as SessionRole,
  viewingBranch: false,
  enterBranch: vi.fn().mockResolvedValue(undefined),
  leaveBranch: vi.fn(),
  reloadOrganization: vi.fn().mockResolvedValue(undefined),
  signIn: vi.fn().mockResolvedValue(undefined),
  signOut: vi.fn().mockResolvedValue(undefined),
  reload: vi.fn().mockResolvedValue(undefined),
};

/** Sets the mocked session: e.g. asRole('waiter'), asRole(null, 'signed_out'). */
export function asRole(role: SessionRole | null, access: AccessState = 'member') {
  authState.access = access;
  if (role) authState.role = role;
}

export const OWNER_ID = '88888888-8888-4888-8888-888888888888';
export const orgFixture: Organization = {
  id: '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a',
  name: 'Horn Hospitality Group',
  plan: 'growth',
  max_branches: 4,
  max_staff: 60,
  license_status: 'active',
  license_expires_at: '2027-06-30T00:00:00Z',
  settings: { reporting_currency: 'USD', fx_rates: { SLS: 11800 } },
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};
const uid = () =>
  authState.role === 'owner'
    ? OWNER_ID
    : authState.role === 'waiter'
      ? WAITER_ID
      : authState.role === 'cashier'
        ? CASHIER_ID
        : MANAGER_ID;

export const authModule = {
  AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  HQ_HOME: '/dashboard/super-admin',
  roleHome: (role: SessionRole | null | undefined) =>
    role === 'owner'
      ? '/dashboard/super-admin'
      : role === 'waiter'
        ? '/waiter'
        : role === 'cashier'
          ? '/cashier'
          : '/manager',
  useAuth: () => ({
    session: authState.access === 'signed_out' ? null : { user: { id: uid() } },
    profile: {
      id: uid(),
      full_name:
        authState.role === 'owner'
          ? 'Hassan Owner'
          : authState.role === 'waiter'
            ? 'Warsame Waiter'
            : authState.role === 'cashier'
              ? 'Cali Cashier'
              : 'Amina Manager',
      email:
        authState.role === 'waiter'
          ? 'warsame@grill.test'
          : authState.role === 'cashier'
            ? 'cali@grill.test'
            : 'amina@grill.test',
      phone: '+252634111222',
      avatar_url: null,
      last_login_at: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
    membership: {
      id: 'm1',
      restaurant_id: restaurant.id,
      user_id: uid(),
      role: authState.role === 'owner' ? 'manager' : authState.role,
      status: authState.access === 'suspended' ? 'suspended' : 'active',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '',
    },
    restaurant:
      authState.access === 'member' && (authState.role !== 'owner' || authState.viewingBranch) ? restaurant : null,
    access: authState.access,
    role: authState.access === 'member' ? authState.role : null,
    organization: authState.role === 'owner' ? orgFixture : null,
    isOwner: authState.role === 'owner',
    viewingBranch: authState.viewingBranch,
    enterBranch: authState.enterBranch,
    leaveBranch: authState.leaveBranch,
    reloadOrganization: authState.reloadOrganization,
    error: null,
    signIn: authState.signIn,
    signOut: authState.signOut,
    reload: authState.reload,
  }),
  useRestaurant: () => restaurant,
};
