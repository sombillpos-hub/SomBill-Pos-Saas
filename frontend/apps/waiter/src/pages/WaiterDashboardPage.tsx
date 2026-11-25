import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BellRing,
  CheckCircle2,
  ChefHat,
  ClipboardList,
  Clock,
  LayoutGrid,
  PlusCircle,
  Receipt,
  Timer,
  Utensils,
} from 'lucide-react';
import { useAuth, useRestaurant } from '@sombill/shared-hooks/AuthContext';
import { useQuery } from '@sombill/shared-hooks/useQuery';
import { useRealtime } from '@sombill/shared-hooks/useRealtime';
import { supabase, friendlyError } from '@sombill/api-client/supabase';
import { presetRange, rangeToIso } from '@sombill/shared-utils/dates';
import { fetchTableStatus } from '@sombill/api-client/queries';
import { formatDateTime, formatDuration, formatMoney } from '@sombill/shared-utils/format';
import { Card, DashboardHero, EmptyState, ErrorState, StatCard } from '@sombill/shared-ui/ui/Feedback';
import { Button } from '@sombill/shared-ui/ui/Button';
import { useToast } from '@sombill/shared-ui/ui/Toast';
import {
  fetchActiveOrders,
  fetchNotifications,
  fetchOpenShift,
  fetchOrdersBetween,
} from '@sombill/api-client/orderData';

export default function WaiterDashboardPage() {
  const r = useRestaurant();
  const { session, profile } = useAuth();
  const uid = session?.user.id ?? '';
  const navigate = useNavigate();
  const toast = useToast();
  const [shiftBusy, setShiftBusy] = useState(false);
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 60000);
    return () => clearInterval(t);
  }, []);

  const q = useQuery(async () => {
    const { fromIso, toIso } = rangeToIso(presetRange('today', r.timezone), r.timezone);
    const [active, today, tables, notes, shift] = await Promise.all([
      fetchActiveOrders(r.id),
      fetchOrdersBetween(r.id, fromIso, toIso, uid),
      fetchTableStatus(r.id),
      fetchNotifications(uid, 8),
      fetchOpenShift(r.id, uid),
    ]);
    const mine = active.filter((o) => o.waiter_id === uid);
    return {
      mine,
      shift,
      notes,
      completedToday: today.filter((o) => o.status === 'completed'),
      available: tables.filter((t) => t.status === 'available').length,
      occupied: tables.filter((t) => t.status !== 'available' && t.status !== 'cleaning').length,
    };
  }, [r.id, uid]);
  useRealtime(['orders', 'payments', 'restaurant_tables'], r.id, () => void q.reload());
  useRealtime(['notifications'], r.id, () => void q.reload(), { filter: `user_id=eq.${uid}` });

  const d = q.data;
  const loading = q.loading && !d;
  const ready = d?.mine.filter((o) => o.status === 'ready') ?? [];
  const pending = d?.mine.filter((o) => ['new', 'pending', 'accepted', 'preparing'].includes(o.status)) ?? [];
  const bills = d?.mine.filter((o) => o.bill_requested_at && o.payment_status !== 'paid') ?? [];
  const salesToday = (d?.completedToday ?? []).reduce((s, o) => s + Number(o.total), 0);

  const toggleShift = async () => {
    setShiftBusy(true);
    const { error } = await supabase.rpc(d?.shift ? 'end_shift' : 'start_shift', { p_restaurant: r.id });
    setShiftBusy(false);
    if (error) {
      toast.error(friendlyError(error));
      return;
    }
    toast.success(d?.shift ? 'Shift ended.' : 'Shift started.');
    await q.reload();
  };

  const totalTables = (d?.available ?? 0) + (d?.occupied ?? 0);
  const floorPct = totalTables > 0 ? Math.round(((d?.occupied ?? 0) / totalTables) * 100) : 0;

  return (
    <div>
      <DashboardHero
        eyebrow={`${r.name} · Floor Service`}
        title={`Hello, ${profile?.full_name?.split(' ')[0] || 'there'}`}
        description="Take table orders, monitor kitchen readiness, and request bills in real time across the dining floor."
        actions={
          <>
            <Button size="sm" icon={<PlusCircle className="h-4 w-4" />} onClick={() => navigate('/waiter/new-order')}>
              New Order
            </Button>
            <Button
              size="sm"
              variant="secondary"
              icon={<LayoutGrid className="h-4 w-4" />}
              onClick={() => navigate('/waiter/tables')}
            >
              View Tables
            </Button>
            <Button
              size="sm"
              variant="secondary"
              icon={<ClipboardList className="h-4 w-4" />}
              onClick={() => navigate('/waiter/orders')}
            >
              View My Orders
            </Button>
            <Button
              size="sm"
              variant="secondary"
              icon={<Receipt className="h-4 w-4" />}
              onClick={() => navigate('/waiter/bills')}
            >
              Request Bill
            </Button>
          </>
        }
        aside={
          <div className="min-w-[260px] rounded-2xl border border-white/15 bg-white/[0.08] p-4 backdrop-blur-md">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Timer className="h-4 w-4 text-orange-300" />
                <div>
                  <p className="text-xs font-bold text-white">
                    {d?.shift ? `On shift · ${formatDuration(d.shift.started_at)}` : 'Not on shift'}
                  </p>
                  <p className="text-[11px] text-white/70">
                    {d?.shift
                      ? `Started ${formatDateTime(d.shift.started_at, r.timezone)}`
                      : 'Start your shift to begin'}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant={d?.shift ? 'secondary' : 'primary'}
                loading={shiftBusy}
                onClick={() => void toggleShift()}
              >
                {d?.shift ? 'End shift' : 'Start shift'}
              </Button>
            </div>
            <div className="mt-3.5 border-t border-white/10 pt-3">
              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-white/70">
                <span>Floor Occupancy</span>
                <span className="font-mono text-sm font-extrabold text-amber-300">{floorPct}%</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#b91c1c] via-[#dc2626] to-[#f97316] transition-all duration-500"
                  style={{ width: `${Math.min(100, floorPct)}%` }}
                />
              </div>
              <div className="mt-2.5 flex items-center justify-between text-xs text-white/75">
                <span>
                  Pickup ready <b className="font-mono text-white">{ready.length}</b>
                </span>
                <span>
                  In kitchen <b className="font-mono text-white">{pending.length}</b>
                </span>
              </div>
            </div>
          </div>
        }
      />
      {q.error && !d ? (
        <div className="card">
          <ErrorState message={q.error} onRetry={q.reload} />
        </div>
      ) : (
        <>
          <section aria-label="My figures" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              loading={loading}
              tone="red"
              icon={<Utensils className="h-5 w-5" />}
              label="My active orders"
              value={d?.mine.length ?? 0}
            />
            <StatCard
              loading={loading}
              tone="orange"
              icon={<CheckCircle2 className="h-5 w-5" />}
              label="Completed today"
              value={d?.completedToday.length ?? 0}
              sub={formatMoney(salesToday, r.currency)}
            />
            <StatCard
              loading={loading}
              icon={<LayoutGrid className="h-5 w-5" />}
              label="Available tables"
              value={d?.available ?? 0}
            />
            <StatCard
              loading={loading}
              tone="orange"
              icon={<LayoutGrid className="h-5 w-5" />}
              label="Occupied tables"
              value={d?.occupied ?? 0}
            />
            <StatCard
              loading={loading}
              tone="orange"
              icon={<ChefHat className="h-5 w-5" />}
              label="Ready to serve"
              value={ready.length}
            />
            <StatCard
              loading={loading}
              icon={<Clock className="h-5 w-5" />}
              label="Pending in kitchen"
              value={pending.length}
            />
            <StatCard
              loading={loading}
              tone="red"
              icon={<BellRing className="h-5 w-5" />}
              label="Bill requests"
              value={bills.length}
            />
            <StatCard
              loading={loading}
              icon={<Receipt className="h-5 w-5" />}
              label="My open balance"
              value={formatMoney(
                (d?.mine ?? []).reduce(
                  (s, o) => s + Number(o.total) - Number(o.amount_paid) + Number(o.amount_refunded),
                  0,
                ),
                r.currency,
              )}
            />
          </section>
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card
              title="Orders ready for pickup"
              bodyClassName="p-0"
              action={
                <Link
                  to="/waiter/kitchen"
                  className="-my-2 inline-flex min-h-[40px] items-center px-2 text-sm font-semibold text-brand-red hover:underline"
                >
                  Kitchen
                </Link>
              }
            >
              {!ready.length ? (
                <EmptyState title="Nothing waiting" message="Ready orders appear here instantly." />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {ready.map((o) => (
                    <li key={o.id}>
                      <Link
                        to={`/waiter/orders/${o.id}`}
                        className="flex min-h-[56px] items-center justify-between px-5 py-3 hover:bg-emerald-50"
                      >
                        <span>
                          <b>#{o.order_number}</b>{' '}
                          <span className="text-sm text-slate-500">
                            ready · {formatDuration(o.created_at)} since order
                          </span>
                        </span>
                        <span className="text-sm font-semibold text-emerald-700">Serve →</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card
              title="Recent activity"
              bodyClassName="p-0"
              action={
                <Link
                  to="/waiter/notifications"
                  className="-my-2 inline-flex min-h-[40px] items-center px-2 text-sm font-semibold text-brand-red hover:underline"
                >
                  All
                </Link>
              }
            >
              {!d?.notes.length ? (
                <EmptyState title="No activity yet" />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {d.notes.map((n) => (
                    <li key={n.id} className="px-5 py-3">
                      <p className={`text-sm ${n.read_at ? '' : 'font-semibold'}`}>{n.title}</p>
                      <p className="text-xs text-slate-500">{formatDateTime(n.created_at, r.timezone)}</p>
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
