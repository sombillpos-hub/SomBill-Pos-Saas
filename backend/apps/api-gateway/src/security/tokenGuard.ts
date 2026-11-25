import type { RequestHandler } from 'express';
import { bearerToken, type AccessTokenVerifier } from '@sombill/authentication';
import { jsonError } from '../middleware/errors.js';
import { isOpenRoute } from '../routes/routeTable.js';

/**
 * Early JWT check: unauthenticated traffic never reaches protected main API modules (which still verify every token).
 * Public endpoints (login, register, refresh, logout, website leads, payment webhooks, and open dev hospitality routes)
 * pass through cleanly.
 */
export function tokenGuard(
  verify: AccessTokenVerifier,
  pathOf: (reqPath: string) => string | null,
  enforceHospitalityAuth = false,
): RequestHandler {
  return async (req, res, next) => {
    const path = pathOf(req.path);
    if (path === null || isOpenRoute(req.method, path, enforceHospitalityAuth)) return next();
    const token = bearerToken(req.headers.authorization);
    if (!token) return jsonError(res, 401, 'TOKEN_MISSING', 'Authentication required.', String(req.id));
    try {
      await verify(token);
    } catch (e) {
      const code = (e as { code?: string }).code ?? 'TOKEN_INVALID';
      return jsonError(res, 401, code, (e as Error).message, String(req.id));
    }
    return next();
  };
}
