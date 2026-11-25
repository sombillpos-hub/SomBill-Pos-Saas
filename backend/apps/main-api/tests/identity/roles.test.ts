import { randomUUID } from 'node:crypto';
import { decodeJwt } from 'jose';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createEvent } from '@sombill/messaging';
import { createEventHandler } from '../../src/events/identity.consumers.js';
import { refreshCookie, register, startIdentity, type IdentityHarness } from './helpers.js';

let h: IdentityHarness;
let handle: ReturnType<typeof createEventHandler>;
beforeAll(async () => {
  h = await startIdentity();
  handle = createEventHandler(h.db, 'identity-service');
});
afterAll(async () => {
  await h.close();
});

const orgCreated = (organizationId: string, ownerUserId: string) =>
  createEvent(
    'organization.created',
    1,
    { organizationId, ownerUserId, name: 'Hargeisa Grill', currency: 'USD', timezone: 'Africa/Mogadishu' },
    { source: 'organization-service' },
  );
const branchCreated = (organizationId: string, branchId: string, by: string) =>
  createEvent(
    'branch.created',
    1,
    { organizationId, branchId, name: 'Main', code: 'MAIN', createdByUserId: by },
    { source: 'organization-service' },
  );

/** Signs a user in again so the access token carries their current memberships. */
async function freshToken(refresh: string): Promise<{ token: string; refresh: string }> {
  const r = await request(h.app).post('/auth/refresh').set('Cookie', `sombill_rt=${refresh}`).expect(200);
  return { token: r.body.data.accessToken, refresh: refreshCookie(r)! };
}

describe('organization.created / branch.created consumers', () => {
  it('makes the creator owner exactly once, even when the event is delivered twice', async () => {
    const owner = await register(h.app, 'owner1@sombill.com');
    const org = randomUUID();
    const event = orgCreated(org, owner.userId);
    await handle(event);
    await handle(event); // redelivery
    const ms = await h.db.membership.findMany({ where: { organizationId: org }, include: { role: true } });
    expect(ms).toHaveLength(1);
    expect(ms[0]).toMatchObject({ userId: owner.userId, branchId: null, role: { code: 'owner' } });
    expect(
      await h.db.outboxEvent.count({
        where: { eventType: 'role.assigned', payload: { path: ['causationId'], equals: event.id } },
      }),
    ).toBe(1);
    expect(await h.db.processedEvent.count({ where: { eventId: event.id } })).toBe(1);

    const { token } = await freshToken(owner.refresh);
    const claims = decodeJwt(token) as {
      memberships: Array<{ organizationId: string; role: string; permissions: string[] }>;
    };
    expect(claims.memberships).toEqual([
      expect.objectContaining({ organizationId: org, role: 'owner', branchId: null }),
    ]);
    expect(claims.memberships[0]!.permissions).toContain('organization.update');
  });

  it('fails (so the bus retries) when the owner does not exist', async () => {
    await expect(handle(orgCreated(randomUUID(), randomUUID()))).rejects.toThrow();
  });
});

describe('role assignment', () => {
  const org = randomUUID();
  const branchX = randomUUID();
  const branchY = randomUUID();
  let owner: { token: string; refresh: string; userId: string };
  let manager: { token: string; refresh: string; userId: string };
  let branchManager: { token: string; refresh: string; userId: string };

  const assign = (token: string, body: Record<string, unknown>) =>
    request(h.app)
      .post('/users/memberships')
      .set('Authorization', `Bearer ${token}`)
      .send({ organizationId: org, ...body });

  beforeAll(async () => {
    const o = await register(h.app, 'owner2@sombill.com');
    await handle(orgCreated(org, o.userId));
    await handle(branchCreated(org, branchX, o.userId));
    await handle(branchCreated(org, branchY, o.userId));
    owner = { ...(await freshToken(o.refresh)), userId: o.userId };
    const m = await register(h.app, 'manager@sombill.com');
    const bm = await register(h.app, 'branch.manager@sombill.com');
    await register(h.app, 'cashier@sombill.com');
    await register(h.app, 'waiter@sombill.com');
    await register(h.app, 'outsider@sombill.com');
    await assign(owner.token, { email: 'manager@sombill.com', role: 'manager' }).expect(201);
    await assign(owner.token, { email: 'branch.manager@sombill.com', role: 'manager', branchId: branchX }).expect(201);
    manager = { ...(await freshToken(m.refresh)), userId: m.userId };
    branchManager = { ...(await freshToken(bm.refresh)), userId: bm.userId };
  });

  it('records the assignment with audit and an outbox event', async () => {
    const audit = await h.db.auditLog.findFirst({
      where: { action: 'role.assigned', organizationId: org, actorUserId: owner.userId },
    });
    expect(audit).toBeTruthy();
    expect(await h.db.outboxEvent.count({ where: { eventType: 'role.assigned' } })).toBeGreaterThanOrEqual(3);
  });

  it('blocks privilege escalation', async () => {
    // A manager lacks accounting.manage, so cannot grant the accountant role…
    const esc = await assign(manager.token, { email: 'cashier@sombill.com', role: 'accountant' });
    expect(esc.status).toBe(403);
    expect(esc.body.error.code).toBe('PRIVILEGE_ESCALATION');
    expect(esc.body.error.details.missing).toContain('accounting.manage');
    // …and only owners manage the owner role.
    expect((await assign(manager.token, { email: 'cashier@sombill.com', role: 'owner' })).status).toBe(403);
    // A role within the manager's own permissions is fine.
    expect((await assign(manager.token, { email: 'cashier@sombill.com', role: 'cashier' })).status).toBe(201);
  });

  it('keeps branch managers inside their branch', async () => {
    expect(
      (await assign(branchManager.token, { email: 'waiter@sombill.com', role: 'waiter', branchId: branchY })).status,
    ).toBe(403);
    expect((await assign(branchManager.token, { email: 'waiter@sombill.com', role: 'waiter' })).status).toBe(403); // org-wide
    expect(
      (await assign(branchManager.token, { email: 'waiter@sombill.com', role: 'waiter', branchId: branchX })).status,
    ).toBe(201);
  });

  it('validates the branch, the user and duplicates', async () => {
    expect(
      (await assign(owner.token, { email: 'waiter@sombill.com', role: 'waiter', branchId: randomUUID() })).status,
    ).toBe(404);
    expect((await assign(owner.token, { email: 'nobody@sombill.com', role: 'waiter' })).status).toBe(404);
    expect((await assign(owner.token, { email: 'waiter@sombill.com', role: 'no_such_role' })).status).toBe(404);
    const dup = await assign(owner.token, { email: 'waiter@sombill.com', role: 'waiter', branchId: branchX });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('ALREADY_ASSIGNED');
  });

  it('isolates organizations', async () => {
    const outsider = await freshToken((await register(h.app, 'outsider2@sombill.com')).refresh);
    expect((await assign(outsider.token, { email: 'waiter@sombill.com', role: 'waiter' })).status).toBe(403);
    expect(
      (
        await request(h.app)
          .get('/users')
          .query({ organizationId: org })
          .set('Authorization', `Bearer ${outsider.token}`)
      ).status,
    ).toBe(403);
    expect(
      (
        await request(h.app)
          .get('/roles')
          .query({ organizationId: org })
          .set('Authorization', `Bearer ${outsider.token}`)
      ).status,
    ).toBe(403);
    const someMembership = await h.db.membership.findFirstOrThrow({ where: { organizationId: org } });
    expect(
      (
        await request(h.app)
          .delete(`/users/memberships/${someMembership.id}`)
          .set('Authorization', `Bearer ${outsider.token}`)
      ).status,
    ).toBe(404);
  });

  it('lists users org-wide for managers and per branch for branch managers', async () => {
    const all = await request(h.app)
      .get('/users')
      .query({ organizationId: org, pageSize: 50 })
      .set('Authorization', `Bearer ${manager.token}`);
    expect(all.status).toBe(200);
    expect(all.body.data.map((u: { email: string }) => u.email).sort()).toEqual(
      [
        'branch.manager@sombill.com',
        'cashier@sombill.com',
        'manager@sombill.com',
        'owner2@sombill.com',
        'waiter@sombill.com',
      ].sort(),
    );
    expect(all.body.meta).toMatchObject({ page: 1, pageSize: 50, total: 5 });
    const mine = await request(h.app)
      .get('/users')
      .query({ organizationId: org })
      .set('Authorization', `Bearer ${branchManager.token}`);
    expect(mine.body.data.map((u: { email: string }) => u.email).sort()).toEqual([
      'branch.manager@sombill.com',
      'waiter@sombill.com',
    ]);
    const search = await request(h.app)
      .get('/users')
      .query({ organizationId: org, search: 'CASH' })
      .set('Authorization', `Bearer ${manager.token}`);
    expect(search.body.data).toHaveLength(1);
  });

  it('lists the roles of an organization', async () => {
    const res = await request(h.app)
      .get('/roles')
      .query({ organizationId: org })
      .set('Authorization', `Bearer ${owner.token}`);
    expect(res.body.data.map((r: { code: string }) => r.code)).toEqual(
      expect.arrayContaining([
        'owner',
        'manager',
        'cashier',
        'waiter',
        'kitchen',
        'inventory_clerk',
        'accountant',
        'hr_manager',
      ]),
    );
  });

  it('never removes the last owner, and revocation takes effect immediately', async () => {
    const ownerMembership = await h.db.membership.findFirstOrThrow({
      where: { organizationId: org, userId: owner.userId },
    });
    const last = await request(h.app)
      .delete(`/users/memberships/${ownerMembership.id}`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(last.status).toBe(409);
    expect(last.body.error.code).toBe('LAST_OWNER');

    const managerMembership = await h.db.membership.findFirstOrThrow({
      where: { organizationId: org, userId: manager.userId },
    });
    await request(h.app)
      .delete(`/users/memberships/${managerMembership.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(204);
    // The manager's old token still lists the role, but identity re-reads memberships for role management.
    expect((await assign(manager.token, { email: 'waiter@sombill.com', role: 'kitchen' })).status).toBe(403);
  });
});

describe('audit trail', () => {
  it('is append-only at the database level', async () => {
    const row = await h.db.auditLog.findFirstOrThrow({});
    await expect(h.db.auditLog.update({ where: { id: row.id }, data: { action: 'tampered' } })).rejects.toThrow();
    await expect(h.db.auditLog.delete({ where: { id: row.id } })).rejects.toThrow();
    expect((await h.db.auditLog.findUniqueOrThrow({ where: { id: row.id } })).action).toBe(row.action);
  });
});
