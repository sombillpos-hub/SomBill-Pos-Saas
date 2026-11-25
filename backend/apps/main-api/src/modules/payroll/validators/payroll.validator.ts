import { z } from 'zod';

/** Request schemas for payroll. Not implemented yet (the dashboards use the Supabase backend for this). */
export const payrollIdParams = z.object({ id: z.uuid() });
