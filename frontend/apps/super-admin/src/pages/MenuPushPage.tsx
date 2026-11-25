import { useMemo, useState } from 'react';
import { Card, ErrorState, PageHeader, TableSkeleton } from '@sombill/shared-ui/ui/Feedback';
import { Badge } from '@sombill/shared-ui/ui/Feedback';
import { useQuery } from '@sombill/shared-hooks/useQuery';
import { formatDateTime, formatMoney } from '@sombill/shared-utils/format';
import { menuMatrix, nameMap, pushHistory } from '../services/hq';
import { useHq } from '../features/HqContext';
import { MenuPushForm } from '../components/MenuPushForm';

export default function MenuPushPage() {
  const { org, branches, scopeIds } = useHq();
  const matrix = useQuery(() => menuMatrix(org.id), [org.id]);
  const history = useQuery(async () => {
    const rows = await pushHistory(
      branches.map((b) => b.id),
      40,
    );
    return { rows, names: await nameMap(rows.map((r) => r.actor_id ?? '')) };
  }, [org.id, branches.length]);
  const [pick, setPick] = useState('');
  const [q, setQ] = useState('');
  const shown = branches.filter((b) => scopeIds.includes(b.id));

  const dishes = useMemo(() => {
    const m = new Map<
      string,
      { name: string; category: string | null; by: Map<string, { price: number; on: boolean }> }
    >();
    for (const r of matrix.data ?? []) {
      const k = r.name.trim().toLowerCase();
      const e = m.get(k) ?? { name: r.name.trim(), category: r.category, by: new Map() };
      e.by.set(r.restaurant_id, { price: r.price, on: r.is_available });
      m.set(k, e);
    }
    return [...m.values()]
      .filter((d) => d.name.toLowerCase().includes(q.trim().toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [matrix.data, q]);

  return (
    <div>
      <PageHeader
        eyebrow="Central Operations · Catalog Sync"
        title="Central Menu Push"
        description="Set one price (or availability) for a dish across several branches at once. Dishes are matched by name; each change is written to the branch audit log."
      />
      <Card title="Push a change" className="mb-4">
        <MenuPushForm
          matrix={matrix.data ?? []}
          initialName={pick}
          onDone={() => void Promise.all([matrix.reload(), history.reload()])}
        />
      </Card>
      <Card
        title="Master dish list"
        className="mb-4"
        bodyClassName="p-0"
        action={
          <input
            className="input h-9 w-56"
            type="search"
            placeholder="Filter dishes"
            aria-label="Filter dishes"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        }
      >
        {matrix.error ? (
          <ErrorState message={matrix.error} onRetry={matrix.reload} />
        ) : matrix.loading ? (
          <TableSkeleton cols={5} />
        ) : (
          <div className="overflow-x-auto">
            <table className="sa-table min-w-full">
              <thead>
                <tr>
                  <th scope="col">Dish</th>
                  {shown.map((b) => (
                    <th scope="col" key={b.id} className="text-right">
                      {b.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dishes.map((d) => {
                  const prices = shown.map((b) => d.by.get(b.id)?.price).filter((p): p is number => p !== undefined);
                  const differs = new Set(prices).size > 1;
                  return (
                    <tr
                      key={d.name}
                      className="cursor-pointer"
                      onClick={() => setPick(d.name)}
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && setPick(d.name)}
                    >
                      <td>
                        <p className="font-semibold">{d.name}</p>
                        <p className="text-xs text-slate-500">
                          {d.category ?? 'No category'}
                          {differs ? ' · ' : ''}
                          {differs && <Badge tone="yellow">Prices differ</Badge>}
                        </p>
                      </td>
                      {shown.map((b) => {
                        const e = d.by.get(b.id);
                        return (
                          <td key={b.id} className="text-right tabular-nums">
                            {e ? (
                              <span className={e.on ? '' : 'text-slate-400 line-through'}>
                                {formatMoney(e.price, b.currency)}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {dishes.length === 0 && <p className="p-5 text-sm text-slate-500">No dishes match.</p>}
          </div>
        )}
      </Card>
      <Card title="Recent pushes" bodyClassName="p-0">
        {(history.data?.rows ?? []).length === 0 ? (
          <p className="p-5 text-sm text-slate-500">No pushes yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="sa-table min-w-full">
              <thead>
                <tr>
                  <th scope="col">Time</th>
                  <th scope="col">Branch</th>
                  <th scope="col">Dish</th>
                  <th scope="col">Change</th>
                  <th scope="col">By</th>
                </tr>
              </thead>
              <tbody>
                {history.data!.rows.map((r) => {
                  const b = branches.find((x) => x.id === r.restaurant_id);
                  const n = r.new_data ?? {};
                  const o = r.old_data ?? {};
                  return (
                    <tr key={r.id}>
                      <td className="whitespace-nowrap">
                        {formatDateTime(r.created_at, b?.timezone ?? 'Africa/Mogadishu')}
                      </td>
                      <td>{b?.name}</td>
                      <td>{String(n.name ?? '')}</td>
                      <td>
                        {n.price !== undefined && n.price !== null ? `${o.price ?? 'new'} → ${String(n.price)}` : ''}
                        {n.is_available !== undefined && n.is_available !== null
                          ? ` ${n.is_available ? 'available' : 'unavailable'}`
                          : ''}
                      </td>
                      <td>{history.data!.names.get(r.actor_id ?? '') ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
