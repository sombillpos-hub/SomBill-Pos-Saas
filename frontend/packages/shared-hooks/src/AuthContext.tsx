import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, supabaseConfigured, unwrap, friendlyError } from '@sombill/api-client/supabase';
import { normalizeSettings } from '@sombill/shared-config/settings';
import type {
  AppRole,
  Organization,
  Profile,
  Restaurant,
  RestaurantMember,
  SessionRole,
} from '@sombill/shared-types/types';

/**
 * loading      – resolving the session
 * signed_out   – no session
 * no_restaurant– signed in but not linked to any restaurant (first manager setup)
 * suspended    – every membership is suspended
 * member       – active member; route by `membership.role`
 */
export type AccessState = 'loading' | 'signed_out' | 'no_restaurant' | 'suspended' | 'member';

interface AuthValue {
  session: Session | null;
  profile: Profile | null;
  membership: RestaurantMember | null;
  restaurant: Restaurant | null;
  access: AccessState;
  /** `owner` for a group owner; otherwise the membership role. */
  role: SessionRole | null;
  /** The group this person owns (Super Admin), if any. */
  organization: Organization | null;
  isOwner: boolean;
  /** An owner looking inside one branch (acts as its manager). */
  viewingBranch: boolean;
  enterBranch: (restaurantId: string) => Promise<void>;
  leaveBranch: () => void;
  reloadOrganization: () => Promise<void>;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  reload: () => Promise<void>;
}

const AuthCtx = createContext<AuthValue | null>(null);
const ROLE_PRIORITY: AppRole[] = ['manager', 'cashier', 'waiter', 'kitchen'];

/** Home route for each role. */
export const HQ_HOME = '/dashboard/super-admin';
export function roleHome(role: SessionRole | null | undefined): string {
  return role === 'owner' ? HQ_HOME : role === 'waiter' ? '/waiter' : role === 'cashier' ? '/cashier' : '/manager';
}
const BRANCH_KEY = 'sombill.hq.branch';
const isDev = Boolean(import.meta.env?.DEV) && import.meta.env?.MODE !== 'test' && !supabaseConfigured;

const DEV_MOCK_PROFILE: Profile = {
  id: 'dev-user-001',
  full_name: 'Ahmed Hassan (SomBill)',
  email: 'admin@sombill.com',
  phone: '+252 63 4408910',
  avatar_url: null,
  last_login_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const DEV_MOCK_RESTAURANT: Restaurant = {
  id: 'dev-restaurant-001',
  name: 'SomBill Grand Restaurant & Cafe',
  currency: 'USD',
  timezone: 'Africa/Mogadishu',
  tax_rate: 0.05,
  tax_inclusive: false,
  tax_label: 'VAT',
  receipt_header: 'SomBill Restaurant',
  receipt_footer: 'Thank you for your visit!',
  address: '150 Independence Ave, Hargeisa',
  phone: '+252 63 4408910',
  email: 'info@sombill.com',
  logo_url: null,
  organization_id: 'dev-org-001',
  order_seq: 0,
  po_seq: 0,
  txn_seq: 0,
  receipt_seq: 0,
  settings: normalizeSettings({}),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const DEV_MOCK_ORG: Organization = {
  id: 'dev-org-001',
  name: 'SomBill Hospitality Group HQ',
  plan: 'enterprise',
  max_branches: 10,
  max_staff: 100,
  license_status: 'active',
  license_expires_at: null,
  settings: { reporting_currency: 'USD', fx_rates: { SLS: 11800, SOS: 26000 } },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [membership, setMembership] = useState<RestaurantMember | null>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [access, setAccess] = useState<AccessState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [viewingBranch, setViewingBranch] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setSessionReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setSessionReady(true);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const load = useCallback(async (s: Session | null) => {
    setError(null);
    if (!s) {
      if (isDev) {
        setProfile(DEV_MOCK_PROFILE);
        setMembership({
          id: 'dev-member-001',
          restaurant_id: DEV_MOCK_RESTAURANT.id,
          user_id: 'dev-user-001',
          role: 'manager',
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        setRestaurant(DEV_MOCK_RESTAURANT);
        setOrganization(DEV_MOCK_ORG);
        setViewingBranch(true);
        setAccess('member');
        return;
      }
      setProfile(null);
      setMembership(null);
      setRestaurant(null);
      setOrganization(null);
      setViewingBranch(false);
      setAccess('signed_out');
      return;
    }
    try {
      const uid = s.user.id;
      const [p, members, owned] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .eq('id', uid)
          .maybeSingle()
          .then(unwrap<Profile | null>),
        supabase
          .from('restaurant_members')
          .select('*')
          .eq('user_id', uid)
          .then(unwrap<RestaurantMember[]>),
        supabase
          .from('organization_members')
          .select('organization_id')
          .eq('user_id', uid)
          .eq('status', 'active')
          .then(unwrap<{ organization_id: string }[]>),
      ]);
      setProfile(p);
      // Group owner (Super Admin): the group comes first; branches are entered from the HQ dashboard.
      const ownedOrg = owned?.[0];
      if (ownedOrg) {
        const org = (await supabase
          .from('organizations')
          .select('*')
          .eq('id', ownedOrg.organization_id)
          .single()
          .then(unwrap<Organization>)) as Organization;
        setOrganization(org);
        const list0 = (members ?? []).filter((m) => m.status === 'active');
        setMembership(list0[0] ?? null);
        let branch: Restaurant | null = null;
        let saved: string | null = null;
        try {
          saved = sessionStorage.getItem(BRANCH_KEY);
        } catch {
          /* storage unavailable */
        }
        if (saved) {
          const r = await supabase.from('restaurants').select('*').eq('id', saved).maybeSingle();
          branch = !r.error && r.data ? { ...r.data, settings: normalizeSettings(r.data.settings) } : null;
        }
        setRestaurant(branch);
        setViewingBranch(Boolean(branch));
        setAccess('member');
        return;
      }
      setOrganization(null);
      setViewingBranch(false);
      const list = members ?? [];
      const active = list
        .filter((m) => m.status === 'active')
        .sort((a, b) => ROLE_PRIORITY.indexOf(a.role) - ROLE_PRIORITY.indexOf(b.role));
      const chosen = active[0] ?? list[0] ?? null;
      setMembership(chosen);
      if (!chosen) {
        setRestaurant(null);
        setAccess('no_restaurant');
        return;
      }
      if (!active.length) {
        setRestaurant(null);
        setAccess('suspended');
        return;
      }
      const r = unwrap(
        await supabase.from('restaurants').select('*').eq('id', chosen.restaurant_id).single(),
      ) as Restaurant;
      setRestaurant({ ...r, settings: normalizeSettings(r.settings) });
      setAccess('member');
    } catch (e) {
      setError(friendlyError(e));
      if (isDev) {
        setProfile(DEV_MOCK_PROFILE);
        setMembership({
          id: 'dev-member-001',
          restaurant_id: DEV_MOCK_RESTAURANT.id,
          user_id: 'dev-user-001',
          role: 'manager',
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        setRestaurant(DEV_MOCK_RESTAURANT);
        setOrganization(DEV_MOCK_ORG);
        setViewingBranch(true);
        setAccess('member');
        return;
      }
      setAccess('signed_out');
    }
  }, []);

  useEffect(() => {
    if (!sessionReady) return;
    void load(session);
  }, [session?.user.id, sessionReady]); // eslint-disable-line react-hooks/exhaustive-deps

  const signIn = useCallback(async (email: string, password: string) => {
    const { error: e } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (e)
      throw new Error(e.message === 'Invalid login credentials' ? 'Incorrect email or password.' : friendlyError(e));
    await supabase.rpc('touch_last_login');
  }, []);

  const signOut = useCallback(async () => {
    await supabase.removeAllChannels();
    await supabase.auth.signOut();
    try {
      sessionStorage.removeItem(BRANCH_KEY);
    } catch {
      /* storage unavailable */
    }
    setSession(null);
  }, []);

  const reload = useCallback(() => load(session), [load, session]);
  const isOwner = organization !== null;
  const role: SessionRole | null = access === 'member' ? (isOwner ? 'owner' : (membership?.role ?? null)) : null;

  const enterBranch = useCallback(async (restaurantId: string) => {
    const r = unwrap(await supabase.from('restaurants').select('*').eq('id', restaurantId).single()) as Restaurant;
    try {
      sessionStorage.setItem(BRANCH_KEY, restaurantId);
    } catch {
      /* storage unavailable */
    }
    setRestaurant({ ...r, settings: normalizeSettings(r.settings) });
    setViewingBranch(true);
  }, []);
  const leaveBranch = useCallback(() => {
    try {
      sessionStorage.removeItem(BRANCH_KEY);
    } catch {
      /* storage unavailable */
    }
    setRestaurant(null);
    setViewingBranch(false);
  }, []);
  const reloadOrganization = useCallback(async () => {
    if (!organization) return;
    const org = unwrap(
      await supabase.from('organizations').select('*').eq('id', organization.id).single(),
    ) as Organization;
    setOrganization(org);
  }, [organization]);

  const value = useMemo<AuthValue>(
    () => ({
      session,
      profile,
      membership,
      restaurant,
      access,
      role,
      organization,
      isOwner,
      viewingBranch,
      enterBranch,
      leaveBranch,
      reloadOrganization,
      error,
      signIn,
      signOut,
      reload,
    }),
    [
      session,
      profile,
      membership,
      restaurant,
      access,
      role,
      organization,
      isOwner,
      viewingBranch,
      enterBranch,
      leaveBranch,
      reloadOrganization,
      error,
      signIn,
      signOut,
      reload,
    ],
  );
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): AuthValue {
  const c = useContext(AuthCtx);
  if (!c) throw new Error('useAuth must be used inside AuthProvider');
  return c;
}

/** For pages under a member guard: restaurant is guaranteed. */
export function useRestaurant(): Restaurant {
  const { restaurant } = useAuth();
  if (!restaurant) throw new Error('useRestaurant used outside protected routes');
  return restaurant;
}
