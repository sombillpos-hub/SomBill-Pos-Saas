import type { Db, Prisma, Tx } from '@sombill/database/identity';

/** Users, memberships and known branches (identity database). */
export class UserRepository {
  constructor(private readonly db: Db | Tx) {}

  findByEmail(email: string) {
    return this.db.user.findUnique({ where: { email } });
  }

  /** One page of users with their memberships matching `membershipFilter`. */
  async pageWithMemberships(
    where: Prisma.UserWhereInput,
    membershipFilter: Prisma.MembershipWhereInput,
    page: { skip: number; take: number },
  ) {
    const [total, users] = await Promise.all([
      this.db.user.count({ where }),
      this.db.user.findMany({
        where,
        orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
        ...page,
        include: {
          memberships: { where: membershipFilter, include: { role: { select: { code: true, name: true } } } },
        },
      }),
    ]);
    return { total, users };
  }

  findKnownBranch(branchId: string) {
    return this.db.knownBranch.findUnique({ where: { id: branchId } });
  }

  findMembership(key: { userId: string; organizationId: string; branchScope: string; roleId: string }) {
    return this.db.membership.findUnique({ where: { userId_organizationId_branchScope_roleId: key } });
  }

  findMembershipWithRole(id: string) {
    return this.db.membership.findUnique({ where: { id }, include: { role: { include: { permissions: true } } } });
  }

  createMembership(data: Prisma.MembershipUncheckedCreateInput) {
    return this.db.membership.create({ data });
  }

  deleteMembership(id: string) {
    return this.db.membership.delete({ where: { id } });
  }

  countOrganizationWideMemberships(organizationId: string, roleId: string) {
    return this.db.membership.count({ where: { organizationId, branchId: null, roleId } });
  }
}
