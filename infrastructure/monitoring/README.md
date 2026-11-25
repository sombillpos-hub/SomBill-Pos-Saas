# monitoring/

What exists today, and where metrics and dashboards will go.

| Signal               | Where                                                                                                                                            | Notes                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| Liveness / readiness | `GET /health/live`, `GET /health/ready` on the gateway (`/health/ready` checks Redis and the main API) and on the main API (databases, RabbitMQ) | used by Docker `HEALTHCHECK` in `infrastructure/docker/backend.Dockerfile` |
| Structured logs      | JSON (pino) on stdout of every backend container, with `requestId` on every line; Nginx logs `$request_id` too                                   | collect with `docker compose logs` or ship stdout to your log platform     |
| Message broker       | RabbitMQ management UI, `http://localhost:15672` (development only; not published in staging/production)                                         | queues, dead-letter queue, consumer counts                                 |
| Rate limits          | `RateLimit` / `Retry-After` response headers from the gateway                                                                                    | counters live in Redis                                                     |

**Not built yet:** a `/metrics` (Prometheus) endpoint, Prometheus + Grafana, alerting and error tracking. When they are
added, put their configuration here (for example `prometheus.yml`, `grafana/dashboards/*.json`, `alerts.yml`) and add
the services as a Compose override in `../deployment/`.
