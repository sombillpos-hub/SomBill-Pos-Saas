import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Express } from 'express';
import { decodeJwt } from 'jose';
import { Redis } from 'ioredis';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createGatewayRuntime, type GatewayRuntime } from '@sombill/api-gateway/runtime';
import { createMainApiRuntime, type MainApiRuntime } from '@sombill/main-api/runtime';
import {
  createTestDatabase,
  generateJwtKeyPair,
  silentLogger,
  testInfra,
  uniqueName,
  waitFor,
  type TestDatabase,
} from '@sombill/testing';

/**
 * The real platform, wired as in production: browser → API Gateway → Main API (identity + organization modules), with events flowing
 * over RabbitMQ through each service's transactional outbox, Redis-backed rate limits, and a database per module.
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const migrations = (svc: string) => path.join(root, '../database/prisma/migrations', svc);
const PASSWORD = 'correct-horse-battery-staple';
const ORIGIN = 'https://app.sombill.test';

let identityDb: TestDatabase;
let organizationDb: TestDatabase;
let mainApi: MainApiRuntime;
let gateway: GatewayRuntime;
const servers: Server[] = [];
let api: Express;

const listen = (app: Express) =>
  new Promise<string>((resolve) => {
    const s = app.listen(0);
    servers.push(s);
    s.on('listening', () => resolve(`http://127.0.0.1:${(s.address() as AddressInfo).port}`));
  });

const redisUrl = `${testInfra.redisUrl}/9`;

beforeAll(async () => {
  const keys = generateJwtKeyPair();
  const exchange = uniqueName('e2e.events');
  const shared = {
    LOG_LEVEL: 'silent',
    RABBITMQ_URL: testInfra.rabbitmqUrl,
    RABBITMQ_EXCHANGE: exchange,
    JWT_PUBLIC_KEY: Buffer.from(keys.publicKeyPem).toString('base64'),
    OUTBOX_INTERVAL_MS: '50',
  };
  identityDb = await createTestDatabase(migrations('identity'), 'e2e_identity');
  organizationDb = await createTestDatabase(migrations('organization'), 'e2e_organization');
  mainApi = await createMainApiRuntime(
    {
      ...shared,
      IDENTITY_DATABASE_URL: identityDb.url,
      ORGANIZATION_DATABASE_URL: organizationDb.url,
      JWT_PRIVATE_KEY: Buffer.from(keys.privateKeyPem).toString('base64'),
      RABBITMQ_QUEUE: uniqueName('main-api.e2e'),
    },
    silentLogger,
  );
  const mainApiUrl = await listen(mainApi.app);

  const redis = new Redis(redisUrl);
  await redis.flushdb();
  await redis.quit();
  gateway = await createGatewayRuntime(
    {
      ...shared,
      REDIS_URL: redisUrl,
      MAIN_API_URL: mainApiUrl,
      CORS_ORIGINS: ORIGIN,
      AUTH_RATE_LIMIT_MAX: '8',
    },
    silentLogger,
  );
  api = gateway.app;
});

afterAll(async () => {
  for (const s of servers) await new Promise((r) => s.close(r));
  await gateway?.stop();
  await mainApi?.stop();
  await identityDb?.drop();
  await organizationDb?.drop();
});

/** Each simulated client gets its own IP, so rate-limit buckets do not interfere between tests. */
let ipCounter = 10;
const client = () => `203.0.113.${ipCounter++}`;

function cookieOf(res: request.Response): string {
  const c = (res.headers['set-cookie'] as unknown as string[]).find((v) => v.startsWith('sombill_rt='))!;
  return c.split(';')[0]!;
}

async function signUp(email: string, ip = client()) {
  const res = await request(api)
    .post('/api/v1/auth/register')
    .set('X-Forwarded-For', ip)
    .send({ email, password: PASSWORD, fullName: email.split('@')[0] });
  expect(res.status).toBe(201);
  return {
    token: res.body.data.accessToken as string,
    cookie: cookieOf(res),
    userId: res.body.data.user.id as string,
    ip,
  };
}

/** Refreshes until the access token lists a membership for `organizationId` (event round trip). */
async function refreshUntilMember(session: { cookie: string; ip: string }, organizationId: string) {
  return waitFor(
    async () => {
      const r = await request(api)
        .post('/api/v1/auth/refresh')
        .set('X-Forwarded-For', session.ip)
        .set('Cookie', session.cookie);
      expect(r.status).toBe(200);
      session.cookie = cookieOf(r);
      const claims = decodeJwt(r.body.data.accessToken) as { memberships: Array<{ organizationId: string }> };
      return claims.memberships.some((m) => m.organizationId === organizationId)
        ? (r.body.data.accessToken as string)
        : undefined;
    },
    15_000,
    100,
  );
}

describe('restaurant onboarding across services', () => {
  it('register → create organization → owner via event → branch → staff role → branch-scoped access', async () => {
    const owner = await signUp('owner@grill.so');
    const created = await request(api)
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Hargeisa Grill', country: 'SO', currency: 'USD', timezone: 'Africa/Mogadishu' });
    expect(created.status).toBe(201);
    const orgId = created.body.data.id as string;

    // organization.created → RabbitMQ → identity grants owner → refreshed token carries it.
    const ownerToken = await refreshUntilMember(owner, orgId);
    const auth = { Authorization: `Bearer ${ownerToken}` };

    const branch = await request(api)
      .post(`/api/v1/organizations/${orgId}/branches`)
      .set(auth)
      .send({ code: 'HRG-01', name: 'Hargeisa Main' });
    expect(branch.status).toBe(201);
    const other = await request(api)
      .post(`/api/v1/organizations/${orgId}/branches`)
      .set(auth)
      .send({ code: 'BER-01', name: 'Berbera Port' });
    expect(other.status).toBe(201);
    const branchId = branch.body.data.id as string;

    // branch.created → identity records the branch, so a branch-scoped role can be granted.
    const cashier = await signUp('cashier@grill.so');
    const assigned = await waitFor(async () => {
      const r = await request(api)
        .post('/api/v1/users/memberships')
        .set(auth)
        .send({ organizationId: orgId, branchId, email: 'cashier@grill.so', role: 'cashier' });
      return r.status === 404 ? undefined : r;
    });
    expect(assigned.status).toBe(201);

    const cashierToken = await refreshUntilMember(cashier, orgId);
    const visible = await request(api)
      .get(`/api/v1/organizations/${orgId}/branches`)
      .set('Authorization', `Bearer ${cashierToken}`);
    expect(visible.body.data.map((b: { code: string }) => b.code)).toEqual(['HRG-01']);
    expect(
      (await request(api).get(`/api/v1/branches/${other.body.data.id}`).set('Authorization', `Bearer ${cashierToken}`))
        .status,
    ).toBe(403);
    expect(
      (
        await request(api)
          .patch(`/api/v1/organizations/${orgId}`)
          .set('Authorization', `Bearer ${cashierToken}`)
          .send({ name: 'Hacked' })
      ).status,
    ).toBe(403);

    // A stranger cannot see the organization at all.
    const stranger = await signUp('stranger@else.so');
    expect(
      (await request(api).get(`/api/v1/organizations/${orgId}`).set('Authorization', `Bearer ${stranger.token}`))
        .status,
    ).toBe(403);
    const mine = await request(api).get('/api/v1/organizations').set('Authorization', `Bearer ${stranger.token}`);
    expect(mine.body.data).toEqual([]);

    // Owner sees the staff list (identity) and the audit trail exists on both sides.
    const staff = await request(api).get('/api/v1/users').query({ organizationId: orgId }).set(auth);
    expect(staff.body.data.map((u: { email: string }) => u.email).sort()).toEqual([
      'cashier@grill.so',
      'owner@grill.so',
    ]);
    expect(await mainApi.identityDb.auditLog.count({ where: { organizationId: orgId } })).toBeGreaterThanOrEqual(2);
    expect(await mainApi.organizationDb.auditLog.count({ where: { organizationId: orgId } })).toBe(3);
  });
});

describe('gateway', () => {
  it('rejects unauthenticated and forged requests before they reach a service', async () => {
    const missing = await request(api).get('/api/v1/organizations');
    expect(missing.status).toBe(401);
    expect(missing.body.error.code).toBe('TOKEN_MISSING');
    const forged = await request(api).get('/api/v1/organizations').set('Authorization', 'Bearer abc.def.ghi');
    expect(forged.body.error.code).toBe('TOKEN_INVALID');
  });

  it('sets security headers, propagates request ids and returns JSON 404s', async () => {
    const res = await request(api).get('/api/v1/nope').set('X-Request-Id', 'trace-123');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatchObject({ code: 'ROUTE_NOT_FOUND', requestId: 'trace-123' });
    expect(res.headers['x-request-id']).toBe('trace-123');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['strict-transport-security']).toBeDefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('allows CORS with credentials only for configured origins', async () => {
    const ok = await request(api)
      .options('/api/v1/auth/login')
      .set('Origin', ORIGIN)
      .set('Access-Control-Request-Method', 'POST');
    expect(ok.headers['access-control-allow-origin']).toBe(ORIGIN);
    expect(ok.headers['access-control-allow-credentials']).toBe('true');
    const evil = await request(api)
      .options('/api/v1/auth/login')
      .set('Origin', 'https://evil.example')
      .set('Access-Control-Request-Method', 'POST');
    expect(evil.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('rate-limits credential endpoints per client (Redis)', async () => {
    const ip = client();
    const statuses: number[] = [];
    for (let i = 0; i < 10; i++) {
      const r = await request(api)
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', ip)
        .send({ email: 'brute@force.so', password: 'guess-guess-guess' });
      statuses.push(r.status);
      if (r.status === 429) expect(r.body.error.code).toBe('RATE_LIMITED');
    }
    expect(statuses.slice(0, 8).every((s) => s === 401)).toBe(true);
    expect(statuses.slice(8)).toEqual([429, 429]);
    // Another client is unaffected.
    expect(
      (
        await request(api)
          .post('/api/v1/auth/login')
          .set('X-Forwarded-For', client())
          .send({ email: 'brute@force.so', password: 'x' })
      ).status,
    ).toBe(401);
  });

  it('serves aggregated OpenAPI docs', async () => {
    const spec = await request(api).get('/api/docs/identity.json');
    expect(spec.status).toBe(200);
    expect(spec.body.openapi).toBe('3.1.0');
    expect(Object.keys(spec.body.paths)).toEqual(
      expect.arrayContaining(['/auth/login', '/auth/refresh', '/users/memberships']),
    );
    const org = await request(api).get('/api/docs/organization.json');
    expect(Object.keys(org.body.paths)).toEqual(
      expect.arrayContaining(['/organizations', '/organizations/{organizationId}/branches']),
    );
    const ui = await request(api).get('/api/docs/');
    expect(ui.status).toBe(200);
    expect(ui.text).toContain('swagger-ui');
  });

  it('reports readiness of Redis and the main API', async () => {
    const r = await request(api).get('/health/ready');
    expect(r.status).toBe(200);
    expect(r.body.checks.map((c: { name: string; ok: boolean }) => `${c.name}:${c.ok}`).sort()).toEqual([
      'main-api:true',
      'redis:true',
    ]);
  });

  it('answers 502 with a JSON error when the main API is down', async () => {
    const down = await createGatewayRuntime(
      {
        LOG_LEVEL: 'silent',
        REDIS_URL: redisUrl,
        JWT_PUBLIC_KEY: mainApi.config.JWT_PUBLIC_KEY,
        MAIN_API_URL: 'http://127.0.0.1:9',
      },
      silentLogger,
    );
    const r = await request(down.app)
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', client())
      .send({ email: 'a@b.so', password: 'x' });
    expect(r.status).toBe(502);
    expect(r.body.error.code).toBe('UPSTREAM_UNAVAILABLE');
    await down.stop();
  });
});
