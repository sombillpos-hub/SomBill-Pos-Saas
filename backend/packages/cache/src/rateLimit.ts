import type { RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { Redis } from 'ioredis';
import { RedisStore, type RedisReply } from 'rate-limit-redis';

export interface LimiterOptions {
  redis: Redis;
  name: string;
  windowSeconds: number;
  max: number;
  /** Only count requests this predicate selects. */
  appliesTo?: (method: string, path: string) => boolean;
}

/**
 * Rate limiter backed by Redis, so the limit holds across every gateway instance.
 * Clients over the limit get 429 with the standard error body and `RateLimit-*` headers.
 */
export function redisRateLimiter(opts: LimiterOptions): RequestHandler {
  return rateLimit({
    windowMs: opts.windowSeconds * 1000,
    limit: opts.max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: (req) => (opts.appliesTo ? !opts.appliesTo(req.method, req.path) : false),
    store: new RedisStore({
      prefix: `rl:${opts.name}:`,
      sendCommand: (command: string, ...args: string[]) => opts.redis.call(command, ...args) as Promise<RedisReply>,
    }),
    handler: (req, res, _next, options) => {
      res.status(options.statusCode).json({
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please slow down and try again shortly.',
          requestId: String((req as { id?: unknown }).id),
        },
      });
    },
  });
}
