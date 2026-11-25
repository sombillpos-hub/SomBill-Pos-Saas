import type { Express } from 'express';
import { createAccessTokenVerifier, TokenIssuer } from '@sombill/authentication';
import { createDb as createIdentityDb, type Db as IdentityDb } from '@sombill/database/identity';
import { createDb as createOrganizationDb, type Db as OrganizationDb } from '@sombill/database/organization';
import { createLogger, type Logger } from '@sombill/logger';
import { RabbitEventBus } from '@sombill/messaging';
import { buildMainApi } from '../app.js';
import { createEventHandler, SUBSCRIBED_EVENTS } from '../events/index.js';
import { startOutboxJobs } from '../jobs/index.js';
import { syncSystemCatalog } from '../modules/roles/services/role.service.js';
import { loadConfig, type MainApiConfig } from './env.js';

export interface MainApiRuntime {
  app: Express;
  config: MainApiConfig;
  identityDb: IdentityDb;
  organizationDb: OrganizationDb;
  logger: Logger;
  stop: () => Promise<void>;
}

/**
 * Wires the whole process: both module databases, permission catalogue sync, RabbitMQ consumer, outbox jobs, token
 * issuer and the HTTP app. Used by `server.ts` and by the integration tests, so both run the same composition.
 */
export async function createMainApiRuntime(
  env: NodeJS.ProcessEnv = process.env,
  logger?: Logger,
): Promise<MainApiRuntime> {
  const config = loadConfig(env);
  const log = logger ?? createLogger(config.SERVICE_NAME, config.LOG_LEVEL);
  const identityDb = createIdentityDb(config.IDENTITY_DATABASE_URL);
  const organizationDb = createOrganizationDb(config.ORGANIZATION_DATABASE_URL);
  await syncSystemCatalog(identityDb);

  const bus = await RabbitEventBus.connect({
    url: config.RABBITMQ_URL,
    exchange: config.RABBITMQ_EXCHANGE,
    logger: log,
    connectionName: config.SERVICE_NAME,
  });
  await bus.subscribe({
    queue: config.RABBITMQ_QUEUE,
    events: [...SUBSCRIBED_EVENTS],
    handler: createEventHandler(identityDb, config.SERVICE_NAME),
  });
  const stopOutbox = startOutboxJobs({
    identityDb,
    organizationDb,
    bus,
    logger: log,
    intervalMs: config.OUTBOX_INTERVAL_MS,
  });

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
  const app = buildMainApi({
    config,
    identityDb,
    organizationDb,
    logger: log,
    tokens,
    verify,
    readiness: [{ name: 'rabbitmq', check: () => bus.ping() }],
  });

  return {
    app,
    config,
    identityDb,
    organizationDb,
    logger: log,
    stop: async () => {
      await stopOutbox();
      await bus.close();
      await Promise.all([identityDb.$disconnect(), organizationDb.$disconnect()]);
    },
  };
}
