import { z } from 'zod';

/** Request schemas for subscriptions. Not implemented yet (the dashboards use the Supabase backend for this). */
export const subscriptionIdParams = z.object({ id: z.uuid() });
