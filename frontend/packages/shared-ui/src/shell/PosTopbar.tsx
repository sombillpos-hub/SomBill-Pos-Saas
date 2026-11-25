import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Bell, ChevronDown, LogOut, MapPin, Menu, Moon, Sun } from 'lucide-react';
import type { SbThemeMode } from '@sombill/shared-hooks/useSbTheme';
import { useRealtimeHealth } from '@sombill/shared-hooks/useRealtime';
import { ShellClock } from './ShellClock';
import { ConnectionBadge } from './ConnectionBadge';
import { ThemeToggle } from './ThemeToggle';
import type { AccountMenuItem } from './ShellTopbar';

interface Props {
  /** App name, e.g. "Cashier POS". */
  title: string;
  /** Restaurant (branch) shown as a soft pill next to the title. */
  place?: string;
  timeZone?: string;
  onOpenMenu: () => void;
  /** Extra status items before the theme switch (e.g. the open-shift pill). */
  children?: ReactNode;
  themeMode: SbThemeMode;
  onToggleTheme: () => void;
  notificationsTo: string;
  unread: number;
  userName?: string;
  userEmail?: string;
  userRole?: string;
  avatarUrl?: string | null;
  initial: string;
  accountItems?: AccountMenuItem[];
  onLogout?: () => void;
}

/** 2026 operational glass topbar for POS terminals: flush with sidebar, clock, live sync, shift, and account dropdown. */
export function PosTopbar({
  title,
  place,
  timeZone,
  onOpenMenu,
  children,
  themeMode,
  onToggleTheme,
  notificationsTo,
  unread,
  userName,
  userEmail,
  userRole,
  avatarUrl,
  initial,
  accountItems = [],
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

  return (
    <header
      className="sb-topbar sb-topbar--pos no-print"
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

      <div className="sb-pos-ident">
        <p className="sb-pos-title">{title}</p>
        {place && (
          <span className="sb-pos-place">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">{place}</span>
          </span>
        )}
      </div>

      <div className="sb-pos-right">
        <div className="sb-pos-clock">
          <ShellClock timeZone={timeZone} />
        </div>
        <ConnectionBadge />
        {children}
        <ThemeToggle mode={themeMode} onToggle={onToggleTheme} />
        <Link to={notificationsTo} className="sb-icon-btn" aria-label={`Notifications (${unread} unread)`}>
          {unread > 0 && <span className="sb-bell-ping" aria-hidden />}
          <Bell className="h-[18px] w-[18px]" aria-hidden />
          {unread > 0 && <span className="sb-bell-badge">{unread > 9 ? '9+' : unread}</span>}
        </Link>

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
              <span className="sb-avatar-org">{userName || title}</span>
              <span className="sb-avatar-role">{userRole}</span>
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
                    <p className="sb-account-name truncate">{userName || title}</p>
                    {userEmail && <p className="sb-account-email truncate">{userEmail}</p>}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  {place && <span className="sb-account-org-pill truncate">{place}</span>}
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
                      {themeMode === 'dark' ? 'Clean porcelain theme' : 'Obsidian dark theme'}
                    </span>
                  </span>
                </button>
              </div>

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
                      <span className="sb-account-item-desc block text-[11px]">End current shift session</span>
                    </span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
