import { useEffect, useState } from 'react';

/**
 * Lightweight GPU-accelerated ambient background particles, soft aurora orbs,
 * and the SomBill website's signature shimmering top scroll progress bar.
 * Pure CSS animations (respects prefers-reduced-motion and hidden in print).
 */
const PARTICLES = [
  { left: '8%', top: '18%', size: 6, delay: '0s', dur: '14s', tone: 'orange' },
  { left: '22%', top: '72%', size: 4, delay: '2.2s', dur: '17s', tone: 'red' },
  { left: '36%', top: '34%', size: 5, delay: '4.5s', dur: '15s', tone: 'amber' },
  { left: '48%', top: '82%', size: 7, delay: '1.1s', dur: '19s', tone: 'orange' },
  { left: '61%', top: '24%', size: 4, delay: '3.4s', dur: '13s', tone: 'red' },
  { left: '74%', top: '64%', size: 6, delay: '5.2s', dur: '16s', tone: 'amber' },
  { left: '86%', top: '16%', size: 5, delay: '0.8s', dur: '18s', tone: 'orange' },
  { left: '92%', top: '78%', size: 4, delay: '2.9s', dur: '15s', tone: 'red' },
  { left: '15%', top: '48%', size: 5, delay: '6.1s', dur: '20s', tone: 'amber' },
  { left: '54%', top: '52%', size: 4, delay: '1.8s', dur: '14s', tone: 'orange' },
  { left: '81%', top: '42%', size: 6, delay: '3.9s', dur: '17s', tone: 'red' },
  { left: '31%', top: '12%', size: 4, delay: '4.8s', dur: '16s', tone: 'amber' },
] as const;

export function AmbientBackdrop() {
  const [scrollPct, setScrollPct] = useState(0);

  useEffect(() => {
    const update = () => {
      const top = window.scrollY || document.documentElement.scrollTop;
      const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      if (height <= 20) {
        setScrollPct(0);
        return;
      }
      setScrollPct(Math.min(100, Math.max(0, (top / height) * 100)));
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return (
    <>
      {scrollPct > 0.5 && (
        <div className="sb-scroll-progress no-print" style={{ width: `${scrollPct}%` }} aria-hidden="true" />
      )}
      <div className="sb-ambient no-print" aria-hidden="true">
        <span className="sb-orb sb-orb--1" />
        <span className="sb-orb sb-orb--2" />
        {PARTICLES.map((p, i) => (
          <span
            key={i}
            className={`sb-particle sb-particle--${p.tone}`}
            style={{
              left: p.left,
              top: p.top,
              width: `${p.size}px`,
              height: `${p.size}px`,
              animationDelay: p.delay,
              animationDuration: p.dur,
            }}
          />
        ))}
      </div>
    </>
  );
}
