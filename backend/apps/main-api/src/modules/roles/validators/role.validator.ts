import { z } from 'zod';

export const rolesQuery = z.object({ organizationId: z.uuid() });

export type RolesQuery = z.infer<typeof rolesQuery>;
