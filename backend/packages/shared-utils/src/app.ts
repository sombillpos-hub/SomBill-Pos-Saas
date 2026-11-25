import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express, type RequestHandler } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { errorHandler, notFoundHandler } from './errors.js';
import type { Logger } from '@sombill/logger';

const REQUEST_ID = /^[A-Za-z0-9._-]{1,128}$/;

/** Reuses a safe incoming X-Request-Id (set by the gateway) or creates one, and echoes it back. */
export const requestId: RequestHandler = (req, res, next) => {
  const incoming = req.header('x-request-id');
  req.id = incoming && REQUEST_ID.test(incoming) ? incoming : randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
};

export interface ReadinessCheck {
  name: string;
  check: () => Promise<void>;
}

export interface ServiceAppOptions {
  serviceName: string;
  logger: Logger;
  /** Allowed browser origins. Services behind the gateway usually leave this empty. */
  corsOrigins?: string[];
  /** Number of trusted reverse-proxy hops (Nginx → gateway → service). */
  trustProxy?: number | boolean;
  readiness?: ReadinessCheck[];
  jsonLimit?: string;
}

/**
 * Standard Express app for a SomBill service: security headers, CORS allow-list, JSON body limit, cookies,
 * request ids, structured request logs and health endpoints. Call `finalizeApp` after mounting routes.
 */
export function createServiceApp(opts: ServiceAppOptions): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', opts.trustProxy ?? 1);
  app.use(requestId);
  app.use(helmet());
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || (opts.corsOrigins ?? []).includes(origin)),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key', 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id'],
      maxAge: 600,
    }),
  );
  app.use(express.json({ limit: opts.jsonLimit ?? '100kb' }));
  app.use(cookieParser());
  app.use(
    pinoHttp({
      logger: opts.logger,
      genReqId: (req) => req.id ?? randomUUID(),
      autoLogging: { ignore: (req) => req.url?.startsWith('/health') ?? false },
    }),
  );

  app.get('/health/live', (_req, res) => {
    res.json({ status: 'ok', service: opts.serviceName });
  });
  app.get('/health/ready', async (_req, res) => {
    const results = await Promise.all(
      (opts.readiness ?? []).map(async (r) => {
        try {
          await r.check();
          return { name: r.name, ok: true };
        } catch {
          return { name: r.name, ok: false };
        }
      }),
    );
    const ready = results.every((r) => r.ok);
    res
      .status(ready ? 200 : 503)
      .json({ status: ready ? 'ready' : 'not_ready', service: opts.serviceName, checks: results });
  });
  return app;
}

export function finalizeApp(app: Express, logger: Logger): Express {
  app.use(notFoundHandler);
  app.use(errorHandler(logger));
  return app;
}

/** Starts listening and wires graceful shutdown (SIGTERM/SIGINT): stop accepting, run hooks, exit. */
export function startHttpServer(
  app: Express,
  port: number,
  logger: Logger,
  onShutdown: Array<() => Promise<void>> = [],
): Server {
  const server = app.listen(port, () => logger.info({ port }, 'listening'));
  let stopping = false;
  const shutdown = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    logger.info({ signal }, 'shutting down');
    server.close();
    for (const hook of onShutdown) {
      try {
        await hook();
      } catch (err) {
        logger.error({ err }, 'shutdown hook failed');
      }
    }
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  return server;
}
