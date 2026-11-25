import {
  Banknote,
  ClipboardList,
  CreditCard,
  History,
  LayoutDashboard,
  PlusCircle,
  ReceiptText,
  Receipt,
  RotateCcw,
  Timer,
  UserCircle,
} from 'lucide-react';
import type { PosNavItem } from '@sombill/shared-types/navItem';

export const CASHIER_NAV: PosNavItem[] = [
  { to: '/cashier', label: 'Dashboard', icon: LayoutDashboard, group: 'Overview', end: true },
  { to: '/cashier/new-sale', label: 'New Sale', icon: PlusCircle, group: 'Point of Sale' },
  { to: '/cashier/active-orders', label: 'Active Orders', icon: ClipboardList, group: 'Point of Sale' },
  { to: '/cashier/bills', label: 'Bills', icon: Receipt, group: 'Point of Sale' },
  { to: '/cashier/payments', label: 'Payment Processing', icon: CreditCard, group: 'Point of Sale' },
  { to: '/cashier/transactions', label: 'Transactions', icon: History, group: 'Ledger & Cash' },
  { to: '/cashier/receipts', label: 'Receipts', icon: ReceiptText, group: 'Ledger & Cash' },
  { to: '/cashier/refunds', label: 'Refunds', icon: RotateCcw, group: 'Ledger & Cash' },
  { to: '/cashier/shift', label: 'Shift Management', icon: Timer, group: 'Ledger & Cash' },
  { to: '/cashier/profile', label: 'My Profile', icon: UserCircle, group: 'Account' },
];
export const CASHIER_NAV_ICON_MONEY = Banknote;
