import { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import '@fontsource-variable/outfit';
import '@fontsource-variable/jetbrains-mono';
import { Link } from 'react-router-dom';
import { BarChart3, Crown, Keyboard, Settings, Users } from 'lucide-react';
import { HQ_HOME, useAuth } from '@sombill/shared-hooks/AuthContext';
import { useSbTheme } from '@sombill/shared-hooks/useSbTheme';
import { NAV_ITEMS, breadcrumbsFor } from './navigation';
import { ConfirmDialog } from '@sombill/shared-ui/ui/ConfirmDialog';
import { ShellSidebar } from '@sombill/shared-ui/shell/ShellSidebar';
import { ShellTopbar } from '@sombill/shared-ui/shell/ShellTopbar';
import { ShellFooter } from '@sombill/shared-ui/shell/ShellFooter';
import { AmbientBackdrop } from '@sombill/shared-ui/shell/AmbientBackdrop';
import { CommandPalette } from '@sombill/shared-ui/shell/CommandPalette';
import { ThemeToggle } from '@sombill/shared-ui/shell/ThemeToggle';
import { AttentionBell } from '../components/AttentionBell';

const COLLAPSE_KEY = 'sombill.sidebar.collapsed';
const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent);

export function AppLayout() {
  const { mode: themeMode, toggle: toggleTheme } = useSbTheme();
  const { restaurant, profile, signOut, isOwner, leaveBranch } = useAuth();
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

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);
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

  const crumbs = useMemo(() => breadcrumbsFor(location.pathname), [location.pathname]);
  const doLogout = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div
      className="sb-app-root manager-dashboard-root dashboard-container flex min-h-screen"
      data-collapsed={collapsed}
    >
      <AmbientBackdrop />
      <ShellSidebar
        items={NAV_ITEMS}
        homeTo="/manager"
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
        onLogout={() => setConfirmLogout(true)}
        subtitle="Manager"
        note="SomLink Technology · Trusted Hospitality Partner"
      />

      {/* Mobile / tablet drawer */}
      {mobileOpen && (
        <div className="no-print fixed inset-0 z-[100] lg:hidden">
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(4,1,2,.7)', backdropFilter: 'blur(6px)' }}
            onClick={() => setMobileOpen(false)}
          />
          <ShellSidebar
            variant="drawer"
            items={NAV_ITEMS}
            homeTo="/manager"
            onClose={() => setMobileOpen(false)}
            onLogout={() => {
              setMobileOpen(false);
              setConfirmLogout(true);
            }}
            subtitle="Manager"
            note="SomLink Technology · Trusted Hospitality Partner"
          />
        </div>
      )}

      <div className="sb-content flex min-w-0 flex-1 flex-col">
        <ShellTopbar
          crumbs={crumbs}
          onOpenMenu={() => setMobileOpen(true)}
          onOpenSearch={() => setPaletteOpen(true)}
          searchShortcut={IS_MAC ? '⌘K' : 'Ctrl K'}
          timeZone={restaurant?.timezone}
          actions={
            <>
              {isOwner && (
                <Link to={HQ_HOME} onClick={leaveBranch} className="sa-hq-link">
                  <Crown className="h-4 w-4" aria-hidden /> Group HQ
                </Link>
              )}
              <ThemeToggle mode={themeMode} onToggle={toggleTheme} />
              <AttentionBell />
            </>
          }
          orgName={restaurant?.name}
          userName={profile?.full_name || profile?.email || 'Manager'}
          userEmail={profile?.email ?? undefined}
          userLine={isOwner ? 'Owner · Branch View' : 'Branch Manager'}
          avatarUrl={restaurant?.logo_url}
          initial={(profile?.full_name || 'M').slice(0, 1).toUpperCase()}
          themeMode={themeMode}
          onToggleTheme={toggleTheme}
          onLogout={() => setConfirmLogout(true)}
          accountItems={[
            {
              label: 'Restaurant Settings',
              description: 'Tax, currency, receipts & permissions',
              icon: Settings,
              onClick: () => navigate('/manager/settings'),
            },
            {
              label: 'Staff Management',
              description: 'Roles, access & invitations',
              icon: Users,
              onClick: () => navigate('/manager/staff'),
            },
            {
              label: 'Reports & Analytics',
              description: 'Sales, profit & CSV exports',
              icon: BarChart3,
              onClick: () => navigate('/manager/reports'),
            },
            {
              label: 'Command Palette',
              description: `Quick jump anywhere (${IS_MAC ? '⌘K' : 'Ctrl K'})`,
              icon: Keyboard,
              onClick: () => setPaletteOpen(true),
            },
            ...(isOwner
              ? [
                  {
                    label: 'Switch to Group HQ',
                    description: 'Multi-branch Super Admin console',
                    icon: Crown,
                    onClick: () => {
                      leaveBranch();
                      navigate(HQ_HOME);
                    },
                  },
                ]
              : []),
          ]}
        />
        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          <div key={location.pathname} className="sb-page-enter">
            <Outlet />
          </div>
          <ShellFooter product="SomBill Hospitality OS" company="SomLink Technology" />
        </main>
      </div>

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        items={NAV_ITEMS}
        themeMode={themeMode}
        onToggleTheme={toggleTheme}
        onSelect={(to) => {
          setPaletteOpen(false);
          navigate(to);
        }}
      />
      <ConfirmDialog
        open={confirmLogout}
        title="Sign out?"
        message="You will need to sign in again to access the manager dashboard."
        confirmLabel="Sign out"
        onConfirm={doLogout}
        onClose={() => setConfirmLogout(false)}
      />
    </div>
  );
}
