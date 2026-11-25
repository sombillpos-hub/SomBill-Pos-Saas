# infrastructure/

Deployment and runtime configuration for SomBill.

```text
infrastructure/
├── docker/
│   ├── backend.Dockerfile     every backend app (--build-arg APP=main-api | api-gateway; targets runtime, migrate)
│   ├── frontend.Dockerfile    static frontends (--build-arg APP=dashboards | website), served by Nginx
│   └── nginx/spa.conf         Nginx config inside the frontend images (SPA fallback, asset caching)
├── nginx/nginx.conf           public reverse proxy: /api and /health → gateway, everything else → dashboards
├── deployment/
│   ├── development/           base Compose stack + .env.example (used by `docker compose up` from the root)
│   ├── staging/               override: restart policies, HTTPS cookies, no broker UI
│   └── production/            override: same + API docs off, TLS on port 443
├── postgres/init/             creates one database and two least-privilege roles per module (first start only)
├── redis/redis.conf           persistence, memory policy, disabled dangerous commands
├── rabbitmq/rabbitmq.conf     flow-control limits, heartbeats, logging
├── monitoring/                what is monitored today and where metrics will go
└── secrets/                   JWT key pair from scripts/generate-jwt-keys.sh (git-ignored)
```

## Run

```bash
bash scripts/generate-jwt-keys.sh
cp infrastructure/deployment/development/.env.example infrastructure/deployment/development/.env   # set passwords
docker compose up --build                     # project root; dashboards on http://localhost, API on /api/v1

# staging / production: base + override + that environment's .env
docker compose -f infrastructure/deployment/development/docker-compose.yml \
               -f infrastructure/deployment/production/docker-compose.yml \
               --env-file infrastructure/deployment/production/.env up -d --build
```

Each Dockerfile has a `<name>.dockerignore` next to it (BuildKit uses it instead of the context's `.dockerignore`).
CI pipelines live in [`../.github/workflows/`](../.github/workflows/) (GitHub requires that location).
