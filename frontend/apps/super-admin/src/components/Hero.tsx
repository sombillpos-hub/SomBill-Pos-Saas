import { motion } from 'framer-motion';
import { Moon, Sun, Sunrise } from 'lucide-react';
import { useAuth } from '@sombill/shared-hooks/AuthContext';
import { formatMoney } from '@sombill/shared-utils/format';
import { secondary, type Fx } from '../features/lib/money';

interface Props {
  orgName: string;
  branches: number;
  registers: number;
  onDuty: number;
  revenue: number;
  revenueNote: string | null;
  occupancyPct: number | null;
  fx: Fx;
  loading: boolean;
}

function greeting(h: number) {
  return h < 12
    ? { text: 'Subax wanaagsan', Icon: Sunrise }
    : h < 18
      ? { text: 'Galab wanaagsan', Icon: Sun }
      : { text: 'Habeen wanaagsan', Icon: Moon };
}

/** Top banner: time-aware greeting, today's figures and three slowly floating light orbs. */
export function Hero({ orgName, branches, registers, onDuty, revenue, revenueNote, occupancyPct, fx, loading }: Props) {
  const { profile } = useAuth();
  const g = greeting(new Date().getHours());
  const first = (profile?.full_name || '').split(' ')[0];
  const sec = secondary(revenue, fx);
  return (
    <section className="sa-hero" aria-label="Group summary">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className={`sa-orb sa-orb--${i}`}
          aria-hidden
          animate={{ y: [0, -18, 0], x: [0, i % 2 ? -12 : 12, 0] }}
          transition={{ duration: 7 + i * 2, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
      <div className="sa-hero-text">
        <p className="sa-hero-greet">
          <g.Icon className="h-4 w-4" aria-hidden /> {g.text}, {first || 'Super Admin'}
        </p>
        <h1>{orgName} — Command HQ</h1>
        <p className="sa-hero-sub">
          {loading
            ? 'Loading today’s numbers…'
            : `Managing ${branches} branch${branches === 1 ? '' : 'es'}, ${registers} open register${registers === 1 ? '' : 's'}, ${onDuty} staff on duty, and ${formatMoney(revenue, fx.reporting)}${revenueNote ?? ''} in sales today.`}
        </p>
      </div>
      <div className="sa-hero-panel">
        <p>Gross revenue today</p>
        <strong>{loading ? '—' : formatMoney(revenue, fx.reporting)}</strong>
        {sec && !loading && <small>{sec}</small>}
        <div className="sa-hero-occ">
          <span>Table occupancy now</span>
          <b>{occupancyPct === null ? '—' : `${occupancyPct}%`}</b>
        </div>
      </div>
    </section>
  );
}
