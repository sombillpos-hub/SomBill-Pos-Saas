import { Link } from 'react-router-dom';
import { Lock, LockOpen } from 'lucide-react';
import type { CashierShift } from '@sombill/shared-types/types';

/** Topbar chip for the cash shift: shows whether one is open and links to Shift Management. Read-only. */
export function ShiftPill({
  shift,
  loading,
  timeZone,
}: {
  shift: CashierShift | null;
  loading: boolean;
  timeZone?: string;
}) {
  const open = Boolean(shift);
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
  return (
    <Link
      to="/cashier/shift"
      className="sb-shift-pill"
      data-state={loading ? 'loading' : open ? 'open' : 'closed'}
      aria-label={open ? `Cash shift open${since ? ` since ${since}` : ''}` : 'No open cash shift'}
    >
      {open ? <LockOpen className="h-3.5 w-3.5" aria-hidden /> : <Lock className="h-3.5 w-3.5" aria-hidden />}
      <span>{loading ? 'Shift…' : open ? `Shift open${since ? ` · ${since}` : ''}` : 'No open shift'}</span>
    </Link>
  );
}
