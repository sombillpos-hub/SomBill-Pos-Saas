import type { Db, Prisma, Tx } from '@sombill/database/organization';

/** Organizations and their subscriptions (organization database). */
export class OrganizationRepository {
  constructor(private readonly db: Db | Tx) {}

  findById(id: string) {
    return this.db.organization.findUnique({ where: { id } });
  }

  slugExists(slug: string) {
    return this.db.organization.findUnique({ where: { slug }, select: { id: true } }).then(Boolean);
  }

  create(data: Prisma.OrganizationUncheckedCreateInput) {
    return this.db.organization.create({ data });
  }

  update(id: string, data: Prisma.OrganizationUpdateInput) {
    return this.db.organization.update({ where: { id }, data });
  }

  async pageByIds(ids: string[], page: { skip: number; take: number }) {
    const where = { id: { in: ids } };
    const [total, rows] = await Promise.all([
      this.db.organization.count({ where }),
      this.db.organization.findMany({ where, orderBy: [{ name: 'asc' }, { id: 'asc' }], ...page }),
    ]);
    return { total, rows };
  }

  createSubscription(data: Prisma.SubscriptionUncheckedCreateInput) {
    return this.db.subscription.create({ data });
  }

  findSubscription(organizationId: string) {
    return this.db.subscription.findUnique({ where: { organizationId } });
  }

  /** Locks the subscription row (inside a transaction) so concurrent branch creations respect the plan limit. */
  async lockSubscription(organizationId: string) {
    const [row] = await this.db.$queryRaw<Array<{ max_branches: number; status: string }>>`
      SELECT "max_branches", "status"::text FROM "subscriptions" WHERE "organization_id" = ${organizationId}::uuid FOR UPDATE`;
    return row ? { maxBranches: row.max_branches, status: row.status } : null;
  }
}
