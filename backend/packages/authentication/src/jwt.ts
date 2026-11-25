import type { RequestHandler } from 'express';
import { errors as joseErrors, importSPKI, jwtVerify, type CryptoKey, type KeyObject } from 'jose';
import type { AccessTokenClaims, Principal } from '@sombill/shared-types';
import { AppError, unauthorized } from '@sombill/shared-utils';

export const JWT_ALGORITHM = 'RS256';

export interface JwtVerifierOptions {
  publicKeyPem: string;
  issuer: string;
  audience: string;
}

export type AccessTokenVerifier = (token: string) => Promise<Principal>;

/**
 * Verifies RS256 access tokens issued by the identity service. Only the public key is needed, so services and the
 * gateway can verify tokens without being able to mint them.
 */
export async function createAccessTokenVerifier(opts: JwtVerifierOptions): Promise<AccessTokenVerifier> {
  const key: CryptoKey | KeyObject = await importSPKI(opts.publicKeyPem, JWT_ALGORITHM);
  return async (token) => {
    try {
      const { payload } = await jwtVerify(token, key, {
        algorithms: [JWT_ALGORITHM],
        issuer: opts.issuer,
        audience: opts.audience,
        requiredClaims: ['sub', 'exp', 'iat'],
      });
      const claims = payload as unknown as AccessTokenClaims;
      if (typeof claims.sid !== 'string' || !Array.isArray(claims.memberships)) {
        throw unauthorized('The access token is invalid.', 'TOKEN_INVALID');
      }
      return { userId: claims.sub, sessionId: claims.sid, email: claims.email, memberships: claims.memberships };
    } catch (e) {
      if (e instanceof AppError) throw e;
      if (e instanceof joseErrors.JWTExpired) throw unauthorized('The access token has expired.', 'TOKEN_EXPIRED');
      throw unauthorized('The access token is invalid.', 'TOKEN_INVALID');
    }
  };
}

export function bearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}

/** Requires a valid access token and attaches `req.principal`. */
export function authenticate(verify: AccessTokenVerifier): RequestHandler {
  return async (req, _res, next) => {
    const token = bearerToken(req.headers.authorization);
    if (!token) return next(unauthorized('Authentication required.', 'TOKEN_MISSING'));
    try {
      req.principal = await verify(token);
      next();
    } catch (e) {
      next(e);
    }
  };
}

export function requirePrincipal(req: Express.Request): Principal {
  if (!req.principal) throw unauthorized();
  return req.principal;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Set by `authenticate` after the access token is verified. */
      principal?: Principal;
    }
  }
}
