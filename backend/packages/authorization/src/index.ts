import type { MembershipClaim, Permission, Principal } from '@sombill/shared-types';
import { forbidden } from '@sombill/shared-utils';

// ---------------------------------------------------------------------------
// Authorization (organization isolation + branch-level access + permissions)
// ---------------------------------------------------------------------------
export interface AccessScope {
  organizationId: string;
  /** Omit for organization-wide actions; only organization-wide roles can perform them. */
  branchId?: string;
}

function grants(m: MembershipClaim, permission: Permission, scope: AccessScope): boolean {
  if (m.organizationId !== scope.organizationId) return false;
  if (!m.permissions.includes(permission)) return false;
  if (m.branchId === null) return true; // organization-wide role
  return scope.branchId !== undefined && m.branchId === scope.branchId;
}

/** True if the principal holds `permission` in the given organization (and branch, if given). */
export function can(principal: Principal, permission: Permission, scope: AccessScope): boolean {
  return principal.memberships.some((m) => grants(m, permission, scope));
}

export function assertCan(principal: Principal, permission: Permission, scope: AccessScope): void {
  if (!can(principal, permission, scope)) {
    // Do not reveal whether the organization/branch exists to someone outside it.
    throw forbidden();
  }
}

export function isMemberOf(principal: Principal, organizationId: string): boolean {
  return principal.memberships.some((m) => m.organizationId === organizationId);
}

/**
 * Branches a principal may act on with `permission` inside an organization:
 * `'all'` for organization-wide roles, otherwise the explicit branch ids (possibly empty).
 */
export function accessibleBranches(
  principal: Principal,
  permission: Permission,
  organizationId: string,
): 'all' | string[] {
  const ms = principal.memberships.filter(
    (m) => m.organizationId === organizationId && m.permissions.includes(permission),
  );
  if (ms.some((m) => m.branchId === null)) return 'all';
  return [...new Set(ms.map((m) => m.branchId).filter((b): b is string => b !== null))];
}

export function organizationIdsOf(principal: Principal): string[] {
  return [...new Set(principal.memberships.map((m) => m.organizationId))];
}
