import type { CookieOptions, Request, Response } from 'express';
import { requirePrincipal, type AccessTokenVerifier } from '@sombill/authentication';
import { input } from '@sombill/validation';
import { sendNoContent, sendOk, unauthorized } from '@sombill/shared-utils';
import type { IdentityConfig } from '../../../config/env.js';
import { requestContext } from '../../../middleware/requestContext.js';
import type { AuthService, IssuedSession } from '../services/auth.service.js';
import type { ChangePasswordBody, LoginBody, RegisterBody } from '../validators/auth.validator.js';

export const REFRESH_COOKIE = 'sombill_rt';

/** Browsers get the refresh token as an httpOnly cookie; other clients opt in to receive it in the body. */
const wantsBodyTransport = (req: Request) => req.get('x-token-transport')?.toLowerCase() === 'body';

export class AuthController {
  private readonly cookie: CookieOptions;

  constructor(
    private readonly auth: AuthService,
    config: IdentityConfig,
    private readonly verify: AccessTokenVerifier,
  ) {
    this.cookie = {
      httpOnly: true,
      secure: config.COOKIE_SECURE,
      sameSite: 'strict',
      path: config.COOKIE_PATH,
      ...(config.COOKIE_DOMAIN ? { domain: config.COOKIE_DOMAIN } : {}),
    };
  }

  private sendSession(req: Request, res: Response, s: IssuedSession, status = 200) {
    const body = wantsBodyTransport(req);
    if (!body) res.cookie(REFRESH_COOKIE, s.refreshToken, { ...this.cookie, expires: s.refreshTokenExpiresAt });
    res.setHeader('Cache-Control', 'no-store');
    sendOk(
      res,
      {
        accessToken: s.accessToken,
        tokenType: 'Bearer',
        expiresIn: s.expiresIn,
        ...(body ? { refreshToken: s.refreshToken } : {}),
        user: s.user,
        memberships: s.memberships,
      },
      status,
    );
  }

  private presentedRefreshToken(req: Request): string | undefined {
    const fromBody = (req.valid?.body as { refreshToken?: string } | undefined)?.refreshToken;
    return fromBody ?? (req.cookies?.[REFRESH_COOKIE] as string | undefined);
  }

  register = async (req: Request, res: Response) => {
    const { body } = input<RegisterBody>(req);
    this.sendSession(req, res, await this.auth.register(body, requestContext(req)), 201);
  };

  login = async (req: Request, res: Response) => {
    const { body } = input<LoginBody>(req);
    this.sendSession(req, res, await this.auth.login(body, requestContext(req)));
  };

  refresh = async (req: Request, res: Response) => {
    const token = this.presentedRefreshToken(req);
    if (!token) throw unauthorized('No refresh token was presented.', 'REFRESH_MISSING');
    try {
      this.sendSession(req, res, await this.auth.refresh(token, requestContext(req)));
    } catch (e) {
      res.clearCookie(REFRESH_COOKIE, this.cookie);
      throw e;
    }
  };

  /** Works with the refresh cookie alone, so an expired access token never blocks signing out. */
  logout = async (req: Request, res: Response) => {
    let sessionId: string | undefined;
    const token = req.get('authorization')?.split(' ')[1];
    if (token) {
      try {
        sessionId = (await this.verify(token)).sessionId;
      } catch {
        /* expired or invalid access token: rely on the refresh token */
      }
    }
    await this.auth.logout(this.presentedRefreshToken(req), sessionId, requestContext(req));
    res.clearCookie(REFRESH_COOKIE, this.cookie);
    sendNoContent(res);
  };

  logoutAll = async (req: Request, res: Response) => {
    const revoked = await this.auth.logoutAll(requirePrincipal(req).userId, requestContext(req));
    res.clearCookie(REFRESH_COOKIE, this.cookie);
    sendOk(res, { revokedSessions: revoked });
  };

  changePassword = async (req: Request, res: Response) => {
    const principal = requirePrincipal(req);
    const { body } = input<ChangePasswordBody>(req);
    await this.auth.changePassword(principal.userId, principal.sessionId, body, requestContext(req));
    sendNoContent(res);
  };

  me = async (req: Request, res: Response) => {
    sendOk(res, await this.auth.me(requirePrincipal(req).userId));
  };
}
