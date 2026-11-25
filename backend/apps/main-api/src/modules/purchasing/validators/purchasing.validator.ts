import { z } from 'zod';

/** Request schemas for purchasing. Not implemented yet (the dashboards use the Supabase backend for this). */
export const purchasingIdParams = z.object({ id: z.uuid() });
