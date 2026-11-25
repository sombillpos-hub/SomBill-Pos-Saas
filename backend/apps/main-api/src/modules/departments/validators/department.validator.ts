import { z } from 'zod';

/** Request schemas for departments. Not implemented yet (the dashboards use the Supabase backend for this). */
export const departmentIdParams = z.object({ id: z.uuid() });
