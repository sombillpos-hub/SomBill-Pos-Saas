import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Coins, CreditCard, Monitor, ReceiptText, ShieldAlert, Users } from 'lucide-react';
import { Card, EmptyState, ErrorState } from '@sombill/shared-ui/ui/Feedback';
import { Button } from '@sombill/shared-ui/ui/Button';
import { useQuery } from '@sombill/shared-hooks/useQuery';
import { formatConverted, secondary, sumConverted, trendPct } from '../features/lib/money';
import { mixShares } from '../features/lib/mix';
import { branchColor } from '../features/lib/colors';
import { menuMatrix } from '../services/hq';
import { useHq } from '../features/HqContext';
import { useAudit, usePayMix, useSeries, useSummary } from '../hooks/hq';
import { Hero } from '../components/Hero';
import { Kpi } from '../components/Kpi';
import { CountUp } from '../components/CountUp';
import { RangeTabs } from '../components/RangeTabs';
import { MultiBranchChart } from '../components/MultiBranchChart';
import { BranchCard } from '../components/BranchCard';
import { AuditTable } from '../components/AuditTable';
import { MenuPushForm } from '../components/MenuPushForm';
import { useEnterBranch } from '../components/useEnterBranch';
import { formatMoney, formatNumber } from '@sombill/shared-utils/format';
import { HQ } from '../layouts/navigation';
import type { RangeKey } from '../features/types';

export default function OverviewPage() {
  const { org, fx, branches, scope, scopeIds, scopeBranches, alerts, setScope } = useHq();
  const navigate = useNavigate();
  const enter = useEnterBranch();
  const [key, setKey] = useState<RangeKey>('today');
  const sum = useSummary(key, true);
  const today = useSummary('today');
  const series = useSeries(key);
  const mix = usePayMix(key);
  const audit = useAudit(7);
  const matrix = useQuery(() => menuMatrix(org.id), [org.id]);

  const cur = sum.cur;
  const rev = useMemo(
    () =>
      sumConverted(
        cur,
        (r) => r.gross,
        (r) => r.currency,
        fx,
      ),
    [cur, fx],
  );
  const prev = useMemo(
    () =>
      sumConverted(
        sum.prev,
        (r) => r.gross,
        (r) => r.currency,
        fx,
      ),
    [sum.prev, fx],
  );
  const tax = useMemo(
    () =>
      sumConverted(
        cur,
        (r) => r.tax,
        (r) => r.currency,
        fx,
      ),
    [cur, fx],
  );
  const todayRev = useMemo(
    () =>
      sumConverted(
        today.cur,
        (r) => r.gross,
        (r) => r.currency,
        fx,
      ),
    [today.cur, fx],
  );
  const guests = cur.reduce((s, r) => s + r.guests, 0);
  const orders = cur.reduce((s, r) => s + r.orders_count, 0);
  const tTotal = today.cur.reduce((s, r) => s + r.tables_total, 0);
  const tOcc = today.cur.reduce((s, r) => s + r.tables_occupied, 0);
  const cur$ = (id: string) => branches.find((b) => b.id === id)?.currency ?? fx.reporting;
  const shares = useMemo(() => mixShares(mix.rows, cur$, fx), [mix.rows, branches, fx]); // eslint-disable-line react-hooks/exhaustive-deps
  const openAlerts = alerts.filter((a) => scopeIds.includes(a.restaurantId));
  const stream = audit.items.filter((i) => i.review?.status !== 'cleared');
  const mixText = shares.shares
    .slice(0, 3)
    .map((s) => `${Math.round(s.pct)}% ${s.label}`)
    .join(' · ');
  const loading = sum.loading;
  const sec = secondary(rev.total, fx);

  if (sum.error) return <ErrorState message={sum.error} onRetry={sum.reload} />;

  return (
    <div className="space-y-6">
      <Hero
        orgName={org.name}
        branches={scopeBranches.length}
        registers={today.cur.reduce((s, r) => s + r.open_cashier_shifts, 0)}
        onDuty={today.cur.reduce((s, r) => s + r.staff_on_duty, 0)}
        revenue={todayRev.total}
        revenueNote={Object.keys(todayRev.unconverted).length ? ' (plus branches without an exchange rate)' : null}
        occupancyPct={tTotal > 0 ? Math.round((tOcc / tTotal) * 100) : null}
        fx={fx}
        loading={today.loading}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="sa-h2">Group numbers · {sum.range.label}</h2>
        <RangeTabs value={key} onChange={setKey} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Key figures">
        <Kpi
          index={0}
          tone="orange"
          icon={<Coins className="h-5 w-5" />}
          label="Total multi-branch revenue"
          loading={loading}
          value={<CountUp value={rev.total} format={(n) => formatConverted({ ...rev, total: n }, fx)} />}
          trend={trendPct(rev.total, prev.total)}
          sub={sec ?? `${formatNumber(orders)} orders`}
        />
        <Kpi
          index={1}
          tone="purple"
          icon={<Users className="h-5 w-5" />}
          label="Total guest footfall"
          loading={loading}
          value={<CountUp value={guests} format={(n) => `${formatNumber(Math.round(n))} guests`} />}
          sub={`across ${cur.length} branch${cur.length === 1 ? '' : 'es'} · from recorded party sizes`}
        />
        <Kpi
          index={2}
          tone="amber"
          icon={<Monitor className="h-5 w-5" />}
          label="Open registers · staff on duty"
          loading={today.loading}
          value={`${today.cur.reduce((s, r) => s + r.open_cashier_shifts, 0)} open`}
          sub={`${today.cur.reduce((s, r) => s + r.staff_on_duty, 0)} staff clocked in now`}
        />
        <Kpi
          index={3}
          tone="amber"
          icon={<ReceiptText className="h-5 w-5" />}
          label="Tax collected"
          loading={loading}
          value={<CountUp value={tax.total} format={(n) => formatConverted({ ...tax, total: n }, fx)} />}
          sub="From order tax, per branch rate"
        />
        <Kpi
          index={4}
          tone="sky"
          icon={<CreditCard className="h-5 w-5" />}
          label="Payment mix"
          loading={mix.loading}
          value={<span className="sa-kpi-small">{mixText || 'No payments yet'}</span>}
          sub={shares.total > 0 ? `of ${formatMoney(shares.total, fx.reporting)} taken` : undefined}
        />
        <Kpi
          index={5}
          tone="red"
          icon={<ShieldAlert className="h-5 w-5" />}
          label="Live fraud / void alerts"
          loading={false}
          value={`${openAlerts.length} flagged`}
          sub={openAlerts.length ? 'Unreviewed in the last 24 h' : 'Nothing needs review'}
        />
      </div>

      <Card
        title={`Revenue by branch · ${sum.range.label}`}
        action={<span className="text-xs text-slate-500">Reporting currency: {fx.reporting}</span>}
      >
        {series.error ? (
          <ErrorState message={series.error} onRetry={series.reload} />
        ) : (
          <MultiBranchChart
            rows={series.rows}
            branches={branches.filter((b) => scopeIds.includes(b.id))}
            range={series.range}
            fx={fx}
          />
        )}
      </Card>

      <section aria-label="Branch performance">
        <h2 className="sa-h2 mb-3">Branch performance (today)</h2>
        {today.cur.length === 0 && !today.loading ? (
          <EmptyState
            title="No branches yet"
            message="Add your first branch in Multi-Branch Fleet."
            action={<Button onClick={() => navigate(`${HQ}/branches`)}>Open Multi-Branch Fleet</Button>}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {today.cur.map((b, i) => (
              <BranchCard
                key={b.restaurant_id}
                b={b}
                index={i}
                color={branchColor(branches.findIndex((x) => x.id === b.restaurant_id))}
                onSwitch={() => enter(b.restaurant_id)}
                onAudit={() => {
                  setScope(b.restaurant_id);
                  navigate(`${HQ}/audit`);
                }}
              />
            ))}
          </div>
        )}
      </section>

      <Card
        title="Security audit & anti-fraud stream"
        action={
          <Button size="sm" variant="secondary" onClick={() => navigate(`${HQ}/audit`)}>
            Open full log
          </Button>
        }
        bodyClassName="p-0"
      >
        <AuditTable
          items={stream}
          loading={audit.loading}
          error={audit.error}
          onRetry={audit.reload}
          onReview={audit.review}
          limit={6}
        />
      </Card>

      <Card
        title="Central menu & price sync hub"
        action={
          <span className="text-xs text-slate-500">{scope === 'all' ? 'All branches' : 'Choose branches below'}</span>
        }
      >
        <MenuPushForm matrix={matrix.data ?? []} onDone={() => void matrix.reload()} compact />
      </Card>
    </div>
  );
}
