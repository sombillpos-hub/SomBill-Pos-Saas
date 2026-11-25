import type { Permission as PermissionCode } from '@sombill/shared-types';
import type { Db, Tx } from '@sombill/database/identity';

export const SYSTEM_SCOPE = 'system';

/** Roles, role permissions and the permission catalogue (identity database). */
export class RoleRepository {
  constructor(private readonly db: Db | Tx) {}

  upsertPermission(code: string, description: string) {
    return this.db.permission.upsert({ where: { code }, update: {}, create: { code, description } });
  }

  upsertSystemRole(code: string, name: string) {
    return this.db.role.upsert({
      where: { scopeKey_code: { scopeKey: SYSTEM_SCOPE, code } },
      update: { name },
      create: { scopeKey: SYSTEM_SCOPE, code, name, isSystem: true },
    });
  }

  /** Makes a role hold exactly `permissions`. */
  async setRolePermissions(roleId: string, permissions: readonly string[]) {
    await this.db.rolePermission.deleteMany({ where: { roleId, permissionCode: { notIn: [...permissions] } } });
    await this.db.rolePermission.createMany({
      data: permissions.map((permissionCode) => ({ roleId, permissionCode })),
      skipDuplicates: true,
    });
  }

  findByCode(scopeKey: string, code: string) {
    return this.db.role.findUnique({ where: { scopeKey_code: { scopeKey, code } }, include: { permissions: true } });
  }

  listForOrganization(organizationId: string) {
    return this.db.role.findMany({
      where: { scopeKey: { in: [SYSTEM_SCOPE, organizationId] } },
      include: { permissions: { select: { permissionCode: true } } },
      orderBy: [{ isSystem: 'desc' }, { code: 'asc' }],
    });
  }

  async membershipClaims(userId: string) {
    const rows = await this.db.membership.findMany({
      where: { userId },
      include: { role: { include: { permissions: { select: { permissionCode: true } } } } },
      orderBy: [{ organizationId: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map((m) => ({
      organizationId: m.organizationId,
      branchId: m.branchId,
      role: m.role.code,
      permissions: m.role.permissions.map((p) => p.permissionCode as PermissionCode),
    }));
  }
}
