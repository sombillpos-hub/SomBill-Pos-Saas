import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '@sombill/shared-utils/cn';

interface WrapProps {
  label?: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
  required?: boolean;
}

export function FieldWrap({ label, error, hint, children, className, htmlFor, required }: WrapProps) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={htmlFor} className="label">
          {label}
          {required && <span className="text-brand-red"> *</span>}
        </label>
      )}
      {children}
      {error ? (
        <p role="alert" className="mt-1 text-xs font-medium text-red-600">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
  hint?: string;
  wrapClassName?: string;
};
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, wrapClassName, className, id, required, ...rest },
  ref,
) {
  const auto = useId();
  const fid = id ?? rest.name ?? auto;
  return (
    <FieldWrap label={label} error={error} hint={hint} className={wrapClassName} htmlFor={fid} required={required}>
      <input
        ref={ref}
        id={fid}
        aria-invalid={Boolean(error)}
        className={cn('input', error && 'border-red-400', className)}
        {...rest}
      />
    </FieldWrap>
  );
});

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string;
  hint?: string;
  wrapClassName?: string;
};
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, hint, wrapClassName, className, id, children, required, ...rest },
  ref,
) {
  const auto = useId();
  const fid = id ?? rest.name ?? auto;
  return (
    <FieldWrap label={label} error={error} hint={hint} className={wrapClassName} htmlFor={fid} required={required}>
      <select
        ref={ref}
        id={fid}
        aria-invalid={Boolean(error)}
        className={cn('input pr-8', error && 'border-red-400', className)}
        {...rest}
      >
        {children}
      </select>
    </FieldWrap>
  );
});

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  error?: string;
  hint?: string;
  wrapClassName?: string;
};
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, hint, wrapClassName, className, id, ...rest },
  ref,
) {
  const auto = useId();
  const fid = id ?? rest.name ?? auto;
  return (
    <FieldWrap label={label} error={error} hint={hint} className={wrapClassName} htmlFor={fid}>
      <textarea
        ref={ref}
        id={fid}
        rows={3}
        aria-invalid={Boolean(error)}
        className={cn('input', error && 'border-red-400', className)}
        {...rest}
      />
    </FieldWrap>
  );
});

export const Checkbox = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { label: string; description?: string }
>(function Checkbox({ label, description, id, ...rest }, ref) {
  const auto = useId();
  const fid = id ?? rest.name ?? auto;
  return (
    <label
      htmlFor={fid}
      className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50"
    >
      <input
        ref={ref}
        id={fid}
        type="checkbox"
        className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-brand-red"
        {...rest}
      />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {description && <span className="block text-xs text-slate-500">{description}</span>}
      </span>
    </label>
  );
});
