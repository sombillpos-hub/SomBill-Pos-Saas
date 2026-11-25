import { NavLink } from 'react-router-dom';
import { MoreHorizontal } from 'lucide-react';
import { cn } from '@sombill/shared-utils/cn';
import type { PosNavItem } from '@sombill/shared-types/navItem';

interface Props {
  /** Up to four shortcuts: the first two sit left of the centre button, the rest right of it. */
  items: PosNavItem[];
  /** The raised centre button (the instant-order action). */
  fab: PosNavItem;
  /** Count shown on the centre button (e.g. items in the draft order). */
  fabBadge?: number;
  /** Opens the full navigation drawer. */
  onMore: () => void;
}

/** Floating glass dock for phones and portrait tablets. Complements the full menu; it never replaces it. */
export function PosDock({ items, fab, fabBadge = 0, onMore }: Props) {
  const left = items.slice(0, 2);
  const right = items.slice(2);
  const Item = ({ to, label, icon: Icon, end }: PosNavItem) => (
    <NavLink to={to} end={end} className={({ isActive }) => cn('sb-dock-item', isActive && 'active')}>
      <Icon className="h-5 w-5" aria-hidden />
      <span>{label}</span>
    </NavLink>
  );
  const FabIcon = fab.icon;
  return (
    <nav className="sb-dock no-print" aria-label="Quick navigation">
      {left.map((i) => (
        <Item key={i.to} {...i} />
      ))}
      <NavLink to={fab.to} className="sb-dock-fab" aria-label={fab.label}>
        <FabIcon className="h-6 w-6" aria-hidden />
        {fabBadge > 0 && <span className="sb-dock-fab-badge">{fabBadge}</span>}
      </NavLink>
      {right.map((i) => (
        <Item key={i.to} {...i} />
      ))}
      <button type="button" className="sb-dock-item" onClick={onMore}>
        <MoreHorizontal className="h-5 w-5" aria-hidden />
        <span>More</span>
      </button>
    </nav>
  );
}
