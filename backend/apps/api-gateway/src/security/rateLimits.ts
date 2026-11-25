import type { Express } from 'express';
import type { Redis } from 'ioredis';
import { redisRateLimiter } from '@sombill/cache';
import type { GatewayConfig } from '../config/env.js';
import { API_PREFIX, CREDENTIAL_ENDPOINTS } from '../routes/routeTable.js';

export const apiPath = (path: string): string | null =>
  path.startsWith(API_PREFIX) ? path.slice(API_PREFIX.length) : null;

/** Redis-backed limits shared by every gateway instance: credentials, token refresh and a global per-client cap. */
export function mountRateLimits(app: Express, redis: Redis, config: GatewayConfig): void {
  app.use(
    redisRateLimiter({
      redis,
      name: 'credentials',
      windowSeconds: config.AUTH_RATE_LIMIT_WINDOW_SECONDS,
      max: config.AUTH_RATE_LIMIT_MAX,
      appliesTo: (method, path) => CREDENTIAL_ENDPOINTS.has(`${method} ${apiPath(path)}`),
    }),
  );
  app.use(
    redisRateLimiter({
      redis,
      name: 'refresh',
      windowSeconds: config.AUTH_RATE_LIMIT_WINDOW_SECONDS,
      max: config.REFRESH_RATE_LIMIT_MAX,
      appliesTo: (method, path) => `${method} ${apiPath(path)}` === 'POST /auth/refresh',
    }),
  );
  app.use(
    redisRateLimiter({
      redis,
      name: 'global',
      windowSeconds: config.RATE_LIMIT_WINDOW_SECONDS,
      max: config.RATE_LIMIT_MAX,
      appliesTo: (_m, path) => path.startsWith(`${API_PREFIX}/`),
    }),
  );
}
