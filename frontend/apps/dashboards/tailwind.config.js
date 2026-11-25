import { fileURLToPath } from 'node:url';

const at = (p) => fileURLToPath(new URL(p, import.meta.url));

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    at('./index.html'),
    at('./src/**/*.{ts,tsx}'),
    at('../manager/src/**/*.{ts,tsx}'),
    at('../cashier/src/**/*.{ts,tsx}'),
    at('../waiter/src/**/*.{ts,tsx}'),
    at('../super-admin/src/**/*.{ts,tsx}'),
    at('../../packages/*/src/**/*.{ts,tsx}'),
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          red: '#DC2626',
          'red-dark': '#B91C1C',
          orange: '#F97316',
          amber: '#FBBF24',
          navy: '#0F172A',
          'navy-light': '#1E293B',
          bg: '#F8FAFC',
          text: '#0F172A',
        },
      },
      fontFamily: {
        sans: ['Outfit Variable', 'Outfit', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono Variable', 'JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(15,23,42,0.04), 0 6px 20px rgba(15,23,42,0.05)',
      },
    },
  },
  plugins: [],
};
