import { z } from 'zod';

/** Request schemas for payments. Not implemented yet (the dashboards use the Supabase backend for this). */
export const paymentIdParams = z.object({ id: z.uuid() });
