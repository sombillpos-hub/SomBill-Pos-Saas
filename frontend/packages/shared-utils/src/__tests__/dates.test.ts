import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, presetRange, rangeToIso, todayInZone, weekStart, zonedMidnight } from '../dates';

describe('timezone-aware dates', () => {
  it('computes local midnight in Hargeisa (UTC+3)', () => {
    expect(zonedMidnight('2026-11-21', 'Africa/Mogadishu').toISOString()).toBe('2026-11-20T21:00:00.000Z');
  });
  it('handles DST zones', () => {
    expect(zonedMidnight('2026-07-01', 'Europe/London').toISOString()).toBe('2026-06-30T23:00:00.000Z');
    expect(zonedMidnight('2026-01-01', 'Europe/London').toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });
  it('produces half-open ISO bounds for an inclusive range', () => {
    expect(rangeToIso({ from: '2026-11-20', to: '2026-11-21' }, 'Africa/Mogadishu')).toEqual({
      fromIso: '2026-11-19T21:00:00.000Z',
      toIso: '2026-11-21T21:00:00.000Z',
    });
  });
  it('knows "today" in the restaurant zone, not the browser zone', () => {
    const now = new Date('2026-11-21T22:30:00Z'); // 01:30 on the 22nd in Hargeisa
    expect(todayInZone('Africa/Mogadishu', now)).toBe('2026-11-22');
    expect(todayInZone('UTC', now)).toBe('2026-11-21');
  });
  it('builds presets', () => {
    const now = new Date('2026-11-21T10:00:00Z'); // Saturday
    expect(presetRange('today', 'UTC', now)).toEqual({ from: '2026-11-21', to: '2026-11-21' });
    expect(presetRange('yesterday', 'UTC', now)).toEqual({ from: '2026-11-20', to: '2026-11-20' });
    expect(presetRange('last7', 'UTC', now)).toEqual({ from: '2026-11-15', to: '2026-11-21' });
    expect(presetRange('thisWeek', 'UTC', now)).toEqual({ from: '2026-11-16', to: '2026-11-21' });
    expect(presetRange('thisMonth', 'UTC', now)).toEqual({ from: '2026-11-01', to: '2026-11-21' });
  });
  it('date helpers', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(daysBetween({ from: '2026-02-27', to: '2026-03-01' })).toEqual(['2026-02-27', '2026-02-28', '2026-03-01']);
    expect(weekStart('2026-11-22')).toBe('2026-11-16');
  });
});
