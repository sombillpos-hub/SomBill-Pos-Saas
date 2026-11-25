import { z } from 'zod';

/** Request schemas for suppliers. Not implemented yet (the dashboards use the Supabase backend for this). */
export const supplierIdParams = z.object({ id: z.uuid() });
