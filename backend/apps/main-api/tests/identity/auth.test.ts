import { decodeJwt } from 'jose';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PASSWORD, refreshCookie, register, startIdentity, type IdentityHarness } from './helpers.js';

let h: IdentityHarness;
beforeAll(async () => {
  h = await startIdentity({ LOGIN_MAX_ATTEMPTS: '3', LOGIN_LOCK_MINUTES: '15' });
});
afterAll(async () => {
  await h.close();
});

describe('registration', () => {
  it('creates the user with an Argon2id hash, signs them in, and records an outbox event', async () => {
    const { res, userId } = await register(h.app, '  Amina@SomBill.com ', 'Amina Yusuf');
    expect(res.body.data).toMatchObject({
      tokenType: 'Bearer',
      expiresIn: 900,
      user: { email: 'amina@sombill.com', fullName: 'Amina Yusuf' },
    });
    expect(res.body.data.refreshToken).toBeUndefined();
    const cookie = (res.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('sombill_rt='))!;
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Secure/);
    expect(cookie).toMatch(/SameSite=Strict/);
    expect(cookie).toMatch(/Path=\/api\/v1\/auth/);
    expect(res.headers['cache-control']).toBe('no-store');

    const user = await h.db.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.passwordHash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(user.passwordHash).not.toContain(PASSWORD);
    const outbox = await h.db.outboxEvent.findMany({ where: { eventType: 'user.registered' } });
    expect(outbox).toHaveLength(1);
    expect((outbox[0]!.payload as { data: { userId: string } }).data.userId).toBe(userId);
  });

  it('issues an RS256 access token with the expected claims', async () => {
    const { accessToken, userId } = await register(h.app, 'claims@sombill.com');
    const claims = decodeJwt(accessToken);
    expect(claims).toMatchObject({
      sub: userId,
      iss: 'sombill-identity',
      aud: 'sombill-api',
      email: 'claims@sombill.com',
      memberships: [],
    });
    expect(typeof claims.sid).toBe('string');
    expect(claims.exp! - claims.iat!).toBe(900);
  });

  it('rejects duplicate e-mails, weak passwords and malformed input', async () => {
    await register(h.app, 'dup@sombill.com');
    const dup = await request(h.app)
      .post('/auth/register')
      .send({ email: 'DUP@sombill.com', password: PASSWORD, fullName: 'X Y' });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('EMAIL_IN_USE');

    const weak = await request(h.app)
      .post('/auth/register')
      .send({ email: 'weak@sombill.com', password: 'short', fullName: 'X Y' });
    expect(weak.status).toBe(400);
    expect(weak.body.error.code).toBe('VALIDATION_ERROR');
    expect(weak.body.error.details[0].path).toBe('password');

    const junk = await request(h.app).post('/auth/register').set('Content-Type', 'application/json').send('{"email":');
    expect(junk.status).toBe(400);
  });
});

describe('login', () => {
  it('signs in with the right password and returns the same error for a wrong password or unknown e-mail', async () => {
    await register(h.app, 'login@sombill.com');
    const ok = await request(h.app).post('/auth/login').send({ email: 'LOGIN@sombill.com', password: PASSWORD });
    expect(ok.status).toBe(200);
    expect(refreshCookie(ok)).toBeTruthy();

    const wrong = await request(h.app)
      .post('/auth/login')
      .send({ email: 'login@sombill.com', password: 'nope-nope-nope' });
    const unknown = await request(h.app)
      .post('/auth/login')
      .send({ email: 'ghost@sombill.com', password: 'nope-nope-nope' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error).toEqual({ ...unknown.body.error, requestId: wrong.body.error.requestId });
    expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('locks the account after repeated failures, even for the right password, then audits it', async () => {
    const { userId } = await register(h.app, 'lock@sombill.com');
    for (let i = 0; i < 3; i++) {
      await request(h.app)
        .post('/auth/login')
        .send({ email: 'lock@sombill.com', password: 'wrong-password!' })
        .expect(401);
    }
    const blocked = await request(h.app).post('/auth/login').send({ email: 'lock@sombill.com', password: PASSWORD });
    expect(blocked.status).toBe(401);
    expect(blocked.body.error.code).toBe('INVALID_CREDENTIALS');
    const user = await h.db.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.lockedUntil!.getTime()).toBeGreaterThan(Date.now() + 14 * 60_000);
    const audits = await h.db.auditLog.findMany({ where: { actorUserId: userId }, orderBy: { occurredAt: 'asc' } });
    expect(audits.map((a) => a.action)).toEqual(
      expect.arrayContaining(['user.registered', 'auth.login_failed', 'auth.account_locked', 'auth.login_blocked']),
    );

    // Once the lock expires the right password works again.
    await h.db.user.update({ where: { id: userId }, data: { lockedUntil: new Date(Date.now() - 1000) } });
    await request(h.app).post('/auth/login').send({ email: 'lock@sombill.com', password: PASSWORD }).expect(200);
  });

  it('refuses suspended accounts after the password check', async () => {
    const { userId } = await register(h.app, 'suspended@sombill.com');
    await h.db.user.update({ where: { id: userId }, data: { status: 'SUSPENDED' } });
    const res = await request(h.app).post('/auth/login').send({ email: 'suspended@sombill.com', password: PASSWORD });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_SUSPENDED');
  });
});

describe('refresh-token rotation', () => {
  it('rotates on every refresh and only stores token hashes', async () => {
    const { refresh: first } = await register(h.app, 'rotate@sombill.com');
    const r1 = await request(h.app).post('/auth/refresh').set('Cookie', `sombill_rt=${first}`);
    expect(r1.status).toBe(200);
    const second = refreshCookie(r1)!;
    expect(second).toBeTruthy();
    expect(second).not.toBe(first);
    const r2 = await request(h.app).post('/auth/refresh').set('Cookie', `sombill_rt=${second}`);
    expect(r2.status).toBe(200);
    const stored = await h.db.refreshToken.findMany({});
    expect(stored.some((t) => t.tokenHash === first || t.tokenHash === second)).toBe(false);
  });

  it('revokes the whole session when a rotated token is reused (theft detection)', async () => {
    const { refresh: stolen } = await register(h.app, 'theft@sombill.com');
    const legit = await request(h.app).post('/auth/refresh').set('Cookie', `sombill_rt=${stolen}`).expect(200);
    const current = refreshCookie(legit)!;

    const replay = await request(h.app).post('/auth/refresh').set('Cookie', `sombill_rt=${stolen}`);
    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe('REFRESH_REUSED');
    // The legitimate user's newer token is now dead too.
    const after = await request(h.app).post('/auth/refresh').set('Cookie', `sombill_rt=${current}`);
    expect(after.status).toBe(401);
  });

  it('lets only one of two concurrent refreshes with the same token succeed', async () => {
    const { refresh } = await register(h.app, 'race@sombill.com');
    const results = await Promise.all([
      request(h.app).post('/auth/refresh').set('Cookie', `sombill_rt=${refresh}`),
      request(h.app).post('/auth/refresh').set('Cookie', `sombill_rt=${refresh}`),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 401]);
  });

  it('supports body transport for non-browser clients', async () => {
    const login = await (async () => {
      await register(h.app, 'mobile@sombill.com');
      return request(h.app)
        .post('/auth/login')
        .set('X-Token-Transport', 'body')
        .send({ email: 'mobile@sombill.com', password: PASSWORD });
    })();
    expect(login.status).toBe(200);
    expect(refreshCookie(login)).toBeUndefined();
    const token = login.body.data.refreshToken as string;
    const r = await request(h.app).post('/auth/refresh').set('X-Token-Transport', 'body').send({ refreshToken: token });
    expect(r.status).toBe(200);
    expect(r.body.data.refreshToken).not.toBe(token);
  });

  it('rejects missing, unknown and expired refresh tokens', async () => {
    expect((await request(h.app).post('/auth/refresh')).body.error.code).toBe('REFRESH_MISSING');
    expect(
      (
        await request(h.app)
          .post('/auth/refresh')
          .set('Cookie', 'sombill_rt=' + 'x'.repeat(43))
      ).body.error.code,
    ).toBe('REFRESH_INVALID');
    const { refresh, userId } = await register(h.app, 'expired@sombill.com');
    await h.db.session.updateMany({
      where: { userId },
      data: { expiresAt: new Date(Date.now() - 1000), createdAt: new Date(Date.now() - 5000) },
    });
    expect((await request(h.app).post('/auth/refresh').set('Cookie', `sombill_rt=${refresh}`)).status).toBe(401);
  });
});

describe('logout, change password, me', () => {
  it('logout revokes the session even without an access token', async () => {
    const { refresh } = await register(h.app, 'bye@sombill.com');
    const out = await request(h.app).post('/auth/logout').set('Cookie', `sombill_rt=${refresh}`);
    expect(out.status).toBe(204);
    expect((out.headers['set-cookie'] as unknown as string[])[0]).toMatch(/sombill_rt=;/);
    expect((await request(h.app).post('/auth/refresh').set('Cookie', `sombill_rt=${refresh}`)).status).toBe(401);
  });

  it('logout-all ends every session', async () => {
    const { accessToken, refresh: a } = await register(h.app, 'all@sombill.com');
    const second = await request(h.app).post('/auth/login').send({ email: 'all@sombill.com', password: PASSWORD });
    const b = refreshCookie(second)!;
    const res = await request(h.app).post('/auth/logout-all').set('Authorization', `Bearer ${accessToken}`);
    expect(res.body.data.revokedSessions).toBe(2);
    for (const t of [a, b])
      expect((await request(h.app).post('/auth/refresh').set('Cookie', `sombill_rt=${t}`)).status).toBe(401);
  });

  it('change-password requires the current password and signs out other sessions', async () => {
    const { accessToken, refresh: current } = await register(h.app, 'pw@sombill.com');
    const other = refreshCookie(
      await request(h.app).post('/auth/login').send({ email: 'pw@sombill.com', password: PASSWORD }),
    )!;
    const auth = { Authorization: `Bearer ${accessToken}` };
    const bad = await request(h.app)
      .post('/auth/change-password')
      .set(auth)
      .send({ currentPassword: 'wrong', newPassword: 'another-long-password' });
    expect(bad.body.error.code).toBe('INVALID_CURRENT_PASSWORD');
    await request(h.app)
      .post('/auth/change-password')
      .set(auth)
      .send({ currentPassword: PASSWORD, newPassword: 'another-long-password' })
      .expect(204);
    expect((await request(h.app).post('/auth/refresh').set('Cookie', `sombill_rt=${other}`)).status).toBe(401);
    expect((await request(h.app).post('/auth/refresh').set('Cookie', `sombill_rt=${current}`)).status).toBe(200);
    await request(h.app)
      .post('/auth/login')
      .send({ email: 'pw@sombill.com', password: 'another-long-password' })
      .expect(200);
  });

  it('me requires a valid token and rejects tampered or foreign tokens', async () => {
    const { accessToken } = await register(h.app, 'me@sombill.com');
    const me = await request(h.app).get('/auth/me').set('Authorization', `Bearer ${accessToken}`);
    expect(me.body.data.user.email).toBe('me@sombill.com');
    expect((await request(h.app).get('/auth/me')).body.error.code).toBe('TOKEN_MISSING');
    const [hd, , sig] = accessToken.split('.');
    const forged = Buffer.from(
      JSON.stringify({
        sub: 'x',
        sid: 'y',
        memberships: [{ organizationId: 'o', permissions: ['organization.update'] }],
      }),
    ).toString('base64url');
    const tampered = await request(h.app).get('/auth/me').set('Authorization', `Bearer ${hd}.${forged}.${sig}`);
    expect(tampered.body.error.code).toBe('TOKEN_INVALID');
  });
});
