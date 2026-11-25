# Deployment guide

> **Structure update (22 Nov 2026).** The identity and organization services now run as two _modules_ of one process, `backend/apps/main-api` (one PostgreSQL database per module, same events and API contract). Shared code was split into `backend/packages/{database,authentication,authorization,validation,logger,cache,messaging,email,storage,shared-types,shared-utils}`; `supabase/` moved to `database/`, `infrastructure/` and `scripts/` to the project root, and these documents to `documentation/`. Text below that still says "identity-service" / "organization-service" describes the same code under its former name; a full rewrite is a follow-up.

## 1. Single host with Docker Compose

```bash
cd backend
bash scripts/generate-jwt-keys.sh                       # infrastructure/secrets/jwt-{private,public}.pem
cp infrastructure/deployment/development/.env.example infrastructure/deployment/development/.env
#   edit .env: strong passwords (openssl rand -base64 32), CORS_ORIGINS, COOKIE_SECURE=true behind HTTPS
docker compose up -d --build   # from the project root (staging/production: see infrastructure/README.md)
curl http://localhost/health/ready
```

Start-up order is automatic: PostgreSQL (the init script creates the per-service databases and roles) → migration jobs
(`identity-migrate`, `organization-migrate`) → services → gateway → Nginx.

Only Nginx publishes a port (80; add 443). RabbitMQ's UI is bound to `127.0.0.1:15672`. Everything else sits on
internal networks.

## 2. HTTPS

Put certificates in a volume and enable the commented TLS server block in `infrastructure/nginx/nginx.conf`, or run
Nginx behind a managed load balancer that terminates TLS. Keep `COOKIE_SECURE=true`. The refresh cookie is
`Secure`-only.

## 3. Configuration reference

| Variable                                                                      | Service                | Notes                                                       |
| ----------------------------------------------------------------------------- | ---------------------- | ----------------------------------------------------------- |
| `DATABASE_URL`                                                                | identity, organization | app role (DML only); the migrate jobs use the migrator role |
| `RABBITMQ_URL`, `RABBITMQ_EXCHANGE`                                           | services               | exchange default `sombill.events`                           |
| `RABBITMQ_QUEUE`                                                              | identity               | default `identity-service.events`                           |
| `JWT_PRIVATE_KEY` / `_FILE`                                                   | identity only          | PEM or base64 PEM                                           |
| `JWT_PUBLIC_KEY` / `_FILE`                                                    | all                    |                                                             |
| `ACCESS_TOKEN_TTL_SECONDS` (900), `REFRESH_TOKEN_TTL_DAYS` (30)               | identity               |                                                             |
| `LOGIN_MAX_ATTEMPTS` (5), `LOGIN_LOCK_MINUTES` (15)                           | identity               |                                                             |
| `ARGON2_MEMORY_KIB` (19456), `ARGON2_TIME_COST` (2), `ARGON2_PARALLELISM` (1) | identity               | raise on capable hardware                                   |
| `COOKIE_SECURE` (true), `COOKIE_PATH` (`/api/v1/auth`), `COOKIE_DOMAIN`       | identity               |                                                             |
| `TRIAL_DAYS` (14), `TRIAL_MAX_BRANCHES` (3)                                   | organization           |                                                             |
| `REDIS_URL`, `IDENTITY_SERVICE_URL`, `ORGANIZATION_SERVICE_URL`               | gateway                |                                                             |
| `CORS_ORIGINS`                                                                | gateway, services      | comma-separated origins of the dashboards and website       |
| `TRUST_PROXY_HOPS` (1)                                                        | gateway                | proxies in front of the gateway                             |
| `RATE_LIMIT_*`, `AUTH_RATE_LIMIT_*`, `REFRESH_RATE_LIMIT_MAX`                 | gateway                |                                                             |
| `DOCS_ENABLED` (true)                                                         | gateway                | set false to hide Swagger in production if preferred        |
| `LOG_LEVEL`                                                                   | all                    | `info` in production                                        |

Invalid or missing configuration stops a service at start-up with the full list of problems.

## 4. CI/CD (GitHub Actions)

`.github/workflows/backend-ci.yml` runs on every push and pull request that touches `backend/`:
format check → lint → Prisma generate → typecheck → **migration drift check** → all tests against real PostgreSQL,
Redis and RabbitMQ → build → Docker image builds for gateway and services. A separate job runs the current Supabase
backend's 303 SQL assertions. `.github/workflows/frontend-ci.yml` does the same for the website and dashboards.

To deploy, extend the image job with `push: true` to your registry and roll out with your orchestrator, running the
migrate job before the new service version.

## 5. Operations

- Health: `GET /health/live` (process up) and `GET /health/ready` (dependencies) on the gateway and every service.
- Logs: JSON on stdout with `service` and `requestId`. Ship them to your log store.
- Backups: `pg_dump` each service database separately. Restore tests are part of Phase 10.
- Scaling: services and gateway are stateless. Run several replicas. Outbox relays coordinate through row locks, and
  rate limits through Redis.
- Dead letters: watch `*.dlq` queues (see `EVENT_ARCHITECTURE.md`).

## 6. Verified in this repository vs. still to verify

**Verified:** every package and service builds; the compiled services start with `node dist/server.js` and complete
register → organization → owner (through RabbitMQ) → branch over HTTP; Compose and Nginx configurations validate; the
Postgres init script creates the roles and the least-privilege rules hold.

**Still to verify in your environment:** Docker image builds (the CI job does this; the build workspace could not pull
base images), a full `docker compose up`, TLS, and `prisma migrate deploy` / drift check (the CI job runs them; the
build workspace could not download Prisma's migration engine, so migrations were applied with the same SQL files
directly).
