import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Banknote,
  ClipboardList,
  CreditCard,
  Hourglass,
  PlusCircle,
  Receipt,
  RotateCcw,
  Smartphone,
  Sparkles,
  Timer,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useAuth, useRestaurant } from '@sombill/shared-hooks/AuthContext';
import { useQuery } from '@sombill/shared-hooks/useQuery';
import { useRealtime } from '@sombill/shared-hooks/useRealtime';
import { fetchAll, supabase } from '@sombill/api-client/supabase';
import { presetRange, rangeToIso, type DateRange } from '@sombill/shared-utils/dates';
import { formatDateTime, formatMoney, ORDER_TYPE_LABEL, PAYMENT_METHOD_LABEL } from '@sombill/shared-utils/format';
import type { Order, Payment, PaymentStatus } from '@sombill/shared-types/types';
import { Card, DashboardHero, EmptyState, ErrorState, StatCard } from '@sombill/shared-ui/ui/Feedback';
import { DateRangeFilter } from '@sombill/shared-ui/ui/Filters';
import { OrderStatusBadge, PaymentStatusBadge } from '@sombill/shared-ui/ui/StatusBadges';
import { Button } from '@sombill/shared-ui/ui/Button';
import { computeCashierStats } from '../features/stats';
import { useOpenShift } from '../hooks/useShift';

export default function CashierDashboardPage() {
  const r = useRestaurant();
  const { profile } = useAuth();
  const money = (n: number) => formatMoney(n, r.currency);
  const [range, setRange] = useState<DateRange>(() => presetRange('today', r.timezone));
  const [status, setStatus] = useState<'' | PaymentStatus>('');
  const shift = useOpenShift();
  const q = useQuery(async () => {
    const { fromIso, toIso } = rangeToIso(range, r.timezone);
    const [orders, payments] = await Promise.all([
      fetchAll<Order>((a, b) =>
        supabase
          .from('orders')
          .select('*')
          .eq('restaurant_id', r.id)
          .gte('created_at', fromIso)
          .lt('created_at', toIso)
          .order('created_at', { ascending: false })
          .range(a, b),
      ),
      fetchAll<Payment>((a, b) =>
        supabase
          .from('payments')
          .select('*')
          .eq('restaurant_id', r.id)
          .gte('created_at', fromIso)
          .lt('created_at', toIso)
          .order('created_at', { ascending: false })
          .range(a, b),
      ),
    ]);
    return { orders, payments };
  }, [r.id, range.from, range.to]);
  useRealtime(['orders', 'payments'], r.id, () => void q.reload(), { debounceMs: 400 });
  const stats = useMemo(() => computeCashierStats(q.data?.orders ?? [], q.data?.payments ?? []), [q.data]);
  const loading = q.loading && !q.data;
  const orderNo = useMemo(() => new Map((q.data?.orders ?? []).map((o) => [o.id, o.order_number])), [q.data]);
  const recentOrders = (q.data?.orders ?? [])
    .filter((o) => o.status !== 'cancelled' && (!status || o.payment_status === status))
    .slice(0, 8);

  const collectPct = stats.grossSales > 0 ? Math.min(100, Math.round((stats.collected / stats.grossSales) * 100)) : 0;

  return (
    <div className="space-y-6">
      <DashboardHero
        eyebrow={
          <>
            <Sparkles className="h-3.5 w-3.5" aria-hidden /> {r.name} · Counter Terminal
          </>
        }
        title={`Hello, ${profile?.full_name?.split(' ')[0] ?? 'cashier'}`}
        description="Live sales, drawer collections, mobile money verification, and active counter orders."
        actions={
          <>
            <Link to="/cashier/new-sale">
              <Button variant="orange" size="sm" icon={<PlusCircle className="h-4 w-4" />}>
                New sale
              </Button>
            </Link>
            <Link to="/cashier/payments">
              <Button variant="secondary" size="sm" icon={<CreditCard className="h-4 w-4" />}>
                Payments
              </Button>
            </Link>
            <Link to="/cashier/bills">
              <Button variant="secondary" size="sm" icon={<Receipt className="h-4 w-4" />}>
                Bills
              </Button>
            </Link>
            <Link to="/cashier/shift">
              <Button variant="secondary" size="sm" icon={<Timer className="h-4 w-4" />}>
                Shift
              </Button>
            </Link>
          </>
        }
        aside={
          <div className="space-y-2.5">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-white/75">Collected</span>
              <span className="font-mono text-lg font-bold tabular-nums text-amber-300">{collectPct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-gradient-to-r from-red-500 via-orange-400 to-amber-300 transition-all duration-500"
                style={{ width: `${collectPct}%` }}
              />
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
              <div>
                <p className="text-white/70">Shift status</p>
                <p className="mt-0.5 font-mono font-bold text-white">{shift.shift ? 'Open' : 'Closed'}</p>
              </div>
              <div>
                <p className="text-white/70">Awaiting verify</p>
                <p className="mt-0.5 font-mono font-bold tabular-nums text-amber-300">
                  {money(stats.pendingVerification)}
                </p>
              </div>
            </div>
          </div>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Register & sales overview</h2>
        <DateRangeFilter value={range} onChange={setRange} timeZone={r.timezone} />
      </div>
      {q.error ? (
        <div className="card">
          <ErrorState message={q.error} onRetry={q.reload} />
        </div>
      ) : (
        <>
          <div
            className="mb-4 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm"
            data-testid="current-shift"
          >
            {shift.shift ? (
              <>
                Shift open since <b>{formatDateTime(shift.shift.opened_at, r.timezone)}</b> · opening cash{' '}
                {money(shift.shift.opening_cash)} ·{' '}
                <Link
                  className="inline-flex min-h-[44px] items-center font-semibold text-brand-red hover:underline"
                  to="/cashier/shift"
                >
                  Manage shift
                </Link>
              </>
            ) : (
              <span className={shift.required ? 'text-amber-800' : 'text-slate-600'}>
                No open shift.{shift.required ? ' You must open a shift before taking payments.' : ''}{' '}
                <Link
                  className="inline-flex min-h-[44px] items-center font-semibold text-brand-red hover:underline"
                  to="/cashier/shift"
                >
                  Open shift
                </Link>
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <StatCard
              loading={loading}
              label="Gross sales"
              value={<span data-testid="stat-gross">{money(stats.grossSales)}</span>}
              sub="Value of orders (not all collected)"
              icon={<TrendingUp className="h-5 w-5" />}
            />
            <StatCard
              loading={loading}
              label="Collected"
              value={<span data-testid="stat-collected">{money(stats.collected)}</span>}
              sub={`Net of refunds ${money(stats.net)}`}
              tone="green"
              icon={<Wallet className="h-5 w-5" />}
            />
            <StatCard
              loading={loading}
              label="Cash"
              value={<span data-testid="stat-cash">{money(stats.cash)}</span>}
              tone="green"
              icon={<Banknote className="h-5 w-5" />}
            />
            <StatCard
              loading={loading}
              label="Card"
              value={<span data-testid="stat-card">{money(stats.card)}</span>}
              icon={<CreditCard className="h-5 w-5" />}
            />
            <StatCard
              loading={loading}
              label="Mobile money (verified)"
              value={<span data-testid="stat-mobile">{money(stats.mobile)}</span>}
              sub="EVC Plus · Zaad · Somtel"
              tone="orange"
              icon={<Smartphone className="h-5 w-5" />}
            />
            <StatCard
              loading={loading}
              label="Awaiting verification"
              value={<span data-testid="stat-pending">{money(stats.pendingVerification)}</span>}
              sub="Not counted as collected"
              tone="orange"
              icon={<Hourglass className="h-5 w-5" />}
            />
            <StatCard
              loading={loading}
              label="Refunds"
              value={<span data-testid="stat-refunds">{money(stats.refunds)}</span>}
              tone="red"
              icon={<RotateCcw className="h-5 w-5" />}
            />
            <StatCard
              loading={loading}
              label="Average transaction"
              value={money(stats.avgTransaction)}
              sub={`${stats.transactions} transactions`}
              icon={<ClipboardList className="h-5 w-5" />}
            />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard
              loading={loading}
              label="Paid orders"
              value={<span data-testid="stat-paid">{stats.paidOrders}</span>}
              tone="green"
            />
            <StatCard
              loading={loading}
              label="Partially paid"
              value={<span data-testid="stat-partial">{stats.partialOrders}</span>}
              tone="orange"
            />
            <StatCard
              loading={loading}
              label="Unpaid orders"
              value={<span data-testid="stat-unpaid">{stats.unpaidOrders}</span>}
              tone="red"
            />
            <StatCard
              loading={loading}
              label="Active orders"
              value={<span data-testid="stat-active">{stats.activeOrders}</span>}
            />
          </div>
          <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Card
              title="Recent transactions"
              bodyClassName="p-0"
              action={
                <Link
                  className="inline-flex min-h-[44px] items-center font-semibold text-brand-red hover:underline text-sm"
                  to="/cashier/transactions"
                >
                  View all
                </Link>
              }
            >
              {!(q.data?.payments ?? []).length ? (
                <EmptyState title="No transactions yet" />
              ) : (
                <ul className="divide-y divide-slate-100 text-sm" aria-label="Recent transactions">
                  {q.data!.payments.slice(0, 8).map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2 px-5 py-2.5">
                      <span>
                        #{p.transaction_number ?? '—'} · Order #{orderNo.get(p.order_id) ?? '—'} ·{' '}
                        {PAYMENT_METHOD_LABEL[p.method]}
                        {p.status === 'pending'
                          ? ' · awaiting verification'
                          : p.status === 'failed'
                            ? ' · rejected'
                            : ''}
                        <span className="block text-xs text-slate-500">{formatDateTime(p.created_at, r.timezone)}</span>
                      </span>
                      <b
                        className={
                          p.kind === 'refund' ? 'text-brand-red' : p.status !== 'succeeded' ? 'text-slate-400' : ''
                        }
                      >
                        {p.kind === 'refund' ? '−' : ''}
                        {money(p.amount)}
                      </b>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card
              title="Recent orders"
              bodyClassName="p-0"
              action={
                <select
                  className="input h-9 w-40 py-0 text-sm"
                  aria-label="Filter orders by payment status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as PaymentStatus | '')}
                >
                  <option value="">All</option>
                  <option value="unpaid">Unpaid</option>
                  <option value="partial">Partially paid</option>
                  <option value="paid">Paid</option>
                  <option value="refunded">Refunded</option>
                </select>
              }
            >
              {!recentOrders.length ? (
                <EmptyState title="No orders" />
              ) : (
                <ul className="divide-y divide-slate-100 text-sm" aria-label="Recent orders">
                  {recentOrders.map((o) => (
                    <li key={o.id}>
                      <Link
                        to={`/cashier/bills?order=${o.id}`}
                        className="flex items-center justify-between gap-2 px-5 py-2.5 hover:bg-slate-50"
                      >
                        <span>
                          <b>#{o.order_number}</b> · {ORDER_TYPE_LABEL[o.order_type]}
                          <span className="mt-0.5 flex gap-1">
                            <OrderStatusBadge s={o.status} />
                            <PaymentStatusBadge s={o.payment_status} />
                          </span>
                        </span>
                        <b className="tabular-nums">{money(o.total)}</b>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
