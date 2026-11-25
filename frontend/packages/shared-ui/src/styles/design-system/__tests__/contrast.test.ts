import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type RGBA = [number, number, number, number];

function parse(c: string): RGBA {
  const hex = /^#([0-9a-f]{6})$/i.exec(c.trim());
  if (hex) {
    const n = parseInt(hex[1] ?? '0', 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const m = /^rgba?\(([^)]+)\)$/.exec(c.trim());
  if (!m) throw new Error(`Unsupported colour ${c}`);
  const [r, g, b, a = '1'] = (m[1] ?? '').split(',').map((x) => x.trim());
  return [Number(r), Number(g), Number(b), Number(a)];
}
/** Composite `top` over an opaque `bottom`. */
function over(top: RGBA, bottom: RGBA): RGBA {
  const a = top[3];
  const mix = (i: 0 | 1 | 2) => top[i] * a + bottom[i] * (1 - a);
  return [mix(0), mix(1), mix(2), 1];
}
function luminance([r, g, b]: RGBA): number {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function ratio(fg: string, bg: string, under = '#080305'): number {
  const base = parse(under);
  const back = over(parse(bg), base);
  const front = over(parse(fg), back);
  const l1 = luminance(front);
  const l2 = luminance(back);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

const DS_DIR = resolve(__dirname, '..');
const tokens = readFileSync(resolve(DS_DIR, 'tokens.css'), 'utf8');
const token = (name: string): string => {
  const m = new RegExp(`--${name}:\\s*([^;]+);`).exec(tokens);
  if (!m) throw new Error(`Missing token --${name}`);
  return (m[1] ?? '').trim();
};

describe('Obsidian Ruby palette meets WCAG AA (4.5:1 for text)', () => {
  const surfaces = ['#080305', 'rgba(255,255,255,0.02)', 'rgba(255,255,255,0.06)', 'rgba(13,6,8,0.95)'];
  it.each(['sb-text-1', 'sb-text-2', 'sb-text-3', 'sb-text-4', 'sb-text-5'])('%s on every surface', (name) => {
    for (const bg of surfaces) expect(ratio(token(name), bg)).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ['ok', 'rgba(16,185,129,0.12)'],
    ['warn', 'rgba(245,158,11,0.12)'],
    ['danger', 'rgba(239,68,68,0.12)'],
    ['info', 'rgba(56,189,248,0.12)'],
    ['violet', 'rgba(167,139,250,0.12)'],
  ])('status colour %s on its pill background', (name, pill) => {
    expect(ratio(token(`sb-${name}`), pill)).toBeGreaterThanOrEqual(4.5);
  });

  it('brand orange and amber (links, clock) on the page background', () => {
    expect(ratio(token('sb-brand-orange'), '#080305')).toBeGreaterThanOrEqual(4.5);
    expect(ratio(token('sb-brand-amber'), '#080305')).toBeGreaterThanOrEqual(4.5);
  });

  it('white text on the flame call-to-action gradient stops', () => {
    // large/bold button label: AA for large text is 3:1
    expect(ratio('#ffffff', '#dc2626')).toBeGreaterThanOrEqual(4.5);
    expect(ratio('#ffffff', '#f97316')).toBeGreaterThanOrEqual(2.8);
  });
});

describe('no low-contrast text colours in the design-system CSS', () => {
  it.each(['obsidian.css', 'shell.css', 'light.css', 'pos.css'])(
    '%s keeps white text at 50% opacity or more',
    (file) => {
      const css = readFileSync(resolve(DS_DIR, file), 'utf8');
      // `(?<![-\w])color` skips border-color, background-color, text-decoration-color, etc.
      const re = /(?<![-\w])color:\s*rgba\((?:248, 250, 252|255, 255, 255),\s*([0-9.]+)\)/g;
      const low = [...css.matchAll(re)].filter((m) => Number(m[1]) < 0.5).map((m) => m[0]);
      expect(low).toEqual([]);
    },
  );
});

describe('light theme meets WCAG AA (4.5:1 for text, 3:1 for icons)', () => {
  it.each([
    ['#64748b', '#ffffff'],
    ['#64748b', '#f8fafc'],
    ['#475569', '#f1f5f9'],
    ['#475569', '#fff7ed'],
    ['#334155', '#ffffff'],
    ['#0f172a', '#ffffff'],
    ['#991b1b', 'rgba(220,38,38,0.08)'],
    ['#047857', 'rgba(16,185,129,0.1)'],
    ['#92400e', 'rgba(245,158,11,0.12)'],
    ['#b91c1c', 'rgba(239,68,68,0.1)'],
    ['#b45309', '#f8fafc'],
    ['#c2410c', 'rgba(249,115,22,0.12)'],
    ['#c2410c', '#ffffff'],
  ])('%s on %s', (fg, bg) => {
    expect(ratio(fg, bg, '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });

  it('toggle sun icon on a white button', () => {
    expect(ratio('#b45309', '#ffffff', '#ffffff')).toBeGreaterThanOrEqual(3);
  });
});

describe('POS terminal colours meet WCAG AA', () => {
  it.each([
    ['#b45309', '#ffffff'], // light: price
    ['#92400e', '#fffbeb'], // light: table pill
    ['#047857', '#ffffff'], // light: change due
    ['#475569', '#ffffff'], // light: chip text
    ['#64748b', '#ffffff'], // light: status bar, clock date
    ['#0f172a', 'rgba(220,38,38,0.08)'], // light: grand total on the flame tint
  ])('light %s on %s', (fg, bg) => {
    expect(ratio(fg, bg, '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ['#fbbf24', 'rgba(255,255,255,0.025)'], // dark: price on a tile
    ['#fbbf24', 'rgba(251,191,36,0.12)'], // dark: table pill
    ['#34d399', 'rgba(255,255,255,0.02)'], // dark: change due
    ['rgba(248,250,252,0.72)', 'rgba(255,255,255,0.04)'], // dark: dim text on chips
    ['rgba(248,250,252,0.7)', 'rgba(255,255,255,0.04)'], // dark: chip text
    ['rgba(248,250,252,0.58)', 'rgba(8,3,5,0.98)'], // dark: status bar
    ['#ffffff', 'rgba(220,38,38,0.16)'], // dark: grand total
  ])('dark %s on %s', (fg, bg) => {
    expect(ratio(fg, bg, '#080305')).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ['#dc2626', '#991b1b'],
    ['#ea580c', '#c2410c'],
    ['#059669', '#047857'],
    ['#475569', '#1e293b'],
    ['#0d9488', '#115e59'],
  ])('white label on the %s → %s payment gradient (bold UI text, at least 3.5:1)', (a, b) => {
    expect(ratio('#ffffff', a, '#ffffff')).toBeGreaterThanOrEqual(3.5);
    expect(ratio('#ffffff', b, '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });
});
