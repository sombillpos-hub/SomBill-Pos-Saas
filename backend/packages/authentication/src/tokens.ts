import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { importPKCS8, SignJWT, type CryptoKey, type KeyObject } from 'jose';
import type { AccessTokenClaims } from '@sombill/shared-types';
import { JWT_ALGORITHM } from './jwt.js';

export interface TokenIssuerOptions {
  privateKeyPem: string;
  issuer: string;
  audience: string;
  accessTokenTtlSeconds: number;
}

/** Signs RS256 access tokens. Only the identity service holds the private key. */
export class TokenIssuer {
  private constructor(
    private readonly key: CryptoKey | KeyObject,
    private readonly opts: TokenIssuerOptions,
  ) {}

  static async create(opts: TokenIssuerOptions): Promise<TokenIssuer> {
    return new TokenIssuer(await importPKCS8(opts.privateKeyPem, JWT_ALGORITHM), opts);
  }

  get accessTokenTtlSeconds(): number {
    return this.opts.accessTokenTtlSeconds;
  }

  signAccessToken(claims: AccessTokenClaims): Promise<string> {
    const { sub, ...rest } = claims;
    return new SignJWT({ ...rest })
      .setProtectedHeader({ alg: JWT_ALGORITHM, typ: 'JWT' })
      .setSubject(sub)
      .setIssuer(this.opts.issuer)
      .setAudience(this.opts.audience)
      .setIssuedAt()
      .setJti(randomUUID())
      .setExpirationTime(`${this.opts.accessTokenTtlSeconds}s`)
      .sign(this.key);
  }
}

/** 256-bit random refresh token (base64url). Only its hash is stored. */
export function newRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
