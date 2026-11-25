import { z } from 'zod';
import { createRegistry, errorResponses, type OpenAPIRegistry } from '@sombill/shared-utils';
import {
  changePasswordBody,
  loginBody,
  membershipView,
  refreshBody,
  registerBody,
  sessionResponse,
  userView,
} from '../modules/auth/validators/auth.validator.js';
import { assignRoleBody, listUsersQuery } from '../modules/users/validators/user.validator.js';

const json = (schema: z.ZodType) => ({ content: { 'application/json': { schema } } });
const secured = [{ bearerAuth: [] }];

export function identityOpenApi(): OpenAPIRegistry {
  const r = createRegistry();
  const tags = ['Auth'];

  r.registerPath({
    method: 'post',
    path: '/auth/register',
    tags,
    summary: 'Create an account and start a session',
    request: { body: json(registerBody) },
    responses: {
      201: { description: 'Signed in; refresh token set as httpOnly cookie', ...json(sessionResponse) },
      400: errorResponses[400],
      409: errorResponses[409],
    },
  });
  r.registerPath({
    method: 'post',
    path: '/auth/login',
    tags,
    summary: 'Sign in with e-mail and password',
    description:
      'Rate limited. After repeated failures the account is locked for a while; the response never reveals whether the e-mail exists.',
    request: { body: json(loginBody) },
    responses: { 200: { description: 'Signed in', ...json(sessionResponse) }, 401: errorResponses[401] },
  });
  r.registerPath({
    method: 'post',
    path: '/auth/refresh',
    tags,
    summary: 'Rotate the refresh token and get a new access token',
    description:
      'Reads the `sombill_rt` cookie (or `refreshToken` in the body). Reusing an already-rotated token revokes the whole session.',
    request: { body: json(refreshBody) },
    responses: { 200: { description: 'New tokens', ...json(sessionResponse) }, 401: errorResponses[401] },
  });
  r.registerPath({
    method: 'post',
    path: '/auth/logout',
    tags,
    summary: 'End the current session',
    request: { body: json(refreshBody) },
    responses: { 204: { description: 'Signed out' } },
  });
  r.registerPath({
    method: 'post',
    path: '/auth/logout-all',
    tags,
    security: secured,
    summary: 'End every session of the current user',
    responses: {
      200: {
        description: 'Sessions revoked',
        ...json(z.object({ data: z.object({ revokedSessions: z.number().int() }) })),
      },
      401: errorResponses[401],
    },
  });
  r.registerPath({
    method: 'post',
    path: '/auth/change-password',
    tags,
    security: secured,
    summary: 'Change password (signs out other sessions)',
    request: { body: json(changePasswordBody) },
    responses: { 204: { description: 'Changed' }, 400: errorResponses[400], 401: errorResponses[401] },
  });
  r.registerPath({
    method: 'get',
    path: '/auth/me',
    tags,
    security: secured,
    summary: 'Current user and memberships',
    responses: {
      200: {
        description: 'Profile',
        ...json(z.object({ data: z.object({ user: userView, memberships: z.array(membershipView) }) })),
      },
      401: errorResponses[401],
    },
  });

  r.registerPath({
    method: 'get',
    path: '/users',
    tags: ['Users'],
    security: secured,
    summary: 'Users with a role in an organization',
    description: 'Requires `user.read`. Branch-scoped readers only see users of their branches.',
    request: { query: listUsersQuery },
    responses: { 200: { description: 'Page of users' }, 401: errorResponses[401], 403: errorResponses[403] },
  });
  r.registerPath({
    method: 'post',
    path: '/users/memberships',
    tags: ['Users'],
    security: secured,
    summary: 'Give a registered user a role in an organization or branch',
    description:
      'Requires `role.assign` in the same scope, and every permission of the granted role (privilege-escalation guard). Only owners can grant `owner`.',
    request: { body: json(assignRoleBody) },
    responses: {
      201: { description: 'Assigned' },
      403: errorResponses[403],
      404: errorResponses[404],
      409: errorResponses[409],
    },
  });
  r.registerPath({
    method: 'delete',
    path: '/users/memberships/{membershipId}',
    tags: ['Users'],
    security: secured,
    summary: 'Remove a role',
    request: { params: z.object({ membershipId: z.uuid() }) },
    responses: {
      204: { description: 'Removed' },
      403: errorResponses[403],
      404: errorResponses[404],
      409: errorResponses[409],
    },
  });
  r.registerPath({
    method: 'get',
    path: '/roles',
    tags: ['Roles'],
    security: secured,
    summary: 'Roles available in an organization',
    request: { query: z.object({ organizationId: z.uuid() }) },
    responses: { 200: { description: 'Roles with permissions' }, 403: errorResponses[403] },
  });
  r.registerPath({
    method: 'get',
    path: '/permissions',
    tags: ['Roles'],
    security: secured,
    summary: 'Permission catalogue',
    responses: { 200: { description: 'All permission codes' } },
  });
  return r;
}
