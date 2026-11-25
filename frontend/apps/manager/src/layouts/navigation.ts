import {
  LayoutDashboard,
  ClipboardList,
  UtensilsCrossed,
  Tags,
  LayoutGrid,
  Users,
  Contact,
  Boxes,
  Truck,
  FileText,
  Receipt,
  BarChart3,
  Settings,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Section heading shown in the sidebar and command palette. */
  group: string;
  end?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/manager', label: 'Dashboard', icon: LayoutDashboard, group: 'Overview', end: true },
  { to: '/manager/orders', label: 'Orders', icon: ClipboardList, group: 'Operations' },
  { to: '/manager/menu', label: 'Menu Management', icon: UtensilsCrossed, group: 'Operations' },
  { to: '/manager/categories', label: 'Categories', icon: Tags, group: 'Operations' },
  { to: '/manager/tables', label: 'Tables & Floor Plans', icon: LayoutGrid, group: 'Operations' },
  { to: '/manager/staff', label: 'Staff Management', icon: Users, group: 'People' },
  { to: '/manager/customers', label: 'Customers', icon: Contact, group: 'People' },
  { to: '/manager/inventory', label: 'Inventory', icon: Boxes, group: 'Supply chain' },
  { to: '/manager/suppliers', label: 'Suppliers', icon: Truck, group: 'Supply chain' },
  { to: '/manager/purchase-orders', label: 'Purchase Orders', icon: FileText, group: 'Supply chain' },
  { to: '/manager/expenses', label: 'Expenses', icon: Receipt, group: 'Finance & insights' },
  { to: '/manager/reports', label: 'Reports', icon: BarChart3, group: 'Finance & insights' },
  { to: '/manager/settings', label: 'Settings', icon: Settings, group: 'System' },
];

export function breadcrumbsFor(pathname: string): Array<{ label: string; to?: string }> {
  const parts = pathname.split('/').filter(Boolean);
  const segs = parts[0] === 'manager' ? parts.slice(1) : parts;
  const first = segs[0];
  const rootPath = !first || first === 'dashboard' ? '/manager' : `/manager/${first}`;
  const root = NAV_ITEMS.find((n) => n.to === rootPath);
  const crumbs: Array<{ label: string; to?: string }> = [{ label: 'Manager', to: '/manager' }];
  if (root && root.to !== '/manager') crumbs.push({ label: root.label, to: segs.length > 1 ? root.to : undefined });
  if (!root || root.to === '/manager') crumbs.push({ label: 'Dashboard' });
  if (segs.length > 1) crumbs.push({ label: 'Details' });
  return crumbs;
}
