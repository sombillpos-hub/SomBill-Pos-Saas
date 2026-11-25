import { Router } from 'express';
import { authenticate, type AccessTokenVerifier } from '@sombill/authentication';
import { PermissionController } from '../controllers/permission.controller.js';

/** GET /permissions */
export function permissionsRouter(deps: { verify: AccessTokenVerifier }): Router {
  const c = new PermissionController();
  const router = Router();
  router.get('/', authenticate(deps.verify), c.list);
  return router;
}
