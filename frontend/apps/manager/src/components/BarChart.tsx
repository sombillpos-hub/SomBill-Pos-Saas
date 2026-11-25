import { useId, useMemo, useState } from 'react';

export interface ChartSeries {
  name: string;
  color: string;
}
export interface ChartDatum {
  label: string;
  values: number[];
}

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const m = v / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
}

/** Grouped vertical bar chart rendered as responsive SVG. */
export function BarChart({
  data,
  series,
  format = (n) => String(n),
  height = 240,
  emptyText = 'No data for this period',
}: {
  data: ChartDatum[];
  series: ChartSeries[];
  format?: (n: number) => string;
  height?: number;
  emptyText?: string;
}) {
  const gradId = useId().replace(/:/g, '');
  const [hover, setHover] = useState<number | null>(null);
  const W = 720;
  const H = height;
  const pad = { l: 64, r: 12, t: 12, b: 36 };
  const max = useMemo(() => niceMax(Math.max(0, ...data.flatMap((d) => d.values))), [data]);
  const hasData = data.some((d) => d.values.some((v) => v !== 0));
  if (!data.length || !hasData) {
    return (
      <div className="flex items-center justify-center text-sm text-slate-400" style={{ height }}>
        {emptyText}
      </div>
    );
  }
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const band = iw / data.length;
  const gap = Math.min(band * 0.25, 16);
  const bw = Math.max(2, (band - gap) / series.length);
  const labelEvery = Math.ceil(data.length / 12);
  const y = (v: number) => pad.t + ih - (Math.max(v, 0) / max) * ih;

  const hovered = hover !== null ? data[hover] : null;
  const tipLeft = hover !== null ? ((pad.l + hover * band + band / 2) / W) * 100 : 0;

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Bar chart: ${series.map((s) => s.name).join(', ')}`}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          {series.map((s, i) => (
            <linearGradient key={s.name} id={`${gradId}-g${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="1" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0.35" />
            </linearGradient>
          ))}
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line
              className="sb-chart-grid"
              x1={pad.l}
              x2={W - pad.r}
              y1={y(max * f)}
              y2={y(max * f)}
              strokeDasharray={f === 0 ? '' : '3 3'}
            />
            <text className="sb-chart-axis" x={pad.l - 8} y={y(max * f) + 4} textAnchor="end" fontSize="11">
              {format(max * f)}
            </text>
          </g>
        ))}
        {data.map((d, i) => (
          <g key={d.label + i} onMouseEnter={() => setHover(i)}>
            {/* subtle hover column highlight + full-height hit area */}
            <rect
              x={pad.l + i * band + 2}
              y={pad.t}
              width={Math.max(0, band - 4)}
              height={ih}
              rx={8}
              fill={hover === i ? 'rgba(249, 115, 22, 0.08)' : 'transparent'}
            />
            {d.values.map((v, s) => (
              <rect
                key={s}
                className="sb-chart-bar"
                data-dim={hover !== null && hover !== i}
                x={pad.l + i * band + gap / 2 + s * bw}
                y={y(v)}
                width={Math.max(2, bw - 2)}
                height={Math.max(0, pad.t + ih - y(v))}
                rx={6}
                fill={`url(#${gradId}-g${s})`}
              >
                <title>{`${d.label} · ${series[s]?.name}: ${format(v)}`}</title>
              </rect>
            ))}
            {i % labelEvery === 0 && (
              <text
                className="sb-chart-axis"
                x={pad.l + i * band + band / 2}
                y={H - 12}
                textAnchor="middle"
                fontSize="11"
              >
                {d.label}
              </text>
            )}
          </g>
        ))}
      </svg>
      {hovered && (
        <div
          className="sb-chart-tooltip pointer-events-none absolute top-2 z-10 min-w-[9rem] -translate-x-1/2"
          style={{ left: `${Math.min(Math.max(tipLeft, 14), 86)}%` }}
          role="status"
        >
          <p className="sb-chart-tooltip-label">{hovered.label}</p>
          {series.map((s, i) => (
            <p key={s.name} className="mt-1 flex items-center justify-between gap-4 text-sm">
              <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: 'rgba(255,255,255,.7)' }}>
                <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                {s.name}
              </span>
              <span className="sb-chart-tooltip-value">{format(hovered.values[i] ?? 0)}</span>
            </p>
          ))}
        </div>
      )}
      {series.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
          {series.map((s) => (
            <span
              key={s.name}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-slate-50 px-2.5 py-1 font-medium"
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
              {s.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Horizontal share bars — used for payment methods, categories, etc. */
export function ShareBars({
  rows,
  format,
}: {
  rows: Array<{ label: string; value: number; sub?: string }>;
  format: (n: number) => string;
}) {
  const total = rows.reduce((s, r) => s + Math.max(r.value, 0), 0);
  if (!rows.length || total <= 0)
    return <p className="py-8 text-center text-sm text-slate-400">No data for this period</p>;
  return (
    <ul className="space-y-3.5">
      {rows.map((r) => {
        const pct = total > 0 ? (Math.max(r.value, 0) / total) * 100 : 0;
        return (
          <li key={r.label} className="group rounded-xl p-1.5 transition-colors hover:bg-slate-50">
            <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
              <span className="truncate font-semibold text-brand-navy">
                {r.label}
                {r.sub && <span className="ml-1.5 text-xs font-normal text-slate-400">{r.sub}</span>}
              </span>
              <span className="shrink-0 font-mono text-xs font-bold tabular-nums text-slate-700">
                {format(r.value)} <span className="font-normal text-slate-400">({pct.toFixed(0)}%)</span>
              </span>
            </div>
            <div data-sb="share-track" className="h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div
                data-sb="share-fill"
                className="h-2.5 rounded-full bg-gradient-to-r from-brand-red via-brand-orange to-brand-amber transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
