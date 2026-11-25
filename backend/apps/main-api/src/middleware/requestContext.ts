import type { Request } from 'express';

/** Who made the request and from where; written to audit logs and used as the event correlation id. */
export interface RequestContext {
  ipAddress: string | null;
  userAgent: string | null;
  requestId?: string;
}

export const requestContext = (req: Request): RequestContext => ({
  ipAddress: req.ip ?? null,
  userAgent: req.get('user-agent')?.slice(0, 500) ?? null,
  requestId: String(req.id),
});

/** Options for `createEvent` derived from a request context. */
export const eventSource = (source: string, ctx: RequestContext) => ({
  source,
  ...(ctx.requestId ? { correlationId: ctx.requestId } : {}),
});
