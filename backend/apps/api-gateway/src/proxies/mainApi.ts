import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Request } from 'express';
import { createProxyMiddleware, type RequestHandler as ProxyHandler } from 'http-proxy-middleware';
import type { Logger } from '@sombill/logger';
import { jsonError } from '../middleware/errors.js';

export interface MainApiProxyOptions {
  target: string;
  timeoutMs: number;
  logger: Logger;
}

/** Reverse proxy to the main API. Strips `/api/v1` and forwards the gateway's trusted client address and request id. */
export function mainApiProxy(opts: MainApiProxyOptions): ProxyHandler<IncomingMessage & Request, ServerResponse> {
  return createProxyMiddleware<IncomingMessage & Request, ServerResponse>({
    target: opts.target,
    changeOrigin: true,
    xfwd: false,
    proxyTimeout: opts.timeoutMs,
    timeout: opts.timeoutMs,
    pathRewrite: (path) => path.replace(/^\/api\/v1/, ''),
    on: {
      proxyReq: (proxyReq, req) => {
        // The gateway is the only trusted source of client address and request id for the main API.
        proxyReq.setHeader('x-request-id', String(req.id));
        proxyReq.setHeader('x-forwarded-for', req.ip ?? '');
        proxyReq.setHeader('x-forwarded-proto', req.protocol);
        proxyReq.setHeader('x-forwarded-host', req.get('host') ?? '');
      },
      error: (err, req, res) => {
        opts.logger.error({ err, service: 'main-api', path: (req as Request).originalUrl }, 'upstream error');
        const code = (err as NodeJS.ErrnoException).code;
        const timedOut = code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'ESOCKETTIMEDOUT';
        if ('writeHead' in res) {
          jsonError(
            res as ServerResponse,
            timedOut ? 504 : 502,
            timedOut ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_UNAVAILABLE',
            'The service is temporarily unavailable. Please try again.',
            String((req as Request).id),
          );
        }
      },
    },
  });
}
