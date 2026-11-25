import { z } from 'zod';

/** Request schemas for employees. Not implemented yet (the dashboards use the Supabase backend for this). */
export const employeeIdParams = z.object({ id: z.uuid() });
