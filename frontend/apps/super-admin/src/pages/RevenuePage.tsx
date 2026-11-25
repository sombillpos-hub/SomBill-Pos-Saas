import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { Card, ErrorState, PageHeader, TableSkeleton } from '@sombill/shared-ui/ui/Feedback';
import { Button } from '@sombill/shared-ui/ui/Button';
import { downloadCsv } from '@sombill/shared-utils/csv';
import { formatMoney, formatNumber } from '@sombill/shared-utils/format';
import { useHq } from '../features/HqContext';
import { useSeries, useSummary } from '../hooks/hq';
import { RangeTabs } from '../components/RangeTabs';
import { MultiBranchChart } from '../components/MultiBranchChart';
import { convert, formatConverted, secondary, sumConverted, trendPct } from '../features/lib/money';
import { branchColor } from '../features/lib/colors';
import type { RangeKey } from '../features/types';

export default function RevenuePage() {
  const { branches, scopeIds, fx } = useHq();
  const [key, setKey] = useState<RangeKey>('mtd');
  const sum = useSummary(key, true);
  const series = useSeries(key);
  const cur = sum.cur;
  const total = useMemo(
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
  const net = useMemo(
    () =>
      sumConverted(
        cur,
        (r) => r.net,
        (r) => r.currency,
        fx,
      ),
    [cur, fx],
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
  const sec = secondary(total.total, fx);
  const trend = trendPct(total.total, prev.total);

  // Totals per time bucket, in the reporting currency
  const buckets = useMemo(() => {
    const m = new Map<string, { gross: number; orders: number }>();
    for (const p of series.rows) {
      const cc = branches.find((b) => b.id === p.restaurant_id)?.currency ?? fx.reporting;
      const v = convert(p.gross, cc, fx.reporting, fx);
      const e = m.get(p.bucket) ?? { gross: 0, orders: 0 };
      e.gross += v ?? 0;
      e.orders += p.orders;
      m.set(p.bucket, e);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [series.rows, branches, fx]);

  const exportCsv = () =>
    downloadCsv(
      `group-revenue-${key}`,
      [
        'Branch',
        'Currency',
        'Orders',
        'Gross',
        'Net of tax',
        'Tax',
        'Discounts',
        'Cancelled orders',
        'Collected',
        'Refunded',
        'Guests',
      ],
      cur.map((r) => [
        r.name,
        r.currency,
        r.orders_count,
        r.gross,
        r.net,
        r.tax,
        r.discounts,
        r.cancelled_count,
        r.collected,
        r.refunded,
        r.guests,
      ]),
    );

  return (
    <div>
      <PageHeader
        eyebrow="Consolidated Finance · Sales"
        title="Global Revenues"
        description="Consolidated sales of the selected branches. Cancelled orders are excluded; amounts are in each branch's currency, with a group total in the reporting currency."
        actions={
          <>
            <RangeTabs value={key} onChange={setKey} />
            <Button
              variant="secondary"
              icon={<Download className="h-4 w-4" />}
              onClick={exportCsv}
              disabled={!cur.length}
            >
              Export CSV
            </Button>
          </>
        }
      />
      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="sa-stat">
          <p>Gross sales</p>
          <strong>{formatConverted(total, fx)}</strong>
          {sec && <small>{sec}</small>}
        </div>
        <div className="sa-stat">
          <p>vs previous period</p>
          <strong>{trend === null ? '—' : `${trend >= 0 ? '+' : ''}${trend.toFixed(1)}%`}</strong>
          <small>{sum.range.label}</small>
        </div>
        <div className="sa-stat">
          <p>Net of tax</p>
          <strong>{formatConverted(net, fx)}</strong>
        </div>
        <div className="sa-stat">
          <p>Tax collected</p>
          <strong>{formatConverted(tax, fx)}</strong>
        </div>
      </div>
      <Card title="By branch" bodyClassName="p-0" className="mb-4">
        {sum.error ? (
          <ErrorState message={sum.error} onRetry={sum.reload} />
        ) : sum.loading ? (
          <TableSkeleton cols={7} />
        ) : (
          <div className="overflow-x-auto">
            <table className="sa-table min-w-full">
              <thead>
                <tr>
                  <th scope="col">Branch</th>
                  <th scope="col" className="text-right">
                    Orders
                  </th>
                  <th scope="col" className="text-right">
                    Gross
                  </th>
                  <th scope="col" className="text-right">
                    Net
                  </th>
                  <th scope="col" className="text-right">
                    Tax
                  </th>
                  <th scope="col" className="text-right">
                    Discounts
                  </th>
                  <th scope="col" className="text-right">
                    Collected
                  </th>
                  <th scope="col" className="text-right">
                    Refunded
                  </th>
                </tr>
              </thead>
              <tbody>
                {cur.map((r) => (
                  <tr key={r.restaurant_id}>
                    <td>
                      <span className="flex items-center gap-2 font-semibold">
                        <i
                          className="sa-dot"
                          style={{ background: branchColor(branches.findIndex((b) => b.id === r.restaurant_id)) }}
                          aria-hidden
                        />
                        {r.name}
                      </span>
                    </td>
                    <td className="text-right tabular-nums">{formatNumber(r.orders_count)}</td>
                    <td className="text-right tabular-nums">{formatMoney(r.gross, r.currency)}</td>
                    <td className="text-right tabular-nums">{formatMoney(r.net, r.currency)}</td>
                    <td className="text-right tabular-nums">{formatMoney(r.tax, r.currency)}</td>
                    <td className="text-right tabular-nums">{formatMoney(r.discounts, r.currency)}</td>
                    <td className="text-right tabular-nums">{formatMoney(r.collected, r.currency)}</td>
                    <td className="text-right tabular-nums">{formatMoney(r.refunded, r.currency)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">Group total ({fx.reporting})</th>
                  <td className="text-right tabular-nums">
                    {formatNumber(cur.reduce((s, r) => s + r.orders_count, 0))}
                  </td>
                  <td className="text-right tabular-nums">{formatConverted(total, fx)}</td>
                  <td className="text-right tabular-nums">{formatConverted(net, fx)}</td>
                  <td className="text-right tabular-nums">{formatConverted(tax, fx)}</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
      <Card title="Trend by branch" className="mb-4">
        <MultiBranchChart
          rows={series.rows}
          branches={branches.filter((b) => scopeIds.includes(b.id))}
          range={series.range}
          fx={fx}
        />
      </Card>
      <Card
        title={series.range.bucket === 'hour' ? 'By hour' : series.range.bucket === 'day' ? 'By day' : 'By month'}
        bodyClassName="p-0"
      >
        {buckets.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">No sales in this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="sa-table min-w-full">
              <thead>
                <tr>
                  <th scope="col">
                    {series.range.bucket === 'hour' ? 'Hour' : series.range.bucket === 'day' ? 'Day' : 'Month'}
                  </th>
                  <th scope="col" className="text-right">
                    Orders
                  </th>
                  <th scope="col" className="text-right">
                    Gross ({fx.reporting})
                  </th>
                </tr>
              </thead>
              <tbody>
                {buckets.map(([k, v]) => (
                  <tr key={k}>
                    <td>{k}</td>
                    <td className="text-right tabular-nums">{formatNumber(v.orders)}</td>
                    <td className="text-right tabular-nums">{formatMoney(v.gross, fx.reporting)}</td>
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
