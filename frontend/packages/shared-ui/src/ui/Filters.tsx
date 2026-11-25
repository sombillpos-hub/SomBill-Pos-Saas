import { useEffect, useState, type ReactNode } from 'react';
import { Search } from 'lucide-react';
import { cn } from '@sombill/shared-utils/cn';
import { presetRange, type DateRange, type RangePreset } from '@sombill/shared-utils/dates';

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  useEffect(() => {
    const t = setTimeout(() => {
      if (local !== value) onChange(local);
    }, 300);
    return () => clearTimeout(t);
  }, [local, value, onChange]);
  return (
    <div className={cn('relative min-w-0', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        className="input pl-9"
        placeholder={placeholder}
        value={local}
        aria-label={placeholder}
        onChange={(e) => setLocal(e.target.value)}
        maxLength={100}
      />
    </div>
  );
}

const PRESETS: Array<[Exclude<RangePreset, 'custom'>, string]> = [
  ['today', 'Today'],
  ['yesterday', 'Yesterday'],
  ['last7', 'Last 7 days'],
  ['thisWeek', 'This week'],
  ['thisMonth', 'This month'],
  ['last30', 'Last 30 days'],
];

export function DateRangeFilter({
  value,
  onChange,
  timeZone,
  maxDays = 366,
}: {
  value: DateRange;
  onChange: (r: DateRange) => void;
  timeZone: string;
  maxDays?: number;
}) {
  const active =
    PRESETS.find(([p]) => {
      const r = presetRange(p, timeZone);
      return r.from === value.from && r.to === value.to;
    })?.[0] ?? 'custom';
  const setCustom = (patch: Partial<DateRange>) => {
    const next = { ...value, ...patch };
    if (next.from > next.to) return;
    const span = (Date.parse(next.to) - Date.parse(next.from)) / 86400000;
    if (span > maxDays) return;
    onChange(next);
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        className="input w-auto"
        aria-label="Date range"
        value={active}
        onChange={(e) => {
          const v = e.target.value as RangePreset;
          if (v !== 'custom') onChange(presetRange(v, timeZone));
        }}
      >
        {PRESETS.map(([k, l]) => (
          <option key={k} value={k}>
            {l}
          </option>
        ))}
        <option value="custom">Custom range</option>
      </select>
      <input
        type="date"
        className="input w-auto"
        aria-label="From date"
        value={value.from}
        max={value.to}
        onChange={(e) => e.target.value && setCustom({ from: e.target.value })}
      />
      <span className="text-slate-400">–</span>
      <input
        type="date"
        className="input w-auto"
        aria-label="To date"
        value={value.to}
        min={value.from}
        onChange={(e) => e.target.value && setCustom({ to: e.target.value })}
      />
    </div>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: Array<{ id: T; label: string; count?: number; icon?: ReactNode }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div role="tablist" className="no-print flex gap-1 overflow-x-auto border-b border-slate-200">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          type="button"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            '-mb-px inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors',
            value === t.id
              ? 'border-brand-red text-brand-red'
              : 'border-transparent text-slate-500 hover:text-brand-navy',
          )}
        >
          {t.icon}
          {t.label}
          {t.count !== undefined && (
            <span className={cn('rounded-full px-1.5 text-xs', value === t.id ? 'bg-brand-red/10' : 'bg-slate-100')}>
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
