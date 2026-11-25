import { useEffect, useState } from 'react';

function makeFormatter(timeZone?: string): Intl.DateTimeFormat {
  const opts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
  try {
    return new Intl.DateTimeFormat('en-GB', { ...opts, timeZone });
  } catch {
    return new Intl.DateTimeFormat('en-GB', opts); // unknown time zone: fall back to the device clock
  }
}

function makeDateFormatter(timeZone?: string): Intl.DateTimeFormat {
  const opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: '2-digit', month: 'short' };
  try {
    return new Intl.DateTimeFormat('en-GB', { ...opts, timeZone });
  } catch {
    return new Intl.DateTimeFormat('en-GB', opts);
  }
}

/**
 * Live digital clock in the restaurant's time zone. Not an aria-live region, so screen readers are not interrupted.
 * `withDate` adds the weekday and date under the time (used by the POS topbar).
 */
export function ShellClock({ timeZone, withDate = false }: { timeZone?: string; withDate?: boolean }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <time
      className="sb-clock"
      dateTime={now.toISOString()}
      aria-label="Restaurant local time"
      data-with-date={withDate}
    >
      {makeFormatter(timeZone).format(now)}
      {withDate && <small className="sb-clock-date">{makeDateFormatter(timeZone).format(now)}</small>}
    </time>
  );
}
