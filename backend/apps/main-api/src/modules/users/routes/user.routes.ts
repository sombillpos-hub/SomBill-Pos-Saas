import { Router } from 'express';
import { authenticate, type AccessTokenVerifier } from '@sombill/authentication';
import { validate } from '@sombill/validation';
import { UserController } from '../controllers/user.controller.js';
import type { UsersService } from '../services/user.service.js';
import { assignRoleBody, listUsersQuery, membershipIdParams } from '../validators/user.validator.js';

/** GET /users · POST /users/memberships · DELETE /users/memberships/:membershipId */
export function usersRouter(deps: { users: UsersService; verify: AccessTokenVerifier }): Router {
  const c = new UserController(deps.users);
  const router = Router();
  router.use(authenticate(deps.verify));
  router.get('/', validate({ query: listUsersQuery }), c.list);
  router.post('/memberships', validate({ body: assignRoleBody }), c.assignRole);
  router.delete('/memberships/:membershipId', validate({ params: membershipIdParams }), c.revokeRole);
  return router;
}
