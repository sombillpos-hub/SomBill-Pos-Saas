import { z } from 'zod';

/** Request schemas for pos. Not implemented yet (the dashboards use the Supabase backend for this). */
export const posIdParams = z.object({ id: z.uuid() });
