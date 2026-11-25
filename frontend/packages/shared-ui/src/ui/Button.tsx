import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@sombill/shared-utils/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'navy' | 'orange';
type Size = 'sm' | 'md';

const VARIANT: Record<Variant, string> = {
  primary: 'bg-brand-red text-white hover:bg-brand-red-dark shadow-sm',
  navy: 'bg-brand-navy text-white hover:bg-brand-navy-light shadow-sm',
  orange: 'bg-brand-orange text-white hover:bg-orange-600 shadow-sm',
  secondary: 'border border-slate-200 bg-white text-brand-text hover:bg-slate-50 hover:border-slate-300 shadow-xs',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-brand-text',
  danger: 'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100',
};
const SIZE: Record<Size, string> = { sm: 'h-8 px-3 text-xs gap-1.5', md: 'h-10 px-4 text-sm gap-2' };

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, icon, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      data-variant={variant}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-xl font-semibold transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60',
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});
