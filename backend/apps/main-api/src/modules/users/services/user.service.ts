import { createEvent, enqueueOutbox } from '@sombill/messaging';
import { PERMISSIONS, SYSTEM_ROLES, type Permission, type Principal } from '@sombill/shared-types';
import { AppError, conflict, forbidden, notFound, toSkipTake } from '@sombill/shared-utils';
import { assertCan, can, type AccessScope } from '@sombill/authorization';
import type { Db } from '@sombill/database/identity';
import { UserRepository } from '../repositories/user.repository.js';
import { toUserListItem } from '../models/user.model.js';
import { writeAudit } from '../../audit-logs/repositories/identity-audit-log.repository.js';
import type { RequestContext as ClientInfo } from '../../../middleware/requestContext.js';
import { findRole, loadMembershipClaims } from '../../roles/services/role.service.js';
import type { AssignRoleBody, ListUsersQuery } from '../validators/user.validator.js';

/**
 * Role management. Authorization for these operations uses memberships read fresh from the database (not the
 * possibly minutes-old token claims), because they change who can do what.
 */
export class UsersService {
  private readonly users: UserRepository;

  constructor(
    private readonly db: Db,
    private readonly serviceName: string,
  ) {
    this.users = new UserRepository(db);
  }

  /** The caller as the database sees them right now. */
  async freshPrincipal(p: Principal): Promise<Principal> {
    return { ...p, memberships: await loadMembershipClaims(this.db, p.userId) };
  }

  async listUsers(actor: Principal, q: ListUsersQuery) {
    const me = await this.freshPrincipal(actor);
    const orgWide = can(me, PERMISSIONS.USER_READ, { organizationId: q.organizationId });
    const branchIds = me.memberships
      .filter(
        (m) => m.organizationId === q.organizationId && m.branchId && m.permissions.includes(PERMISSIONS.USER_READ),
      )
      .map((m) => m.branchId as string);
    if (!orgWide && branchIds.length === 0) throw forbidden();

    const membershipFilter = orgWide
      ? { organizationId: q.organizationId }
      : { organizationId: q.organizationId, branchId: { in: branchIds } };
    const where = {
      memberships: { some: membershipFilter },
      ...(q.search
        ? {
            OR: [
              { email: { contains: q.search, mode: 'insensitive' as const } },
              { fullName: { contains: q.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const { total, users } = await this.users.pageWithMemberships(where, membershipFilter, toSkipTake(q));
    return { total, items: users.map(toUserListItem) };
  }

  async assignRole(actor: Principal, body: AssignRoleBody, client: ClientInfo) {
    const me = await this.freshPrincipal(actor);
    const branchId = body.branchId ?? null;
    const scope: AccessScope = branchId
      ? { organizationId: body.organizationId, branchId }
      : { organizationId: body.organizationId };
    assertCan(me, PERMISSIONS.ROLE_ASSIGN, scope);

    const role = await findRole(this.db, body.organizationId, body.role);
    if (!role) throw notFound('Role');
    this.assertMayGrant(
      me,
      role.code,
      role.permissions.map((p) => p.permissionCode as Permission),
      scope,
    );

    if (branchId) {
      const branch = await this.users.findKnownBranch(branchId);
      if (!branch || branch.organizationId !== body.organizationId) throw notFound('Branch');
    }
    const target = await this.users.findByEmail(body.email);
    if (!target) throw notFound('User');

    return this.db.$transaction(async (tx) => {
      const repo = new UserRepository(tx);
      const branchScope = branchId ?? '*';
      const existing = await repo.findMembership({
        userId: target.id,
        organizationId: body.organizationId,
        branchScope,
        roleId: role.id,
      });
      if (existing) throw conflict('The user already has this role here.', 'ALREADY_ASSIGNED');
      const m = await repo.createMembership({
        userId: target.id,
        organizationId: body.organizationId,
        branchId,
        branchScope,
        roleId: role.id,
        createdByUserId: me.userId,
      });
      await writeAudit(tx, {
        action: 'role.assigned',
        actorUserId: me.userId,
        organizationId: body.organizationId,
        targetType: 'membership',
        targetId: m.id,
        metadata: { userId: target.id, role: role.code, branchId },
        ...client,
      });
      await enqueueOutbox(
        tx,
        createEvent(
          'role.assigned',
          1,
          {
            userId: target.id,
            organizationId: body.organizationId,
            branchId,
            role: role.code,
            assignedByUserId: me.userId,
          },
          { source: this.serviceName, correlationId: client.requestId },
        ),
      );
      return { id: m.id, userId: target.id, organizationId: m.organizationId, branchId: m.branchId, role: role.code };
    });
  }

  async revokeRole(actor: Principal, membershipId: string, client: ClientInfo): Promise<void> {
    const me = await this.freshPrincipal(actor);
    const m = await this.users.findMembershipWithRole(membershipId);
    // Outsiders get 404 rather than 403, so membership ids cannot be probed across organizations.
    if (!m || !me.memberships.some((x) => x.organizationId === m.organizationId)) throw notFound('Membership');
    const scope: AccessScope = m.branchId
      ? { organizationId: m.organizationId, branchId: m.branchId }
      : { organizationId: m.organizationId };
    assertCan(me, PERMISSIONS.ROLE_ASSIGN, scope);
    this.assertMayGrant(
      me,
      m.role.code,
      m.role.permissions.map((p) => p.permissionCode as Permission),
      scope,
    );

    await this.db.$transaction(async (tx) => {
      const repo = new UserRepository(tx);
      if (m.role.code === SYSTEM_ROLES.OWNER && m.branchId === null) {
        const owners = await repo.countOrganizationWideMemberships(m.organizationId, m.roleId);
        if (owners <= 1) throw new AppError(409, 'LAST_OWNER', 'An organization must keep at least one owner.');
      }
      await repo.deleteMembership(m.id);
      await writeAudit(tx, {
        action: 'role.revoked',
        actorUserId: me.userId,
        organizationId: m.organizationId,
        targetType: 'membership',
        targetId: m.id,
        metadata: { userId: m.userId, role: m.role.code, branchId: m.branchId },
        ...client,
      });
      await enqueueOutbox(
        tx,
        createEvent(
          'role.revoked',
          1,
          {
            userId: m.userId,
            organizationId: m.organizationId,
            branchId: m.branchId,
            role: m.role.code,
            revokedByUserId: me.userId,
          },
          { source: this.serviceName, correlationId: client.requestId },
        ),
      );
    });
  }

  /**
   * Privilege-escalation guard: you can only grant (or take away) a role whose every permission you hold yourself
   * in that scope, and only an organization-wide owner can grant or revoke the owner role.
   */
  private assertMayGrant(me: Principal, roleCode: string, permissions: Permission[], scope: AccessScope): void {
    if (roleCode === SYSTEM_ROLES.OWNER) {
      const isOwner = me.memberships.some(
        (m) => m.organizationId === scope.organizationId && m.branchId === null && m.role === SYSTEM_ROLES.OWNER,
      );
      if (!isOwner) throw forbidden('Only an owner can manage the owner role.');
    }
    const missing = permissions.filter((p) => !can(me, p, scope));
    if (missing.length > 0) {
      throw new AppError(403, 'PRIVILEGE_ESCALATION', 'You cannot grant a role with permissions you do not have.', {
        missing,
      });
    }
  }
}
