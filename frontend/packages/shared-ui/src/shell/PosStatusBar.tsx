import type { ReactNode } from 'react';

/** 32px monospace status bar pinned to the bottom of a POS terminal (screen only, hidden on small tablets). */
export function PosStatusBar({ left, center, right }: { left: ReactNode; center?: ReactNode; right?: ReactNode }) {
  return (
    <footer className="sb-statusbar no-print">
      <div className="sb-statusbar-left">{left}</div>
      {center && <div className="sb-statusbar-center">{center}</div>}
      {right && <div className="sb-statusbar-right">{right}</div>}
    </footer>
  );
}
