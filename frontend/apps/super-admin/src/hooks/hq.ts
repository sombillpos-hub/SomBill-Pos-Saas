import { useCallback, useMemo } from 'react';
import { useAuth } from '@sombill/shared-hooks/AuthContext';
import { useQuery } from '@sombill/shared-hooks/useQuery';
import {
  auditFeed,
  auditReviews,
  branchSummary,
  nameMap,
  paymentMix,
  reviewEvent,
  revenueSeries,
} from '../services/hq';
import { useHq } from '../features/HqContext';
import { flagAll, RISK_ORDER } from '../features/lib/risk';
import { rangeFor } from '../features/lib/range';
import type { AuditReview, Flagged, RangeKey, ReviewStatus } from '../features/types';

export function useRange(key: RangeKey) {
  return useMemo(() => rangeFor(key), [key]);
}

/** Branch totals for a window (and the window before it, for trend arrows), limited to the chosen branch scope. */
export function useSummary(key: RangeKey, withPrev = false) {
  const { org, scopeIds } = useHq();
  const range = useRange(key);
  const q = useQuery(async () => {
    const [cur, prev] = await Promise.all([
      branchSummary(org.id, range.from, range.to),
      withPrev ? branchSummary(org.id, range.prevFrom, range.prevTo) : Promise.resolve([]),
    ]);
    return { cur, prev };
  }, [org.id, key, withPrev]);
  const inScope = <T extends { restaurant_id: string }>(rows: T[]) =>
    rows.filter((r) => scopeIds.includes(r.restaurant_id));
  return { ...q, range, cur: inScope(q.data?.cur ?? []), prev: inScope(q.data?.prev ?? []) };
}

export function useSeries(key: RangeKey) {
  const { org, scopeIds } = useHq();
  const range = useRange(key);
  const q = useQuery(() => revenueSeries(org.id, range.from, range.to, range.bucket), [org.id, key]);
  return { ...q, range, rows: (q.data ?? []).filter((r) => scopeIds.includes(r.restaurant_id)) };
}

export function usePayMix(key: RangeKey) {
  const { org, scopeIds } = useHq();
  const range = useRange(key);
  const q = useQuery(() => paymentMix(org.id, range.from, range.to), [org.id, key]);
  return { ...q, range, rows: (q.data ?? []).filter((r) => scopeIds.includes(r.restaurant_id)) };
}

export interface AuditItem extends Flagged {
  actorName: string;
  review: AuditReview | null;
}

/** The anti-fraud stream: flagged audit events with the owner's review status and who did them. */
export function useAudit(days: number) {
  const { org, branches, scopeIds } = useHq();
  const { session } = useAuth();
  const q = useQuery(async () => {
    const from = new Date(Date.now() - days * 86400000);
    const [rows, reviews] = await Promise.all([
      auditFeed(
        branches.map((b) => b.id),
        from,
        500,
      ),
      auditReviews(org.id),
    ]);
    const flagged = flagAll(rows);
    const names = await nameMap(flagged.map((f) => f.actorId ?? ''));
    return { flagged, reviews, names };
  }, [org.id, days, branches.length]);

  const items: AuditItem[] = useMemo(() => {
    const rev = new Map((q.data?.reviews ?? []).map((r) => [r.event_key, r]));
    return (q.data?.flagged ?? [])
      .filter((f) => scopeIds.includes(f.restaurantId))
      .map((f) => ({
        ...f,
        actorName: f.actorId ? (q.data?.names.get(f.actorId) ?? 'Unknown') : 'System',
        review: rev.get(f.key) ?? null,
      }))
      .sort((a, b) => RISK_ORDER[a.risk] - RISK_ORDER[b.risk] || b.at.localeCompare(a.at));
  }, [q.data, scopeIds]);

  const review = useCallback(
    async (key: string, status: ReviewStatus, note: string) => {
      await reviewEvent(org.id, key, status, note, session?.user.id ?? '');
      await q.reload();
    },
    [org.id, session?.user.id, q],
  );
  return { ...q, items, review };
}
