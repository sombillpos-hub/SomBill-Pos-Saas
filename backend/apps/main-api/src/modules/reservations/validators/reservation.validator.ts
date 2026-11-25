import { z } from 'zod';

/** Request schemas for reservations. Not implemented yet (the dashboards use the Supabase backend for this). */
export const reservationIdParams = z.object({ id: z.uuid() });
