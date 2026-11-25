import type { StoredFile } from '@sombill/database/organization';

/** API shape of a stored file. `contentUrl` is relative to the API version root (`/api/v1`). */
export const toFileView = (f: StoredFile) => ({
  id: f.id,
  organizationId: f.organizationId,
  branchId: f.branchId,
  purpose: f.purpose,
  originalName: f.originalName,
  contentType: f.contentType,
  sizeBytes: f.sizeBytes,
  checksumSha256: f.checksumSha256,
  uploadedByUserId: f.uploadedByUserId,
  createdAt: f.createdAt.toISOString(),
  contentUrl: `/files/${f.id}/content`,
});

export type FileView = ReturnType<typeof toFileView>;
