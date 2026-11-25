import type { Response } from 'express';
import type { ApiPage, ApiSuccess } from '@sombill/shared-types';
import { pageMeta, type PaginationQuery } from './pagination.js';

/**
 * SomBill response standard (every endpoint):
 *   success  -> { "data": <resource or array> }                     200 / 201
 *   list     -> { "data": [...], "meta": { page, pageSize, total, totalPages } }   200
 *   no body  -> 204
 *   error    -> { "error": { code, message, details?, requestId } } 4xx / 5xx (see errors.ts)
 */
export function sendOk<T>(res: Response, data: T, status = 200): void {
  const body: ApiSuccess<T> = { data };
  res.status(status).json(body);
}

export function sendCreated<T>(res: Response, data: T, location?: string): void {
  if (location) res.location(location);
  sendOk(res, data, 201);
}

export function sendNoContent(res: Response): void {
  res.status(204).end();
}

export function sendPage<T>(res: Response, items: T[], query: PaginationQuery, total: number): void {
  const body: ApiPage<T> = { data: items, meta: pageMeta(query, total) };
  res.status(200).json(body);
}
