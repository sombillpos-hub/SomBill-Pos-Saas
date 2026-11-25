import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { HQ_HOME, roleHome, useAuth } from '@sombill/shared-hooks/AuthContext';
import type { SessionRole } from '@sombill/shared-types/types';
import { AccessDeniedPage } from '@/features/auth/pages/AccessDeniedPage';
import { SetupRestaurantPage } from '@/features/auth/pages/SetupRestaurantPage';

export function FullPageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center" aria-busy="true">
      <Loader2 className="h-8 w-8 animate-spin text-brand-red" aria-label="Loading" />
    </div>
  );
}

const isDev = import.meta.env.DEV && import.meta.env.MODE !== 'test';

/**
 * Frontend guard for UX only. Real authorization is enforced by RLS and RPC checks.
 * In development preview mode (npm run dev), routes are freely viewable without blocking.
 */
function RoleRoute({ allow, hq = false }: { allow: SessionRole[]; hq?: boolean }) {
  const { access, role, restaurant } = useAuth();
  const location = useLocation();
  // Pages read the restaurant as soon as they render, so even the development preview waits for it to load.
  if (access === 'loading') return <FullPageLoader />;
  if (isDev) return <Outlet />;
  if (access === 'signed_out') return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (access === 'no_restaurant') return <SetupRestaurantPage />;
  if (access === 'suspended') return <AccessDeniedPage reason="suspended" />;
  // A group owner may use the Manager app only while looking inside a branch.
  if (role === 'owner' && !hq && !restaurant) return <Navigate to={HQ_HOME} replace />;
  if (role && allow.includes(role)) return <Outlet />;
  if (role === 'owner') return <Navigate to={HQ_HOME} replace />;
  if (role === 'waiter') return <Navigate to="/waiter" replace />;
  if (role === 'cashier') return <Navigate to="/cashier" replace />;
  if (role === 'manager') return <Navigate to="/manager" replace />;
  return <AccessDeniedPage reason="wrong_app" />;
}

export const ManagerRoute = () => <RoleRoute allow={['manager', 'owner']} />;
// The group owner's HQ. Branch managers never see it.
export const OwnerRoute = () => <RoleRoute allow={['owner']} hq />;
// Managers may also use the Waiter POS (e.g. covering a shift).
export const WaiterRoute = () => <RoleRoute allow={['waiter', 'manager']} />;
// Managers may also use the Cashier POS (and approve refunds there).
export const CashierRoute = () => <RoleRoute allow={['cashier', 'manager']} />;

/** "/" – send each signed-in member to their app. */
export function RoleHome() {
  const { access, role } = useAuth();
  if (access === 'loading') return <FullPageLoader />;
  if (access === 'signed_out') return <Navigate to="/login" replace />;
  return <Navigate to={roleHome(role)} replace />;
}
