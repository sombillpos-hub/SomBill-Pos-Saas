import { useCallback, useLayoutEffect, useState } from 'react';

/** `light` is the default; `dark` is the "Obsidian Ruby" theme (see styles/design-system). */
export type SbThemeMode = 'light' | 'dark';

export const SB_THEME_KEY = 'sombill.theme';

/** The value of <html data-sb-theme> for each mode. */
const ATTRIBUTE: Record<SbThemeMode, string> = { light: 'light', dark: 'obsidian' };

function readStoredMode(): SbThemeMode {
  try {
    return localStorage.getItem(SB_THEME_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

/**
 * App-wide SomBill theme switch for layouts that opt in (the Manager layout today).
 *
 * - Defaults to light. The choice is remembered per browser in localStorage.
 * - The attribute is applied before first paint (layout effect), so a saved dark choice does not flash white.
 * - It lives on <html> so portalled UI (modals, toasts, popovers, the command palette) is themed too, and it is
 *   removed on unmount so other apps (Waiter, Cashier, sign-in) are unaffected.
 */
export function useSbTheme(enabled = true): {
  mode: SbThemeMode;
  setMode: (mode: SbThemeMode) => void;
  toggle: () => void;
} {
  const [mode, setModeState] = useState<SbThemeMode>(readStoredMode);

  useLayoutEffect(() => {
    if (!enabled) return;
    const root = document.documentElement;
    const previous = root.getAttribute('data-sb-theme');
    root.setAttribute('data-sb-theme', ATTRIBUTE[mode]);
    return () => {
      if (previous) root.setAttribute('data-sb-theme', previous);
      else root.removeAttribute('data-sb-theme');
    };
  }, [mode, enabled]);

  const setMode = useCallback((next: SbThemeMode) => {
    setModeState(next);
    try {
      localStorage.setItem(SB_THEME_KEY, next);
    } catch {
      /* storage unavailable: the choice still applies for this visit */
    }
  }, []);

  const toggle = useCallback(() => {
    setModeState((current) => {
      const next: SbThemeMode = current === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(SB_THEME_KEY, next);
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  }, []);

  return { mode, setMode, toggle };
}
