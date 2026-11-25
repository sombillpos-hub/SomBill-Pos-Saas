import { z } from 'zod';

/** Request schemas for customers. Not implemented yet (the dashboards use the Supabase backend for this). */
export const customerIdParams = z.object({ id: z.uuid() });
