import { z } from 'zod';

/** Request schemas for rooms. Not implemented yet (the dashboards use the Supabase backend for this). */
export const roomIdParams = z.object({ id: z.uuid() });
