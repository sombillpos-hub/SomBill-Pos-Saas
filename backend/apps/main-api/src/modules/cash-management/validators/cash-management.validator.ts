import { z } from 'zod';

/** Request schemas for cash-management. Not implemented yet (the dashboards use the Supabase backend for this). */
export const cashManagementIdParams = z.object({ id: z.uuid() });
