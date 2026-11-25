import { z } from 'zod';

/** Request schemas for hotels. Not implemented yet (the dashboards use the Supabase backend for this). */
export const hotelIdParams = z.object({ id: z.uuid() });
