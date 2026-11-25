import { useAuth, useRestaurant } from '@sombill/shared-hooks/AuthContext';
import { useRealtimeHealth } from '@sombill/shared-hooks/useRealtime';
import { PosStatusBar } from '@sombill/shared-ui/shell/PosStatusBar';
import type { CashierShift } from '@sombill/shared-types/types';

/** Bottom status bar of the Cashier POS. Only real values: the signed-in cashier, shift, live-sync state and the tax rule. */
export function CashierStatusBar({ shift, timeZone }: { shift: CashierShift | null; timeZone?: string }) {
  const r = useRestaurant();
  const { profile } = useAuth();
  const health = useRealtimeHealth();
  let since = '';
  if (shift) {
    try {
      since = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone }).format(
        new Date(shift.opened_at),
      );
    } catch {
      since = '';
    }
  }
  const rate = Number((Number(r.tax_rate) * 100).toFixed(2));
  return (
    <PosStatusBar
      left={
        <>
          Cashier: {profile?.full_name || profile?.email || '—'} · Shift: {shift ? `open since ${since}` : 'none open'}
        </>
      }
      center={<>SomBill POS · Live updates: {health}</>}
      right={
        <>
          {r.tax_label} {rate}%{r.tax_inclusive ? ' (incl.)' : ''} · {r.currency}
        </>
      }
    />
  );
}
