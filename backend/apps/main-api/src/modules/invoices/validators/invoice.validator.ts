import { z } from 'zod';

/** Request schemas for invoices. Not implemented yet (the dashboards use the Supabase backend for this). */
export const invoiceIdParams = z.object({ id: z.uuid() });
