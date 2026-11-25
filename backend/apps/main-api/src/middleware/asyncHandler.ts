import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Express 5 already forwards rejected promises to the error handler; this wrapper only gives controller methods a
 * typed signature and keeps `this` bound.
 */
export const handler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void> | void): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);
