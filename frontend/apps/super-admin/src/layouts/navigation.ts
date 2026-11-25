import {
  Boxes,
  Building2,
  CreditCard,
  DollarSign,
  FileSearch,
  LayoutDashboard,
  Monitor,
  ServerCog,
  Settings,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  UtensilsCrossed,
} from 'lucide-react';
import type { ShellNavItem } from '@sombill/shared-ui/shell/ShellSidebar';

export const HQ = '/dashboard/super-admin';

/** The four sections of the brief. `group` is the sidebar heading. */
export const SUPER_ADMIN_NAV: ShellNavItem[] = [
  { to: HQ, label: 'HQ Fleet Overview', icon: LayoutDashboard, group: 'Global command', end: true },
  { to: `${HQ}/branches`, label: 'Multi-Branch Fleet', icon: Building2, group: 'Global command' },
  { to: `${HQ}/terminals`, label: 'Active POS Fleet', icon: Monitor, group: 'Global command' },
  { to: `${HQ}/revenue`, label: 'Global Revenues', icon: TrendingUp, group: 'Consolidated finance' },
  { to: `${HQ}/tax`, label: 'Tax Filings', icon: ShieldCheck, group: 'Consolidated finance' },
  { to: `${HQ}/mobile-money`, label: 'Mobile Money Portals', icon: CreditCard, group: 'Consolidated finance' },
  { to: `${HQ}/licenses`, label: 'SaaS Subscription', icon: Sparkles, group: 'Consolidated finance' },
  { to: `${HQ}/menu-push`, label: 'Central Menu Push', icon: UtensilsCrossed, group: 'Central operations' },
  { to: `${HQ}/users`, label: 'Global Staff & RBAC', icon: Users, group: 'Central operations' },
  { to: `${HQ}/inventory`, label: 'Master Supply Chain', icon: Boxes, group: 'Central operations' },
  { to: `${HQ}/audit`, label: 'Audit & Anti-Fraud', icon: FileSearch, group: 'Security & infra' },
  { to: `${HQ}/system`, label: 'Cloud Telemetry', icon: ServerCog, group: 'Security & infra' },
  { to: `${HQ}/settings`, label: 'Platform Controls', icon: Settings, group: 'Security & infra' },
];

export const GROUP_ICON = DollarSign;

export function crumbsFor(pathname: string) {
  const item = SUPER_ADMIN_NAV.find((i) =>
    i.end ? pathname === i.to : pathname === i.to || pathname.startsWith(`${i.to}/`),
  );
  const root = { label: 'Group HQ', to: HQ };
  if (!item || item.to === HQ) return [{ label: 'Group HQ' }];
  return [root, { label: item.label }];
}
