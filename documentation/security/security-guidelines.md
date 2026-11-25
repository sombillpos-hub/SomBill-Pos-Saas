# Security

> **Structure update (22 Nov 2026).** The identity and organization services now run as two *modules* of one process, `backend/apps/main-api` (one PostgreSQL database per module, same events and API contract). Shared code was split into `backend/packages/{database,authentication,authorization,validation,logger,cache,messaging,email,storage,shared-types,shared-utils}`; `supabase/` moved to `database/`, `infrastructure/` and `scripts/` to the project root, and these documents to `documentation/`. Text below that still says "identity-service" / "organization-service" describes the same code under its former name; a full rewrite is a follow-up.

## Authentication

| Control          | Implementation                                                                                                                                                                                                                     |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Password hashing | **Argon2id**, m = 19 MiB, t = 2, p = 1 (OWASP minimum; configurable upward). Hashes are rehashed on login when parameters rise                                                                                                     |
| Password policy  | 10–128 characters, passphrases welcome (NIST SP 800-63B)                                                                                                                                                                           |
| Brute force      | Redis rate limit at the gateway (10 credential attempts / 15 min / IP) and account lock-out after 5 failures (15 min)                                                                                                              |
| User enumeration | identical 401 for unknown e-mail, wrong password and locked account; dummy Argon2 verification keeps timing equal                                                                                                                  |
| Access tokens    | JWT **RS256**, 15 minutes, `iss`/`aud`/`exp`/`jti` checked. Only identity holds the private key; everyone else verifies with the public key                                                                                        |
| Refresh tokens   | 256-bit random, stored as SHA-256 only, `HttpOnly; Secure; SameSite=Strict` cookie scoped to `/api/v1/auth`. **Rotated on every use**; reuse of a rotated token or a lost race revokes the whole session. Absolute 30-day lifetime |
| Session control  | logout (works with an expired access token), logout-all, password change signs out other sessions, suspended accounts cannot refresh                                                                                               |
| Frontend storage | access token in memory only (Zustand), refresh token only in the httpOnly cookie                                                                                                                                                   |

## Authorization

- **Permission-based RBAC:** 38 permissions, 8 system roles. A membership is organization-wide or limited to one
  branch.
- **Organization isolation:** every check is `can(principal, permission, { organizationId, branchId? })`. Organization
  and branch ids from the client are only accepted after they match the caller's signed memberships.
- **Branch-level access:** branch roles never satisfy organization-wide actions; listings are filtered to accessible
  branches.
- **No probing:** resources of other organizations return 404, not 403.
- **Privilege escalation:** you can only grant or revoke roles whose every permission you hold in that scope; only
  owners manage the owner role; the last owner cannot be removed. Identity reads the caller's memberships fresh from the
  database for these operations instead of trusting a token up to 15 minutes old.
- Defense in depth: the gateway verifies JWTs, and every service verifies them again.

## Transport, headers, input

- TLS at Nginx (template included); HSTS from Helmet and Nginx.
- Helmet on all responses; strict CSP except the Swagger page; `x-powered-by` removed.
- CORS allow-list with credentials; unknown origins get no CORS headers.
- Body limit 100 KB at services, 1 MB at Nginx; malformed JSON → 400.
- Zod validation of body, query and params on every endpoint; unknown keys stripped.
- `X-Forwarded-For` is overwritten at Nginx and at the gateway, so clients cannot spoof their IP for rate limits or
  audit.

## Data

- **Database least privilege:** per-service migrator (DDL) and app (DML only) roles; services cannot reach other
  databases (verified).
- **Audit logs** for sign-ins, failures, lock-outs, session revocations, role changes and organization and branch
  changes. Append-only by database trigger.
- Logs redact authorization headers, cookies, passwords and tokens.
- Errors never expose stack traces, SQL or constraint names.

## Secrets

- No secrets in the repository: `.env` files are git-ignored, only `.env.example` files are committed.
- JWT keys via Docker secrets (`*_FILE`) or base64 environment variables; `scripts/generate-jwt-keys.sh` creates
  3072-bit RSA keys.
- Rotate the JWT key pair by deploying the new public key everywhere, then the new private key (current access tokens
  expire within 15 minutes).

## Reporting

Report suspected vulnerabilities privately to the maintainers. Do not open public issues for them.
