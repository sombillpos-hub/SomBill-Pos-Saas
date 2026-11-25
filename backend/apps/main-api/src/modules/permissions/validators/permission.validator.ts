import { z } from 'zod';

/** Request schemas for permissions. Not implemented yet (the dashboards use the Supabase backend for this). */
export const permissionIdParams = z.object({ id: z.uuid() });
