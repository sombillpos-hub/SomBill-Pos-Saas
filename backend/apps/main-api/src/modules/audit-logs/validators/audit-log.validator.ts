import { z } from 'zod';

/** Request schemas for audit-logs. Placeholder. Today the logic lives in the routes/services files of this module; split it out here later. */
export const auditLogIdParams = z.object({ id: z.uuid() });
