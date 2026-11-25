import { z } from 'zod';
import { baseEnvSchema, csv, jwtVerifyEnvSchema, loadEnv, redisEnvSchema } from '@sombill/shared-utils';

export const envSchema = baseEnvSchema
  .extend(jwtVerifyEnvSchema.shape)
  .extend(redisEnvSchema.shape)
  .extend({
    SERVICE_NAME: z.string().default('api-gateway'),
    PORT: z.coerce.number().int().default(4000),
    /** Browser origins allowed to call the API (the dashboards and website). */
    CORS_ORIGINS: csv,
    /** Reverse-proxy hops in front of the gateway (Nginx = 1). */
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(1),
    /** Base URL of the main API (all business modules run inside it). */
    MAIN_API_URL: z.url(),
    UPSTREAM_TIMEOUT_MS: z.coerce.number().int().min(1000).default(30_000),
    RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().min(1).default(60),
    RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(300),
    AUTH_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().min(1).default(900),
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(10),
    REFRESH_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(60),
    DOCS_ENABLED: z
      .enum(['true', 'false'])
      .default('true')
      .transform((v) => v === 'true'),
    /** Set to "true" in production to enforce JWT authentication on all hospitality/POS routes. */
    AUTH_ENFORCE_HOSPITALITY: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),
  });

export type GatewayConfig = z.infer<typeof envSchema>;

export const loadConfig = (source: NodeJS.ProcessEnv = process.env): GatewayConfig => loadEnv(envSchema, source);
