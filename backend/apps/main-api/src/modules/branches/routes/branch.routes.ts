import { Router } from 'express';
import { authenticate, type AccessTokenVerifier } from '@sombill/authentication';
import { validate } from '@sombill/validation';
import { BranchController } from '../controllers/branch.controller.js';
import type { BranchesService } from '../services/branch.service.js';
import { branchParams, branchSettingsBody, updateBranchBody } from '../validators/branch.validator.js';

/** /branches/:branchId and /branches/:branchId/settings */
export function branchesRouter(deps: { branches: BranchesService; verify: AccessTokenVerifier }): Router {
  const c = new BranchController(deps.branches);
  const router = Router();
  router.use(authenticate(deps.verify));
  router.get('/:branchId', validate({ params: branchParams }), c.get);
  router.patch('/:branchId', validate({ params: branchParams, body: updateBranchBody }), c.update);
  router.get('/:branchId/settings', validate({ params: branchParams }), c.getSettings);
  router.put('/:branchId/settings', validate({ params: branchParams, body: branchSettingsBody }), c.updateSettings);
  return router;
}
