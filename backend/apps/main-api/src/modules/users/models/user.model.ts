import type { Membership, User } from '@sombill/database/identity';

type UserWithMemberships = User & { memberships: Array<Membership & { role: { code: string; name: string } }> };

/** API shape of a user in staff lists (no password hash, no lock counters). */
export const toUserListItem = (u: UserWithMemberships) => ({
  id: u.id,
  email: u.email,
  fullName: u.fullName,
  status: u.status,
  lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
  memberships: u.memberships.map((m) => ({ id: m.id, branchId: m.branchId, role: m.role.code, roleName: m.role.name })),
});

export type UserListItem = ReturnType<typeof toUserListItem>;
