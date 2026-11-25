import { z } from 'zod';

/** Request schemas for expenses. Not implemented yet (the dashboards use the Supabase backend for this). */
export const expenseIdParams = z.object({ id: z.uuid() });
