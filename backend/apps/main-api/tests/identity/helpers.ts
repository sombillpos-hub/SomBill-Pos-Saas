import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Express } from 'express';
import request from 'supertest';
import { createAccessTokenVerifier } from '@sombill/authentication';
import { createTestDatabase, generateJwtKeyPair, silentLogger, testInfra, type TestDatabase } from '@sombill/testing';
import { buildIdentityApp } from '../../src/app.js';
import { loadConfig, type IdentityConfig } from '../../src/config/env.js';
import { createDb, type Db } from '@sombill/database/identity';
import { syncSystemCatalog } from '../../src/modules/roles/services/role.service.js';
import { TokenIssuer } from '@sombill/authentication';

const migrationsDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../../database/prisma/migrations/identity',
);

export interface IdentityHarness {
  app: Express;
  db: Db;
  config: IdentityConfig;
  keys: { publicKeyPem: string; privateKeyPem: string };
  close: () => Promise<void>;
}

export async function startIdentity(overrides: Record<string, string> = {}): Promise<IdentityHarness> {
  const database: TestDatabase = await createTestDatabase(migrationsDir, 'identity_test');
  const keys = generateJwtKeyPair();
  const config = loadConfig({
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    IDENTITY_DATABASE_URL: database.url,
    ORGANIZATION_DATABASE_URL: database.url,
    RABBITMQ_URL: testInfra.rabbitmqUrl,
    JWT_PRIVATE_KEY: Buffer.from(keys.privateKeyPem).toString('base64'),
    JWT_PUBLIC_KEY: Buffer.from(keys.publicKeyPem).toString('base64'),
    ...overrides,
  });
  const db = createDb(config.IDENTITY_DATABASE_URL);
  await syncSystemCatalog(db);
  const tokens = await TokenIssuer.create({
    privateKeyPem: config.JWT_PRIVATE_KEY,
    issuer: config.JWT_ISSUER,
    audience: config.JWT_AUDIENCE,
    accessTokenTtlSeconds: config.ACCESS_TOKEN_TTL_SECONDS,
  });
  const verify = await createAccessTokenVerifier({
    publicKeyPem: config.JWT_PUBLIC_KEY,
    issuer: config.JWT_ISSUER,
    audience: config.JWT_AUDIENCE,
  });
  const app = buildIdentityApp({ config, db, logger: silentLogger, tokens, verify });
  return {
    app,
    db,
    config,
    keys,
    close: async () => {
      await db.$disconnect();
      await database.drop();
    },
  };
}

export const PASSWORD = 'correct-horse-battery-staple';

/** Extracts the refresh-token cookie value from a response. */
export function refreshCookie(res: request.Response): string | undefined {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  const c = raw?.find((v) => v.startsWith('sombill_rt='));
  return c?.split(';')[0]?.slice('sombill_rt='.length) || undefined;
}

export async function register(app: Express, email: string, fullName = 'Test User') {
  const res = await request(app).post('/auth/register').send({ email, password: PASSWORD, fullName });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  return {
    res,
    accessToken: res.body.data.accessToken as string,
    refresh: refreshCookie(res)!,
    userId: res.body.data.user.id as string,
  };
}
