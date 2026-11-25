import { z } from 'zod';

/** Request schemas for kitchen. Not implemented yet (the dashboards use the Supabase backend for this). */
export const kitchenIdParams = z.object({ id: z.uuid() });
