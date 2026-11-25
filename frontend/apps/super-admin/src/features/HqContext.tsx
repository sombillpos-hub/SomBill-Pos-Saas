import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '@sombill/shared-hooks/AuthContext';
import { useQuery } from '@sombill/shared-hooks/useQuery';
import { auditFeed, auditReviews, branchSummary, listBranches } from '../services/hq';
import { flagAll } from './lib/risk';
import { fxFrom, type Fx } from './lib/money';
import { rangeFor } from './lib/range';
import type { Organization } from '@sombill/shared-types/types';
import type { Branch, BranchSummary, Flagged } from './types';

const SCOPE_KEY = 'sombill.hq.scope';
export const ALL = 'all';

interface HqValue {
  org: Organization;
  fx: Fx;
  branches: Branch[];
  branchesLoading: boolean;
  branchesError: string | null;
  reloadBranches: () => Promise<void>;
  /** 'all' or one branch id. Pages filter by this. */
  scope: string;
  setScope: (s: string) => void;
  scopeIds: string[];
  scopeBranches: Branch[];
  /** Today's numbers for the top bar and sidebar badges; refreshed every 30 s. */
  live: BranchSummary[];
  liveLoaded: boolean;
  /** Unreviewed high/medium flagged events from the last 24 hours. */
  alerts: Flagged[];
  refreshLive: () => Promise<void>;
}

const Ctx = createContext<HqValue | null>(null);

export function HqProvider({ children }: { children: ReactNode }) {
  const { organization } = useAuth();
  if (!organization) throw new Error('HqProvider needs a group owner');
  return <Inner org={organization}>{children}</Inner>;
}

function Inner({ org, children }: { org: Organization; children: ReactNode }) {
  const branchesQ = useQuery(() => listBranches(org.id), [org.id]);
  const branches = useMemo(() => branchesQ.data ?? [], [branchesQ.data]);
  const [scope, setScopeState] = useState<string>(() => {
    try {
      return localStorage.getItem(SCOPE_KEY) || ALL;
    } catch {
      return ALL;
    }
  });
  // A saved branch that no longer exists falls back to "all".
  const effective = scope !== ALL && branches.length && !branches.some((b) => b.id === scope) ? ALL : scope;
  const setScope = useCallback((s: string) => {
    setScopeState(s);
    try {
      localStorage.setItem(SCOPE_KEY, s);
    } catch {
      /* storage unavailable */
    }
  }, []);
  const scopeBranches = useMemo(
    () => (effective === ALL ? branches : branches.filter((b) => b.id === effective)),
    [branches, effective],
  );
  const scopeIds = useMemo(() => scopeBranches.map((b) => b.id), [scopeBranches]);

  const liveQ = useQuery(async () => {
    const day = rangeFor('today');
    const [summary, rows, reviews] = await Promise.all([
      branchSummary(org.id, day.from, day.to),
      auditFeed(
        (await listBranches(org.id)).map((b) => b.id),
        new Date(Date.now() - 24 * 3600 * 1000),
        200,
      ),
      auditReviews(org.id),
    ]);
    const done = new Set(reviews.filter((r) => r.status === 'cleared').map((r) => r.event_key));
    return { summary, alerts: flagAll(rows).filter((f) => f.risk !== 'low' && !done.has(f.key)) };
  }, [org.id]);
  useEffect(() => {
    const t = setInterval(() => void liveQ.reload(), 30000);
    return () => clearInterval(t);
  }, [liveQ]);

  const value = useMemo<HqValue>(
    () => ({
      org,
      fx: fxFrom(org.settings),
      branches,
      branchesLoading: branchesQ.loading,
      branchesError: branchesQ.error,
      reloadBranches: branchesQ.reload,
      scope: effective,
      setScope,
      scopeIds,
      scopeBranches,
      live: liveQ.data?.summary ?? [],
      liveLoaded: liveQ.data !== undefined,
      alerts: liveQ.data?.alerts ?? [],
      refreshLive: liveQ.reload,
    }),
    [
      org,
      branches,
      branchesQ.loading,
      branchesQ.error,
      branchesQ.reload,
      effective,
      setScope,
      scopeIds,
      scopeBranches,
      liveQ.data,
      liveQ.reload,
    ],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useHq(): HqValue {
  const c = useContext(Ctx);
  if (!c) throw new Error('useHq must be used inside HqProvider');
  return c;
}
