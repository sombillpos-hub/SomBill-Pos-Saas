import { useEffect } from 'react';
import { Monitor, UserRound } from 'lucide-react';
import { Badge, Card, EmptyState, ErrorState, PageHeader, Skeleton } from '@sombill/shared-ui/ui/Feedback';
import { Button } from '@sombill/shared-ui/ui/Button';
import { useQuery } from '@sombill/shared-hooks/useQuery';
import { formatDuration, formatMoney } from '@sombill/shared-utils/format';
import { openRegisters, staffOnDuty } from '../services/hq';
import { useHq } from '../features/HqContext';
import { useEnterBranch } from '../components/useEnterBranch';
import { branchColor } from '../features/lib/colors';

const ROLE: Record<string, string> = { manager: 'Manager', cashier: 'Cashier', waiter: 'Waiter', kitchen: 'Kitchen' };

/** What is running right now: open cash drawers and staff clocked in, per branch. Refreshes every 30 seconds. */
export default function TerminalsPage() {
  const { branches, scopeBranches, scopeIds } = useHq();
  const enter = useEnterBranch();
  const q = useQuery(async () => {
    const ids = branches.map((b) => b.id);
    const [regs, duty] = await Promise.all([openRegisters(ids), staffOnDuty(ids)]);
    return { regs, duty };
  }, [branches.length]);
  useEffect(() => {
    const t = setInterval(() => void q.reload(), 30000);
    return () => clearInterval(t);
  }, [q]);
  const regs = (q.data?.regs ?? []).filter((r) => scopeIds.includes(r.restaurant_id));
  const duty = (q.data?.duty ?? []).filter((r) => scopeIds.includes(r.restaurant_id));

  return (
    <div>
      <PageHeader
        eyebrow="Global Command · Terminals"
        title="Active POS Fleet"
        description="Open cash registers and staff on shift, per branch. A register counts as live while its shift is open."
        actions={
          <Button variant="secondary" onClick={() => q.reload()}>
            Refresh
          </Button>
        }
      />
      {q.error ? (
        <ErrorState message={q.error} onRetry={q.reload} />
      ) : q.loading ? (
        <Skeleton className="h-40 w-full" />
      ) : scopeBranches.length === 0 ? (
        <EmptyState title="No branches" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {scopeBranches.map((b) => {
            const r = regs.filter((x) => x.restaurant_id === b.id);
            const d = duty.filter((x) => x.restaurant_id === b.id);
            return (
              <Card
                key={b.id}
                title={b.name}
                action={
                  <Button size="sm" variant="secondary" onClick={() => enter(b.id, '/dashboard')}>
                    Open branch
                  </Button>
                }
              >
                <div className="space-y-4">
                  <section aria-label={`${b.name} registers`}>
                    <h3 className="sa-h3">
                      <Monitor className="h-4 w-4" aria-hidden /> Cash registers{' '}
                      <Badge tone={r.length ? 'green' : 'gray'}>{r.length} open</Badge>
                    </h3>
                    {r.length === 0 ? (
                      <p className="text-sm text-slate-500">
                        No open register. Cashiers open a shift to start taking payments.
                      </p>
                    ) : (
                      <ul className="sa-list">
                        {r.map((x) => (
                          <li key={x.id}>
                            <span className="sa-live-dot" aria-hidden />
                            <span className="font-semibold">{x.cashier_name}</span>
                            <span className="text-slate-500">
                              open {formatDuration(x.opened_at)} · float {formatMoney(x.opening_cash, b.currency)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                  <section aria-label={`${b.name} staff on duty`}>
                    <h3 className="sa-h3">
                      <UserRound className="h-4 w-4" aria-hidden /> Staff on duty{' '}
                      <Badge tone={d.length ? 'green' : 'gray'}>{d.length}</Badge>
                    </h3>
                    {d.length === 0 ? (
                      <p className="text-sm text-slate-500">Nobody is clocked in.</p>
                    ) : (
                      <ul className="sa-list">
                        {d.map((x) => (
                          <li key={x.id}>
                            <i
                              className="sa-dot"
                              style={{ background: branchColor(branches.findIndex((y) => y.id === b.id)) }}
                              aria-hidden
                            />
                            <span className="font-semibold">{x.name}</span>
                            <span className="text-slate-500">
                              {x.role ? ROLE[x.role] : 'Staff'} · since {formatDuration(x.started_at)} ago
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
