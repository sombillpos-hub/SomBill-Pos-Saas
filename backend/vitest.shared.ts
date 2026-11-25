import { defaultClientConditions, defaultServerConditions } from 'vite';
import { defineConfig, type ViteUserConfig } from 'vitest/config';

/**
 * Shared Vitest settings. Workspace packages are resolved from TypeScript source through the "source" export
 * condition, so tests never need a build step. Integration tests run serially because they share local
 * PostgreSQL, RabbitMQ and Redis servers (each test file gets its own database and queues).
 */
export function sharedConfig(overrides: ViteUserConfig['test'] = {}): ViteUserConfig {
  return defineConfig({
    resolve: { conditions: ['source', ...defaultClientConditions] },
    ssr: { resolve: { conditions: ['source', ...defaultServerConditions], externalConditions: ['source'] } },
    test: {
      environment: 'node',
      include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
      testTimeout: 30_000,
      hookTimeout: 60_000,
      fileParallelism: false,
      ...overrides,
    },
  });
}
