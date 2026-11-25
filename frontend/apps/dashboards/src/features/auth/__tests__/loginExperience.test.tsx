import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { authState } from '@sombill/shared-utils/testing/mockAuth';
import { renderWithProviders } from '@sombill/shared-utils/testing/render';
import { resetDb, supabaseMock } from '@sombill/shared-utils/testing/mockSupabase';

vi.mock('@sombill/api-client/supabase', async (orig) => ({
  ...(await orig<typeof import('@sombill/api-client/supabase')>()),
  supabase: (await import('@sombill/shared-utils/testing/mockSupabase')).supabaseMock,
}));
vi.mock(
  '@sombill/shared-hooks/AuthContext',
  async () => (await import('@sombill/shared-utils/testing/mockAuth')).authModule,
);

const { LoginPage } = await import('@/features/auth/pages/LoginPage');
const { ResetPasswordPage } = await import('@/features/auth/pages/ResetPasswordPage');
const { applyRememberMe, enforceTemporarySession } = await import('@/features/auth/session');

const renderLogin = () =>
  renderWithProviders(
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<p>HOME</p>} />
    </Routes>,
    '/login',
  );
const signInButton = () => screen.getByRole('button', { name: /^Sign In to SomBill/ });

describe('login experience', () => {
  beforeEach(() => {
    resetDb();
    localStorage.clear();
    sessionStorage.clear();
    authState.access = 'signed_out';
    authState.signIn.mockReset().mockResolvedValue(undefined);
    authState.signOut.mockClear();
    authState.reload.mockClear();
  });

  it('shows the brand showcase, install pill only when the browser offers one, and no dead provider buttons', async () => {
    renderLogin();
    expect(screen.getByRole('heading', { level: 1, name: 'Welcome Back!' })).toBeInTheDocument();
    expect(screen.getByText('Smart POS. Smooth Operations.')).toBeInTheDocument();
    expect(screen.getByText('Fast POS')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /install app/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /google/i })).toBeNull();
    expect(screen.queryByText(/passkey|face id/i)).toBeNull();
    expect(screen.queryByText(/offline mesh/i)).toBeNull();
    expect(screen.getByRole('link', { name: 'Contact Support' })).toHaveAttribute(
      'href',
      expect.stringContaining('wa.me/'),
    );
    act(() => {
      const e = new Event('beforeinstallprompt');
      Object.assign(e, {
        prompt: vi.fn().mockResolvedValue(undefined),
        userChoice: Promise.resolve({ outcome: 'accepted' }),
      });
      window.dispatchEvent(e);
    });
    expect(await screen.findByRole('button', { name: /install app/i })).toBeInTheDocument();
  });

  it('offers email domain chips while typing and fills the address', async () => {
    const user = userEvent.setup();
    renderLogin();
    const email = screen.getByLabelText('Email address');
    expect(screen.queryByRole('button', { name: '@gmail.com' })).toBeNull();
    await user.type(email, 'amina');
    await user.click(await screen.findByRole('button', { name: '@gmail.com' }));
    expect(email).toHaveValue('amina@gmail.com');
    expect(screen.queryByRole('button', { name: '@gmail.com' })).toBeNull();
  });

  it('reveals the password and warns when Caps Lock is on', async () => {
    const user = userEvent.setup();
    renderLogin();
    const pw = screen.getByLabelText('Password');
    expect(pw).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(pw).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText('Caps Lock is on')).toBeNull();
    fireEvent.keyDown(pw, { key: 'A', modifierCapsLock: true });
    expect(await screen.findByText('Caps Lock is on')).toBeInTheDocument();
  });

  it('signs in with the email and password and remembers the session by default', async () => {
    const user = userEvent.setup();
    renderLogin();
    await user.type(screen.getByLabelText('Email address'), 'amina@grill.test');
    await user.type(screen.getByLabelText('Password'), 'Correct-horse-1');
    await user.click(signInButton());
    await waitFor(() => expect(authState.signIn).toHaveBeenCalledWith('amina@grill.test', 'Correct-horse-1'));
    expect(await screen.findByText('HOME')).toBeInTheDocument();
    expect(localStorage.getItem('sombill.session.temp')).toBeNull();
  });

  it('un-ticking "Remember me" makes the session end with the browser tab', async () => {
    const user = userEvent.setup();
    renderLogin();
    await user.click(screen.getByRole('checkbox', { name: 'Remember me' }));
    await user.type(screen.getByLabelText('Email address'), 'amina@grill.test');
    await user.type(screen.getByLabelText('Password'), 'Correct-horse-1');
    await user.click(signInButton());
    await screen.findByText('HOME');
    expect(localStorage.getItem('sombill.session.temp')).toBe('1');
    // A new browser session (sessionStorage gone) removes the stored login before the app reads it.
    localStorage.setItem('sb-abc-auth-token', '{"x":1}');
    sessionStorage.clear();
    expect(enforceTemporarySession()).toBe(true);
    expect(localStorage.getItem('sb-abc-auth-token')).toBeNull();
    // A remembered session is left alone.
    applyRememberMe(true);
    localStorage.setItem('sb-abc-auth-token', '{"x":1}');
    expect(enforceTemporarySession()).toBe(false);
    expect(localStorage.getItem('sb-abc-auth-token')).not.toBeNull();
  });

  it('switches language to Somali and to Arabic (right to left) and remembers it', async () => {
    const user = userEvent.setup();
    const first = renderLogin();
    await user.click(screen.getByRole('button', { name: /^SO$/ }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Ku soo dhawaaw mar kale!');
    await user.click(screen.getByRole('button', { name: /^AR$/ }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('مرحباً بعودتك!');
    expect(document.querySelector('.auth-viewport')).toHaveAttribute('dir', 'rtl');
    first.unmount();
    renderLogin();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('مرحباً بعودتك!');
  });

  describe('forgot password with a one-time code', () => {
    it('sends the code, verifies six digits, sets a new password and goes in', async () => {
      const user = userEvent.setup();
      renderLogin();
      await user.type(screen.getByLabelText('Email address'), 'amina@grill.test');
      await user.click(screen.getByRole('button', { name: 'Forgot password?' }));
      expect(await screen.findByRole('heading', { level: 1, name: 'Reset Your Password' })).toBeInTheDocument();
      expect(screen.getByLabelText('Email address')).toHaveValue('amina@grill.test');

      await user.click(await screen.findByRole('button', { name: /^Send Reset Code/ }));
      await waitFor(() =>
        expect(supabaseMock.auth.resetPasswordForEmail).toHaveBeenCalledWith(
          'amina@grill.test',
          expect.objectContaining({ redirectTo: expect.stringContaining('/reset-password') }),
        ),
      );
      expect(await screen.findByText('Enter the 6-digit code')).toBeInTheDocument();
      expect(screen.getByText('Resend in 1:00')).toBeInTheDocument();

      await user.click(await screen.findByLabelText('Digit 1'));
      await user.paste('123456');
      await waitFor(() =>
        expect(supabaseMock.auth.verifyOtp).toHaveBeenCalledWith({
          email: 'amina@grill.test',
          token: '123456',
          type: 'recovery',
        }),
      );
      expect(await screen.findByRole('heading', { level: 1, name: 'Choose a new password' })).toBeInTheDocument();

      await user.type(await screen.findByLabelText('New password'), 'Brand-new-pass-1');
      await user.type(screen.getByLabelText('Confirm password'), 'Brand-new-pass-1');
      await user.click(screen.getByRole('button', { name: 'Save password' }));
      await waitFor(() => expect(supabaseMock.auth.updateUser).toHaveBeenCalledWith({ password: 'Brand-new-pass-1' }));
      expect(await screen.findByText('HOME')).toBeInTheDocument();
      expect(authState.reload).toHaveBeenCalled();
    });

    it('does not send anything for an invalid email, and shows a bad code without moving on', async () => {
      const user = userEvent.setup();
      renderLogin();
      await user.click(screen.getByRole('button', { name: 'Forgot password?' }));
      await screen.findByRole('heading', { level: 1, name: 'Reset Your Password' });
      await user.type(screen.getByLabelText('Email address'), 'nope');
      await user.click(await screen.findByRole('button', { name: /^Send Reset Code/ }));
      expect(await screen.findByText('Enter a valid email address')).toHaveAttribute('role', 'alert');
      expect(supabaseMock.auth.resetPasswordForEmail).not.toHaveBeenCalled();

      await user.clear(screen.getByLabelText('Email address'));
      await user.type(screen.getByLabelText('Email address'), 'amina@grill.test');
      await user.click(await screen.findByRole('button', { name: /^Send Reset Code/ }));
      await screen.findByText('Enter the 6-digit code');
      supabaseMock.auth.verifyOtp.mockResolvedValueOnce({
        data: {},
        error: { message: 'Token has expired or is invalid' },
      });
      await user.click(screen.getByLabelText('Digit 1'));
      await user.paste('000000');
      expect(await screen.findByText(/not valid or has expired/)).toHaveAttribute('role', 'alert');
      expect(screen.getByRole('heading', { level: 1, name: 'Enter the 6-digit code' })).toBeInTheDocument();
    });

    it('goes back to sign in, and signs out if a code was already accepted', async () => {
      const user = userEvent.setup();
      renderLogin();
      await user.click(screen.getByRole('button', { name: 'Forgot password?' }));
      await screen.findByRole('heading', { level: 1, name: 'Reset Your Password' });
      await user.type(screen.getByLabelText('Email address'), 'amina@grill.test');
      await user.click(await screen.findByRole('button', { name: /^Send Reset Code/ }));
      await screen.findByText('Enter the 6-digit code');
      await user.click(screen.getByLabelText('Digit 1'));
      await user.paste('123456');
      await screen.findByText('Choose a new password');
      await user.click(screen.getByRole('button', { name: 'Back to Sign In' }));
      await waitFor(() => expect(authState.signOut).toHaveBeenCalled());
      expect(await screen.findByRole('heading', { level: 1, name: 'Welcome Back!' })).toBeInTheDocument();
    });
  });

  it('the email-link page uses the same design and still saves a new password', async () => {
    const user = userEvent.setup();
    authState.access = 'member';
    renderWithProviders(
      <Routes>
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/" element={<p>HOME</p>} />
      </Routes>,
      '/reset-password',
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Set your password' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('New password'), 'Brand-new-pass-1');
    await user.type(screen.getByLabelText('Confirm password'), 'Brand-new-pass-1');
    await user.click(screen.getByRole('button', { name: 'Save password' }));
    expect(await screen.findByText('HOME')).toBeInTheDocument();
  });
});
