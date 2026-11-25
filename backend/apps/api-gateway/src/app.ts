import type { IncomingMessage, ServerResponse } from 'node:http';
import express, { type Express, type Request, type RequestHandler } from 'express';
import helmet from 'helmet';
import type { Redis } from 'ioredis';
import type { AccessTokenVerifier } from '@sombill/authentication';
import type { Logger } from '@sombill/logger';
import { errorHandler, notFoundHandler, requestId } from '@sombill/shared-utils';
import type { GatewayConfig } from './config/env.js';
import { apiVersionHeader } from './middleware/apiVersion.js';
import { mountHealth } from './middleware/health.js';
import { requestLogger } from './middleware/requestLogger.js';
import { mountDocs, mainApiProxy } from './proxies/index.js';
import { matchRoute } from './routes/routeTable.js';
import { apiPath, corsPolicy, mountRateLimits, tokenGuard } from './security/index.js';

export interface GatewayDeps {
  config: GatewayConfig;
  logger: Logger;
  redis: Redis;
  verify: AccessTokenVerifier;
}

export function buildGateway(deps: GatewayDeps): Express {
  const { config, logger, redis } = deps;

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.TRUST_PROXY_HOPS);
  app.use(requestId);
  app.use(requestLogger(logger));
  app.use(corsPolicy(config.CORS_ORIGINS));
  app.use(apiVersionHeader);

  if (config.DOCS_ENABLED) mountDocs(app, config.MAIN_API_URL);
  app.use(helmet());
  mountHealth(app, { serviceName: config.SERVICE_NAME, redis, upstreams: { 'main-api': config.MAIN_API_URL } });
  mountRateLimits(app, redis, config);

  const proxy = mainApiProxy({ target: config.MAIN_API_URL, timeoutMs: config.UPSTREAM_TIMEOUT_MS, logger });
  const guard = tokenGuard(
    deps.verify,
    (p) => {
      const path = apiPath(p);
      return path !== null && matchRoute(path) ? path : null;
    },
    config.AUTH_ENFORCE_HOSPITALITY,
  );
  const forward: RequestHandler = (req, res, next) => {
    const path = apiPath(req.path);
    if (path === null || !matchRoute(path)) return next();
    return proxy(req as IncomingMessage & Request, res as unknown as ServerResponse, next);
  };
  app.use(guard, forward);

  app.use(notFoundHandler);
  app.use(errorHandler(logger));
  return app;
}
