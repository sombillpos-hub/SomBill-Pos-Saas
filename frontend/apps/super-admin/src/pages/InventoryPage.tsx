import { AlertTriangle } from 'lucide-react';
import { Badge, Card, ErrorState, PageHeader, TableSkeleton } from '@sombill/shared-ui/ui/Feedback';
import { Button } from '@sombill/shared-ui/ui/Button';
import { useQuery } from '@sombill/shared-hooks/useQuery';
import { formatMoney, formatNumber, formatQty } from '@sombill/shared-utils/format';
import { inventorySummary, lowStock } from '../services/hq';
import { useHq } from '../features/HqContext';
import { useEnterBranch } from '../components/useEnterBranch';
import { formatConverted, sumConverted } from '../features/lib/money';

export default function InventoryPage() {
  const { org, branches, scopeIds, fx } = useHq();
  const enter = useEnterBranch();
  const q = useQuery(async () => ({ sum: await inventorySummary(org.id), low: await lowStock(org.id, 200) }), [org.id]);
  const name = (id: string) => branches.find((b) => b.id === id)?.name ?? '—';
  const cur = (id: string) => branches.find((b) => b.id === id)?.currency ?? fx.reporting;
  const sum = (q.data?.sum ?? []).filter((r) => scopeIds.includes(r.restaurant_id));
  const low = (q.data?.low ?? []).filter((r) => scopeIds.includes(r.restaurant_id));
  const value = sumConverted(
    sum,
    (r) => r.stock_value,
    (r) => cur(r.restaurant_id),
    fx,
  );
  const poValue = sumConverted(
    sum,
    (r) => r.open_po_value,
    (r) => cur(r.restaurant_id),
    fx,
  );

  return (
    <div>
      <PageHeader
        eyebrow="Central Operations · Stock"
        title="Master Supply Chain"
        description="Stock position and open purchase orders across branches. Stock is managed inside each branch; open a branch to receive or adjust."
      />
      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="sa-stat">
          <p>Stock value</p>
          <strong>{formatConverted(value, fx)}</strong>
          <small>quantity × unit cost</small>
        </div>
        <div className="sa-stat">
          <p>Low stock items</p>
          <strong>{formatNumber(sum.reduce((s, r) => s + r.low_stock, 0))}</strong>
          <small>at or below minimum</small>
        </div>
        <div className="sa-stat">
          <p>Out of stock</p>
          <strong>{formatNumber(sum.reduce((s, r) => s + r.out_of_stock, 0))}</strong>
        </div>
        <div className="sa-stat">
          <p>Open purchase orders</p>
          <strong>{formatNumber(sum.reduce((s, r) => s + r.open_purchase_orders, 0))}</strong>
          <small>{formatConverted(poValue, fx)}</small>
        </div>
      </div>
      <Card title="By branch" bodyClassName="p-0" className="mb-4">
        {q.error ? (
          <ErrorState message={q.error} onRetry={q.reload} />
        ) : q.loading ? (
          <TableSkeleton cols={6} />
        ) : (
          <div className="overflow-x-auto">
            <table className="sa-table min-w-full">
              <thead>
                <tr>
                  <th scope="col">Branch</th>
                  <th scope="col" className="text-right">
                    Items
                  </th>
                  <th scope="col" className="text-right">
                    Low
                  </th>
                  <th scope="col" className="text-right">
                    Out
                  </th>
                  <th scope="col" className="text-right">
                    Stock value
                  </th>
                  <th scope="col" className="text-right">
                    Open POs
                  </th>
                  <th scope="col" className="text-right">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {sum.map((r) => (
                  <tr key={r.restaurant_id}>
                    <td className="font-semibold">{name(r.restaurant_id)}</td>
                    <td className="text-right tabular-nums">{formatNumber(r.items)}</td>
                    <td className="text-right tabular-nums">
                      {r.low_stock > 0 ? <Badge tone="yellow">{r.low_stock}</Badge> : 0}
                    </td>
                    <td className="text-right tabular-nums">
                      {r.out_of_stock > 0 ? <Badge tone="red">{r.out_of_stock}</Badge> : 0}
                    </td>
                    <td className="text-right tabular-nums">{formatMoney(r.stock_value, cur(r.restaurant_id))}</td>
                    <td className="text-right tabular-nums">
                      {r.open_purchase_orders} · {formatMoney(r.open_po_value, cur(r.restaurant_id))}
                    </td>
                    <td className="text-right">
                      <Button size="sm" variant="secondary" onClick={() => enter(r.restaurant_id, '/inventory')}>
                        Open inventory
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Card title="Needs restocking" bodyClassName="p-0">
        {low.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">Nothing is below its minimum level.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="sa-table min-w-full">
              <thead>
                <tr>
                  <th scope="col">Item</th>
                  <th scope="col">Branch</th>
                  <th scope="col" className="text-right">
                    On hand
                  </th>
                  <th scope="col" className="text-right">
                    Minimum
                  </th>
                </tr>
              </thead>
              <tbody>
                {low.map((r) => (
                  <tr key={r.item_id}>
                    <td className="font-semibold">
                      <AlertTriangle className="mr-1 inline h-4 w-4 text-amber-600" aria-hidden />
                      {r.name}
                    </td>
                    <td>{name(r.restaurant_id)}</td>
                    <td className="text-right tabular-nums">
                      {formatQty(r.quantity)} {r.unit}
                    </td>
                    <td className="text-right tabular-nums">
                      {formatQty(r.min_stock)} {r.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
