import { createEvent, enqueueOutbox } from '@sombill/messaging';
import type { MembershipClaim } from '@sombill/shared-types';
import { AppError, conflict, unauthorized } from '@sombill/shared-utils';
import type { User } from '@sombill/database/identity';
import type { Db, Tx } from '@sombill/database/identity';
import type { PasswordHasher } from '@sombill/authentication';
import { hashToken, newRefreshToken, type TokenIssuer } from '@sombill/authentication';
import { writeAudit } from '../../audit-logs/repositories/identity-audit-log.repository.js';
import { loadMembershipClaims } from '../../roles/services/role.service.js';
import { AuthRepository } from '../repositories/auth.repository.js';
import { toPublicUser, type PublicUser } from '../models/auth.model.js';
import type { RequestContext } from '../../../middleware/requestContext.js';
import type { ChangePasswordBody, LoginBody, RegisterBody } from '../validators/auth.validator.js';

export type ClientInfo = RequestContext;
export { toPublicUser, type PublicUser };

export interface AuthServiceOptions {
  db: Db;
  tokens: TokenIssuer;
  passwords: PasswordHasher;
  refreshTokenTtlDays: number;
  loginMaxAttempts: number;
  loginLockMinutes: number;
  serviceName: string;
}

export interface IssuedSession {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
  expiresIn: number;
  user: PublicUser;
  memberships: MembershipClaim[];
}

const invalidCredentials = () => unauthorized('The e-mail or password is incorrect.', 'INVALID_CREDENTIALS');
const invalidRefresh = () => unauthorized('The session is no longer valid. Please sign in again.', 'REFRESH_INVALID');

export class AuthService {
  private readonly repo: AuthRepository;

  constructor(private readonly o: AuthServiceOptions) {
    this.repo = new AuthRepository(o.db);
  }

  async register(body: RegisterBody, client: ClientInfo): Promise<IssuedSession> {
    const passwordHash = await this.o.passwords.hash(body.password);
    const user = await this.o.db.$transaction(async (tx) => {
      const repo = new AuthRepository(tx);
      if (await repo.emailExists(body.email)) {
        throw conflict('An account with this e-mail already exists.', 'EMAIL_IN_USE');
      }
      const u = await repo.createUser({
        email: body.email,
        fullName: body.fullName,
        phone: body.phone ?? null,
        passwordHash,
        passwordChangedAt: new Date(),
      });
      await writeAudit(tx, {
        action: 'user.registered',
        actorUserId: u.id,
        targetType: 'user',
        targetId: u.id,
        ...client,
      });
      await enqueueOutbox(
        tx,
        createEvent(
          'user.registered',
          1,
          { userId: u.id, email: u.email, fullName: u.fullName },
          this.eventOpts(client),
        ),
      );
      return u;
    });
    return this.startSession(user, client);
  }

  async login(body: LoginBody, client: ClientInfo): Promise<IssuedSession> {
    const user = await this.repo.findUserByEmail(body.email);
    if (!user) {
      await this.o.passwords.verifyDummy(body.password);
      await this.o.db.$transaction((tx) =>
        writeAudit(tx, { action: 'auth.login_failed', metadata: { reason: 'unknown_email' }, ...client }),
      );
      throw invalidCredentials();
    }

    const now = new Date();
    if (user.lockedUntil && user.lockedUntil > now) {
      // Same answer as a wrong password: a lock must not confirm that the account exists.
      await this.o.passwords.verifyDummy(body.password);
      await this.o.db.$transaction((tx) =>
        writeAudit(tx, {
          action: 'auth.login_blocked',
          actorUserId: user.id,
          metadata: { reason: 'locked' },
          ...client,
        }),
      );
      throw invalidCredentials();
    }

    const ok = await this.o.passwords.verify(user.passwordHash, body.password);
    if (!ok) {
      const failed = user.failedLoginCount + 1;
      const lock = failed >= this.o.loginMaxAttempts;
      await this.o.db.$transaction(async (tx) => {
        await new AuthRepository(tx).updateUser(user.id, {
          failedLoginCount: lock ? 0 : failed,
          lockedUntil: lock ? new Date(now.getTime() + this.o.loginLockMinutes * 60_000) : user.lockedUntil,
        });
        await writeAudit(tx, {
          action: lock ? 'auth.account_locked' : 'auth.login_failed',
          actorUserId: user.id,
          metadata: { reason: 'wrong_password', failedAttempts: failed },
          ...client,
        });
      });
      throw invalidCredentials();
    }

    if (user.status !== 'ACTIVE') {
      throw new AppError(403, 'ACCOUNT_SUSPENDED', 'This account is suspended. Contact your administrator.');
    }

    const rehash = this.o.passwords.needsRehash(user.passwordHash) ? await this.o.passwords.hash(body.password) : null;
    const updated = await this.o.db.$transaction(async (tx) => {
      const u = await new AuthRepository(tx).updateUser(user.id, {
        failedLoginCount: 0,
        lockedUntil: null,
        lastLoginAt: now,
        ...(rehash ? { passwordHash: rehash } : {}),
      });
      await writeAudit(tx, { action: 'auth.login_succeeded', actorUserId: u.id, ...client });
      return u;
    });
    return this.startSession(updated, client);
  }

  /**
   * Refresh-token rotation with reuse detection: every refresh consumes the presented token and issues a new
   * one. Presenting an already-used token means it was stolen or replayed, so the whole session is revoked.
   */
  async refresh(refreshToken: string, client: ClientInfo): Promise<IssuedSession> {
    const tokenHash = hashToken(refreshToken);
    const record = await this.repo.findRefreshTokenWithSession(tokenHash);
    if (!record) throw invalidRefresh();
    const { session } = record;
    const now = new Date();

    if (record.usedAt) {
      await this.revokeSession(session.id, 'refresh_token_reuse', client, session.userId);
      throw unauthorized('This session was ended for your security. Please sign in again.', 'REFRESH_REUSED');
    }
    if (session.revokedAt || session.expiresAt <= now || record.expiresAt <= now) throw invalidRefresh();
    if (session.user.status !== 'ACTIVE') throw invalidRefresh();

    const next = newRefreshToken();
    const rotated = await this.o.db.$transaction(async (tx) => {
      // Conditional update: if two requests race with the same token, only one wins.
      const repo = new AuthRepository(tx);
      if (!(await repo.consumeRefreshToken(record.id, now))) return false;
      await repo.createRefreshToken({
        sessionId: session.id,
        tokenHash: hashToken(next),
        expiresAt: session.expiresAt,
      });
      await repo.touchSession(session.id, now);
      return true;
    });
    if (!rotated) {
      await this.revokeSession(session.id, 'refresh_token_reuse', client, session.userId);
      throw unauthorized('This session was ended for your security. Please sign in again.', 'REFRESH_REUSED');
    }
    return this.issue(session.user, session.id, next, session.expiresAt);
  }

  /** Ends the session the refresh token belongs to. Unknown or already-revoked tokens are ignored. */
  async logout(
    refreshToken: string | undefined,
    sessionIdFromAccessToken: string | undefined,
    client: ClientInfo,
  ): Promise<void> {
    let sessionId = sessionIdFromAccessToken;
    let userId: string | undefined;
    if (refreshToken) {
      const rec = await this.repo.findRefreshTokenOwner(hashToken(refreshToken));
      sessionId = rec?.sessionId ?? sessionId;
      userId = rec?.session.userId;
    }
    if (sessionId) await this.revokeSession(sessionId, 'logout', client, userId);
  }

  async logoutAll(userId: string, client: ClientInfo): Promise<number> {
    return this.o.db.$transaction(async (tx) => {
      const count = await new AuthRepository(tx).revokeSessions({ userId }, 'logout_all');
      await writeAudit(tx, {
        action: 'auth.logout_all',
        actorUserId: userId,
        metadata: { sessions: count },
        ...client,
      });
      return count;
    });
  }

  async changePassword(
    userId: string,
    currentSessionId: string,
    body: ChangePasswordBody,
    client: ClientInfo,
  ): Promise<void> {
    const user = await this.repo.findUserById(userId);
    if (!user) throw unauthorized();
    if (!(await this.o.passwords.verify(user.passwordHash, body.currentPassword))) {
      throw new AppError(400, 'INVALID_CURRENT_PASSWORD', 'The current password is incorrect.');
    }
    if (body.currentPassword === body.newPassword) {
      throw new AppError(400, 'PASSWORD_UNCHANGED', 'The new password must be different from the current one.');
    }
    const passwordHash = await this.o.passwords.hash(body.newPassword);
    await this.o.db.$transaction(async (tx) => {
      const repo = new AuthRepository(tx);
      await repo.updateUser(userId, { passwordHash, passwordChangedAt: new Date() });
      // Every other session is signed out; the current one stays.
      await repo.revokeSessions({ userId, id: { not: currentSessionId } }, 'password_changed');
      await writeAudit(tx, { action: 'auth.password_changed', actorUserId: userId, ...client });
    });
  }

  async me(userId: string): Promise<{ user: PublicUser; memberships: MembershipClaim[] }> {
    const user = await this.repo.findUserById(userId);
    if (!user) throw unauthorized();
    return { user: toPublicUser(user), memberships: await loadMembershipClaims(this.o.db, userId) };
  }

  // -------------------------------------------------------------------------
  private async startSession(user: User, client: ClientInfo): Promise<IssuedSession> {
    const refreshToken = newRefreshToken();
    const expiresAt = new Date(Date.now() + this.o.refreshTokenTtlDays * 86_400_000);
    const session = await this.o.db.$transaction(async (tx) => {
      const repo = new AuthRepository(tx);
      const s = await repo.createSession({
        userId: user.id,
        expiresAt,
        ipAddress: client.ipAddress,
        userAgent: client.userAgent?.slice(0, 500) ?? null,
      });
      await repo.createRefreshToken({ sessionId: s.id, tokenHash: hashToken(refreshToken), expiresAt });
      return s;
    });
    return this.issue(user, session.id, refreshToken, expiresAt);
  }

  private async issue(
    user: User,
    sessionId: string,
    refreshToken: string,
    refreshTokenExpiresAt: Date,
  ): Promise<IssuedSession> {
    const memberships = await loadMembershipClaims(this.o.db, user.id);
    const accessToken = await this.o.tokens.signAccessToken({
      sub: user.id,
      sid: sessionId,
      email: user.email,
      memberships,
    });
    return {
      accessToken,
      refreshToken,
      refreshTokenExpiresAt,
      expiresIn: this.o.tokens.accessTokenTtlSeconds,
      user: toPublicUser(user),
      memberships,
    };
  }

  private async revokeSession(sessionId: string, reason: string, client: ClientInfo, userId?: string): Promise<void> {
    await this.o.db.$transaction(async (tx: Tx) => {
      const count = await new AuthRepository(tx).revokeSessions({ id: sessionId }, reason);
      if (count > 0) {
        await writeAudit(tx, {
          action: reason === 'logout' ? 'auth.logout' : 'auth.session_revoked',
          actorUserId: userId ?? null,
          targetType: 'session',
          targetId: sessionId,
          metadata: { reason },
          ...client,
        });
      }
    });
  }

  private eventOpts(client: ClientInfo) {
    return { source: this.o.serviceName, ...(client.requestId ? { correlationId: client.requestId } : {}) };
  }
}
