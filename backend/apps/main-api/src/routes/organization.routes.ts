import { Router } from 'express';
import type { AccessTokenVerifier } from '@sombill/authentication';
import type { Db } from '@sombill/database/organization';
import type { Logger } from '@sombill/logger';
import type { StorageProvider } from '@sombill/storage';
import type { OrganizationConfig } from '../config/env.js';
import { branchesRouter } from '../modules/branches/routes/branch.routes.js';
import { BranchesService } from '../modules/branches/services/branch.service.js';
import { organizationsRouter } from '../modules/organizations/routes/organization.routes.js';
import { OrganizationsService } from '../modules/organizations/services/organization.service.js';
import { filesRouter } from '../modules/files/routes/file.routes.js';
import { FilesService } from '../modules/files/services/file.service.js';

export interface OrganizationRoutesDeps {
  config: OrganizationConfig;
  db: Db;
  verify: AccessTokenVerifier;
  storage: StorageProvider;
  logger: Logger;
}

/** /organizations, /branches, /files */
export function organizationRoutes(deps: OrganizationRoutesDeps): Router {
  const { config, db, verify } = deps;
  const organizations = new OrganizationsService(db, {
    serviceName: config.SERVICE_NAME,
    trialDays: config.TRIAL_DAYS,
    trialMaxBranches: config.TRIAL_MAX_BRANCHES,
  });
  const branches = new BranchesService(db, config.SERVICE_NAME);
  const files = new FilesService(db, deps.storage, deps.logger);

  const router = Router();
  router.use('/organizations', organizationsRouter({ organizations, branches, verify }));
  router.use('/branches', branchesRouter({ branches, verify }));
  router.use('/files', filesRouter({ files, verify, maxBytes: config.UPLOAD_MAX_BYTES }));
  return router;
}
