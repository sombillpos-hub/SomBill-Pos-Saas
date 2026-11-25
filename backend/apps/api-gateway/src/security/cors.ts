import cors from 'cors';
import type { RequestHandler } from 'express';

/** Browser allow-list (dashboards and website). Requests without an Origin header (server-to-server) pass. */
export function corsPolicy(allowedOrigins: string[]): RequestHandler {
  return cors({
    origin: (origin, cb) => cb(null, !origin || allowedOrigins.includes(origin)),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key', 'X-Request-Id', 'X-Token-Transport'],
    exposedHeaders: ['X-Request-Id', 'RateLimit', 'RateLimit-Policy', 'Retry-After', 'API-Version'],
    maxAge: 600,
  });
}
