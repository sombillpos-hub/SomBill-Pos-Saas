import type { ReactNode } from 'react';
import { AlertCircle, Inbox, RefreshCw } from 'lucide-react';
import { cn } from '@sombill/shared-utils/cn';
import { Button } from './Button';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-slate-200/70', className)} aria-hidden />;
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3 p-4" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          {Array.from({ length: cols }).map((__, j) => (
            <Skeleton key={j} className="h-5 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  message,
  action,
  icon,
}: {
  title: string;
  message?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        {icon ?? <Inbox className="h-6 w-6" />}
      </div>
      <h3 className="text-base font-semibold text-brand-navy">{title}</h3>
      {message && <p className="mt-1 max-w-sm text-sm text-slate-500">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-brand-red">
        <AlertCircle className="h-6 w-6" />
      </div>
      <h3 className="text-base font-semibold text-brand-navy">Could not load data</h3>
      <p className="mt-1 max-w-md text-sm text-slate-500">{message}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-4" onClick={onRetry} icon={<RefreshCw className="h-4 w-4" />}>
          Try again
        </Button>
      )}
    </div>
  );
}

const TONES = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  red: 'bg-red-50 text-red-700 ring-red-600/20',
  orange: 'bg-orange-50 text-orange-700 ring-orange-600/20',
  blue: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  navy: 'bg-slate-100 text-brand-navy ring-slate-500/20',
  gray: 'bg-slate-50 text-slate-600 ring-slate-500/20',
  purple: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  yellow: 'bg-amber-50 text-amber-800 ring-amber-600/20',
} as const;
export type Tone = keyof typeof TONES;

export function Badge({
  tone = 'gray',
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      data-tone={tone}
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Card({
  children,
  className,
  title,
  action,
  bodyClassName,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  action?: ReactNode;
  bodyClassName?: string;
}) {
  return (
    <section className={cn('card min-w-0 rounded-2xl', className)}>
      {(title || action) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
          {title && <h2 className="text-sm font-bold tracking-tight text-brand-navy">{title}</h2>}
          {action}
        </header>
      )}
      <div className={cn(bodyClassName ?? 'p-5')}>{children}</div>
    </section>
  );
}

export function StatCard({
  label,
  value,
  sub,
  icon,
  tone = 'navy',
  loading,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  tone?: 'navy' | 'red' | 'orange' | 'green';
  loading?: boolean;
}) {
  const tones = {
    navy: 'bg-brand-navy/10 text-brand-navy ring-1 ring-brand-navy/10',
    red: 'bg-brand-red/10 text-brand-red ring-1 ring-brand-red/15',
    orange: 'bg-brand-orange/15 text-brand-orange ring-1 ring-brand-orange/20',
    green: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-600/15',
  };
  const stripe = {
    navy: 'before:bg-slate-800',
    red: 'before:bg-brand-red',
    orange: 'before:bg-brand-orange',
    green: 'before:bg-emerald-500',
  };
  return (
    <div
      className={cn(
        'card card-glass-archetype relative flex min-w-0 items-start gap-3.5 overflow-hidden rounded-2xl p-4 sm:p-5',
        'before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:content-[""]',
        stripe[tone],
      )}
    >
      {icon && (
        <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', tones[tone])}>{icon}</div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
        {loading ? (
          <Skeleton className="mt-2 h-7 w-24" />
        ) : (
          <p data-sb="stat-value" className="mt-1 truncate text-2xl font-bold tracking-tight text-brand-navy">
            {value}
          </p>
        )}
        {sub && !loading && <p className="mt-1 truncate text-xs text-slate-500">{sub}</p>}
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <section className="sb-page-banner mb-6" aria-label={title}>
      <div className="sb-hero-main">
        <div className="sb-hero-eyebrow">{eyebrow ?? 'SomBill Hospitality OS'}</div>
        <h1 className="sb-hero-title">{title}</h1>
        {description && <p className="sb-hero-desc">{description}</p>}
      </div>
      {actions && <div className="no-print sb-banner-actions">{actions}</div>}
    </section>
  );
}

export function DashboardHero({
  eyebrow,
  title,
  description,
  aside,
  actions,
}: {
  eyebrow?: ReactNode;
  title: string;
  description?: string;
  aside?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="sb-hero mb-6" aria-label={title}>
      <div className="sb-hero-main">
        {eyebrow && <div className="sb-hero-eyebrow">{eyebrow}</div>}
        <h1 className="sb-hero-title">{title}</h1>
        {description && <p className="sb-hero-desc">{description}</p>}
        {actions && <div className="no-print mt-4 flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {aside && <div className="sb-hero-aside">{aside}</div>}
    </section>
  );
}
