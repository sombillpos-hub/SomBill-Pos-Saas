import {
  ALL_PERMISSIONS,
  SYSTEM_ROLE_PERMISSIONS,
  SYSTEM_ROLES,
  type MembershipClaim,
  type SystemRole,
} from '@sombill/shared-types';
import type { Db, Tx } from '@sombill/database/identity';
import { RoleRepository, SYSTEM_SCOPE } from '../repositories/role.repository.js';
import { toRoleView } from '../models/role.model.js';

export { SYSTEM_SCOPE };

const ROLE_NAMES: Record<SystemRole, string> = {
  owner: 'Owner',
  manager: 'Manager',
  cashier: 'Cashier',
  waiter: 'Waiter',
  kitchen: 'Kitchen staff',
  inventory_clerk: 'Inventory clerk',
  accountant: 'Accountant',
  hr_manager: 'HR manager',
};

const describe = (code: string) => {
  const [resource, action] = code.split('.');
  return `${(action ?? '').replace(/_/g, ' ')} ${(resource ?? '').replace(/_/g, ' ')}`.trim();
};

/**
 * Makes the database permission catalogue and system roles match `@sombill/shared-types` exactly.
 * Idempotent; runs at every start-up, so a deploy that adds a permission also grants it to system roles.
 */
export async function syncSystemCatalog(db: Db): Promise<void> {
  await db.$transaction(async (tx) => {
    const roles = new RoleRepository(tx);
    for (const code of ALL_PERMISSIONS) await roles.upsertPermission(code, describe(code));
    for (const code of Object.values(SYSTEM_ROLES)) {
      const role = await roles.upsertSystemRole(code, ROLE_NAMES[code]);
      await roles.setRolePermissions(role.id, SYSTEM_ROLE_PERMISSIONS[code]);
    }
  });
}

/** Current memberships of a user, as embedded in access tokens. Always read fresh from the database. */
export function loadMembershipClaims(db: Db | Tx, userId: string): Promise<MembershipClaim[]> {
  return new RoleRepository(db).membershipClaims(userId);
}

/** Resolves a role code for an organization: organization custom roles first, then system roles. */
export async function findRole(db: Db | Tx, organizationId: string, code: string) {
  const roles = new RoleRepository(db);
  return (await roles.findByCode(organizationId, code)) ?? (await roles.findByCode(SYSTEM_SCOPE, code));
}

export async function listRoles(db: Db, organizationId: string) {
  return (await new RoleRepository(db).listForOrganization(organizationId)).map(toRoleView);
}
