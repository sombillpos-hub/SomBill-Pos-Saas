import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ReceiptText, RotateCcw, Timer, UserCircle } from 'lucide-react';
import '@fontsource-variable/outfit';
import '@fontsource-variable/jetbrains-mono';
import { useAuth, useRestaurant } from '@sombill/shared-hooks/AuthContext';
import { useQuery } from '@sombill/shared-hooks/useQuery';
import { useRealtime } from '@sombill/shared-hooks/useRealtime';
import { supabase } from '@sombill/api-client/supabase';
import { PosShell } from '@sombill/shared-ui/pos/PosShell';
import { CartProvider, useCart } from '@sombill/shared-hooks/cart';
import { CASHIER_NAV } from './navigation';
import { useOpenShift } from '../hooks/useShift';
import { ShiftPill } from '../components/ShiftPill';
import { CashierStatusBar } from '../components/CashierStatusBar';

export function CashierLayout() {
  return (
    <CartProvider storageKey="sombill.cashier.sale">
      <CashierShell />
    </CartProvider>
  );
}

function CashierShell() {
  const r = useRestaurant();
  const { session } = useAuth();
  const navigate = useNavigate();
  const cart = useCart();
  const open = useOpenShift();
  // Badges: bills waiting for a cashier and mobile money awaiting verification.
  const counts = useQuery(async () => {
    const [bills, pending] = await Promise.all([
      supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', r.id)
        .not('bill_requested_at', 'is', null)
        .neq('payment_status', 'paid')
        .not('status', 'in', '(completed,cancelled)'),
      supabase
        .from('payments')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', r.id)
        .eq('status', 'pending'),
    ]);
    return { bills: bills.count ?? 0, pending: pending.count ?? 0 };
  }, [r.id, session?.user.id]);
  const reload = useCallback(() => void counts.reload(), [counts]);
  useRealtime(['orders', 'payments'], r.id, reload);
  return (
    <PosShell
      nav={CASHIER_NAV}
      navLabel="Cashier navigation"
      appLabel="Cashier POS"
      homePath="/cashier"
      storageKey="sombill.cashier.sidebar"
      compactPaths={['/cashier/new-sale', '/cashier/payments']}
      badge={(to) =>
        to === '/cashier/new-sale'
          ? cart.itemCount
          : to === '/cashier/bills'
            ? (counts.data?.bills ?? 0)
            : to === '/cashier/payments'
              ? (counts.data?.pending ?? 0)
              : 0
      }
      onLogout={() => cart.clear()}
      themed
      appTone="cashier"
      accountItems={[
        {
          label: 'Shift Management',
          description: 'Open, close & count cash drawer',
          icon: Timer,
          onClick: () => navigate('/cashier/shift'),
        },
        {
          label: 'Receipts & Thermal Print',
          description: 'Reprint or export 80mm receipts',
          icon: ReceiptText,
          onClick: () => navigate('/cashier/receipts'),
        },
        {
          label: 'Refunds & Reversals',
          description: 'Process authorised refunds',
          icon: RotateCcw,
          onClick: () => navigate('/cashier/refunds'),
        },
        {
          label: 'My Profile',
          description: 'Account details & security',
          icon: UserCircle,
          onClick: () => navigate('/cashier/profile'),
        },
      ]}
      topbarExtra={<ShiftPill shift={open.shift} loading={open.loading && !open.data} timeZone={r.timezone} />}
      statusBar={<CashierStatusBar shift={open.shift} timeZone={r.timezone} />}
    />
  );
}
