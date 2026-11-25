import { z } from 'zod';

/** Request schemas for orders. Not implemented yet (the dashboards use the Supabase backend for this). */
export const orderIdParams = z.object({ id: z.uuid() });
