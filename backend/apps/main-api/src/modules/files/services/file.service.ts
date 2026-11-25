import { createHash, randomUUID } from 'node:crypto';
import { PERMISSIONS, type Permission, type Principal } from '@sombill/shared-types';
import { assertCan, can, isMemberOf, type AccessScope } from '@sombill/authorization';
import { AppError, forbidden, notFound, toSkipTake } from '@sombill/shared-utils';
import type { Db, Prisma, StoredFile } from '@sombill/database/organization';
import type { Logger } from '@sombill/logger';
import { sniffFileType, type StorageProvider } from '@sombill/storage';
import type { RequestContext } from '../../../middleware/requestContext.js';
import { writeAudit } from '../../audit-logs/repositories/organization-audit-log.repository.js';
import { toFileView } from '../models/file.model.js';
import { FileRepository } from '../repositories/file.repository.js';
import { ALLOWED_TYPES, type FilePurpose, type IncomingFile } from '../types/file.types.js';
import type { ListFilesQuery, UploadFileBody } from '../validators/file.validator.js';

const PRIVATE_READ: Permission[] = [PERMISSIONS.EXPENSE_CREATE, PERMISSIONS.EXPENSE_APPROVE];

/** Permission needed to upload or delete a file of this purpose in this scope. */
function writePermission(purpose: FilePurpose, branchId: string | null): Permission {
  switch (purpose) {
    case 'MENU_IMAGE':
      return PERMISSIONS.CATALOG_MANAGE;
    case 'EXPENSE_ATTACHMENT':
      return PERMISSIONS.EXPENSE_CREATE;
    case 'BRANDING':
      return branchId ? PERMISSIONS.BRANCH_SETTINGS_MANAGE : PERMISSIONS.ORGANIZATION_UPDATE;
    case 'DOCUMENT':
      return branchId ? PERMISSIONS.BRANCH_UPDATE : PERMISSIONS.ORGANIZATION_UPDATE;
  }
}

const scopeOf = (organizationId: string, branchId: string | null): AccessScope =>
  branchId ? { organizationId, branchId } : { organizationId };

/** Keeps the base name only, without control characters, at most 200 characters. */
export function cleanFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? '';
  // eslint-disable-next-line no-control-regex
  const cleaned = base.replace(/[\u0000-\u001f\u007f"]/g, '').trim();
  return (cleaned || 'file').slice(0, 200);
}

export class FilesService {
  private readonly files: FileRepository;

  constructor(
    private readonly db: Db,
    private readonly storage: StorageProvider,
    private readonly logger: Logger,
  ) {
    this.files = new FileRepository(db);
  }

  async upload(actor: Principal, body: UploadFileBody, file: IncomingFile, ctx: RequestContext) {
    const branchId = body.branchId ?? null;
    assertCan(actor, writePermission(body.purpose, branchId), scopeOf(body.organizationId, branchId));
    if (branchId && !(await this.files.branchBelongsTo(branchId, body.organizationId))) throw notFound('Branch');

    const detected = sniffFileType(file.buffer);
    if (!detected || !ALLOWED_TYPES[body.purpose].includes(detected.mime)) {
      throw new AppError(415, 'UNSUPPORTED_FILE_TYPE', 'This file type is not allowed here.', {
        allowed: ALLOWED_TYPES[body.purpose],
      });
    }
    const id = randomUUID();
    const key = `${body.organizationId}/${body.purpose.toLowerCase()}/${id}.${detected.ext}`;
    const checksum = createHash('sha256').update(file.buffer).digest('hex');

    await this.storage.put(key, file.buffer, detected.mime);
    try {
      const row = await this.db.$transaction(async (tx) => {
        const created = await new FileRepository(tx).create({
          id,
          organizationId: body.organizationId,
          branchId,
          purpose: body.purpose,
          storageKey: key,
          originalName: cleanFileName(file.originalName),
          contentType: detected.mime,
          sizeBytes: file.buffer.byteLength,
          checksumSha256: checksum,
          uploadedByUserId: actor.userId,
        });
        await writeAudit(tx, {
          action: 'file.uploaded',
          actorUserId: actor.userId,
          organizationId: body.organizationId,
          targetType: 'file',
          targetId: id,
          metadata: { purpose: body.purpose, branchId, sizeBytes: created.sizeBytes, contentType: detected.mime },
          ...ctx,
        });
        return created;
      });
      return toFileView(row);
    } catch (e) {
      // The metadata was not saved: do not leave an unreachable object behind.
      await this.storage.remove(key).catch((err) => this.logger.error({ err, key }, 'orphaned upload not removed'));
      throw e;
    }
  }

  async list(actor: Principal, q: ListFilesQuery) {
    const scope = scopeOf(q.organizationId, q.branchId ?? null);
    assertCan(actor, PERMISSIONS.ORGANIZATION_READ, scope);
    const seesPrivate = PRIVATE_READ.some((p) => can(actor, p, scope));
    if (q.purpose === 'EXPENSE_ATTACHMENT' && !seesPrivate) throw forbidden();
    const where: Prisma.StoredFileWhereInput = {
      organizationId: q.organizationId,
      ...(q.branchId ? { branchId: q.branchId } : {}),
      ...(q.purpose ? { purpose: q.purpose } : seesPrivate ? {} : { purpose: { not: 'EXPENSE_ATTACHMENT' } }),
    };
    const { total, rows } = await this.files.page(where, toSkipTake(q));
    return { total, items: rows.map(toFileView) };
  }

  /** Loads a file the caller may read; outsiders get 404 so file ids cannot be probed across organizations. */
  private async readable(actor: Principal, fileId: string): Promise<StoredFile> {
    const f = await this.files.findById(fileId);
    if (!f || !isMemberOf(actor, f.organizationId)) throw notFound('File');
    const scope = scopeOf(f.organizationId, f.branchId);
    const allowed =
      f.purpose === 'EXPENSE_ATTACHMENT'
        ? PRIVATE_READ.some((p) => can(actor, p, scope))
        : can(actor, PERMISSIONS.ORGANIZATION_READ, scope);
    if (!allowed) throw forbidden();
    return f;
  }

  async get(actor: Principal, fileId: string) {
    return toFileView(await this.readable(actor, fileId));
  }

  async content(actor: Principal, fileId: string) {
    const f = await this.readable(actor, fileId);
    const bytes = await this.storage.get(f.storageKey);
    if (!bytes) {
      this.logger.error({ fileId, key: f.storageKey }, 'stored file is missing from storage');
      throw notFound('File');
    }
    return { file: f, bytes };
  }

  async remove(actor: Principal, fileId: string, ctx: RequestContext): Promise<void> {
    const f = await this.files.findById(fileId);
    if (!f || !isMemberOf(actor, f.organizationId)) throw notFound('File');
    assertCan(actor, writePermission(f.purpose, f.branchId), scopeOf(f.organizationId, f.branchId));
    await this.db.$transaction(async (tx) => {
      await new FileRepository(tx).delete(f.id);
      await writeAudit(tx, {
        action: 'file.deleted',
        actorUserId: actor.userId,
        organizationId: f.organizationId,
        targetType: 'file',
        targetId: f.id,
        metadata: { purpose: f.purpose, originalName: f.originalName },
        ...ctx,
      });
    });
    await this.storage
      .remove(f.storageKey)
      .catch((err) => this.logger.error({ err, key: f.storageKey }, 'deleted file not removed from storage'));
  }
}
