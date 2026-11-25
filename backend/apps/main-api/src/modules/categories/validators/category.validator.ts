import { z } from 'zod';

/** Request schemas for categories. Not implemented yet (the dashboards use the Supabase backend for this). */
export const categoryIdParams = z.object({ id: z.uuid() });
