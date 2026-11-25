import { formatMoney } from '@sombill/shared-utils/format';

/** Exchange setup of the group. `rates[X]` = units of X per 1 USD (so SLS: 11800 means 1 USD = 11,800 SLS). */
export interface Fx {
  reporting: string;
  rates: Record<string, number>;
}

export function fxFrom(settings: { reporting_currency?: string; fx_rates?: Record<string, number> } | undefined): Fx {
  return { reporting: settings?.reporting_currency || 'USD', rates: { ...(settings?.fx_rates ?? {}) } };
}

const perUsd = (cur: string, fx: Fx): number | null => {
  if (cur === 'USD') return 1;
  const r = fx.rates[cur];
  return r !== undefined && r > 0 ? r : null;
};

/** Converts through USD. Returns null when a needed rate is missing, so a number is never silently wrong. */
export function convert(amount: number, from: string, to: string, fx: Fx): number | null {
  if (from === to) return amount;
  const a = perUsd(from, fx);
  const b = perUsd(to, fx);
  if (a === null || b === null) return null;
  return (amount / a) * b;
}

export interface Converted {
  total: number;
  /** Amounts that could not be converted, by currency. Shown next to the total, never dropped. */
  unconverted: Record<string, number>;
}

export function sumConverted<T>(rows: T[], amount: (r: T) => number, currency: (r: T) => string, fx: Fx): Converted {
  const out: Converted = { total: 0, unconverted: {} };
  for (const r of rows) {
    const v = Number(amount(r)) || 0;
    const c = convert(v, currency(r), fx.reporting, fx);
    if (c === null) out.unconverted[currency(r)] = (out.unconverted[currency(r)] ?? 0) + v;
    else out.total += c;
  }
  return out;
}

/** "$12,480.00", plus " + SLS 1,200" for anything that has no rate yet. */
export function formatConverted(c: Converted, fx: Fx): string {
  const extra = Object.entries(c.unconverted)
    .map(([cur, v]) => formatMoney(v, cur))
    .join(' + ');
  const main = formatMoney(c.total, fx.reporting);
  return extra ? `${main} + ${extra}` : main;
}

/** Secondary figure in a second currency (e.g. SLS next to USD), only when a rate exists. */
export function secondary(total: number, fx: Fx, currency = 'SLS'): string | null {
  if (currency === fx.reporting) return null;
  const v = convert(total, fx.reporting, currency, fx);
  return v === null ? null : `${currency} ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(v)}`;
}

/** Percentage change; null when the previous value is 0 (no honest percentage exists). */
export function trendPct(current: number, previous: number): number | null {
  if (!(previous > 0)) return null;
  return ((current - previous) / previous) * 100;
}
