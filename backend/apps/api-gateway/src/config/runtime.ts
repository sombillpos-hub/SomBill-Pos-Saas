import type { Express } from 'express';
import type { Redis } from 'ioredis';
import { createRedis } from '@sombill/cache';
import { createAccessTokenVerifier } from '@sombill/authentication';
import { createLogger, type Logger } from '@sombill/logger';
import { buildGateway } from '../app.js';
import { loadConfig, type GatewayConfig } from './env.js';

export interface GatewayRuntime {
  app: Express;
  config: GatewayConfig;
  logger: Logger;
  redis: Redis;
  stop: () => Promise<void>;
}

export async function createGatewayRuntime(
  env: NodeJS.ProcessEnv = process.env,
  logger?: Logger,
): Promise<GatewayRuntime> {
  const config = loadConfig(env);
  const log = logger ?? createLogger(config.SERVICE_NAME, config.LOG_LEVEL);
  const redis = createRedis(config.REDIS_URL, log);
  const verify = await createAccessTokenVerifier({
    publicKeyPem: config.JWT_PUBLIC_KEY,
    issuer: config.JWT_ISSUER,
    audience: config.JWT_AUDIENCE,
  });
  const app = buildGateway({ config, logger: log, redis, verify });
  return { app, config, logger: log, redis, stop: async () => void (await redis.quit()) };
}
