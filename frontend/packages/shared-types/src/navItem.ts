import type { LucideIcon } from 'lucide-react';

/** One sidebar entry in a POS app (Waiter POS, Cashier POS). */
export interface PosNavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  group?: string;
  end?: boolean;
}
