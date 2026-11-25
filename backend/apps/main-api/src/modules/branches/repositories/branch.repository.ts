import type { Db, Prisma, Tx } from '@sombill/database/organization';

/** Branches and branch settings (organization database). */
export class BranchRepository {
  constructor(private readonly db: Db | Tx) {}

  findById(id: string) {
    return this.db.branch.findUnique({ where: { id } });
  }

  codeExists(organizationId: string, code: string) {
    return this.db.branch
      .findUnique({ where: { organizationId_code: { organizationId, code } }, select: { id: true } })
      .then(Boolean);
  }

  countInOrganization(organizationId: string) {
    return this.db.branch.count({ where: { organizationId } });
  }

  /** Creates the branch together with its default settings row. */
  create(data: Omit<Prisma.BranchUncheckedCreateInput, 'settings'>, settingsUpdatedBy: string) {
    return this.db.branch.create({ data: { ...data, settings: { create: { updatedByUserId: settingsUpdatedBy } } } });
  }

  update(id: string, data: Prisma.BranchUpdateInput) {
    return this.db.branch.update({ where: { id }, data });
  }

  async page(where: Prisma.BranchWhereInput, page: { skip: number; take: number }) {
    const [total, rows] = await Promise.all([
      this.db.branch.count({ where }),
      this.db.branch.findMany({ where, orderBy: [{ code: 'asc' }], ...page }),
    ]);
    return { total, rows };
  }

  getSettings(branchId: string) {
    return this.db.branchSettings.findUniqueOrThrow({ where: { branchId } });
  }

  updateSettings(branchId: string, data: Prisma.BranchSettingsUpdateInput) {
    return this.db.branchSettings.update({ where: { branchId }, data });
  }
}
