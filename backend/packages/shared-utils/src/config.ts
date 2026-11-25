import { readFileSync } from 'node:fs';
import { z } from 'zod';

/**
 * Environment validation. Every service declares its schema by extending `baseEnvSchema`, and `loadEnv`
 * fails fast at start-up with a readable list of problems instead of failing later at runtime.
 */
export const baseEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  PORT: z.coerce.number().int().min(1).max(65535),
  SERVICE_NAME: z.string().min(1),
});

/** Comma-separated list → string[] (empty entries dropped). */
export const csv = z
  .string()
  .default('')
  .transform((v) =>
    v
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );

/** PEM key given either directly or base64-encoded (convenient for env files and secrets managers). */
export const pemKey = z
  .string()
  .min(1)
  .transform((v) => (v.includes('-----BEGIN') ? v.replace(/\\n/g, '\n') : Buffer.from(v, 'base64').toString('utf8')))
  .refine((v) => v.includes('-----BEGIN'), 'must be a PEM key or a base64-encoded PEM key');

export const jwtVerifyEnvSchema = z.object({
  JWT_PUBLIC_KEY: pemKey,
  JWT_ISSUER: z.string().default('sombill-identity'),
  JWT_AUDIENCE: z.string().default('sombill-api'),
});

export const databaseEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
});

export const rabbitEnvSchema = z.object({
  RABBITMQ_URL: z.string().url(),
  RABBITMQ_EXCHANGE: z.string().default('sombill.events'),
});

export const redisEnvSchema = z.object({
  REDIS_URL: z.string().url(),
});

export class EnvValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Invalid environment configuration:\n  - ${issues.join('\n  - ')}`);
    this.name = 'EnvValidationError';
  }
}

/**
 * Docker/Kubernetes secrets convention: `X_FILE=/run/secrets/x` provides the value of `X` from a file.
 * An explicit `X` always wins.
 */
export function resolveFileVariables(source: NodeJS.ProcessEnv, declaredKeys: readonly string[]): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = { ...source };
  const declared = new Set(declaredKeys);
  for (const [key, path] of Object.entries(source)) {
    if (!key.endsWith('_FILE') || !path) continue;
    const target = key.slice(0, -'_FILE'.length);
    // Only variables this service declares; unrelated *_FILE variables (PIP_CONFIG_FILE, …) are ignored.
    if (!declared.has(target)) continue;
    if (out[target] === undefined || out[target] === '') {
      try {
        out[target] = readFileSync(path, 'utf8').trim();
      } catch (e) {
        throw new EnvValidationError([`${key}: cannot read ${path} (${(e as Error).message})`]);
      }
    }
  }
  return out;
}

export function loadEnv<S extends z.ZodType>(schema: S, source: NodeJS.ProcessEnv = process.env): z.infer<S> {
  const declaredKeys = schema instanceof z.ZodObject ? Object.keys(schema.shape) : [];
  const result = schema.safeParse(resolveFileVariables(source, declaredKeys));
  if (!result.success) {
    throw new EnvValidationError(result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`));
  }
  return result.data;
}
