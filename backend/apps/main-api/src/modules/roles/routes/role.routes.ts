import { Router } from 'express';
import { authenticate, type AccessTokenVerifier } from '@sombill/authentication';
import { validate } from '@sombill/validation';
import type { Db } from '@sombill/database/identity';
import type { UsersService } from '../../users/services/user.service.js';
import { RoleController } from '../controllers/role.controller.js';
import { rolesQuery } from '../validators/role.validator.js';

/** GET /roles?organizationId= */
export function rolesRouter(deps: { db: Db; users: UsersService; verify: AccessTokenVerifier }): Router {
  const c = new RoleController(deps.db, deps.users);
  const router = Router();
  router.use(authenticate(deps.verify));
  router.get('/', validate({ query: rolesQuery }), c.list);
  return router;
}
