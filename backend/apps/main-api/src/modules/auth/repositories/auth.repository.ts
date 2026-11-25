import type { Db, Prisma, Tx } from '@sombill/database/identity';

/** Accounts, sessions and refresh tokens (identity database). */
export class AuthRepository {
  constructor(private readonly db: Db | Tx) {}

  findUserByEmail(email: string) {
    return this.db.user.findUnique({ where: { email } });
  }

  findUserById(id: string) {
    return this.db.user.findUnique({ where: { id } });
  }

  emailExists(email: string) {
    return this.db.user.findUnique({ where: { email }, select: { id: true } }).then(Boolean);
  }

  createUser(data: Prisma.UserCreateInput) {
    return this.db.user.create({ data });
  }

  updateUser(id: string, data: Prisma.UserUpdateInput) {
    return this.db.user.update({ where: { id }, data });
  }

  createSession(data: Prisma.SessionUncheckedCreateInput) {
    return this.db.session.create({ data });
  }

  touchSession(id: string, at: Date) {
    return this.db.session.update({ where: { id }, data: { lastUsedAt: at } });
  }

  /** Revokes matching active sessions; returns how many were revoked. */
  async revokeSessions(where: Prisma.SessionWhereInput, reason: string) {
    const { count } = await this.db.session.updateMany({
      where: { ...where, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
    return count;
  }

  createRefreshToken(data: { sessionId: string; tokenHash: string; expiresAt: Date }) {
    return this.db.refreshToken.create({ data });
  }

  findRefreshTokenWithSession(tokenHash: string) {
    return this.db.refreshToken.findUnique({ where: { tokenHash }, include: { session: { include: { user: true } } } });
  }

  findRefreshTokenOwner(tokenHash: string) {
    return this.db.refreshToken.findUnique({
      where: { tokenHash },
      select: { sessionId: true, session: { select: { userId: true } } },
    });
  }

  /** Marks a refresh token used only if it is still unused (wins the race between two refreshes). */
  async consumeRefreshToken(id: string, at: Date): Promise<boolean> {
    const { count } = await this.db.refreshToken.updateMany({ where: { id, usedAt: null }, data: { usedAt: at } });
    return count === 1;
  }
}
