import { z } from 'zod';
import { baseEnvSchema, csv, loadEnv, pemKey, rabbitEnvSchema } from '@sombill/shared-utils';

const bool = z
  .enum(['true', 'false'])
  .default('true')
  .transform((v) => v === 'true');

/**
 * One process, several modules (identity, organization, ...). Each module keeps its own PostgreSQL database, so
 * there is one connection string per module; everything else (JWT keys, RabbitMQ, CORS, outbox) is shared.
 */
export const envSchema = baseEnvSchema.extend(rabbitEnvSchema.shape).extend({
  SERVICE_NAME: z.string().default('main-api'),
  PORT: z.coerce.number().int().default(4001),
  IDENTITY_DATABASE_URL: z.url(),
  ORGANIZATION_DATABASE_URL: z.url(),
  JWT_PRIVATE_KEY: pemKey,
  JWT_PUBLIC_KEY: pemKey,
  JWT_ISSUER: z.string().default('sombill-identity'),
  JWT_AUDIENCE: z.string().default('sombill-api'),
  CORS_ORIGINS: csv,
  OUTBOX_INTERVAL_MS: z.coerce.number().int().min(50).default(500),
  /** Durable queue this process consumes from. */
  RABBITMQ_QUEUE: z.string().default('main-api.events'),

  // file uploads (modules/files)
  STORAGE_DRIVER: z.enum(['local']).default('local'),
  /** Root folder of the local-disk provider; mount it as a persistent volume in Docker. */
  STORAGE_LOCAL_DIR: z.string().default('./storage'),
  UPLOAD_MAX_BYTES: z.coerce.number().int().min(1024).max(52_428_800).default(5_242_880),

  // identity module
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
  COOKIE_SECURE: bool,
  COOKIE_PATH: z.string().default('/api/v1/auth'),
  COOKIE_DOMAIN: z.string().optional(),
  LOGIN_MAX_ATTEMPTS: z.coerce.number().int().min(3).max(20).default(5),
  LOGIN_LOCK_MINUTES: z.coerce.number().int().min(1).max(1440).default(15),
  // OWASP Password Storage Cheat Sheet minimum for Argon2id: m=19 MiB, t=2, p=1.
  ARGON2_MEMORY_KIB: z.coerce.number().int().min(19456).default(19456),
  ARGON2_TIME_COST: z.coerce.number().int().min(2).default(2),
  ARGON2_PARALLELISM: z.coerce.number().int().min(1).default(1),

  // organization module
  TRIAL_DAYS: z.coerce.number().int().min(1).max(90).default(14),
  TRIAL_MAX_BRANCHES: z.coerce.number().int().min(1).default(3),
});

export type MainApiConfig = z.infer<typeof envSchema>;
/** Modules read the slice they need; both are the same validated object. */
export type IdentityConfig = MainApiConfig;
export type OrganizationConfig = MainApiConfig;

export const loadConfig = (source: NodeJS.ProcessEnv = process.env): MainApiConfig => loadEnv(envSchema, source);
