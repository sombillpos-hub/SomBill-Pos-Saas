import { motion } from 'framer-motion';
import { BarChart3, MapPin, Phone, Zap } from 'lucide-react';
import { Button } from '@sombill/shared-ui/ui/Button';
import { formatMoney, formatNumber } from '@sombill/shared-utils/format';
import { formatDuration } from '@sombill/shared-utils/format';
import type { BranchSummary } from '../features/types';

interface Props {
  b: BranchSummary;
  color: string;
  index?: number;
  onSwitch: () => void;
  onAudit: () => void;
}

/** One branch: today's takings, table occupancy gauge, registers and staff on duty. Lifts and shimmers on hover. */
export function BranchCard({ b, color, index = 0, onSwitch, onAudit }: Props) {
  const occ = b.tables_total > 0 ? Math.round((b.tables_occupied / b.tables_total) * 100) : 0;
  return (
    <motion.article
      className="sa-branch card"
      style={{ ['--bc' as string]: color }}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.35 }}
      aria-label={b.name}
    >
      <header className="sa-branch-head">
        <span className="sa-branch-dot" aria-hidden />
        <div className="min-w-0">
          <h3 className="truncate">{b.name}</h3>
          <p className="truncate">
            <MapPin className="inline h-3.5 w-3.5" aria-hidden /> {b.address || b.timezone}
          </p>
        </div>
      </header>
      {b.phone && (
        <p className="sa-branch-contact">
          <Phone className="inline h-3.5 w-3.5" aria-hidden /> {b.phone}
        </p>
      )}
      <div className="sa-branch-rev">
        <span>Revenue</span>
        <strong>{formatMoney(b.gross, b.currency)}</strong>
        <small>
          {formatNumber(b.orders_count)} order{b.orders_count === 1 ? '' : 's'}
        </small>
      </div>
      <div className="sa-gauge" role="img" aria-label={`Table occupancy ${occ}%`}>
        <div className="sa-gauge-head">
          <span>Tables occupied</span>
          <b>
            {b.tables_occupied}/{b.tables_total} · {occ}%
          </b>
        </div>
        <div className="sa-gauge-bar">
          <i style={{ width: `${occ}%` }} />
        </div>
      </div>
      <p className="sa-branch-fleet">
        {b.open_cashier_shifts} register{b.open_cashier_shifts === 1 ? '' : 's'} open · {b.staff_on_duty} on duty ·{' '}
        {b.staff_active} staff
      </p>
      <p className="sa-branch-last">
        {b.last_order_at ? `Last order ${formatDuration(b.last_order_at)} ago` : 'No orders in the last 7 days'}
      </p>
      <div className="sa-branch-actions">
        <Button size="sm" icon={<Zap className="h-3.5 w-3.5" />} onClick={onSwitch}>
          Switch to Branch View
        </Button>
        <Button size="sm" variant="secondary" icon={<BarChart3 className="h-3.5 w-3.5" />} onClick={onAudit}>
          View Audit
        </Button>
      </div>
    </motion.article>
  );
}
