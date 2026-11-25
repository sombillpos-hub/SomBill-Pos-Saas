import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { authState } from '@sombill/shared-utils/testing/mockAuth';
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

const { LoginPage } = await import('@/features/auth/pages/LoginPage');
const { CashierRoute, ManagerRoute } = await import('@/app/router/ProtectedRoute');
const { AppLayout } = await import('@sombill/manager/layouts/AppLayout');

function GuardedApp() {
  return (
    <Routes>
      <Route path="/login" element={<p>LOGIN SCREEN</p>} />
      <Route path="/waiter" element={<p>WAITER HOME</p>} />
      <Route element={<CashierRoute />}>
        <Route path="/cashier" element={<p>CASHIER HOME</p>} />
      </Route>
      <Route element={<ManagerRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<p>SECRET DASHBOARD</p>} />
        </Route>
      </Route>
    </Routes>
  );
}

describe('login', () => {
  beforeEach(() => {
    resetDb();
    authState.access = 'signed_out';
    authState.signIn.mockReset().mockResolvedValue(undefined);
  });

  it('validates input before calling Supabase', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/login" element={<LoginPage />} />
      </Routes>,
      '/login',
    );
    await userEvent.click(screen.getByRole('button', { name: /^Sign In to SomBill/ }));
    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(screen.getByText('Enter your password')).toBeInTheDocument();
    expect(authState.signIn).not.toHaveBeenCalled();
  });

  it('signs in and hands off to the role router', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<p>DASH</p>} />
      </Routes>,
      '/login',
    );
    await userEvent.type(screen.getByLabelText('Email address'), 'amina@grill.test');
    await userEvent.type(screen.getByLabelText('Password'), 'Correct-horse-1');
    await userEvent.click(screen.getByRole('button', { name: /^Sign In to SomBill/ }));
    await waitFor(() => expect(authState.signIn).toHaveBeenCalledWith('amina@grill.test', 'Correct-horse-1'));
    expect(await screen.findByText('DASH')).toBeInTheDocument();
  });

  it('shows a clear error for wrong credentials', async () => {
    authState.signIn.mockRejectedValueOnce(new Error('Incorrect email or password.'));
    renderWithProviders(
      <Routes>
        <Route path="/login" element={<LoginPage />} />
      </Routes>,
      '/login',
    );
    await userEvent.type(screen.getByLabelText('Email address'), 'amina@grill.test');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: /^Sign In to SomBill/ }));
    expect(await screen.findByText('Incorrect email or password.')).toHaveAttribute('role', 'alert');
  });
});

describe('manager access guard', () => {
  beforeEach(() => resetDb());

  it('redirects signed-out users to login', async () => {
    authState.access = 'signed_out';
    renderWithProviders(<GuardedApp />, '/dashboard');
    expect(await screen.findByText('LOGIN SCREEN')).toBeInTheDocument();
    expect(screen.queryByText('SECRET DASHBOARD')).not.toBeInTheDocument();
  });
  it('sends waiters and cashiers to their POS apps and blocks kitchen staff', async () => {
    authState.access = 'member';
    authState.role = 'waiter';
    renderWithProviders(<GuardedApp />, '/dashboard');
    expect(await screen.findByText('WAITER HOME')).toBeInTheDocument();
    expect(screen.queryByText('SECRET DASHBOARD')).not.toBeInTheDocument();
    cleanup();
    authState.role = 'cashier';
    renderWithProviders(<GuardedApp />, '/dashboard');
    expect(await screen.findByText('CASHIER HOME')).toBeInTheDocument();
    expect(screen.queryByText('SECRET DASHBOARD')).not.toBeInTheDocument();
    cleanup();
    authState.role = 'kitchen';
    renderWithProviders(<GuardedApp />, '/dashboard');
    expect(await screen.findByText('Not available for your role')).toBeInTheDocument();
    expect(screen.queryByText('SECRET DASHBOARD')).not.toBeInTheDocument();
    authState.role = 'manager';
  });
  it('keeps waiters and kitchen staff out of the Cashier POS; managers may use it', async () => {
    authState.access = 'member';
    authState.role = 'waiter';
    renderWithProviders(<GuardedApp />, '/cashier');
    expect(await screen.findByText('WAITER HOME')).toBeInTheDocument();
    expect(screen.queryByText('CASHIER HOME')).not.toBeInTheDocument();
    cleanup();
    authState.role = 'kitchen';
    renderWithProviders(<GuardedApp />, '/cashier');
    expect(await screen.findByText('Not available for your role')).toBeInTheDocument();
    cleanup();
    authState.role = 'manager';
    renderWithProviders(<GuardedApp />, '/cashier');
    expect(await screen.findByText('CASHIER HOME')).toBeInTheDocument();
  });
  it('blocks suspended accounts', async () => {
    authState.access = 'suspended';
    renderWithProviders(<GuardedApp />, '/dashboard');
    expect(await screen.findByText('Account suspended')).toBeInTheDocument();
  });
  it('lets active managers in', async () => {
    authState.access = 'member';
    authState.role = 'manager';
    renderWithProviders(<GuardedApp />, '/dashboard');
    expect(await screen.findByText('SECRET DASHBOARD')).toBeInTheDocument();
  });
});

describe('logout', () => {
  it('asks for confirmation then signs out', async () => {
    resetDb();
    authState.access = 'member';
    authState.role = 'manager';
    authState.signOut.mockClear();
    renderWithProviders(<GuardedApp />, '/dashboard');
    const [logout] = await screen.findAllByRole('button', { name: /logout/i });
    await userEvent.click(logout!);
    expect(screen.getByText('Sign out?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(authState.signOut).toHaveBeenCalledTimes(1));
  });
});
