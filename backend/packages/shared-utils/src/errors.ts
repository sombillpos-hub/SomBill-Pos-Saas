import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import type { ApiErrorBody } from '@sombill/shared-types';
import type { Logger } from '@sombill/logger';

/** An expected, client-facing error. Anything else becomes a generic 500 with no internal details. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (message: string, details?: unknown) => new AppError(400, 'BAD_REQUEST', message, details);
export const unauthorized = (message = 'Authentication required.', code = 'UNAUTHORIZED') =>
  new AppError(401, code, message);
export const forbidden = (message = 'You do not have permission to perform this action.') =>
  new AppError(403, 'FORBIDDEN', message);
export const notFound = (what = 'Resource') => new AppError(404, 'NOT_FOUND', `${what} not found.`);
export const conflict = (message: string, code = 'CONFLICT') => new AppError(409, code, message);

interface PrismaLikeError {
  code: string;
  meta?: { target?: unknown; modelName?: string };
}

function isPrismaKnownError(e: unknown): e is PrismaLikeError & Error {
  return (
    e instanceof Error &&
    e.name === 'PrismaClientKnownRequestError' &&
    typeof (e as unknown as PrismaLikeError).code === 'string'
  );
}

/** Maps any thrown value to `{ status, body }` without leaking internals. */
export function toErrorResponse(err: unknown, requestId?: string): { status: number; body: ApiErrorBody } {
  const wrap = (status: number, code: string, message: string, details?: unknown) => ({
    status,
    body: {
      error: { code, message, ...(details === undefined ? {} : { details }), ...(requestId ? { requestId } : {}) },
    },
  });

  if (err instanceof AppError) return wrap(err.status, err.code, err.message, err.details);
  if (err instanceof ZodError) {
    return wrap(
      400,
      'VALIDATION_ERROR',
      'The request is invalid.',
      err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  }
  if (isPrismaKnownError(err)) {
    if (err.code === 'P2002') return wrap(409, 'CONFLICT', 'A record with these values already exists.');
    if (err.code === 'P2025') return wrap(404, 'NOT_FOUND', 'Resource not found.');
    if (err.code === 'P2003') return wrap(409, 'CONFLICT', 'The operation conflicts with related records.');
  }
  // Malformed JSON bodies (body-parser)
  if (err instanceof SyntaxError && 'status' in err && (err as { status?: number }).status === 400) {
    return wrap(400, 'BAD_REQUEST', 'Malformed JSON body.');
  }
  if (err instanceof Error && 'type' in err && (err as { type?: string }).type === 'entity.too.large') {
    return wrap(413, 'PAYLOAD_TOO_LARGE', 'The request body is too large.');
  }
  return wrap(500, 'INTERNAL_ERROR', 'An unexpected error occurred.');
}

export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (err, req, res, _next) => {
    const { status, body } = toErrorResponse(err, req.id === undefined ? undefined : String(req.id));
    if (status >= 500) logger.error({ err, requestId: req.id, path: req.path }, 'unhandled error');
    res.status(status).json(body);
  };
}

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new AppError(404, 'ROUTE_NOT_FOUND', `No route for ${req.method} ${req.path}.`));
};
