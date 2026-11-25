# development

Base stack used everywhere: PostgreSQL 16, Redis, RabbitMQ, main API (+ migration job), API gateway, dashboards and
Nginx. `docker compose up --build` from the project root uses it directly (the root `docker-compose.yml` includes it).
Staging and production run this same file plus their own override.
