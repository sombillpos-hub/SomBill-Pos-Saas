import { Router } from 'express';
import { authenticate, type AccessTokenVerifier } from '@sombill/authentication';
import { validate } from '@sombill/validation';
import type { IdentityConfig } from '../../../config/env.js';
import { AuthController } from '../controllers/auth.controller.js';
import type { AuthService } from '../services/auth.service.js';
import { changePasswordBody, loginBody, refreshBody, registerBody } from '../validators/auth.validator.js';

export { REFRESH_COOKIE } from '../controllers/auth.controller.js';

/** /auth/register, /login, /refresh, /logout, /logout-all, /change-password, /me */
export function authRouter(deps: { auth: AuthService; config: IdentityConfig; verify: AccessTokenVerifier }): Router {
  const c = new AuthController(deps.auth, deps.config, deps.verify);
  const router = Router();
  router.post('/register', validate({ body: registerBody }), c.register);
  router.post('/login', validate({ body: loginBody }), c.login);
  router.post('/refresh', validate({ body: refreshBody }), c.refresh);
  router.post('/logout', validate({ body: refreshBody }), c.logout);
  router.post('/logout-all', authenticate(deps.verify), c.logoutAll);
  router.post('/change-password', authenticate(deps.verify), validate({ body: changePasswordBody }), c.changePassword);
  router.get('/me', authenticate(deps.verify), c.me);
  return router;
}
