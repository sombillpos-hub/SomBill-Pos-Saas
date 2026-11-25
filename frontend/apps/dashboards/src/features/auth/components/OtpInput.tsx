import { useEffect, useRef, type ClipboardEvent, type KeyboardEvent } from 'react';

interface Props {
  value: string;
  onChange: (v: string) => void;
  onComplete: (v: string) => void;
  label: string;
  digitLabel: (n: number) => string;
  disabled?: boolean;
  invalid?: boolean;
  length?: number;
}

/** Six single-digit boxes: auto-advance, backspace goes back, paste fills all boxes. */
export function OtpInput({ value, onChange, onComplete, label, digitLabel, disabled, invalid, length = 6 }: Props) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  useEffect(() => {
    refs.current[0]?.focus({ preventScroll: true });
  }, []);
  const set = (next: string) => {
    const v = next.replace(/\D/g, '').slice(0, length);
    onChange(v);
    if (v.length === length) onComplete(v);
  };
  const type = (i: number, raw: string) => {
    const d = raw.replace(/\D/g, '');
    if (!d) return;
    const chars = value.padEnd(length, ' ').split('');
    chars[i] = d.slice(-1);
    set(chars.join('').replace(/ /g, ''));
    refs.current[Math.min(i + 1, length - 1)]?.focus();
  };
  const key = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (value[i]) set(value.slice(0, i) + value.slice(i + 1));
      else if (i > 0) {
        set(value.slice(0, i - 1) + value.slice(i));
        refs.current[i - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft') refs.current[Math.max(0, i - 1)]?.focus();
    else if (e.key === 'ArrowRight') refs.current[Math.min(length - 1, i + 1)]?.focus();
  };
  const paste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const d = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!d) return;
    set(d);
    refs.current[Math.min(d.length, length - 1)]?.focus();
  };
  return (
    <div className="au-otp" role="group" aria-label={label} dir="ltr">
      {Array.from({ length }, (_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          className="au-otp-box"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={2}
          value={value[i] ?? ''}
          disabled={disabled}
          aria-label={digitLabel(i + 1)}
          aria-invalid={invalid || undefined}
          onChange={(e) => type(i, e.target.value)}
          onKeyDown={(e) => key(i, e)}
          onPaste={paste}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  );
}
