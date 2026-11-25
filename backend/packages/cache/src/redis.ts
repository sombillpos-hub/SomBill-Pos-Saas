import { Redis } from 'ioredis';
import type { Logger } from '@sombill/logger';

/** One Redis connection with error logging (used by the API gateway rate limits). */
export function createRedis(url: string, logger: Logger): Redis {
  const redis = new Redis(url, { maxRetriesPerRequest: 2 });
  redis.on('error', (err) => logger.error({ err }, 'redis error'));
  return redis;
}
