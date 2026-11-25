import { z } from 'zod';

/** Request schemas for inventory. Not implemented yet (the dashboards use the Supabase backend for this). */
export const inventoryIdParams = z.object({ id: z.uuid() });
