import { useSyncExternalStore } from 'react';

/** Subscribes to a CSS media query. Returns `fallback` where matchMedia is unavailable (tests/SSR). */
export function useMediaQuery(query: string, fallback = false): boolean {
  return useSyncExternalStore(
    (cb) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {};
      const m = window.matchMedia(query);
      m.addEventListener('change', cb);
      return () => m.removeEventListener('change', cb);
    },
    () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : fallback),
    () => fallback,
  );
}

/** Scrolls an element into view when panels are stacked (narrow layouts). */
export function revealIfStacked(el: HTMLElement | null, stackedQuery = '(max-width: 1279px)') {
  if (!el || typeof window === 'undefined' || !window.matchMedia?.(stackedQuery).matches) return;
  requestAnimationFrame(() => el.scrollIntoView?.({ behavior: 'smooth', block: 'start' }));
}
