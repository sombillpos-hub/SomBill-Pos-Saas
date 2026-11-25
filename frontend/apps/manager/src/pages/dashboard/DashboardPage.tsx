import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  BarChart3,
  Boxes,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Clock,
  HandCoins,
  LayoutGrid,
  ReceiptText,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  UtensilsCrossed,
  Wallet,
} from 'lucide-react';
import { useRestaurant } from '@sombill/shared-hooks/AuthContext';
import { useQuery } from '@sombill/shared-hooks/useQuery';
import { useRealtime } from '@sombill/shared-hooks/useRealtime';
import { useStaffDirectory } from '@sombill/shared-hooks/useStaffDirectory';
import { supabase, unwrap } from '@sombill/api-client/supabase';
import { addDays, presetRange, rangeToIso, todayInZone, type DateRange } from '@sombill/shared-utils/dates';
import {
  fetchAudit,
  fetchInventory,
  fetchItemsForOrdersInRange,
  fetchOrdersInRange,
  fetchPaymentsInRange,
  fetchTableStatus,
} from '@sombill/api-client/queries';
import {
  byPaymentMethod,
  inventoryValuation,
  orderBalance,
  popularProducts,
  salesSeries,
  summarize,
} from '@sombill/shared-utils/reports';
import { formatDateTime, formatMoney, formatQty, PAYMENT_METHOD_LABEL } from '@sombill/shared-utils/format';
import type { SalesSummary } from '@sombill/shared-types/types';
import { Card, DashboardHero, ErrorState, StatCard, Badge, EmptyState } from '@sombill/shared-ui/ui/Feedback';
import { Button } from '@sombill/shared-ui/ui/Button';
import { DateRangeFilter, Tabs } from '@sombill/shared-ui/ui/Filters';
import { BarChart, ShareBars } from '@sombill/manager/components/BarChart';
import { OrderStatusBadge, PaymentStatusBadge } from '@sombill/shared-ui/ui/StatusBadges';

type ChartMode = 'daily' | 'weekly' | 'monthly';

export default function DashboardPage() {
  const r = useRestaurant();
  const navigate = useNavigate();
  const tz = r.timezone;
  const money = (n: number) => formatMoney(n, r.currency);
  const [range, setRange] = useState<DateRange>(() => presetRange('today', tz));
  const [chartMode, setChartMode] = useState<ChartMode>('daily');
  const staff = useStaffDirectory(r.id);

  const main = useQuery(async () => {
    const { fromIso, toIso } = rangeToIso(range, tz);
    const [summary, orders, payments, items, tables, inventory, activity] = await Promise.all([
      supabase
        .rpc('sales_summary', { p_restaurant: r.id, p_from: fromIso, p_to: toIso })
        .then((x) => unwrap<SalesSummary>(x)),
      fetchOrdersInRange(r.id, fromIso, toIso),
      fetchPaymentsInRange(r.id, fromIso, toIso),
      fetchItemsForOrdersInRange(r.id, fromIso, toIso),
      fetchTableStatus(r.id),
      fetchInventory(r.id),
      fetchAudit(r.id, { limit: 12 }),
    ]);
    return { summary, orders, payments, items, tables, inventory, activity };
  }, [r.id, range.from, range.to, tz]);

  const chartRange = useMemo<DateRange>(() => {
    const today = todayInZone(tz);
    if (chartMode === 'daily') return range.from === range.to ? { from: addDays(today, -13), to: today } : range;
    if (chartMode === 'weekly') return { from: addDays(today, -7 * 12 + 1), to: today };
    return { from: `${addDays(today, -334).slice(0, 7)}-01`, to: today };
  }, [chartMode, range, tz]);

  const chart = useQuery(async () => {
    const { fromIso, toIso } = rangeToIso(chartRange, tz);
    const [orders, payments] = await Promise.all([
      fetchOrdersInRange(r.id, fromIso, toIso),
      fetchPaymentsInRange(r.id, fromIso, toIso),
    ]);
    return salesSeries(
      orders,
      payments,
      chartRange,
      tz,
      chartMode === 'daily' ? 'day' : chartMode === 'weekly' ? 'week' : 'month',
    );
  }, [r.id, chartRange.from, chartRange.to, chartMode, tz]);

  useRealtime(['orders', 'payments', 'order_items', 'restaurant_tables', 'inventory_items'], r.id, () => {
    void main.reload();
    void chart.reload();
  });

  const d = main.data;
  const local = useMemo(() => (d ? summarize(d.orders, d.payments) : null), [d]);
  const methods = useMemo(() => (d ? byPaymentMethod(d.payments) : []), [d]);
  const popular = useMemo(() => (d ? popularProducts(d.items, 6) : []), [d]);
  const inv = useMemo(() => (d ? inventoryValuation(d.inventory) : null), [d]);
  const occupied = d?.tables.filter((t) => t.status !== 'available' && t.status !== 'cleaning').length ?? 0;
  const available = d?.tables.filter((t) => t.status === 'available').length ?? 0;
  const s = d?.summary;
  const loading = main.loading && !d;

  const chartData = (chart.data ?? []).map((p) => ({
    label: chartMode === 'monthly' ? p.key : p.key.slice(5),
    values: [p.sales, p.collected],
  }));

  const totalTables = occupied + available;
  const occupancyPct = totalTables > 0 ? Math.round((occupied / totalTables) * 100) : 0;
  const collectionPct = s && s.gross_sales > 0 ? Math.min(100, Math.round((s.collected / s.gross_sales) * 100)) : 0;

  return (
    <div className="space-y-6">
      <DashboardHero
        eyebrow={
          <>
            <Sparkles className="h-3.5 w-3.5" aria-hidden /> {r.name} · Live Operations
          </>
        }
        title="Business Control Center"
        description="Real-time revenue, floor occupancy, stock health, and staff activity directly from recorded orders and payments."
        actions={
          <>
            <Button
              size="sm"
              variant="primary"
              icon={<ClipboardList className="h-4 w-4" />}
              onClick={() => navigate('/manager/orders')}
            >
              Orders
            </Button>
            <Button
              size="sm"
              variant="secondary"
              icon={<UtensilsCrossed className="h-4 w-4" />}
              onClick={() => navigate('/manager/menu')}
            >
              Menu
            </Button>
            <Button
              size="sm"
              variant="secondary"
              icon={<Boxes className="h-4 w-4" />}
              onClick={() => navigate('/manager/inventory')}
            >
              Inventory
            </Button>
            <Button
              size="sm"
              variant="secondary"
              icon={<BarChart3 className="h-4 w-4" />}
              onClick={() => navigate('/manager/reports')}
            >
              Reports
            </Button>
          </>
        }
        aside={
          <div className="space-y-2.5">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-white/75">Collected</span>
              <span className="font-mono text-lg font-bold tabular-nums text-emerald-300">{collectionPct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-gradient-to-r from-red-500 via-orange-400 to-amber-300 transition-all duration-500"
                style={{ width: `${collectionPct}%` }}
              />
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
              <div>
                <p className="text-white/70">Floor occupancy</p>
                <p className="mt-0.5 font-mono font-bold tabular-nums text-white">
                  {occupied}/{totalTables} ({occupancyPct}%)
                </p>
              </div>
              <div>
                <p className="text-white/70">Low stock</p>
                <p className="mt-0.5 font-mono font-bold tabular-nums text-amber-300">
                  {inv?.lowStock.length ?? 0} item{(inv?.lowStock.length ?? 0) === 1 ? '' : 's'}
                </p>
              </div>
            </div>
          </div>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Performance overview</h2>
          {s && s.pending_orders > 0 && <Badge tone="orange">{s.pending_orders} active</Badge>}
        </div>
        <DateRangeFilter value={range} onChange={setRange} timeZone={tz} />
      </div>

      {main.error && !d ? (
        <div className="card">
          <ErrorState message={main.error} onRetry={main.reload} />
        </div>
      ) : (
        <>
          <section aria-label="Money" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              loading={loading}
              tone="navy"
              icon={<TrendingUp className="h-5 w-5" />}
              label="Gross sales"
              value={money(s?.gross_sales ?? 0)}
              sub="Order totals, excl. cancelled"
            />
            <StatCard
              loading={loading}
              tone="green"
              icon={<Wallet className="h-5 w-5" />}
              label="Payments collected"
              value={money(s?.collected ?? 0)}
              sub={`Net of refunds: ${money(s?.net_collected ?? 0)}`}
            />
            <StatCard
              loading={loading}
              tone="red"
              icon={<HandCoins className="h-5 w-5" />}
              label="Outstanding balances"
              value={money(s?.outstanding ?? 0)}
              sub="Unpaid on orders in this period"
            />
            <StatCard
              loading={loading}
              tone="orange"
              icon={<CircleDollarSign className="h-5 w-5" />}
              label="Refunds"
              value={money(s?.refunds ?? 0)}
              sub="Recorded separately from sales"
            />
          </section>

          <section aria-label="Orders" className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
            <StatCard
              loading={loading}
              icon={<ShoppingBag className="h-5 w-5" />}
              label="Total orders"
              value={s?.total_orders ?? 0}
            />
            <StatCard
              loading={loading}
              tone="green"
              icon={<CheckCircle2 className="h-5 w-5" />}
              label="Completed"
              value={s?.completed_orders ?? 0}
            />
            <StatCard
              loading={loading}
              tone="orange"
              icon={<Clock className="h-5 w-5" />}
              label="Pending"
              value={s?.pending_orders ?? 0}
            />
            <StatCard
              loading={loading}
              tone="red"
              icon={<Ban className="h-5 w-5" />}
              label="Cancelled"
              value={s?.cancelled_orders ?? 0}
            />
            <StatCard
              loading={loading}
              icon={<ReceiptText className="h-5 w-5" />}
              label="Avg order value"
              value={money(s?.avg_order_value ?? 0)}
            />
            <StatCard
              loading={loading}
              tone="navy"
              icon={<LayoutGrid className="h-5 w-5" />}
              label="Tables in use"
              value={`${occupied} / ${occupied + available}`}
              sub={`${available} available now`}
            />
          </section>

          <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
            <Card
              className="xl:col-span-2"
              title="Sales trend"
              bodyClassName="p-5"
              action={
                <Tabs
                  value={chartMode}
                  onChange={setChartMode}
                  tabs={[
                    { id: 'daily', label: 'Daily' },
                    { id: 'weekly', label: 'Weekly' },
                    { id: 'monthly', label: 'Monthly' },
                  ]}
                />
              }
            >
              {chart.error ? (
                <ErrorState message={chart.error} onRetry={chart.reload} />
              ) : (
                <BarChart
                  data={chartData}
                  format={(n) => formatMoney(n, r.currency).replace(/\.00$/, '')}
                  series={[
                    { name: 'Gross sales', color: '#dc2626' },
                    { name: 'Collected (net)', color: '#f97316' },
                  ]}
                />
              )}
            </Card>
            <Card title="Sales by payment method">
              <ShareBars
                format={money}
                rows={methods.map((m) => ({
                  label: PAYMENT_METHOD_LABEL[m.method],
                  value: m.net,
                  sub: `${m.payments} payments`,
                }))}
              />
            </Card>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
            <Card
              title="Recent orders"
              className="xl:col-span-2"
              bodyClassName="p-0"
              action={
                <Link
                  to="/orders"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-brand-red hover:underline"
                >
                  View all <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              }
            >
              {!d?.orders.length ? (
                <EmptyState title="No orders in this period" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-100">
                    <thead className="bg-slate-50/70">
                      <tr>
                        <th className="th">Order</th>
                        <th className="th">Table</th>
                        <th className="th">Status</th>
                        <th className="th">Payment</th>
                        <th className="th text-right">Total</th>
                        <th className="th text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {d.orders.slice(0, 8).map((o) => (
                        <tr
                          key={o.id}
                          className="cursor-pointer hover:bg-orange-50/40"
                          onClick={() => navigate(`/orders/${o.id}`)}
                        >
                          <td className="td font-semibold">
                            #{o.order_number}
                            <div className="text-xs font-normal text-slate-500">{formatDateTime(o.created_at, tz)}</div>
                          </td>
                          <td className="td">{d.tables.find((t) => t.id === o.table_id)?.table_number ?? '—'}</td>
                          <td className="td">
                            <OrderStatusBadge s={o.status} />
                          </td>
                          <td className="td">
                            <PaymentStatusBadge s={o.payment_status} />
                          </td>
                          <td className="td text-right tabular-nums">{money(o.total)}</td>
                          <td className="td text-right tabular-nums">{money(orderBalance(o))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
            <Card title="Popular products">
              {!popular.length ? (
                <p className="py-8 text-center text-sm text-slate-400">No items sold in this period</p>
              ) : (
                <ol className="space-y-3">
                  {popular.map((p, i) => (
                    <li key={p.name + i} className="flex items-center gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-orange/15 text-xs font-bold text-brand-orange">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.name}</span>
                      <span className="text-right text-sm tabular-nums">
                        <b>{formatQty(p.quantity)}</b> sold
                        <div className="text-xs text-slate-500">{money(p.revenue)}</div>
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card title="Recent transactions" bodyClassName="p-0">
              {!d?.payments.length ? (
                <EmptyState title="No payments in this period" />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {d.payments.slice(0, 8).map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{PAYMENT_METHOD_LABEL[p.method]}</p>
                        <p className="text-xs text-slate-500">
                          {formatDateTime(p.created_at, tz)} · {staff.nameOf(p.cashier_id)}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 text-sm font-semibold tabular-nums ${p.kind === 'refund' ? 'text-brand-red' : 'text-emerald-700'}`}
                      >
                        {p.kind === 'refund' ? '−' : '+'}
                        {money(p.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card
              title="Low-stock alerts"
              bodyClassName="p-0"
              action={
                <Link
                  to="/inventory"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-brand-red hover:underline"
                >
                  Inventory <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              }
            >
              {!inv?.lowStock.length ? (
                <EmptyState title="Stock levels healthy" message="No items are at or below their minimum." />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {inv.lowStock.slice(0, 8).map((i) => (
                    <li key={i.id} className="flex items-center justify-between gap-3 px-5 py-3">
                      <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                        <AlertTriangle className="h-4 w-4 shrink-0 text-brand-orange" />
                        <span className="truncate">{i.name}</span>
                      </span>
                      <Badge tone={i.quantity <= 0 ? 'red' : 'orange'}>
                        {formatQty(i.quantity)} / {formatQty(i.min_stock)} {i.unit}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card title="Business activity" bodyClassName="p-0">
              {!d?.activity.length ? (
                <EmptyState title="No recent activity" />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {d.activity.map((a) => (
                    <li key={a.id} className="px-5 py-3">
                      <p className="text-sm">
                        <b>{staff.nameOf(a.actor_id)}</b>{' '}
                        <span className="text-slate-600">{describeAudit(a.action, a.entity_type)}</span>
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatDateTime(a.created_at, tz)}
                        {a.reason ? ` · “${a.reason}”` : ''}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
          {local && local.discounts > 0 && (
            <p className="mt-4 text-xs text-slate-500">
              Discounts given in this period: {money(local.discounts)} · Tax included in sales:{' '}
              {money(local.taxCollected)}
            </p>
          )}
        </>
      )}
    </div>
  );
}

export function describeAudit(action: string, entity: string): string {
  const noun: Record<string, string> = {
    products: 'a product',
    categories: 'a category',
    restaurant_tables: 'a table',
    customers: 'a customer',
    orders: 'an order',
    order_items: 'an order item',
    payments: 'a payment',
    inventory_items: 'an inventory item',
    suppliers: 'a supplier',
    purchase_orders: 'a purchase order',
    expenses: 'an expense',
    restaurant_members: 'a staff member',
    restaurants: 'restaurant settings',
    product_recipe_items: 'a recipe',
  };
  const verb: Record<string, string> = {
    create: 'created',
    update: 'updated',
    delete: 'removed',
    archive: 'archived',
    restore: 'restored',
    price_change: 'changed the price of',
    status_change: 'changed the status of',
    cancel: 'cancelled',
    refund: 'refunded',
    staff_create: 'added',
    staff_role_change: 'changed the role of',
    staff_suspended: 'suspended',
    staff_active: 'reactivated',
    staff_password_reset: 'sent a password reset to',
  };
  return `${verb[action] ?? action} ${noun[entity] ?? entity}`;
}
