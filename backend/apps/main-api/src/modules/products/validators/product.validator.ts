import { z } from 'zod';

/** Request schemas for products. Not implemented yet (the dashboards use the Supabase backend for this). */
export const productIdParams = z.object({ id: z.uuid() });
