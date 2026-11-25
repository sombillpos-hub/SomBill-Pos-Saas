import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, LogOut, Menu, Moon, Search, Sun, type LucideIcon } from 'lucide-react';
import { useRealtimeHealth } from '@sombill/shared-hooks/useRealtime';
import { ConnectionBadge } from './ConnectionBadge';

export interface Crumb {
  label: string;
  to?: string;
}

export interface AccountMenuItem {
  label: string;
  description?: string;
  icon: LucideIcon;
  onClick: () => void;
}

interface Props {
  crumbs: Crumb[];
  onOpenMenu: () => void;
  onOpenSearch: () => void;
  timeZone?: string;
  /** Shown before the user menu, e.g. the theme toggle and notification bell. */
  actions?: ReactNode;
  orgName?: string;
  userName?: string;
  userEmail?: string;
  userLine?: string;
  avatarUrl?: string | null;
  initial: string;
  searchShortcut: string;
  accountItems?: AccountMenuItem[];
  themeMode?: 'light' | 'dark';
  onToggleTheme?: () => void;
  onLogout?: () => void;
}

/** Sticky 2026 glass topbar: breadcrumbs, spotlight search, subtle live indicator, actions, and interactive account menu. */
export function ShellTopbar({
  crumbs,
  onOpenMenu,
  onOpenSearch,
  actions,
  orgName,
  userName,
  userEmail,
  userLine,
  avatarUrl,
  initial,
  searchShortcut,
  accountItems = [],
  themeMode,
  onToggleTheme,
  onLogout,
}: Props) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const health = useRealtimeHealth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const displayName = userName || orgName || 'Account';
  const displayRole = userLine || orgName || '';

  return (
    <header
      className="sb-topbar no-print"
      data-scrolled={scrolled}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty('--sb-mx', `${Math.round(e.clientX - rect.left)}px`);
      }}
    >
      <span className="sb-aurora" aria-hidden />
      <button type="button" className="sb-icon-btn sb-menu-btn" onClick={onOpenMenu} aria-label="Open menu">
        <Menu className="h-5 w-5" />
      </button>

      <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
        <ol className="sb-crumbs truncate">
          {crumbs.map((c, i) => (
            <li key={i} className="flex min-w-0 items-center gap-1.5">
              {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden />}
              {c.to ? (
                <Link to={c.to} className="truncate">
                  {c.label}
                </Link>
              ) : (
                <span className="truncate" aria-current="page">
                  {c.label}
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>

      <button type="button" className="sb-search" onClick={onOpenSearch} aria-label="Search pages and actions">
        <Search className="h-4 w-4 shrink-0" aria-hidden />
        <span>Search…</span>
        <kbd className="sb-kbd" aria-hidden>
          {searchShortcut}
        </kbd>
      </button>

      {/* Only surface the connection banner pill when degraded; when healthy, a live dot sits on the account menu. */}
      {health !== 'live' && <ConnectionBadge />}
      {actions}

      <div ref={menuRef} className="relative">
        <button
          type="button"
          className="sb-account-trigger"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label="Account menu"
          onClick={() => setMenuOpen((o) => !o)}
        >
          <span className="sb-avatar-wrap">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="sb-avatar" />
            ) : (
              <span className="sb-avatar" aria-hidden>
                {initial}
              </span>
            )}
            <span className="sb-avatar-dot" data-state={health} aria-hidden />
          </span>
          <span className="sb-account-meta">
            <span className="sb-avatar-org">{displayName}</span>
            <span className="sb-avatar-role">{displayRole}</span>
          </span>
          <ChevronDown className={`sb-account-chev h-4 w-4 ${menuOpen ? 'rotate-180' : ''}`} aria-hidden />
        </button>

        {menuOpen && (
          <div className="sb-account-menu" role="menu" aria-label="Account options">
            <div className="sb-account-head">
              <div className="flex items-center gap-3">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="sb-avatar h-10 w-10" />
                ) : (
                  <span className="sb-avatar h-10 w-10 text-base" aria-hidden>
                    {initial}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="sb-account-name truncate">{displayName}</p>
                  {userEmail && <p className="sb-account-email truncate">{userEmail}</p>}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                {orgName && <span className="sb-account-org-pill truncate">{orgName}</span>}
                <span className="sb-account-sync" data-state={health}>
                  <i aria-hidden />{' '}
                  {health === 'live' ? 'Live sync' : health === 'connecting' ? 'Connecting…' : 'Offline'}
                </span>
              </div>
            </div>

            {accountItems.length > 0 && (
              <div className="sb-account-group">
                {accountItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      role="menuitem"
                      className="sb-account-item"
                      onClick={() => {
                        setMenuOpen(false);
                        item.onClick();
                      }}
                    >
                      <span className="sb-account-item-ico" aria-hidden>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1 text-left">
                        <span className="block text-[13px] font-semibold leading-tight">{item.label}</span>
                        {item.description && (
                          <span className="sb-account-item-desc block truncate text-[11px]">{item.description}</span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {onToggleTheme && themeMode && (
              <div className="sb-account-group">
                <button
                  type="button"
                  role="menuitem"
                  className="sb-account-item"
                  onClick={() => {
                    onToggleTheme();
                    setMenuOpen(false);
                  }}
                >
                  <span className="sb-account-item-ico" aria-hidden>
                    {themeMode === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block text-[13px] font-semibold leading-tight">
                      {themeMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                    </span>
                    <span className="sb-account-item-desc block text-[11px]">
                      {themeMode === 'dark' ? 'Clean porcelain theme' : 'Obsidian Ruby dark theme'}
                    </span>
                  </span>
                </button>
              </div>
            )}

            {onLogout && (
              <div className="sb-account-group">
                <button
                  type="button"
                  role="menuitem"
                  className="sb-account-item sb-account-item--danger"
                  onClick={() => {
                    setMenuOpen(false);
                    onLogout();
                  }}
                >
                  <span className="sb-account-item-ico" aria-hidden>
                    <LogOut className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block text-[13px] font-semibold leading-tight">Sign out</span>
                    <span className="sb-account-item-desc block text-[11px]">End current session safely</span>
                  </span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
