import type { RequestHandler } from 'express';
import { pinoHttp } from 'pino-http';
import type { Logger } from '@sombill/logger';

/** Structured request logs correlated by request id; health probes are not logged. */
export function requestLogger(logger: Logger): RequestHandler {
  return pinoHttp({
    logger,
    genReqId: (req) => req.id ?? '',
    autoLogging: { ignore: (req) => req.url?.startsWith('/health') ?? false },
  });
}
