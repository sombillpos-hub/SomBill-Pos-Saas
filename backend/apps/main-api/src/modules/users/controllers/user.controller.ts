import type { Request, Response } from 'express';
import { requirePrincipal } from '@sombill/authentication';
import { input } from '@sombill/validation';
import { sendCreated, sendNoContent, sendPage } from '@sombill/shared-utils';
import { requestContext } from '../../../middleware/requestContext.js';
import type { UsersService } from '../services/user.service.js';
import type { AssignRoleBody, ListUsersQuery } from '../validators/user.validator.js';

/** HTTP layer of /users: reads the validated request, calls the service, writes the response. */
export class UserController {
  constructor(private readonly users: UsersService) {}

  list = async (req: Request, res: Response) => {
    const { query } = input<unknown, ListUsersQuery>(req);
    const { items, total } = await this.users.listUsers(requirePrincipal(req), query);
    sendPage(res, items, query, total);
  };

  assignRole = async (req: Request, res: Response) => {
    const { body } = input<AssignRoleBody>(req);
    sendCreated(res, await this.users.assignRole(requirePrincipal(req), body, requestContext(req)));
  };

  revokeRole = async (req: Request, res: Response) => {
    const { params } = input<unknown, unknown, { membershipId: string }>(req);
    await this.users.revokeRole(requirePrincipal(req), params.membershipId, requestContext(req));
    sendNoContent(res);
  };
}
