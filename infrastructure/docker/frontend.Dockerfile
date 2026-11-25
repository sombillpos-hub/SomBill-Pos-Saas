# syntax=docker/dockerfile:1.7
# Static frontend image: Vite build served by Nginx. Build context: frontend/.  Examples (from the project root):
#   docker build -f infrastructure/docker/frontend.Dockerfile --build-arg APP=dashboards \
#     --build-context nginx=infrastructure/docker/nginx frontend
#   docker build -f infrastructure/docker/frontend.Dockerfile --build-arg APP=website \
#     --build-context nginx=infrastructure/docker/nginx frontend
# VITE_* values are public (bundled into the browser): never pass secrets here.
ARG APP=dashboards

FROM node:22-bookworm-slim AS build
ARG APP
ARG VITE_SUPABASE_URL=""
ARG VITE_SUPABASE_ANON_KEY=""
ARG VITE_API_BASE_URL="/api/v1"
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY VITE_API_BASE_URL=$VITE_API_BASE_URL
WORKDIR /src
COPY . .
# The website has its own dependencies and lockfile; the dashboards build from the npm workspace.
RUN if [ "$APP" = "website" ]; then \
      npm ci --prefix apps/website && npm --prefix apps/website run build && mv apps/website/dist /out; \
    else \
      npm ci && npm --prefix apps/dashboards run build && mv apps/dashboards/dist /out; \
    fi

FROM nginx:1.27-alpine AS runtime
COPY --from=nginx spa.conf /etc/nginx/conf.d/default.conf
COPY --from=build /out /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
