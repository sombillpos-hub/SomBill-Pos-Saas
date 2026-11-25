import { Router } from 'express';
import type { AccessTokenVerifier } from '@sombill/authentication';
import { PasswordHasher } from '@sombill/authentication';
import type { Db } from '@sombill/database/identity';
import type { IdentityConfig } from '../config/env.js';
import { authRouter } from '../modules/auth/routes/auth.routes.js';
import { AuthService } from '../modules/auth/services/auth.service.js';
import { permissionsRouter } from '../modules/permissions/routes/permission.routes.js';
import { rolesRouter } from '../modules/roles/routes/role.routes.js';
import { usersRouter } from '../modules/users/routes/user.routes.js';
import { UsersService } from '../modules/users/services/user.service.js';
import type { TokenIssuer } from '@sombill/authentication';

export interface IdentityRoutesDeps {
  config: IdentityConfig;
  db: Db;
  tokens: TokenIssuer;
  verify: AccessTokenVerifier;
}

/** /auth, /users, /roles, /permissions */
export function identityRoutes(deps: IdentityRoutesDeps): Router {
  const { config, db, verify } = deps;
  const passwords = new PasswordHasher({
    memoryCost: config.ARGON2_MEMORY_KIB,
    timeCost: config.ARGON2_TIME_COST,
    parallelism: config.ARGON2_PARALLELISM,
  });
  const auth = new AuthService({
    db,
    tokens: deps.tokens,
    passwords,
    refreshTokenTtlDays: config.REFRESH_TOKEN_TTL_DAYS,
    loginMaxAttempts: config.LOGIN_MAX_ATTEMPTS,
    loginLockMinutes: config.LOGIN_LOCK_MINUTES,
    serviceName: config.SERVICE_NAME,
  });
  const users = new UsersService(db, config.SERVICE_NAME);

  const router = Router();
  router.use('/auth', authRouter({ auth, config, verify }));
  router.use('/users', usersRouter({ users, verify }));
  router.use('/roles', rolesRouter({ db, users, verify }));
  router.use('/permissions', permissionsRouter({ verify }));
  return router;
}
