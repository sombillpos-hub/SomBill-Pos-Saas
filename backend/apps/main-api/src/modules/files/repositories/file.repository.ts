import type { Db, Prisma, Tx } from '@sombill/database/organization';

/** `stored_files` (organization database). */
export class FileRepository {
  constructor(private readonly db: Db | Tx) {}

  create(data: Prisma.StoredFileUncheckedCreateInput) {
    return this.db.storedFile.create({ data });
  }

  findById(id: string) {
    return this.db.storedFile.findUnique({ where: { id } });
  }

  delete(id: string) {
    return this.db.storedFile.delete({ where: { id } });
  }

  async page(where: Prisma.StoredFileWhereInput, page: { skip: number; take: number }) {
    const [total, rows] = await Promise.all([
      this.db.storedFile.count({ where }),
      this.db.storedFile.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], ...page }),
    ]);
    return { total, rows };
  }

  branchBelongsTo(branchId: string, organizationId: string) {
    return this.db.branch.findFirst({ where: { id: branchId, organizationId }, select: { id: true } }).then(Boolean);
  }
}
