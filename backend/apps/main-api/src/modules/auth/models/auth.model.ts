import type { User } from '@sombill/database/identity';

/** Account data safe to return to clients (never the password hash or lock counters). */
export interface PublicUser {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  status: 'ACTIVE' | 'SUSPENDED';
  createdAt: string;
}

export const toPublicUser = (u: User): PublicUser => ({
  id: u.id,
  email: u.email,
  fullName: u.fullName,
  phone: u.phone,
  status: u.status,
  createdAt: u.createdAt.toISOString(),
});
