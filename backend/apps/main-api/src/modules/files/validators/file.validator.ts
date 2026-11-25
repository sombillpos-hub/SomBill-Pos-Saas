import { z } from 'zod';
import { paginationQuery } from '@sombill/shared-utils';
import { FILE_PURPOSES } from '../types/file.types.js';

export const uploadFileBody = z.object({
  organizationId: z.uuid(),
  branchId: z.uuid().optional(),
  purpose: z.enum(FILE_PURPOSES),
});

export const listFilesQuery = paginationQuery.extend({
  organizationId: z.uuid(),
  branchId: z.uuid().optional(),
  purpose: z.enum(FILE_PURPOSES).optional(),
});

export const fileParams = z.object({ fileId: z.uuid() });

export type UploadFileBody = z.infer<typeof uploadFileBody>;
export type ListFilesQuery = z.infer<typeof listFilesQuery>;
