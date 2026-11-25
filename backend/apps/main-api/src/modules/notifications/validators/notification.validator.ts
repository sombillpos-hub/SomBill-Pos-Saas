import { z } from 'zod';

/** Request schemas for notifications. Not implemented yet (the dashboards use the Supabase backend for this). */
export const notificationIdParams = z.object({ id: z.uuid() });
