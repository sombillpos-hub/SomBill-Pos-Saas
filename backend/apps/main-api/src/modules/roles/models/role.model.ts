import type { Role } from '@sombill/database/identity';

/** API shape of a role with its permission codes. */
export const toRoleView = (r: Role & { permissions: Array<{ permissionCode: string }> }) => ({
  id: r.id,
  code: r.code,
  name: r.name,
  isSystem: r.isSystem,
  organizationId: r.organizationId,
  permissions: r.permissions.map((p) => p.permissionCode).sort(),
});

export type RoleView = ReturnType<typeof toRoleView>;
