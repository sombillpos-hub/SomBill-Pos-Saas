import type { Range, RangeKey } from '../types';

export const RANGE_LABEL: Record<RangeKey, string> = {
  today: 'Today',
  week: 'This week',
  mtd: 'Month-to-date',
  year: 'Year',
};

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** Time windows in the viewer's own time zone. `to` is exclusive. Weeks start on Saturday (Somali business week). */
export function rangeFor(key: RangeKey, now: Date = new Date()): Range {
  const today = startOfDay(now);
  let from: Date;
  let to: Date;
  let prevFrom: Date;
  let bucket: Range['bucket'] = 'day';
  if (key === 'today') {
    from = today;
    to = addDays(today, 1);
    prevFrom = addDays(today, -1);
    bucket = 'hour';
  } else if (key === 'week') {
    const back = (today.getDay() + 1) % 7; // Saturday = 0 days back
    from = addDays(today, -back);
    to = addDays(from, 7);
    prevFrom = addDays(from, -7);
  } else if (key === 'mtd') {
    from = new Date(today.getFullYear(), today.getMonth(), 1);
    to = addDays(today, 1);
    const days = Math.round((to.getTime() - from.getTime()) / 86400000);
    prevFrom = addDays(from, -days);
  } else {
    from = new Date(today.getFullYear(), 0, 1);
    to = new Date(today.getFullYear() + 1, 0, 1);
    prevFrom = new Date(today.getFullYear() - 1, 0, 1);
    bucket = 'month';
  }
  return { key, from, to, prevFrom, prevTo: from, bucket, label: RANGE_LABEL[key] };
}

/** Fills every bucket of the window so charts show quiet hours/days as zero instead of skipping them. */
export function bucketLabels(range: Range): string[] {
  const out: string[] = [];
  const pad = (n: number) => String(n).padStart(2, '0');
  if (range.bucket === 'hour') {
    for (let h = 0; h < 24; h++)
      out.push(
        `${range.from.getFullYear()}-${pad(range.from.getMonth() + 1)}-${pad(range.from.getDate())} ${pad(h)}:00`,
      );
  } else if (range.bucket === 'day') {
    for (let d = new Date(range.from); d < range.to; d = addDays(d, 1))
      out.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
  } else {
    for (let m = 0; m < 12; m++) out.push(`${range.from.getFullYear()}-${pad(m + 1)}`);
  }
  return out;
}

export function shortBucket(label: string, bucket: Range['bucket']): string {
  if (bucket === 'hour') return label.slice(11, 13);
  if (bucket === 'month')
    return (
      ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][
        Number(label.slice(5, 7)) - 1
      ] ?? label
    );
  return label.slice(5);
}
