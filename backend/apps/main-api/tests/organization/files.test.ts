import { randomUUID } from 'node:crypto';
import { mkdtemp, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Express } from 'express';
import { importPKCS8, SignJWT } from 'jose';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SYSTEM_ROLE_PERMISSIONS, type MembershipClaim, type SystemRole } from '@sombill/shared-types';
import { createAccessTokenVerifier } from '@sombill/authentication';
import { LocalDiskStorage } from '@sombill/storage';
import { createTestDatabase, generateJwtKeyPair, silentLogger, testInfra, type TestDatabase } from '@sombill/testing';
import { buildOrganizationApp } from '../../src/app.js';
import { loadConfig } from '../../src/config/env.js';
import { cleanFileName } from '../../src/modules/files/services/file.service.js';
import { createDb, type Db } from '@sombill/database/organization';

const migrations = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../../database/prisma/migrations/organization',
);
const keys = generateJwtKeyPair();
let database: TestDatabase;
let db: Db;
let app: Express;
let storageDir: string;
let orgId: string;
let branchId: string;

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const PDF = Buffer.from('%PDF-1.7\n1 0 obj\n');
const owner = randomUUID();
const waiter = randomUUID();
const outsider = randomUUID();

async function token(userId: string, role?: SystemRole, org = orgId) {
  const key = await importPKCS8(keys.privateKeyPem, 'RS256');
  const memberships: MembershipClaim[] = role
    ? [{ organizationId: org, branchId: null, role, permissions: [...SYSTEM_ROLE_PERMISSIONS[role]] }]
    : [];
  return new SignJWT({ sid: randomUUID(), email: `${userId}@t.so`, memberships })
    .setProtectedHeader({ alg: 'RS256' })
    .setSubject(userId)
    .setIssuer('sombill-identity')
    .setAudience('sombill-api')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(key);
}

const upload = async (t: string, fields: Record<string, string>, file: Buffer, name = 'photo.png') => {
  let r = request(app).post('/files').set('Authorization', `Bearer ${t}`);
  for (const [k, v] of Object.entries(fields)) r = r.field(k, v);
  return r.attach('file', file, name);
};

beforeAll(async () => {
  database = await createTestDatabase(migrations, 'files_test');
  storageDir = await mkdtemp(path.join(tmpdir(), 'sb-files-'));
  const config = loadConfig({
    LOG_LEVEL: 'silent',
    IDENTITY_DATABASE_URL: database.url,
    ORGANIZATION_DATABASE_URL: database.url,
    RABBITMQ_URL: testInfra.rabbitmqUrl,
    JWT_PUBLIC_KEY: keys.publicKeyPem,
    JWT_PRIVATE_KEY: keys.privateKeyPem,
    UPLOAD_MAX_BYTES: '2048',
  });
  db = createDb(database.url);
  const verify = await createAccessTokenVerifier({
    publicKeyPem: config.JWT_PUBLIC_KEY,
    issuer: config.JWT_ISSUER,
    audience: config.JWT_AUDIENCE,
  });
  app = buildOrganizationApp({ config, db, logger: silentLogger, verify, storage: new LocalDiskStorage(storageDir) });
  const created = await request(app)
    .post('/organizations')
    .set('Authorization', `Bearer ${await token(owner)}`)
    .send({ name: 'Files Test Co', country: 'SO', currency: 'USD', timezone: 'Africa/Mogadishu' });
  orgId = created.body.data.id;
  const b = await request(app)
    .post(`/organizations/${orgId}/branches`)
    .set('Authorization', `Bearer ${await token(owner, 'owner')}`)
    .send({ code: 'MAIN', name: 'Main branch' });
  branchId = b.body.data.id;
});
afterAll(async () => {
  await db.$disconnect();
  await database.drop();
});

describe('files', () => {
  it('uploads, lists, downloads and deletes a menu image', async () => {
    const t = await token(owner, 'owner');
    const up = await upload(t, { organizationId: orgId, branchId, purpose: 'MENU_IMAGE' }, PNG, '../../evil.png');
    expect(up.status).toBe(201);
    expect(up.body.data).toMatchObject({
      organizationId: orgId,
      branchId,
      purpose: 'MENU_IMAGE',
      contentType: 'image/png',
      sizeBytes: PNG.length,
      originalName: 'evil.png',
    });
    const id = up.body.data.id as string;

    const list = await request(app).get(`/files?organizationId=${orgId}`).set('Authorization', `Bearer ${t}`);
    expect(list.status).toBe(200);
    expect(list.body.meta).toMatchObject({ page: 1, total: 1 });

    const content = await request(app).get(`/files/${id}/content`).set('Authorization', `Bearer ${t}`);
    expect(content.status).toBe(200);
    expect(content.headers['content-type']).toBe('image/png');
    expect(content.headers['x-content-type-options']).toBe('nosniff');
    expect(Buffer.from(content.body as Buffer)).toEqual(PNG);

    expect(await db.auditLog.count({ where: { action: 'file.uploaded', targetId: id } })).toBe(1);
    const del = await request(app).delete(`/files/${id}`).set('Authorization', `Bearer ${t}`);
    expect(del.status).toBe(204);
    expect((await request(app).get(`/files/${id}`).set('Authorization', `Bearer ${t}`)).status).toBe(404);
    expect(await readdir(path.join(storageDir, orgId, 'menu_image'))).toEqual([]);
  });

  it('checks the type by content, the size limit and required fields', async () => {
    const t = await token(owner, 'owner');
    const svg = await upload(t, { organizationId: orgId, purpose: 'MENU_IMAGE' }, Buffer.from('<svg/>'), 'x.png');
    expect(svg.status).toBe(415);
    expect(svg.body.error.code).toBe('UNSUPPORTED_FILE_TYPE');
    const pdfAsImage = await upload(t, { organizationId: orgId, purpose: 'MENU_IMAGE' }, PDF, 'menu.pdf');
    expect(pdfAsImage.status).toBe(415);
    const big = await upload(
      t,
      { organizationId: orgId, purpose: 'MENU_IMAGE' },
      Buffer.concat([PNG, Buffer.alloc(4096)]),
    );
    expect(big.status).toBe(413);
    expect(big.body.error.code).toBe('FILE_TOO_LARGE');
    const noPurpose = await upload(t, { organizationId: orgId }, PNG);
    expect(noPurpose.status).toBe(400);
    expect(noPurpose.body.error.code).toBe('VALIDATION_ERROR');
    const malformed = await upload(t, { organizationId: orgId, purpose: 'MENU_IMAGE' }, PNG, 'bad\u0007name.png');
    expect(malformed.status).toBe(400);
    expect(malformed.body.error.code).toBe('INVALID_UPLOAD');
    const none = await request(app)
      .post('/files')
      .set('Authorization', `Bearer ${t}`)
      .field('organizationId', orgId)
      .field('purpose', 'MENU_IMAGE');
    expect(none.status).toBe(400);
    expect(none.body.error.code).toBe('FILE_REQUIRED');
  });

  it('enforces permissions per purpose and hides other organizations', async () => {
    const waiterToken = await token(waiter, 'waiter');
    const denied = await upload(waiterToken, { organizationId: orgId, purpose: 'MENU_IMAGE' }, PNG);
    expect(denied.status).toBe(403);

    const ownerToken = await token(owner, 'owner');
    const receipt = await upload(ownerToken, { organizationId: orgId, purpose: 'EXPENSE_ATTACHMENT' }, PDF, 'r.pdf');
    expect(receipt.status).toBe(201);
    const id = receipt.body.data.id as string;
    // Waiters can't see expense attachments: neither in lists nor by id.
    const waiterList = await request(app)
      .get(`/files?organizationId=${orgId}`)
      .set('Authorization', `Bearer ${waiterToken}`);
    expect(waiterList.body.data.map((f: { id: string }) => f.id)).not.toContain(id);
    expect((await request(app).get(`/files/${id}`).set('Authorization', `Bearer ${waiterToken}`)).status).toBe(403);
    // Someone outside the organization gets 404, not 403.
    const outsiderToken = await token(outsider, 'owner', randomUUID());
    expect((await request(app).get(`/files/${id}`).set('Authorization', `Bearer ${outsiderToken}`)).status).toBe(404);
    expect((await request(app).get(`/files/${id}`)).status).toBe(401);
  });

  it('cleans file names', () => {
    expect(cleanFileName('C:\\Users\\a\\menu "final".png')).toBe('menu final.png');
    expect(cleanFileName('')).toBe('file');
    expect(cleanFileName('a'.repeat(300))).toHaveLength(200);
  });
});
