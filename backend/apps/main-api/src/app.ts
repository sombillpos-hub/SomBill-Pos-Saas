import type { Express } from 'express';
import type { AccessTokenVerifier, TokenIssuer } from '@sombill/authentication';
import type { Db as IdentityDb } from '@sombill/database/identity';
import type { Db as OrganizationDb } from '@sombill/database/organization';
import type { Logger } from '@sombill/logger';
import { LocalDiskStorage, type StorageProvider } from '@sombill/storage';
import { createServiceApp, finalizeApp, type ReadinessCheck } from '@sombill/shared-utils';
import type { MainApiConfig } from './config/env.js';
import { identityOpenApi } from './routes/identity.openapi.js';
import { organizationOpenApi } from './routes/organization.openapi.js';
import { hospitalityRoutes, identityRoutes, organizationRoutes, publicRoutes } from './routes/index.js';
import { mountModuleOpenApi } from './utils/index.js';

export interface MainApiDeps {
  config: MainApiConfig;
  identityDb: IdentityDb;
  organizationDb: OrganizationDb;
  logger: Logger;
  tokens: TokenIssuer;
  verify: AccessTokenVerifier;
  /** Defaults to the local-disk provider at STORAGE_LOCAL_DIR. */
  storage?: StorageProvider;
  readiness?: ReadinessCheck[];
}

export const createStorage = (config: MainApiConfig): StorageProvider => new LocalDiskStorage(config.STORAGE_LOCAL_DIR);

/** The main API: one Express app that mounts every business module behind the gateway. */
export function buildMainApi(deps: MainApiDeps): Express {
  const { config, identityDb, organizationDb } = deps;
  const storage = deps.storage ?? createStorage(config);
  const app = createServiceApp({
    serviceName: config.SERVICE_NAME,
    logger: deps.logger,
    corsOrigins: config.CORS_ORIGINS,
    readiness: [
      { name: 'identity-database', check: async () => void (await identityDb.$queryRaw`SELECT 1`) },
      { name: 'organization-database', check: async () => void (await organizationDb.$queryRaw`SELECT 1`) },
      { name: 'storage', check: () => storage.check() },
      ...(deps.readiness ?? []),
    ],
  });
  mountModuleOpenApi(app, 'identity', identityOpenApi(), {
    title: 'SomBill Identity API',
    version: '1.0.0',
    serverUrl: '/api/v1',
  });
  mountModuleOpenApi(app, 'organization', organizationOpenApi(), {
    title: 'SomBill Organization API',
    version: '1.0.0',
    serverUrl: '/api/v1',
  });
  app.use(identityRoutes({ config, db: identityDb, tokens: deps.tokens, verify: deps.verify }));
  app.use(organizationRoutes({ config, db: organizationDb, verify: deps.verify, storage, logger: deps.logger }));
  app.use(hospitalityRoutes());
  app.use(publicRoutes());
  return finalizeApp(app, deps.logger);
}

export interface IdentityModuleDeps {
  config: MainApiConfig;
  db: IdentityDb;
  logger: Logger;
  tokens: TokenIssuer;
  verify: AccessTokenVerifier;
  readiness?: ReadinessCheck[];
}

/** Identity module on its own (no organization database). Used by the module tests. */
export function buildIdentityApp(deps: IdentityModuleDeps): Express {
  const app = createServiceApp({
    serviceName: deps.config.SERVICE_NAME,
    logger: deps.logger,
    corsOrigins: deps.config.CORS_ORIGINS,
    readiness: [
      { name: 'database', check: async () => void (await deps.db.$queryRaw`SELECT 1`) },
      ...(deps.readiness ?? []),
    ],
  });
  mountModuleOpenApi(app, 'identity', identityOpenApi(), {
    title: 'SomBill Identity API',
    version: '1.0.0',
    serverUrl: '/api/v1',
  });
  app.use(identityRoutes(deps));
  return finalizeApp(app, deps.logger);
}

export interface OrganizationModuleDeps {
  config: MainApiConfig;
  db: OrganizationDb;
  logger: Logger;
  verify: AccessTokenVerifier;
  storage?: StorageProvider;
  readiness?: ReadinessCheck[];
}

/** Organization module on its own (no identity database). Used by the module tests. */
export function buildOrganizationApp(deps: OrganizationModuleDeps): Express {
  const app = createServiceApp({
    serviceName: deps.config.SERVICE_NAME,
    logger: deps.logger,
    corsOrigins: deps.config.CORS_ORIGINS,
    readiness: [
      { name: 'database', check: async () => void (await deps.db.$queryRaw`SELECT 1`) },
      ...(deps.readiness ?? []),
    ],
  });
  mountModuleOpenApi(app, 'organization', organizationOpenApi(), {
    title: 'SomBill Organization API',
    version: '1.0.0',
    serverUrl: '/api/v1',
  });
  app.use(organizationRoutes({ ...deps, storage: deps.storage ?? createStorage(deps.config) }));
  return finalizeApp(app, deps.logger);
}
