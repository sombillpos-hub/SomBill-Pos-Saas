import { Moon, Sun } from 'lucide-react';
import type { SbThemeMode } from '@sombill/shared-hooks/useSbTheme';

interface Props {
  mode: SbThemeMode;
  onToggle: () => void;
}

/** Light / dark switch for the topbar. A toggle button: the label stays "Dark mode" and aria-pressed carries the state. */
export function ThemeToggle({ mode, onToggle }: Props) {
  const dark = mode === 'dark';
  return (
    <button
      type="button"
      className="sb-icon-btn sb-theme-toggle"
      onClick={onToggle}
      aria-label="Dark mode"
      aria-pressed={dark}
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      data-mode={mode}
    >
      <Sun className="sb-theme-sun h-[18px] w-[18px]" aria-hidden />
      <Moon className="sb-theme-moon h-[18px] w-[18px]" aria-hidden />
    </button>
  );
}
