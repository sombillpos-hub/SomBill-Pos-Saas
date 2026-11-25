import { z } from 'zod';

/** Request schemas for accounting. Not implemented yet (the dashboards use the Supabase backend for this). */
export const accountingIdParams = z.object({ id: z.uuid() });
