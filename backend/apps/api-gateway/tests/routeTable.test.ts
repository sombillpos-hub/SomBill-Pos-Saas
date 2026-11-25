import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config/env.js';
import { CREDENTIAL_ENDPOINTS, matchRoute, PUBLIC_ENDPOINTS } from '../src/routes/routeTable.js';

describe('route table', () => {
  it('maps API prefixes to the owning service', () => {
    expect(matchRoute('/auth/login')?.service).toBe('identity');
    expect(matchRoute('/users/memberships/123')?.service).toBe('identity');
    expect(matchRoute('/organizations')?.service).toBe('organization');
    expect(matchRoute('/branches/abc/settings')?.service).toBe('organization');
    expect(matchRoute('/orders/123')?.service).toBe('hospitality');
    expect(matchRoute('/payments')?.service).toBe('hospitality');
    expect(matchRoute('/public/demo-requests')?.service).toBe('public');
    expect(matchRoute('/webhooks/payments/zaad')?.service).toBe('public');
    expect(matchRoute('/realtime/stream')?.service).toBe('public');
  });

  it('does not match look-alike prefixes or unknown paths', () => {
    expect(matchRoute('/authx/login')).toBeUndefined();
    expect(matchRoute('/organizationsX')).toBeUndefined();
    expect(matchRoute('/unknown-service')).toBeUndefined();
  });

  it('keeps the public surface minimal and rate-limits credential endpoints', () => {
    expect([...PUBLIC_ENDPOINTS].sort()).toEqual([
      'POST /auth/login',
      'POST /auth/logout',
      'POST /auth/refresh',
      'POST /auth/register',
    ]);
    expect(CREDENTIAL_ENDPOINTS.has('POST /auth/login')).toBe(true);
    expect(CREDENTIAL_ENDPOINTS.has('GET /organizations')).toBe(false);
  });
});

describe('gateway config', () => {
  it('requires upstream URLs, Redis and the public key; applies safe defaults', () => {
    expect(() => loadConfig({})).toThrow(/MAIN_API_URL/);
    const c = loadConfig({
      REDIS_URL: 'redis://localhost:6379',
      JWT_PUBLIC_KEY: '-----BEGIN PUBLIC KEY-----\nX\n-----END PUBLIC KEY-----',
      MAIN_API_URL: 'http://main-api:4001',
    });
    expect(c).toMatchObject({
      PORT: 4000,
      AUTH_RATE_LIMIT_MAX: 10,
      RATE_LIMIT_MAX: 300,
      TRUST_PROXY_HOPS: 1,
      CORS_ORIGINS: [],
    });
  });
});
