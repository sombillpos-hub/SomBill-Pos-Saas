import { Router } from 'express';
import { authenticate, type AccessTokenVerifier } from '@sombill/authentication';
import { validate } from '@sombill/validation';
import { createBranchBody, listBranchesQuery } from '../../branches/validators/branch.validator.js';
import type { BranchesService } from '../../branches/services/branch.service.js';
import { OrganizationController } from '../controllers/organization.controller.js';
import type { OrganizationsService } from '../services/organization.service.js';
import {
  createOrganizationBody,
  listOrganizationsQuery,
  organizationParams,
  updateOrganizationBody,
} from '../validators/organization.validator.js';

/** /organizations, /organizations/:id, /organizations/:id/subscription, /organizations/:id/branches */
export function organizationsRouter(deps: {
  organizations: OrganizationsService;
  branches: BranchesService;
  verify: AccessTokenVerifier;
}): Router {
  const c = new OrganizationController(deps.organizations, deps.branches);
  const router = Router();
  router.use(authenticate(deps.verify));
  router.post('/', validate({ body: createOrganizationBody }), c.create);
  router.get('/', validate({ query: listOrganizationsQuery }), c.list);
  router.get('/:organizationId', validate({ params: organizationParams }), c.get);
  router.patch('/:organizationId', validate({ params: organizationParams, body: updateOrganizationBody }), c.update);
  router.get('/:organizationId/subscription', validate({ params: organizationParams }), c.subscription);
  router.post(
    '/:organizationId/branches',
    validate({ params: organizationParams, body: createBranchBody }),
    c.createBranch,
  );
  router.get(
    '/:organizationId/branches',
    validate({ params: organizationParams, query: listBranchesQuery }),
    c.listBranches,
  );
  return router;
}
