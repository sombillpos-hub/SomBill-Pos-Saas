# syntax=docker/dockerfile:1.7
# One image recipe for every backend app. Build context: backend/.  Examples (from the project root):
#   docker build -f infrastructure/docker/backend.Dockerfile --build-arg APP=main-api \
#     --build-context database=database --target runtime backend
#   docker build -f infrastructure/docker/backend.Dockerfile --build-arg APP=api-gateway \
#     --build-context database=database --target runtime backend
# Targets: runtime (the server) and migrate (main-api only: applies database migrations, then exits).
ARG APP=main-api

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
RUN corepack enable && apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /repo

FROM base AS build
ARG APP
COPY . .
# Prisma schemas + migrations (packages/database/prisma.*.config.ts read ../../../database/prisma = /database/prisma)
COPY --from=database prisma /database/prisma
RUN pnpm install --frozen-lockfile --filter "@sombill/${APP}..."
RUN if [ "$APP" = "main-api" ]; then pnpm --filter "@sombill/database" prisma:generate; fi
RUN pnpm --filter "@sombill/${APP}..." run build
RUN pnpm deploy --legacy --filter "@sombill/${APP}" --prod /out

# One-shot job: applies pending migrations of every module database (run before starting the main API).
FROM build AS migrate
WORKDIR /repo/packages/database
CMD ["pnpm", "db:migrate"]

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates tini && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build --chown=node:node /out ./
# Upload storage for the local-disk provider (mount a volume here: STORAGE_LOCAL_DIR=/app/storage)
RUN mkdir -p /app/storage && chown node:node /app/storage
USER node
EXPOSE 4000 4001
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/server.js"]
