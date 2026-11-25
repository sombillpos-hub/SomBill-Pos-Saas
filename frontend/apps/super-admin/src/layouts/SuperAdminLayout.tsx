import { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Building2, FileSearch, Radio, Settings, Sparkles } from 'lucide-react';
import { useHotkeys } from 'react-hotkeys-hook';
import '@fontsource-variable/outfit';
import '@fontsource-variable/jetbrains-mono';
import { useAuth } from '@sombill/shared-hooks/AuthContext';
import { useSbTheme } from '@sombill/shared-hooks/useSbTheme';
import { ConfirmDialog } from '@sombill/shared-ui/ui/ConfirmDialog';
import { AmbientBackdrop } from '@sombill/shared-ui/shell/AmbientBackdrop';
import { ShellSidebar } from '@sombill/shared-ui/shell/ShellSidebar';
import { ShellTopbar } from '@sombill/shared-ui/shell/ShellTopbar';
import { ShellFooter } from '@sombill/shared-ui/shell/ShellFooter';
import { CommandPalette } from '@sombill/shared-ui/shell/CommandPalette';
import { ThemeToggle } from '@sombill/shared-ui/shell/ThemeToggle';
import { HqProvider, useHq } from '../features/HqContext';
import { HQ, SUPER_ADMIN_NAV, crumbsFor } from './navigation';
import { BranchSwitcher } from '../components/BranchSwitcher';
import { BroadcastModal } from '../components/BroadcastModal';
import { formatNumber } from '@sombill/shared-utils/format';

const COLLAPSE_KEY = 'sombill.hq.collapsed';
const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent);

export function SuperAdminLayout() {
  return (
    <HqProvider>
      <Shell />
    </HqProvider>
  );
}

function Shell() {
  const { mode: themeMode, toggle: toggleTheme } = useSbTheme();
  const { profile, signOut, leaveBranch } = useAuth();
  const { org, fx, live, alerts, branches } = useHq();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [broadcastOpen, setBroadcastOpen] = useState(false);

  // Being at HQ means not being inside a branch.
  useEffect(() => {
    leaveBranch();
  }, [leaveBranch]);
  useEffect(() => setMobileOpen(false), [location.pathname]);
  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
    } catch {
      /* storage unavailable */
    }
  }, [collapsed]);
  useHotkeys(
    'mod+k',
    (e) => {
      e.preventDefault();
      setPaletteOpen((o) => !o);
    },
    { enableOnFormTags: true },
  );

  const registers = live.reduce((n, b) => n + b.open_cashier_shifts, 0);
  const crumbs = useMemo(() => crumbsFor(location.pathname), [location.pathname]);
  const badge = (to: string) =>
    to === `${HQ}/branches`
      ? branches.length
      : to === `${HQ}/terminals`
        ? registers
        : to === `${HQ}/audit`
          ? alerts.length
          : 0;
  const doLogout = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };
  const rate = fx.rates.SLS;

  return (
    <div
      className="sb-app-root sa-root manager-dashboard-root dashboard-container flex min-h-screen"
      data-app="super-admin"
      data-collapsed={collapsed}
    >
      <AmbientBackdrop />
      <ShellSidebar
        items={SUPER_ADMIN_NAV}
        homeTo={HQ}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
        onLogout={() => setConfirmLogout(true)}
        subtitle="Super Admin"
        note="SomLink Technology · Trusted Hospitality Partner"
        navLabel="Super Admin navigation"
        badge={badge}
        crown
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
            items={SUPER_ADMIN_NAV}
            homeTo={HQ}
            onClose={() => setMobileOpen(false)}
            onLogout={() => {
              setMobileOpen(false);
              setConfirmLogout(true);
            }}
            subtitle="Super Admin"
            navLabel="Super Admin navigation"
            badge={badge}
            crown
          />
        </div>
      )}

      <div className="sb-content flex min-w-0 flex-1 flex-col">
        <ShellTopbar
          crumbs={crumbs}
          onOpenMenu={() => setMobileOpen(true)}
          onOpenSearch={() => setPaletteOpen(true)}
          searchShortcut={IS_MAC ? '⌘K' : 'Ctrl K'}
          actions={
            <>
              <BranchSwitcher />
              <span className="sa-pill sa-pill--live" title="Cash registers with an open shift right now">
                <i aria-hidden /> {formatNumber(registers)} register{registers === 1 ? '' : 's'} open
              </span>
              {rate ? (
                <span className="sa-pill sa-pill--rate" title="Group exchange rate (Platform Controls)">
                  USD/SLS {formatNumber(rate)}
                </span>
              ) : null}
              <button
                type="button"
                className="sa-broadcast"
                onClick={() => setBroadcastOpen(true)}
                aria-label="Broadcast to staff"
                title="Broadcast to staff"
              >
                <Radio className="h-4 w-4" aria-hidden /> <span className="sa-btn-label">Broadcast</span>
              </button>
              <ThemeToggle mode={themeMode} onToggle={toggleTheme} />
            </>
          }
          orgName={org.name}
          userName={profile?.full_name || profile?.email || 'Super Admin'}
          userEmail={profile?.email ?? undefined}
          userLine="Owner / Group CEO"
          avatarUrl={profile?.avatar_url}
          initial={(profile?.full_name || 'O').slice(0, 1).toUpperCase()}
          themeMode={themeMode}
          onToggleTheme={toggleTheme}
          onLogout={() => setConfirmLogout(true)}
          accountItems={[
            {
              label: 'Multi-Branch Fleet',
              description: `${branches.length} active branches`,
              icon: Building2,
              onClick: () => navigate(`${HQ}/branches`),
            },
            {
              label: 'Audit & Anti-Fraud',
              description: alerts.length ? `${alerts.length} open alerts` : 'Review security stream',
              icon: FileSearch,
              onClick: () => navigate(`${HQ}/audit`),
            },
            {
              label: 'SaaS Subscription',
              description: `${org.plan} plan & branch quota`,
              icon: Sparkles,
              onClick: () => navigate(`${HQ}/licenses`),
            },
            {
              label: 'Platform Controls',
              description: 'Group currency, FX & governance',
              icon: Settings,
              onClick: () => navigate(`${HQ}/settings`),
            },
          ]}
        />
        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          <div key={location.pathname} className="sb-page-enter">
            <Outlet />
          </div>
          <ShellFooter
            product="SomBill Enterprise OS"
            company="SomLink Technology"
            extra={
              <p className="df-meta">
                {alerts.length ? `${alerts.length} open alert${alerts.length === 1 ? '' : 's'}` : 'No open alerts'}
              </p>
            }
          />
        </main>
      </div>

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        items={SUPER_ADMIN_NAV}
        themeMode={themeMode}
        onToggleTheme={toggleTheme}
        onSelect={(to) => {
          setPaletteOpen(false);
          navigate(to);
        }}
      />
      <BroadcastModal open={broadcastOpen} onClose={() => setBroadcastOpen(false)} />
      <ConfirmDialog
        open={confirmLogout}
        title="Sign out?"
        message="You will need to sign in again to reach the group HQ."
        confirmLabel="Sign out"
        onConfirm={doLogout}
        onClose={() => setConfirmLogout(false)}
      />
    </div>
  );
}
