import { useNavigate } from 'react-router-dom';
import { ChefHat, ClipboardList, Receipt, UserCircle } from 'lucide-react';
import { PosShell } from '@sombill/shared-ui/pos/PosShell';
import { WAITER_NAV } from './navigation';
import '@fontsource-variable/outfit';
import '@fontsource-variable/jetbrains-mono';
import { CartProvider, useCart } from '@sombill/shared-hooks/cart';

export function WaiterLayout() {
  return (
    <CartProvider storageKey="sombill.waiter.cart">
      <WaiterShell />
    </CartProvider>
  );
}

const byTo = (to: string) => WAITER_NAV.find((n) => n.to === to)!;
const DOCK = {
  items: [byTo('/waiter/tables'), byTo('/waiter/orders'), byTo('/waiter/kitchen')],
  fab: byTo('/waiter/new-order'),
};

function WaiterShell() {
  const cart = useCart();
  const navigate = useNavigate();
  return (
    <PosShell
      nav={WAITER_NAV}
      navLabel="Waiter navigation"
      appLabel="Waiter POS"
      appTone="waiter"
      homePath="/waiter"
      storageKey="sombill.waiter.sidebar"
      compactPaths={['/waiter/new-order']}
      badge={(to) => (to === '/waiter/new-order' ? cart.itemCount : 0)}
      onLogout={() => cart.clear()}
      accountItems={[
        {
          label: 'My Orders',
          description: 'Track your active floor tickets',
          icon: ClipboardList,
          onClick: () => navigate('/waiter/orders'),
        },
        {
          label: 'Kitchen Status',
          description: 'See dishes ready to serve',
          icon: ChefHat,
          onClick: () => navigate('/waiter/kitchen'),
        },
        {
          label: 'Bills',
          description: 'Request and monitor table bills',
          icon: Receipt,
          onClick: () => navigate('/waiter/bills'),
        },
        {
          label: 'My Profile',
          description: 'Waiter details & sign-in security',
          icon: UserCircle,
          onClick: () => navigate('/waiter/profile'),
        },
      ]}
      themed
      dock={DOCK}
    />
  );
}
