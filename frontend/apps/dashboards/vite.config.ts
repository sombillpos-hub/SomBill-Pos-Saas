/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

const at = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// Keep this list in sync with "paths" in ../../tsconfig.base.json.
const alias = {
  '@sombill/manager': at('../manager/src'),
  '@sombill/cashier': at('../cashier/src'),
  '@sombill/waiter': at('../waiter/src'),
  '@sombill/super-admin': at('../super-admin/src'),
  '@sombill/shared-ui': at('../../packages/shared-ui/src'),
  '@sombill/shared-hooks': at('../../packages/shared-hooks/src'),
  '@sombill/shared-utils': at('../../packages/shared-utils/src'),
  '@sombill/shared-types': at('../../packages/shared-types/src'),
  '@sombill/api-client': at('../../packages/api-client/src'),
  '@sombill/shared-config': at('../../packages/shared-config/src'),
  '@': at('./src'),
};

export default defineConfig({
  server: {
    // `npm run dev` in frontend/ serves the website and the dashboards together on 3000 (scripts/dev.mjs).
    port: 3000,
    strictPort: true,
    host: true,
  },
  plugins: [react()],
  // Static files (logo etc.) are served from public/ (Vite default).
  resolve: { alias },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
          forms: ['react-hook-form', 'zod', '@hookform/resolvers'],
          query: ['@tanstack/react-query'],
          motion: ['framer-motion'],
          charts: ['recharts'],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [at('../../packages/shared-utils/src/testing/setup.ts')],
    // Tests live next to the code they test, in apps/*/src and packages/*/src.
    dir: at('../..'),
    include: ['apps/*/src/**/*.test.{ts,tsx}', 'packages/*/src/**/*.test.{ts,tsx}'],
    exclude: ['apps/website/**', '**/node_modules/**'],
  },
});
