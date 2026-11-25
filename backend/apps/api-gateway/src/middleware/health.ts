import type { Express } from 'express';
import type { Redis } from 'ioredis';

export interface HealthOptions {
  serviceName: string;
  redis: Redis;
  /** Upstream name → base URL; each is probed on `/health/ready`. */
  upstreams: Record<string, string>;
}

/** `/health/live` (process is up) and `/health/ready` (Redis and every upstream answer). */
export function mountHealth(app: Express, opts: HealthOptions): void {
  app.get('/health/live', (_req, res) => void res.json({ status: 'ok', service: opts.serviceName }));
  app.get('/health/ready', async (_req, res) => {
    const check = async (name: string, fn: () => Promise<unknown>) => {
      try {
        await fn();
        return { name, ok: true };
      } catch {
        return { name, ok: false };
      }
    };
    const checks = await Promise.all([
      check('redis', () => opts.redis.ping()),
      ...Object.entries(opts.upstreams).map(([name, url]) =>
        check(name, async () => {
          const r = await fetch(new URL('/health/ready', url), { signal: AbortSignal.timeout(3000) });
          if (!r.ok) throw new Error(String(r.status));
        }),
      ),
    ]);
    const ready = checks.every((c) => c.ok);
    res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'not_ready', service: opts.serviceName, checks });
  });
}
