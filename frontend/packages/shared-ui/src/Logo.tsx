import { useState } from 'react';
import { cn } from '@sombill/shared-utils/cn';

/** Official SomBill logo from public/branding (served at /branding); falls back to a wordmark if the file is missing. */
export function Logo({ compact, className, light }: { compact?: boolean; className?: string; light?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (!failed) {
    return (
      <img
        src="/branding/sombill-logo.png"
        alt="SomBill"
        onError={() => setFailed(true)}
        className={cn('w-auto object-contain', compact ? 'h-8' : 'h-10', className)}
      />
    );
  }
  return (
    <span
      className={cn('inline-flex items-center gap-2 font-extrabold tracking-tight', className)}
      aria-label="SomBill"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-red text-sm text-white">S</span>
      {!compact && (
        <span className={cn('text-xl', light ? 'text-white' : 'text-brand-navy')}>
          Som<span className="text-brand-orange">Bill</span>
        </span>
      )}
    </span>
  );
}
