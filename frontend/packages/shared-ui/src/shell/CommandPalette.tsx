import { Command } from 'cmdk';
import { Moon, Sun } from 'lucide-react';
import type { SbThemeMode } from '@sombill/shared-hooks/useSbTheme';
import type { ShellNavItem } from './ShellSidebar';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: ShellNavItem[];
  onSelect: (to: string) => void;
  /** When given, an "Appearance" entry switches between light and dark. */
  themeMode?: SbThemeMode;
  onToggleTheme?: () => void;
}

/** Keyboard-driven "jump to page" palette (Ctrl/⌘ + K). Navigation and the theme switch only: it never changes data. */
export function CommandPalette({ open, onOpenChange, items, onSelect, themeMode, onToggleTheme }: Props) {
  const groups = items.reduce<Record<string, ShellNavItem[]>>((acc, item) => {
    (acc[item.group ?? 'Pages'] ??= []).push(item);
    return acc;
  }, {});
  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Jump to a page"
      overlayClassName="sb-cmdk-overlay"
      contentClassName="sb-cmdk"
    >
      <Command.Input placeholder="Jump to a page…" aria-label="Jump to a page" />
      <Command.List>
        <Command.Empty>No matching page.</Command.Empty>
        {Object.entries(groups).map(([group, list]) => (
          <Command.Group key={group} heading={group}>
            {list.map(({ to, label, icon: Icon }) => (
              <Command.Item key={to} value={`${group} ${label}`} onSelect={() => onSelect(to)}>
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                {label}
              </Command.Item>
            ))}
          </Command.Group>
        ))}
        {onToggleTheme && (
          <Command.Group heading="Appearance">
            <Command.Item
              value="Appearance theme dark light mode"
              onSelect={() => {
                onToggleTheme();
                onOpenChange(false);
              }}
            >
              {themeMode === 'dark' ? (
                <Sun className="h-4 w-4 shrink-0" aria-hidden />
              ) : (
                <Moon className="h-4 w-4 shrink-0" aria-hidden />
              )}
              {themeMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            </Command.Item>
          </Command.Group>
        )}
      </Command.List>
      <div className="sb-cmdk-foot" aria-hidden>
        <span>↑↓ navigate</span>
        <span>↵ open</span>
        <span>esc close</span>
      </div>
    </Command.Dialog>
  );
}
