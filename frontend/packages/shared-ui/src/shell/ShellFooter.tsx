import type { ReactNode } from 'react';
import { Database, ShieldCheck, Wifi, Zap } from 'lucide-react';
import { useRealtimeHealth } from '@sombill/shared-hooks/useRealtime';

const HEALTH = { live: 'Realtime sync live', connecting: 'Realtime sync connecting', offline: 'Realtime sync offline' };

/** Breathing glass footer with an aurora beam and floating status icons. */
export function ShellFooter({ product, company, extra }: { product: string; company: string; extra?: ReactNode }) {
  const health = useRealtimeHealth();
  return (
    <footer className="df-root no-print">
      <div className="df-aurora-bar" aria-hidden />
      <div className="df-inner">
        <p className="df-meta">
          <strong>{product}</strong> · © {new Date().getFullYear()} {company}
        </p>
        <p className="df-meta" role="status">
          {HEALTH[health]}
        </p>
        {extra}
        <div className="flex items-center gap-2" aria-hidden>
          <span className="df-float-icon" title="Realtime">
            <Wifi className="h-3.5 w-3.5" />
          </span>
          <span className="df-float-icon" title="Secure">
            <ShieldCheck className="h-3.5 w-3.5" />
          </span>
          <span className="df-float-icon" title="Data">
            <Database className="h-3.5 w-3.5" />
          </span>
          <span className="df-float-icon" title="Fast">
            <Zap className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </footer>
  );
}
