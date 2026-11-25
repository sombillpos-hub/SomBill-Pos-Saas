import { z } from 'zod';

/** Request schemas for tables. Not implemented yet (the dashboards use the Supabase backend for this). */
export const tableIdParams = z.object({ id: z.uuid() });
