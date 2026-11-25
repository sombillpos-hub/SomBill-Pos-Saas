import { z } from 'zod';

/** Request schemas for restaurants. Not implemented yet (the dashboards use the Supabase backend for this). */
export const restaurantIdParams = z.object({ id: z.uuid() });
