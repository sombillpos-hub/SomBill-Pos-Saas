import { z } from 'zod';

/** Request schemas for reports. Not implemented yet (the dashboards use the Supabase backend for this). */
export const reportIdParams = z.object({ id: z.uuid() });
