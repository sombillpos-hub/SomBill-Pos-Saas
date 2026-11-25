import type { Request, Response } from 'express';
import { PERMISSIONS } from '@sombill/shared-types';
import { assertCan } from '@sombill/authorization';
import { requirePrincipal } from '@sombill/authentication';
import { input } from '@sombill/validation';
import { sendOk } from '@sombill/shared-utils';
import type { Db } from '@sombill/database/identity';
import type { UsersService } from '../../users/services/user.service.js';
import { listRoles } from '../services/role.service.js';

export class RoleController {
  constructor(
    private readonly db: Db,
    private readonly users: UsersService,
  ) {}

  /** Roles usable in an organization (system roles + its custom roles). Checked against fresh memberships. */
  list = async (req: Request, res: Response) => {
    const { query } = input<unknown, { organizationId: string }>(req);
    const me = await this.users.freshPrincipal(requirePrincipal(req));
    assertCan(me, PERMISSIONS.ROLE_READ, { organizationId: query.organizationId });
    sendOk(res, await listRoles(this.db, query.organizationId));
  };
}
