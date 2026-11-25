# SomBill documentation

| Folder | Document | What it covers |
| --- | --- | --- |
| `architecture/` | [system-architecture.md](architecture/system-architecture.md) | the whole system: apps, backends, how they connect |
| | [frontend-architecture.md](architecture/frontend-architecture.md) | frontend stack, workspace layout, website, design system |
| | [backend-architecture.md](architecture/backend-architecture.md) | gateway + main API, modules, events (RabbitMQ, outbox) |
| `api/` | [api-documentation.md](api/api-documentation.md) | REST API contract (`/api/v1`); live docs at `GET /api/docs` |
| `database/` | [database-design.md](database/database-design.md) | database per module, migrations, conventions (tables and columns: [`../database/documentation/`](../database/documentation/)) |
| `security/` | [security-guidelines.md](security/security-guidelines.md) | authentication, authorization, secrets, hardening |
| `deployment/` | [deployment-guide.md](deployment/deployment-guide.md) | running the stack with Docker (development, staging, production) |
| `user-guides/` | [super-admin](user-guides/super-admin-guide.md) · [manager](user-guides/manager-guide.md) · [cashier](user-guides/cashier-guide.md) · [waiter](user-guides/waiter-guide.md) | how each role uses its dashboard |
| `project/` | [PROJECT_STATUS.md](project/PROJECT_STATUS.md), build and restructure reports, `dashboards/` (module specs, test reports), `history/` | project history and status; `history/archive/` holds local backups (git-ignored) |

Other READMEs: [project](../README.md) · [backend](../backend/README.md) · [database](../database/README.md) ·
[infrastructure](../infrastructure/README.md) · [tests](../tests/README.md).
