import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Bell, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Wifi, WifiOff, X } from 'lucide-react';
import { cn } from '@sombill/shared-utils/cn';
import { useAuth, useRestaurant } from '@sombill/shared-hooks/AuthContext';
import { useQuery } from '@sombill/shared-hooks/useQuery';
import { useRealtime, useRealtimeHealth } from '@sombill/shared-hooks/useRealtime';
import { useMediaQuery } from '@sombill/shared-hooks/useMediaQuery';
import { useSbTheme } from '@sombill/shared-hooks/useSbTheme';
import { supabase } from '@sombill/api-client/supabase';
import { Logo } from '@sombill/shared-ui/Logo';
import { ConfirmDialog } from '@sombill/shared-ui/ui/ConfirmDialog';
import { useToast } from '@sombill/shared-ui/ui/Toast';
import { ShellSidebar } from '@sombill/shared-ui/shell/ShellSidebar';
import { PosTopbar } from '@sombill/shared-ui/shell/PosTopbar';
import { PosDock } from '@sombill/shared-ui/shell/PosDock';
import { OfflineBanner } from '@sombill/shared-ui/shell/OfflineBanner';
import { AmbientBackdrop } from '@sombill/shared-ui/shell/AmbientBackdrop';
import type { AccountMenuItem } from '@sombill/shared-ui/shell/ShellTopbar';
import type { PosNavItem as NavItem } from '@sombill/shared-types/navItem';
import type { AppNotification } from '@sombill/shared-types/types';

export interface PosShellProps {
  nav: NavItem[];
  navLabel: string; // accessible name of the sidebar navigation
  appLabel: string; // e.g. "Waiter POS"
  homePath: string;
  storageKey: string; // sidebar collapsed preference
  compactPaths?: string[]; // routes that auto-compact the sidebar below 1280px
  badge?: (to: string) => number;
  onLogout?: () => void; // e.g. discard local drafts
  /** Renders the "Obsidian Ruby" terminal shell (light by default, dark on request) instead of the navy shell. */
  themed?: boolean;
  /** Themed shell only: extra status items in the topbar (e.g. the open-shift pill). */
  topbarExtra?: ReactNode;
  /** Themed shell only: the bottom status bar. */
  statusBar?: ReactNode;
  /** Themed shell only: floating bottom dock on phones and portrait tablets (shortcuts plus a centre action). */
  dock?: { items: NavItem[]; fab: NavItem };
  /** Accent palette identifier (e.g. "cashier" or "waiter") for subtle role color differentiation. */
  appTone?: 'cashier' | 'waiter';
  /** Account dropdown quick-action items. */
  accountItems?: AccountMenuItem[];
}

/** Shared sidebar shell for the Waiter and Cashier POS apps. */
export function PosShell({
  nav: items,
  navLabel,
  appLabel,
  homePath,
  storageKey,
  compactPaths = [],
  badge,
  onLogout,
  themed = false,
  topbarExtra,
  statusBar,
  dock,
  appTone,
  accountItems,
}: PosShellProps) {
  const theme = useSbTheme(themed);
  const r = useRestaurant();
  const { profile, session, signOut } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const health = useRealtimeHealth();
  const uid = session?.user.id;
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(storageKey) === '1';
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const wide = useMediaQuery('(min-width: 1280px)', true);
  const narrow = useMediaQuery('(max-width: 1023px)', false);
  // The POS needs the width on 1024px tablets: compact the sidebar there automatically.
  const compact = collapsed || (!wide && compactPaths.some((p) => location.pathname.startsWith(p)));
  const [confirmLogout, setConfirmLogout] = useState(false);
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, collapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [collapsed, storageKey]);

  const unread = useQuery(async () => {
    if (!uid) return 0;
    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', uid)
      .is('read_at', null);
    return count ?? 0;
  }, [uid]);
  // Live toast for new notifications addressed to this waiter.
  const latest = useQuery(async () => {
    if (!uid) return null;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(1);
    return ((data ?? [])[0] as AppNotification | undefined) ?? null;
  }, [uid]);
  const [seen, setSeen] = useState<string | null>(null);
  useEffect(() => {
    const n = latest.data;
    if (!n) return;
    if (seen === null) {
      setSeen(n.id);
      return;
    }
    if (n.id !== seen) {
      setSeen(n.id);
      if (!n.read_at) toast.info(n.title);
    }
  }, [latest.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const onNotif = useCallback(() => {
    void unread.reload();
    void latest.reload();
  }, [unread, latest]);
  useRealtime(['notifications'], uid ? r.id : undefined, onNotif, { filter: uid ? `user_id=eq.${uid}` : undefined });

  const doLogout = async () => {
    onLogout?.();
    await signOut();
    navigate('/login', { replace: true });
  };

  const nav = (isCollapsed: boolean) => (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4" aria-label={navLabel}>
      {items.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          title={isCollapsed ? label : undefined}
          className={({ isActive }) =>
            cn(
              'flex min-h-[44px] items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors',
              isActive ? 'bg-brand-orange text-white shadow-sm' : 'text-slate-300 hover:bg-white/10 hover:text-white',
              isCollapsed && 'justify-center px-2',
            )
          }
        >
          <Icon className="h-5 w-5 shrink-0" aria-hidden />
          {!isCollapsed && <span className="truncate">{label}</span>}
          {!isCollapsed && to.endsWith('/notifications') && (unread.data ?? 0) > 0 && (
            <span className="ml-auto rounded-full bg-brand-red px-2 text-xs font-bold text-white">{unread.data}</span>
          )}
          {!isCollapsed && !to.endsWith('/notifications') && (badge?.(to) ?? 0) > 0 && (
            <span className="ml-auto rounded-full bg-white/20 px-2 text-xs font-bold text-white">{badge!(to)}</span>
          )}
        </NavLink>
      ))}
      <button
        type="button"
        onClick={() => setConfirmLogout(true)}
        title={isCollapsed ? 'Logout' : undefined}
        className={cn(
          'mt-2 flex min-h-[44px] items-center gap-3 rounded-lg px-3 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white',
          isCollapsed && 'justify-center px-2',
        )}
      >
        <LogOut className="h-5 w-5 shrink-0" aria-hidden />
        {!isCollapsed && <span>Logout</span>}
      </button>
    </nav>
  );

  if (themed) {
    const unreadCount = unread.data ?? 0;
    const navBadge = (to: string) => (to.endsWith('/notifications') ? unreadCount : (badge?.(to) ?? 0));
    const note = 'Trusted Hospitality Partner · Powered by SomLink';
    return (
      <div
        className="sb-app-root pos-root flex min-h-screen"
        data-collapsed={compact}
        data-dock={dock ? true : undefined}
        data-app={appTone}
      >
        <AmbientBackdrop />
        <ShellSidebar
          items={items}
          homeTo={homePath}
          navLabel={navLabel}
          badge={navBadge}
          collapsed={compact}
          onToggleCollapse={() => setCollapsed((c) => !c)}
          onLogout={() => setConfirmLogout(true)}
          subtitle={appLabel}
          note={note}
        />
        {mobileOpen && (
          <div className="no-print fixed inset-0 z-[100] lg:hidden">
            <div
              className="absolute inset-0"
              style={{ background: 'rgba(4,1,2,.7)', backdropFilter: 'blur(6px)' }}
              onClick={() => setMobileOpen(false)}
            />
            <ShellSidebar
              variant="drawer"
              items={items}
              homeTo={homePath}
              navLabel={navLabel}
              badge={navBadge}
              onClose={() => setMobileOpen(false)}
              onLogout={() => {
                setMobileOpen(false);
                setConfirmLogout(true);
              }}
              subtitle={appLabel}
              note={note}
            />
          </div>
        )}
        <div className="sb-content flex min-w-0 flex-1 flex-col">
          <OfflineBanner />
          <PosTopbar
            title={appLabel}
            place={r.name}
            timeZone={r.timezone}
            onOpenMenu={() => setMobileOpen(true)}
            themeMode={theme.mode}
            onToggleTheme={theme.toggle}
            notificationsTo={`${homePath}/notifications`}
            unread={unreadCount}
            userName={profile?.full_name || profile?.email || undefined}
            userEmail={profile?.email ?? undefined}
            userRole={appLabel}
            avatarUrl={r.logo_url ?? null}
            initial={(profile?.full_name || profile?.email || 'U').slice(0, 1).toUpperCase()}
            accountItems={accountItems}
            onLogout={() => setConfirmLogout(true)}
          >
            {topbarExtra}
          </PosTopbar>
          <main className="min-w-0 flex-1 p-4 sm:p-6">
            <div key={location.pathname} className="sb-page-enter">
              <Outlet />
            </div>
          </main>
          {statusBar}
        </div>
        {dock && narrow && (
          <PosDock
            items={dock.items}
            fab={dock.fab}
            fabBadge={navBadge(dock.fab.to)}
            onMore={() => setMobileOpen(true)}
          />
        )}
        <ConfirmDialog
          open={confirmLogout}
          title="Sign out?"
          message="Any unsent draft order on this device will be discarded."
          confirmLabel="Sign out"
          onConfirm={doLogout}
          onClose={() => setConfirmLogout(false)}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside
        className={cn(
          'no-print sticky top-0 hidden h-screen shrink-0 flex-col bg-brand-navy transition-[width] duration-200 lg:flex',
          compact ? 'w-[76px]' : 'w-60',
        )}
      >
        <div className="flex h-16 items-center justify-center border-b border-white/10 px-4">
          <Link to={homePath} className="rounded-lg bg-white px-2 py-1">
            <Logo compact={compact} />
          </Link>
        </div>
        {nav(compact)}
        <div className="border-t border-white/10 p-3">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={compact ? 'Expand sidebar' : 'Collapse sidebar'}
            className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-400 hover:bg-white/10 hover:text-white"
          >
            {compact ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <>
                <PanelLeftClose className="h-4 w-4" /> Collapse
              </>
            )}
          </button>
          {!compact && (
            <p className="mt-2 text-center text-[10px] text-slate-500">
              Trusted Hospitality Partner · Powered by SomLink
            </p>
          )}
        </div>
      </aside>

      {mobileOpen && (
        <div className="no-print fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-brand-navy/60" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-brand-navy shadow-xl">
            <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
              <span className="rounded-lg bg-white px-2 py-1">
                <Logo />
              </span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
                className="p-2 text-slate-300 hover:text-white"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            {nav(false)}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            className="rounded-lg p-2.5 text-slate-600 hover:bg-slate-100 lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-brand-navy">{r.name}</p>
            <p className="truncate text-xs text-slate-500">
              {appLabel} · {profile?.full_name || profile?.email}
            </p>
          </div>
          <span
            className={cn(
              'hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold sm:inline-flex',
              health === 'live'
                ? 'bg-emerald-50 text-emerald-700'
                : health === 'connecting'
                  ? 'bg-amber-50 text-amber-700'
                  : 'bg-red-50 text-red-700',
            )}
            role="status"
            aria-label={`Live updates ${health}`}
          >
            {health === 'offline' ? <WifiOff className="h-3.5 w-3.5" /> : <Wifi className="h-3.5 w-3.5" />}
            {health === 'live' ? 'Live' : health === 'connecting' ? 'Connecting…' : 'Reconnecting…'}
          </span>
          <Link
            to={`${homePath}/notifications`}
            className="relative rounded-lg p-2.5 text-slate-600 hover:bg-slate-100"
            aria-label={`Notifications (${unread.data ?? 0} unread)`}
          >
            <Bell className="h-6 w-6" />
            {(unread.data ?? 0) > 0 && (
              <span className="absolute right-1 top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand-red px-1 text-[11px] font-bold text-white">
                {unread.data}
              </span>
            )}
          </Link>
        </header>
        <main className="min-w-0 flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
      <ConfirmDialog
        open={confirmLogout}
        title="Sign out?"
        message="Any unsent draft order on this device will be discarded."
        confirmLabel="Sign out"
        onConfirm={doLogout}
        onClose={() => setConfirmLogout(false)}
      />
    </div>
  );
}
