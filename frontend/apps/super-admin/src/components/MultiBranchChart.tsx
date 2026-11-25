import { useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { EmptyState } from '@sombill/shared-ui/ui/Feedback';
import { formatMoney } from '@sombill/shared-utils/format';
import { convert, type Fx } from '../features/lib/money';
import { bucketLabels, shortBucket } from '../features/lib/range';
import { branchColor } from '../features/lib/colors';
import type { Branch, Range, SeriesPoint } from '../features/types';

interface Props {
  rows: SeriesPoint[];
  branches: Branch[];
  range: Range;
  fx: Fx;
}

/** Revenue per bucket and branch in the reporting currency. Branches whose currency has no rate are left out and named. */
export function MultiBranchChart({ rows, branches, range, fx }: Props) {
  const [kind, setKind] = useState<'area' | 'bar'>('area');
  const plotted = useMemo(
    () => branches.filter((b) => convert(1, b.currency, fx.reporting, fx) !== null),
    [branches, fx],
  );
  const skipped = branches.filter((b) => !plotted.includes(b));
  const data = useMemo(() => {
    const cur = new Map(branches.map((b) => [b.id, b.currency]));
    return bucketLabels(range).map((label) => {
      const row: Record<string, string | number> = { label, short: shortBucket(label, range.bucket) };
      for (const b of plotted) row[b.id] = 0;
      for (const p of rows) {
        if (p.bucket !== label || !plotted.some((b) => b.id === p.restaurant_id)) continue;
        row[p.restaurant_id] = Number(
          (
            (row[p.restaurant_id] as number) +
            (convert(p.gross, cur.get(p.restaurant_id) ?? fx.reporting, fx.reporting, fx) ?? 0)
          ).toFixed(2),
        );
      }
      return row;
    });
  }, [rows, plotted, branches, range, fx]);
  const empty = !rows.length;
  const axis = { stroke: 'var(--sa-axis)', fontSize: 11 };
  const tip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: { dataKey: string; value: number }[];
    label?: string;
  }) => {
    if (!active || !payload?.length) return null;
    const total = payload.reduce((s, p) => s + p.value, 0);
    return (
      <div className="sa-tooltip">
        <p className="sa-tooltip-title">{label}</p>
        {payload.map((p) => {
          const b = plotted.find((x) => x.id === p.dataKey);
          return b ? (
            <p key={b.id} className="sa-tooltip-row">
              <i style={{ background: branchColor(branches.indexOf(b)) }} aria-hidden />
              <span>{b.name}</span>
              <b>{formatMoney(p.value, fx.reporting)}</b>
            </p>
          ) : null;
        })}
        <p className="sa-tooltip-total">
          <span>Total</span>
          <b>{formatMoney(total, fx.reporting)}</b>
        </p>
      </div>
    );
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <ul className="sa-legend" aria-label="Branches">
          {plotted.map((b) => (
            <li key={b.id}>
              <i style={{ background: branchColor(branches.indexOf(b)) }} aria-hidden />
              {b.name}
            </li>
          ))}
        </ul>
        <div className="sa-seg" role="group" aria-label="Chart type">
          <button type="button" aria-pressed={kind === 'area'} onClick={() => setKind('area')}>
            Area
          </button>
          <button type="button" aria-pressed={kind === 'bar'} onClick={() => setKind('bar')}>
            Bars
          </button>
        </div>
      </div>
      {empty ? (
        <EmptyState title="No sales in this period" message="Revenue appears here as soon as branches take orders." />
      ) : (
        <div style={{ height: 300 }} role="img" aria-label={`Revenue by branch, ${range.label}`}>
          <ResponsiveContainer width="100%" height="100%">
            {kind === 'area' ? (
              <AreaChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
                <defs>
                  {plotted.map((b) => (
                    <linearGradient key={b.id} id={`sa-g-${b.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={branchColor(branches.indexOf(b))} stopOpacity={0.45} />
                      <stop offset="100%" stopColor={branchColor(branches.indexOf(b))} stopOpacity={0.02} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid stroke="var(--sa-grid)" vertical={false} />
                <XAxis dataKey="short" tick={axis} tickLine={false} axisLine={false} />
                <YAxis
                  tick={axis}
                  tickLine={false}
                  axisLine={false}
                  width={52}
                  tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : String(v))}
                />
                <Tooltip content={tip as never} />
                {plotted.map((b) => (
                  <Area
                    key={b.id}
                    type="monotone"
                    dataKey={b.id}
                    stroke={branchColor(branches.indexOf(b))}
                    strokeWidth={2}
                    fill={`url(#sa-g-${b.id})`}
                  />
                ))}
              </AreaChart>
            ) : (
              <BarChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
                <CartesianGrid stroke="var(--sa-grid)" vertical={false} />
                <XAxis dataKey="short" tick={axis} tickLine={false} axisLine={false} />
                <YAxis
                  tick={axis}
                  tickLine={false}
                  axisLine={false}
                  width={52}
                  tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : String(v))}
                />
                <Tooltip content={tip as never} cursor={{ fill: 'rgba(148,163,184,.12)' }} />
                {plotted.map((b) => (
                  <Bar key={b.id} dataKey={b.id} fill={branchColor(branches.indexOf(b))} radius={[4, 4, 0, 0]} />
                ))}
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
      {skipped.length > 0 && (
        <p className="mt-2 text-xs text-slate-500">
          Not plotted (no exchange rate for their currency):{' '}
          {skipped.map((b) => `${b.name} (${b.currency})`).join(', ')}. Set rates in Platform Controls.
        </p>
      )}
    </div>
  );
}
