import type { RequestHandler } from 'express';
import { z } from 'zod';

export interface ValidationSchemas {
  body?: z.ZodType;
  query?: z.ZodType;
  params?: z.ZodType;
}

/**
 * Validates and coerces body, query and params with Zod. Parsed values are exposed on `req.valid`
 * (Express 5 makes `req.query` read-only), and unknown keys are stripped by the schemas.
 */
export function validate(schemas: ValidationSchemas): RequestHandler {
  return (req, _res, next) => {
    req.valid = {
      body: schemas.body ? schemas.body.parse(req.body ?? {}) : undefined,
      query: schemas.query ? schemas.query.parse(req.query) : undefined,
      params: schemas.params ? schemas.params.parse(req.params) : undefined,
    };
    next();
  };
}

/** Typed access to validated input inside a handler. */
export function input<B = unknown, Q = unknown, P = unknown>(req: Express.Request): { body: B; query: Q; params: P } {
  const v = req.valid ?? {};
  return { body: v.body as B, query: v.query as Q, params: v.params as P };
}

export const uuidParam = (name: string) => z.object({ [name]: z.uuid() });

/** ISO 4217 currency code. */
export const currencyCode = z.string().regex(/^[A-Z]{3}$/, 'must be a 3-letter ISO 4217 currency code');

/** IANA time zone (validated with Intl). */
export const timeZone = z.string().refine((tz) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}, 'must be a valid IANA time zone');

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Set by `validate`. */
      valid?: { body?: unknown; query?: unknown; params?: unknown };
    }
  }
}
