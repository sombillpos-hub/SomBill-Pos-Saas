import {
  Bell,
  ChefHat,
  ClipboardList,
  LayoutDashboard,
  LayoutGrid,
  PlusCircle,
  Receipt,
  UserCircle,
  UtensilsCrossed,
} from 'lucide-react';
import type { PosNavItem } from '@sombill/shared-types/navItem';

export type WaiterNavItem = PosNavItem;

export const WAITER_NAV: WaiterNavItem[] = [
  { to: '/waiter', label: 'Dashboard', icon: LayoutDashboard, group: 'Overview', end: true },
  { to: '/waiter/tables', label: 'Tables', icon: LayoutGrid, group: 'Floor & Orders' },
  { to: '/waiter/new-order', label: 'New Order', icon: PlusCircle, group: 'Floor & Orders' },
  { to: '/waiter/orders', label: 'My Orders', icon: ClipboardList, group: 'Floor & Orders' },
  { to: '/waiter/menu', label: 'Menu', icon: UtensilsCrossed, group: 'Service' },
  { to: '/waiter/kitchen', label: 'Kitchen Status', icon: ChefHat, group: 'Service' },
  { to: '/waiter/bills', label: 'Bills', icon: Receipt, group: 'Service' },
  { to: '/waiter/notifications', label: 'Notifications', icon: Bell, group: 'Account' },
  { to: '/waiter/profile', label: 'My Profile', icon: UserCircle, group: 'Account' },
];
