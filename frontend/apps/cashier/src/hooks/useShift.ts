import { useAuth, useRestaurant } from '@sombill/shared-hooks/AuthContext';
import { useQuery } from '@sombill/shared-hooks/useQuery';
import { useRealtime } from '@sombill/shared-hooks/useRealtime';
import { fetchOpenCashierShift } from '../services/data';

/** The signed-in cashier's open cash shift (null when none). */
export function useOpenShift() {
  const r = useRestaurant();
  const { session, role } = useAuth();
  const uid = session?.user.id ?? '';
  const q = useQuery(() => fetchOpenCashierShift(r.id, uid), [r.id, uid]);
  useRealtime(['payments'], r.id, () => void q.reload());
  const required = role === 'cashier' && r.settings.permissions.require_open_shift;
  return { ...q, shift: q.data ?? null, required, blocked: required && !q.loading && !q.data };
}
