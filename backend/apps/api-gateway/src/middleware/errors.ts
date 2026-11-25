import type { ServerResponse } from 'node:http';

/** Writes a JSON error in the same shape as every other SomBill error response. */
export const jsonError = (res: ServerResponse, status: number, code: string, message: string, reqId?: string): void => {
  if (res.headersSent) return;
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: { code, message, ...(reqId ? { requestId: reqId } : {}) } }));
};
