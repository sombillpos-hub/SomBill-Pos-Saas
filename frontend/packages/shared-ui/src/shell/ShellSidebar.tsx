import { useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { ChevronDown, LogOut, PanelLeftClose, PanelLeftOpen, X, type LucideIcon } from 'lucide-react';
import { cn } from '@sombill/shared-utils/cn';
import { BrandMark } from './BrandMark';

export interface ShellNavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  group?: string;
  /** Match the route exactly (e.g. a dashboard at the app root). */
  end?: boolean;
}

interface Props {
  items: ShellNavItem[];
  homeTo: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onLogout: () => void;
  /** `drawer` renders inside a mobile overlay instead of fixed to the viewport. */
  variant?: 'fixed' | 'drawer';
  onClose?: () => void;
  subtitle?: string;
  note?: string;
  /** Accessible name of the navigation landmark. */
  navLabel?: string;
  /** Optional count shown at the end of a link (queues, unread items). */
  badge?: (to: string) => number;
  /** Gold crown on the brand mark (Super Admin). */
  crown?: boolean;
}

/** Floating glass sidebar: grouped navigation, glowing active state, collapse control. */
export function ShellSidebar({
  items,
  homeTo,
  collapsed = false,
  onToggleCollapse,
  onLogout,
  variant = 'fixed',
  onClose,
  subtitle,
  note,
  navLabel = 'Main navigation',
  badge,
  crown,
}: Props) {
  const [closedGroups, setClosedGroups] = useState<Record<string, boolean>>({});
  const sections = useMemo(() => {
    const out: Array<{ group?: string; items: ShellNavItem[] }> = [];
    for (const item of items) {
      const last = out[out.length - 1];
      if (last && last.group === item.group) last.items.push(item);
      else out.push({ group: item.group, items: [item] });
    }
    return out;
  }, [items]);

  const toggleGroup = (g: string) => setClosedGroups((prev) => ({ ...prev, [g]: !prev[g] }));

  return (
    <aside
      className={cn('sb-sidebar no-print', variant === 'drawer' && 'sb-sidebar--drawer')}
      data-collapsed={collapsed}
    >
      <div className="sb-sidebar-head">
        <BrandMark to={homeTo} collapsed={collapsed} subtitle={subtitle} crown={crown} />
        {variant === 'drawer' && (
          <button type="button" onClick={onClose} aria-label="Close menu" className="sb-icon-btn">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav className="sb-nav" aria-label={navLabel}>
        {sections.map((sec, idx) => {
          const isDropdown = Boolean(sec.group && sec.items.length > 1);
          const isOpen = !sec.group || !closedGroups[sec.group];
          return (
            <div key={sec.group ?? `sec-${idx}`} className="sb-nav-section">
              {sec.group &&
                (collapsed ? (
                  idx > 0 && <div className="sb-nav-divider" role="presentation" />
                ) : isDropdown ? (
                  <button
                    type="button"
                    className="sb-nav-group-btn"
                    aria-expanded={isOpen}
                    onClick={() => toggleGroup(sec.group!)}
                  >
                    <span>{sec.group}</span>
                    <span className="sb-nav-group-meta">
                      {!isOpen && <span className="sb-nav-group-count">{sec.items.length}</span>}
                      <ChevronDown className={cn('sb-nav-chevron h-3.5 w-3.5', !isOpen && '-rotate-90')} aria-hidden />
                    </span>
                  </button>
                ) : (
                  <p className="sb-nav-group" aria-hidden>
                    {sec.group}
                  </p>
                ))}
              {(collapsed || isOpen) &&
                sec.items.map(({ to, label, icon: Icon, end }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    title={collapsed ? label : undefined}
                    aria-label={collapsed ? label : undefined}
                    className={({ isActive }) =>
                      cn('sb-nav-link', isActive && 'active', collapsed && 'sb-nav-link--collapsed')
                    }
                  >
                    <span className="sb-nav-ico" aria-hidden>
                      <Icon className="h-[16px] w-[16px]" />
                    </span>
                    {!collapsed && <span className="truncate">{label}</span>}
                    {!collapsed && (badge?.(to) ?? 0) > 0 && <span className="sb-nav-badge">{badge?.(to)}</span>}
                  </NavLink>
                ))}
            </div>
          );
        })}
        <div className="sb-nav-divider" role="presentation" />
        <button
          type="button"
          onClick={onLogout}
          title={collapsed ? 'Logout' : undefined}
          aria-label="Logout"
          className={cn('sb-nav-link sb-nav-logout', collapsed && 'sb-nav-link--collapsed')}
        >
          <span className="sb-nav-ico" aria-hidden>
            <LogOut className="h-[16px] w-[16px]" />
          </span>
          {!collapsed && <span>Logout</span>}
        </button>
      </nav>

      {variant === 'fixed' && (
        <div className="sb-sidebar-foot">
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={cn('sb-nav-link', collapsed && 'sb-nav-link--collapsed')}
            style={{ fontSize: '0.8rem' }}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <>
                <PanelLeftClose className="h-4 w-4" /> Collapse
              </>
            )}
          </button>
          {!collapsed && note && <p className="sb-sidebar-note">{note}</p>}
        </div>
      )}
    </aside>
  );
}
