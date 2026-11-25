import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Express } from 'express';
import { importPKCS8, SignJWT } from 'jose';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { OutboxRelay, RabbitEventBus, type EventEnvelope } from '@sombill/messaging';
import { SYSTEM_ROLE_PERMISSIONS, type MembershipClaim, type SystemRole } from '@sombill/shared-types';
import { createAccessTokenVerifier } from '@sombill/authentication';
import {
  createTestDatabase,
  generateJwtKeyPair,
  silentLogger,
  testInfra,
  uniqueName,
  waitFor,
  type TestDatabase,
} from '@sombill/testing';
import { buildOrganizationApp } from '../../src/app.js';
import { loadConfig } from '../../src/config/env.js';
import { createDb, type Db } from '@sombill/database/organization';

const migrations = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../../database/prisma/migrations/organization',
);
const keys = generateJwtKeyPair();
let database: TestDatabase;
let db: Db;
let app: Express;

/** Tokens as the identity service would issue them (this service only verifies). */
async function token(userId: string, memberships: Array<{ org: string; role: SystemRole; branch?: string }> = []) {
  const key = await importPKCS8(keys.privateKeyPem, 'RS256');
  const claims: MembershipClaim[] = memberships.map((m) => ({
    organizationId: m.org,
    branchId: m.branch ?? null,
    role: m.role,
    permissions: [...SYSTEM_ROLE_PERMISSIONS[m.role]],
  }));
  return new SignJWT({ sid: randomUUID(), email: `${userId}@t.so`, memberships: claims })
    .setProtectedHeader({ alg: 'RS256' })
    .setSubject(userId)
    .setIssuer('sombill-identity')
    .setAudience('sombill-api')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(key);
}

beforeAll(async () => {
  database = await createTestDatabase(migrations, 'org_test');
  const config = loadConfig({
    LOG_LEVEL: 'silent',
    IDENTITY_DATABASE_URL: database.url,
    ORGANIZATION_DATABASE_URL: database.url,
    RABBITMQ_URL: testInfra.rabbitmqUrl,
    JWT_PUBLIC_KEY: keys.publicKeyPem,
    JWT_PRIVATE_KEY: keys.privateKeyPem,
  });
  db = createDb(database.url);
  const verify = await createAccessTokenVerifier({
    publicKeyPem: config.JWT_PUBLIC_KEY,
    issuer: config.JWT_ISSUER,
    audience: config.JWT_AUDIENCE,
  });
  app = buildOrganizationApp({ config, db, logger: silentLogger, verify });
});
afterAll(async () => {
  await db.$disconnect();
  await database.drop();
});

const ownerId = randomUUID();
const newOrg = { name: 'Hargeisa Grill Group', country: 'SO', currency: 'USD', timezone: 'Africa/Mogadishu' };

async function createOrg(userId = ownerId, body: Record<string, unknown> = newOrg) {
  const t = await token(userId);
  const res = await request(app).post('/organizations').set('Authorization', `Bearer ${t}`).send(body);
  return res;
}

describe('organizations', () => {
  it('creates an organization with a trial subscription and an organization.created outbox event', async () => {
    const res = await createOrg();
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      name: 'Hargeisa Grill Group',
      currency: 'USD',
      status: 'ACTIVE',
      subscription: { plan: 'trial', status: 'TRIALING', maxBranches: 3 },
    });
    expect(res.body.data.slug).toMatch(/^hargeisa-grill-group-[a-f0-9]{6}$/);
    const outbox = await db.outboxEvent.findMany({ where: { eventType: 'organization.created' } });
    const event = outbox.find(
      (e) =>
        (e.payload as unknown as EventEnvelope<{ organizationId: string }>).data.organizationId === res.body.data.id,
    );
    expect((event!.payload as unknown as EventEnvelope<{ ownerUserId: string }>).data.ownerUserId).toBe(ownerId);
    expect(
      await db.auditLog.count({ where: { action: 'organization.created', organizationId: res.body.data.id } }),
    ).toBe(1);
  });

  it('validates codes, time zones and slugs', async () => {
    const bad = await createOrg(ownerId, {
      name: 'X Co',
      country: 'Somalia',
      currency: 'usd',
      timezone: 'Mars/Olympus',
    });
    expect(bad.status).toBe(400);
    expect(bad.body.error.details.map((d: { path: string }) => d.path).sort()).toEqual([
      'country',
      'currency',
      'timezone',
    ]);
    await createOrg(ownerId, { ...newOrg, slug: 'taken-slug' }).then((r) => expect(r.status).toBe(201));
    const dup = await createOrg(ownerId, { ...newOrg, slug: 'taken-slug' });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('SLUG_TAKEN');
  });

  it('requires authentication', async () => {
    expect((await request(app).post('/organizations').send(newOrg)).status).toBe(401);
  });

  it('isolates organizations: members see theirs, outsiders get 403', async () => {
    const a = (await createOrg()).body.data.id as string;
    const b = (await createOrg(randomUUID())).body.data.id as string;
    const ownerOfA = await token(ownerId, [{ org: a, role: 'owner' }]);
    expect((await request(app).get(`/organizations/${a}`).set('Authorization', `Bearer ${ownerOfA}`)).status).toBe(200);
    expect((await request(app).get(`/organizations/${b}`).set('Authorization', `Bearer ${ownerOfA}`)).status).toBe(403);
    const list = await request(app).get('/organizations').set('Authorization', `Bearer ${ownerOfA}`);
    expect(list.body.data.map((o: { id: string }) => o.id)).toEqual([a]);
    expect(list.body.meta.total).toBe(1);
  });

  it('only owners can update the organization', async () => {
    const org = (await createOrg()).body.data.id as string;
    const manager = await token(randomUUID(), [{ org, role: 'manager' }]);
    const owner = await token(ownerId, [{ org, role: 'owner' }]);
    expect(
      (
        await request(app)
          .patch(`/organizations/${org}`)
          .set('Authorization', `Bearer ${manager}`)
          .send({ name: 'Nope' })
      ).status,
    ).toBe(403);
    const ok = await request(app)
      .patch(`/organizations/${org}`)
      .set('Authorization', `Bearer ${owner}`)
      .send({ name: 'Berbera Grill' });
    expect(ok.body.data.name).toBe('Berbera Grill');
    expect(await db.outboxEvent.count({ where: { eventType: 'organization.updated' } })).toBeGreaterThanOrEqual(1);
    expect(
      (await request(app).patch(`/organizations/${org}`).set('Authorization', `Bearer ${owner}`).send({})).status,
    ).toBe(400);
  });
});

describe('branches', () => {
  let org: string;
  let owner: string;
  beforeAll(async () => {
    org = (await createOrg()).body.data.id;
    owner = await token(ownerId, [{ org, role: 'owner' }]);
  });
  const createBranch = (t: string, body: Record<string, unknown>, o = org) =>
    request(app).post(`/organizations/${o}/branches`).set('Authorization', `Bearer ${t}`).send(body);

  it('creates branches with organization defaults, settings and a branch.created event', async () => {
    const res = await createBranch(owner, { code: 'hrg-01', name: 'Hargeisa Main' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      code: 'HRG-01',
      country: 'SO',
      currency: 'USD',
      timezone: 'Africa/Mogadishu',
      status: 'ACTIVE',
    });
    const settings = await request(app)
      .get(`/branches/${res.body.data.id}/settings`)
      .set('Authorization', `Bearer ${owner}`);
    expect(settings.body.data).toMatchObject({
      taxRate: '0.0000',
      serviceChargeRate: '0.0000',
      pricesIncludeTax: false,
    });
    expect(await db.outboxEvent.count({ where: { eventType: 'branch.created' } })).toBe(1);
    const dup = await createBranch(owner, { code: 'HRG-01', name: 'Again' });
    expect(dup.body.error.code).toBe('BRANCH_CODE_TAKEN');
  });

  it('enforces the plan limit even under concurrent requests', async () => {
    const results = await Promise.all(
      ['B-1', 'B-2', 'B-3', 'B-4'].map((code) => createBranch(owner, { code, name: `Branch ${code}` })),
    );
    // Trial = 3 branches; one exists already, so exactly two of four succeed.
    expect(results.filter((r) => r.status === 201)).toHaveLength(2);
    expect(results.filter((r) => r.status === 409).every((r) => r.body.error.code === 'PLAN_LIMIT_REACHED')).toBe(true);
    expect(await db.branch.count({ where: { organizationId: org } })).toBe(3);
  });

  it('scopes branch staff to their branch', async () => {
    const all = await request(app).get(`/organizations/${org}/branches`).set('Authorization', `Bearer ${owner}`);
    expect(all.body.meta.total).toBe(3);
    const [first, second] = all.body.data as Array<{ id: string }>;
    const cashier = await token(randomUUID(), [{ org, role: 'cashier', branch: first!.id }]);
    const mine = await request(app).get(`/organizations/${org}/branches`).set('Authorization', `Bearer ${cashier}`);
    expect(mine.body.data.map((b: { id: string }) => b.id)).toEqual([first!.id]);
    expect((await request(app).get(`/branches/${first!.id}`).set('Authorization', `Bearer ${cashier}`)).status).toBe(
      200,
    );
    expect((await request(app).get(`/branches/${second!.id}`).set('Authorization', `Bearer ${cashier}`)).status).toBe(
      403,
    );
    expect((await createBranch(cashier, { code: 'X-1', name: 'Nope' })).status).toBe(403);
    // A branch-scoped manager still cannot create sibling branches.
    const branchManager = await token(randomUUID(), [{ org, role: 'manager', branch: first!.id }]);
    expect((await createBranch(branchManager, { code: 'X-2', name: 'Nope' })).status).toBe(403);
  });

  it('hides branches of other organizations (404, not 403)', async () => {
    const branch = (await db.branch.findFirstOrThrow({ where: { organizationId: org } })).id;
    const stranger = await token(randomUUID(), [{ org: randomUUID(), role: 'owner' }]);
    expect((await request(app).get(`/branches/${branch}`).set('Authorization', `Bearer ${stranger}`)).status).toBe(404);
    expect((await request(app).get(`/branches/${randomUUID()}`).set('Authorization', `Bearer ${owner}`)).status).toBe(
      404,
    );
  });

  it('updates settings with exact decimals and rejects out-of-range rates', async () => {
    const branch = (await db.branch.findFirstOrThrow({ where: { organizationId: org } })).id;
    const manager = await token(randomUUID(), [{ org, role: 'manager' }]);
    const ok = await request(app)
      .put(`/branches/${branch}/settings`)
      .set('Authorization', `Bearer ${manager}`)
      .send({ taxRate: '5.125', serviceChargeRate: 10, receiptFooter: 'Mahadsanid!' });
    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({
      taxRate: '5.1250',
      serviceChargeRate: '10.0000',
      receiptFooter: 'Mahadsanid!',
    });
    expect(
      (
        await request(app)
          .put(`/branches/${branch}/settings`)
          .set('Authorization', `Bearer ${manager}`)
          .send({ taxRate: '101' })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .put(`/branches/${branch}/settings`)
          .set('Authorization', `Bearer ${manager}`)
          .send({ taxRate: '1.23456' })
      ).status,
    ).toBe(400);
    const cashier = await token(randomUUID(), [{ org, role: 'cashier', branch }]);
    expect(
      (
        await request(app)
          .put(`/branches/${branch}/settings`)
          .set('Authorization', `Bearer ${cashier}`)
          .send({ taxRate: '1' })
      ).status,
    ).toBe(403);
  });

  it('paginates and filters', async () => {
    const page = await request(app)
      .get(`/organizations/${org}/branches`)
      .query({ page: 2, pageSize: 2 })
      .set('Authorization', `Bearer ${owner}`);
    expect(page.body.meta).toEqual({ page: 2, pageSize: 2, total: 3, totalPages: 2 });
    expect(page.body.data).toHaveLength(1);
    const search = await request(app)
      .get(`/organizations/${org}/branches`)
      .query({ search: 'hargeisa' })
      .set('Authorization', `Bearer ${owner}`);
    expect(search.body.data.map((b: { code: string }) => b.code)).toEqual(['HRG-01']);
    expect(
      (
        await request(app)
          .get(`/organizations/${org}/branches`)
          .query({ pageSize: 1000 })
          .set('Authorization', `Bearer ${owner}`)
      ).status,
    ).toBe(400);
  });
});

describe('transactional outbox → RabbitMQ', () => {
  it('publishes pending events once and marks them published', async () => {
    const exchange = uniqueName('test.org');
    const bus = await RabbitEventBus.connect({
      url: testInfra.rabbitmqUrl,
      exchange,
      logger: silentLogger,
      connectionName: 'org-test',
    });
    const received: EventEnvelope[] = [];
    await bus.subscribe({
      queue: uniqueName('q'),
      events: ['organization.created', 'branch.created', 'organization.updated'],
      handler: async (e) => void received.push(e),
    });
    const pending = await db.outboxEvent.count({ where: { publishedAt: null } });
    expect(pending).toBeGreaterThan(0);
    const relay = new OutboxRelay({ db, publish: (e) => bus.publish(e), logger: silentLogger });
    let published = 0;
    while (true) {
      const n = await relay.tick();
      if (n === 0) break;
      published += n;
    }
    expect(published).toBe(pending);
    expect(await db.outboxEvent.count({ where: { publishedAt: null } })).toBe(0);
    await waitFor(() => (received.length >= pending ? true : undefined));
    expect(new Set(received.map((e) => e.id)).size).toBe(pending);
    expect(await relay.tick()).toBe(0);
    await bus.close();
  });
});
