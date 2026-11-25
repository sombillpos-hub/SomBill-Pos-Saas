import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { baseEnvSchema, csv, EnvValidationError, jwtVerifyEnvSchema, loadEnv } from '../src/config.js';

const PEM = '-----BEGIN PUBLIC KEY-----\nMIIB\n-----END PUBLIC KEY-----';

describe('loadEnv', () => {
  const schema = baseEnvSchema.extend(jwtVerifyEnvSchema.shape).extend({ ORIGINS: csv });

  it('validates, coerces and applies defaults', () => {
    const env = loadEnv(schema, {
      PORT: '4001',
      SERVICE_NAME: 'x',
      JWT_PUBLIC_KEY: PEM,
      ORIGINS: 'https://a.so, ,https://b.so',
    });
    expect(env).toMatchObject({
      PORT: 4001,
      NODE_ENV: 'development',
      LOG_LEVEL: 'info',
      JWT_ISSUER: 'sombill-identity',
    });
    expect(env.ORIGINS).toEqual(['https://a.so', 'https://b.so']);
  });

  it('accepts base64-encoded PEM keys', () => {
    const env = loadEnv(schema, { PORT: '1', SERVICE_NAME: 'x', JWT_PUBLIC_KEY: Buffer.from(PEM).toString('base64') });
    expect(env.JWT_PUBLIC_KEY).toBe(PEM);
  });

  it('reads X from the file named by X_FILE (Docker secrets), explicit X wins', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'env-'));
    const file = path.join(dir, 'key.pem');
    writeFileSync(file, `${PEM}\n`);
    expect(loadEnv(schema, { PORT: '1', SERVICE_NAME: 'x', JWT_PUBLIC_KEY_FILE: file }).JWT_PUBLIC_KEY).toBe(PEM);
    expect(() => loadEnv(schema, { PORT: '1', SERVICE_NAME: 'x', JWT_PUBLIC_KEY_FILE: '/nope' })).toThrow(
      EnvValidationError,
    );
    // Unrelated *_FILE variables from the host environment are ignored.
    expect(() =>
      loadEnv(schema, { PORT: '1', SERVICE_NAME: 'x', JWT_PUBLIC_KEY: PEM, PIP_CONFIG_FILE: '/does/not/exist' }),
    ).not.toThrow();
  });

  it('reports every problem at once', () => {
    try {
      loadEnv(baseEnvSchema.extend({ URL: z.url() }), { PORT: 'abc', URL: 'nope' });
      expect.fail('should throw');
    } catch (e) {
      expect(e).toBeInstanceOf(EnvValidationError);
      expect((e as EnvValidationError).issues.map((i) => i.split(':')[0]).sort()).toEqual([
        'PORT',
        'SERVICE_NAME',
        'URL',
      ]);
    }
  });
});
