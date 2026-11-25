import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { Skeleton } from '@sombill/shared-ui/ui/Feedback';
import { cn } from '@sombill/shared-utils/cn';

export interface KpiProps {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon: ReactNode;
  tone?: 'red' | 'orange' | 'amber' | 'purple' | 'green' | 'sky';
  /** Percentage vs the previous window. Undefined = no baseline to compare with. */
  trend?: number | null;
  loading?: boolean;
  index?: number;
}

export function Kpi({ label, value, sub, icon, tone = 'orange', trend, loading, index = 0 }: KpiProps) {
  return (
    <motion.div
      className="sa-kpi card card-glass-archetype"
      data-tone={tone}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.35 }}
    >
      <div className="sa-kpi-icon" aria-hidden>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="sa-kpi-label">{label}</p>
        {loading ? (
          <Skeleton className="mt-2 h-7 w-28" />
        ) : (
          <p className="sa-kpi-value" data-sb="stat-value">
            {value}
          </p>
        )}
        <div className="sa-kpi-sub">
          {trend !== undefined && trend !== null && !loading && (
            <span className={cn('sa-trend', trend >= 0 ? 'up' : 'down')}>
              {trend >= 0 ? (
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <ArrowDownRight className="h-3.5 w-3.5" aria-hidden />
              )}
              {Math.abs(trend).toFixed(1)}%
            </span>
          )}
          {sub && !loading && <span className="truncate">{sub}</span>}
        </div>
      </div>
    </motion.div>
  );
}
