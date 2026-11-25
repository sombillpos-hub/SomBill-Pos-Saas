import { z } from 'zod';
import { paginationQuery } from '@sombill/shared-utils';
import { emailSchema } from '../../auth/validators/auth.validator.js';

export const listUsersQuery = paginationQuery
  .extend({
    organizationId: z.uuid(),
    search: z.string().trim().min(1).max(100).optional(),
  })
  .openapi('ListUsersQuery');

export const assignRoleBody = z
  .object({
    organizationId: z.uuid(),
    /** Omit (or null) for an organization-wide role. */
    branchId: z.uuid().nullable().optional(),
    email: emailSchema,
    role: z.string().trim().min(2).max(50).openapi({ example: 'cashier' }),
  })
  .openapi('AssignRoleRequest');

export const membershipIdParams = z.object({ membershipId: z.uuid() });

export type ListUsersQuery = z.infer<typeof listUsersQuery>;
export type AssignRoleBody = z.infer<typeof assignRoleBody>;
