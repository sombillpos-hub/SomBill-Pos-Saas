import { Link } from 'react-router-dom';
import { Popover } from 'radix-ui';
import { Bell, HandCoins, Receipt } from 'lucide-react';
import { useAuth } from '@sombill/shared-hooks/AuthContext';
import { useQuery } from '@sombill/shared-hooks/useQuery';
import { useRealtime } from '@sombill/shared-hooks/useRealtime';
import { fetchTableStatus } from '@sombill/api-client/queries';

/**
 * Bell with a live count of tables that need the manager's attention (bill requested / payment pending).
 * Read-only: it uses the same `table_status_v` view as the Tables page and refreshes through realtime.
 */
export function AttentionBell() {
  const { restaurant } = useAuth();
  const rid = restaurant?.id;
  const q = useQuery(async () => (rid ? fetchTableStatus(rid) : []), [rid]);
  useRealtime(['restaurant_tables', 'orders', 'payments'], rid, () => void q.reload());

  const billRequests = (q.data ?? []).filter((t) => t.status === 'bill_requested');
  const paymentPending = (q.data ?? []).filter((t) => t.status === 'payment_pending');
  const count = billRequests.length + paymentPending.length;

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="sb-icon-btn"
          aria-label={count ? `Notifications, ${count} need attention` : 'Notifications'}
        >
          {count > 0 && <span className="sb-bell-ping" aria-hidden />}
          <Bell className="h-[18px] w-[18px]" aria-hidden />
          {count > 0 && <span className="sb-bell-badge">{count > 9 ? '9+' : count}</span>}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="sb-popover" align="end" sideOffset={10}>
          <h3>Needs attention</h3>
          {count === 0 && <p className="sb-pop-empty">All clear. No tables are waiting.</p>}
          {billRequests.map((t) => (
            <Link key={t.id} to="/tables">
              <span className="sb-pop-icon">
                <Receipt className="h-4 w-4" aria-hidden />
              </span>
              <span>
                <p>Table {t.table_number} asked for the bill</p>
                <p className="sb-pop-sub">Open Tables &amp; Floor Plans</p>
              </span>
            </Link>
          ))}
          {paymentPending.map((t) => (
            <Link key={t.id} to="/tables">
              <span className="sb-pop-icon">
                <HandCoins className="h-4 w-4" aria-hidden />
              </span>
              <span>
                <p>Table {t.table_number}: payment pending</p>
                <p className="sb-pop-sub">Open Tables &amp; Floor Plans</p>
              </span>
            </Link>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
