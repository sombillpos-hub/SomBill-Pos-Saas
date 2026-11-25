import { useEffect, useState } from 'react';
import { CheckCircle2, CircleAlert, Wifi } from 'lucide-react';
import { Badge, Card, PageHeader } from '@sombill/shared-ui/ui/Feedback';
import { Button } from '@sombill/shared-ui/ui/Button';
import { useRealtimeHealth } from '@sombill/shared-hooks/useRealtime';
import { useQuery } from '@sombill/shared-hooks/useQuery';
import { supabase } from '@sombill/api-client/supabase';
import { formatDuration } from '@sombill/shared-utils/format';
import { useHq } from '../features/HqContext';
import { useSummary } from '../hooks/hq';

async function probe() {
  const t0 = performance.now();
  const { error } = await supabase.from('organizations').select('id').limit(1);
  return { ok: !error, ms: Math.round(performance.now() - t0), at: new Date() };
}

/** What can be measured from here: database round trip, realtime channel, browser connection, and how recently each branch took an order. */
export default function SystemPage() {
  const { branches, scopeIds } = useHq();
  const rt = useRealtimeHealth();
  const summary = useSummary('today');
  const db = useQuery(probe, []);
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    const t = setInterval(() => void Promise.all([db.reload(), summary.reload()]), 30000);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
      clearInterval(t);
    };
  }, [db, summary]);

  const slow = (db.data?.ms ?? 0) > 1500;
  const checks = [
    { name: 'Browser connection', ok: online, detail: online ? 'Online' : 'Offline: changes cannot be saved' },
    {
      name: 'Database',
      ok: db.data?.ok === true && !slow,
      detail: db.error ? db.error : db.data ? `${db.data.ms} ms round trip${slow ? ' (slow)' : ''}` : 'Checking…',
    },
    {
      name: 'Realtime updates',
      ok: rt === 'live',
      detail:
        rt === 'live' ? 'Live' : rt === 'connecting' ? 'Connecting…' : 'Offline: pages refresh on a timer instead',
    },
  ];
  const rows = summary.cur.filter((r) => scopeIds.includes(r.restaurant_id));

  return (
    <div>
      <PageHeader
        eyebrow="Security & Infra · Health"
        title="Cloud Telemetry"
        description="Connection health seen from this browser, and branch activity. Checks refresh every 30 seconds."
        actions={
          <Button
            variant="secondary"
            onClick={() => {
              void db.reload();
              void summary.reload();
            }}
          >
            Check now
          </Button>
        }
      />
      <div className="mb-4 grid gap-4 md:grid-cols-3">
        {checks.map((c) => (
          <div key={c.name} className="sa-stat" data-ok={c.ok}>
            <p>{c.name}</p>
            <strong className="flex items-center gap-2">
              {c.ok ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-500" aria-hidden />
              ) : (
                <CircleAlert className="h-5 w-5 text-amber-500" aria-hidden />
              )}
              {c.ok ? 'Healthy' : 'Attention'}
            </strong>
            <small>{c.detail}</small>
          </div>
        ))}
      </div>
      <Card title="Branch activity" bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="sa-table min-w-full">
            <thead>
              <tr>
                <th scope="col">Branch</th>
                <th scope="col">Last order</th>
                <th scope="col" className="text-right">
                  Open orders
                </th>
                <th scope="col" className="text-right">
                  Registers open
                </th>
                <th scope="col">Signal</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const idle = r.last_order_at ? Date.now() - new Date(r.last_order_at).getTime() : Infinity;
                const warn = r.open_cashier_shifts > 0 && idle > 3 * 3600 * 1000;
                return (
                  <tr key={r.restaurant_id}>
                    <td className="font-semibold">{branches.find((b) => b.id === r.restaurant_id)?.name ?? r.name}</td>
                    <td>{r.last_order_at ? `${formatDuration(r.last_order_at)} ago` : 'No orders in 7 days'}</td>
                    <td className="text-right tabular-nums">{r.open_orders}</td>
                    <td className="text-right tabular-nums">{r.open_cashier_shifts}</td>
                    <td>
                      {warn ? (
                        <Badge tone="yellow">Register open, no orders for 3 h+</Badge>
                      ) : (
                        <Badge tone="green">
                          <Wifi className="mr-1 h-3 w-3" aria-hidden />
                          Normal
                        </Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="mt-3 text-xs text-slate-500">
        Uptime history, server load and per-terminal sync are not available here: SomBill runs on the hosted database
        and has no per-device agents.
      </p>
    </div>
  );
}
