import { useState } from 'react';
import { Link } from 'react-router-dom';

const LOGO_SRC = '/branding/sombill-logo.jpg';

/**
 * SomBill brand lockup for the dark shell: floating logo with a radial flame glow that spins on hover.
 * Uses the official logo from /branding when it exists (a wide wordmark replaces the text, a square mark sits beside
 * it) and falls back to a flame tile with the "SomBill" wordmark until the file is supplied.
 */
export function BrandMark({
  to,
  collapsed,
  subtitle,
  crown,
}: {
  to: string;
  collapsed?: boolean;
  subtitle?: string;
  /** Gold revolving crown badge (Super Admin). */
  crown?: boolean;
}) {
  const [state, setState] = useState<'loading' | 'mark' | 'wordmark' | 'missing'>('loading');
  const showImage = state !== 'missing';
  return (
    <Link to={to} className="sb-brand" aria-label="SomBill home">
      <span className="sb-brand-mark" aria-hidden>
        <span className="sb-brand-glow" />
        {state === 'missing' && <span className="sb-brand-tile">S</span>}
        {showImage && state !== 'wordmark' && (
          <img
            src={LOGO_SRC}
            alt="SomBill"
            className="sb-brand-img rounded-xl object-cover shadow-md ring-1 ring-white/15"
            style={state === 'loading' ? { opacity: 0, position: 'absolute' } : undefined}
            onLoad={() => setState('mark')}
            onError={() => setState('missing')}
          />
        )}
        {state === 'wordmark' && <img src={LOGO_SRC} alt="" className="sb-brand-img" style={{ width: 'auto' }} />}
        {crown && <span className="sb-brand-crown">👑</span>}
      </span>
      {!collapsed && state !== 'wordmark' && (
        <span className="sb-brand-stack">
          <span className="sb-brand-text">
            Som<b>Bill</b>
          </span>
          {subtitle && <span className="sb-brand-sub">{subtitle}</span>}
        </span>
      )}
    </Link>
  );
}
