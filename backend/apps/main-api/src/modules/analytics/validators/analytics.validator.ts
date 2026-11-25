import { z } from 'zod';

/** Request schemas for analytics. Not implemented yet (the dashboards use the Supabase backend for this). */
export const analyticsIdParams = z.object({ id: z.uuid() });
