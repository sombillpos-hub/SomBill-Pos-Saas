import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
import { pino } from 'pino';

/** Local infrastructure used by integration tests (override with env vars in CI). */
export const testInfra = {
  postgresAdminUrl: process.env.TEST_DATABASE_ADMIN_URL ?? 'postgresql://postgres@127.0.0.1:5432/postgres',
  rabbitmqUrl: process.env.RABBITMQ_URL ?? 'amqp://guest:guest@127.0.0.1:5672',
  redisUrl: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379',
};

export const silentLogger = pino({ level: process.env.TEST_LOG_LEVEL ?? 'silent' });

export interface TestDatabase {
  url: string;
  name: string;
  drop: () => Promise<void>;
}

/**
 * Creates an empty database and applies the service's real migration files in order, exactly as
 * `prisma migrate deploy` would. Each test file gets its own database.
 */
export async function createTestDatabase(migrationsDir: string, prefix = 'sombill_test'): Promise<TestDatabase> {
  const name = `${prefix}_${randomBytes(5).toString('hex')}`;
  const admin = new pg.Client({ connectionString: testInfra.postgresAdminUrl });
  await admin.connect();
  await admin.query(`CREATE DATABASE "${name}"`);
  await admin.end();

  const url = new URL(testInfra.postgresAdminUrl);
  url.pathname = `/${name}`;
  const client = new pg.Client({ connectionString: url.toString() });
  await client.connect();
  const dirs = (await readdir(migrationsDir, { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  for (const dir of dirs) {
    const sql = await readFile(path.join(migrationsDir, dir, 'migration.sql'), 'utf8');
    await client.query(sql);
  }
  await client.end();

  return {
    url: url.toString(),
    name,
    drop: async () => {
      const a = new pg.Client({ connectionString: testInfra.postgresAdminUrl });
      await a.connect();
      await a.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
      await a.end();
    },
  };
}

export function generateJwtKeyPair(): { publicKeyPem: string; privateKeyPem: string } {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return { publicKeyPem: publicKey, privateKeyPem: privateKey };
}

/** Polls until `fn` returns a value other than undefined (or throws after `timeoutMs`). */
export async function waitFor<T>(
  fn: () => Promise<T | undefined> | T | undefined,
  timeoutMs = 10_000,
  everyMs = 50,
): Promise<T> {
  const start = Date.now();
  for (;;) {
    const v = await fn();
    if (v !== undefined) return v;
    if (Date.now() - start > timeoutMs) throw new Error(`waitFor timed out after ${timeoutMs} ms`);
    await new Promise((r) => setTimeout(r, everyMs));
  }
}

export const uniqueName = (prefix: string) => `${prefix}.${randomBytes(4).toString('hex')}`;
