// Restaurant-timezone aware date ranges. Business days are defined in the
// restaurant's configured time zone, not the browser's.

export interface DateRange {
  from: string; // YYYY-MM-DD inclusive (restaurant local)
  to: string; // YYYY-MM-DD inclusive (restaurant local)
}

export type RangePreset = 'today' | 'yesterday' | 'last7' | 'thisWeek' | 'thisMonth' | 'last30' | 'custom';

function partsInZone(d: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const p = Object.fromEntries(fmt.formatToParts(d).map((x) => [x.type, x.value]));
  return { y: +p.year!, m: +p.month!, d: +p.day!, h: +p.hour!, min: +p.minute!, s: +p.second! };
}

/** Offset (ms) of `timeZone` from UTC at instant `d`. */
export function zoneOffsetMs(d: Date, timeZone: string): number {
  const p = partsInZone(d, timeZone);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s);
  return asUtc - Math.floor(d.getTime() / 1000) * 1000;
}

/** UTC instant of local midnight for a YYYY-MM-DD date in `timeZone`. */
export function zonedMidnight(ymd: string, timeZone: string): Date {
  const [y, m, d] = ymd.split('-').map(Number) as [number, number, number];
  const guess = new Date(Date.UTC(y, m - 1, d));
  let t = guess.getTime() - zoneOffsetMs(guess, timeZone);
  // second pass handles DST transitions
  t = guess.getTime() - zoneOffsetMs(new Date(t), timeZone);
  return new Date(t);
}

export function todayInZone(timeZone: string, now: Date = new Date()): string {
  const p = partsInZone(now, timeZone);
  return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
}

export function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function localDateOf(iso: string, timeZone: string): string {
  return todayInZone(timeZone, new Date(iso));
}

/** Half-open [fromIso, toIso) UTC bounds for an inclusive local date range. */
export function rangeToIso(range: DateRange, timeZone: string): { fromIso: string; toIso: string } {
  return {
    fromIso: zonedMidnight(range.from, timeZone).toISOString(),
    toIso: zonedMidnight(addDays(range.to, 1), timeZone).toISOString(),
  };
}

export function presetRange(
  preset: Exclude<RangePreset, 'custom'>,
  timeZone: string,
  now: Date = new Date(),
): DateRange {
  const today = todayInZone(timeZone, now);
  switch (preset) {
    case 'today':
      return { from: today, to: today };
    case 'yesterday': {
      const y = addDays(today, -1);
      return { from: y, to: y };
    }
    case 'last7':
      return { from: addDays(today, -6), to: today };
    case 'last30':
      return { from: addDays(today, -29), to: today };
    case 'thisWeek': {
      const [y, m, d] = today.split('-').map(Number) as [number, number, number];
      const dow = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; // Monday = 0
      return { from: addDays(today, -dow), to: today };
    }
    case 'thisMonth':
      return { from: `${today.slice(0, 8)}01`, to: today };
  }
}

export function daysBetween(range: DateRange): string[] {
  const out: string[] = [];
  for (let d = range.from; d <= range.to && out.length < 400; d = addDays(d, 1)) out.push(d);
  return out;
}

/** ISO week key (Monday start) for a local date. */
export function weekStart(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number) as [number, number, number];
  const dow = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
  return addDays(ymd, -dow);
}
