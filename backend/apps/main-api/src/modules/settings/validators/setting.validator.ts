import { z } from 'zod';

/** Request schemas for settings. Not implemented yet (the dashboards use the Supabase backend for this). */
export const settingIdParams = z.object({ id: z.uuid() });
