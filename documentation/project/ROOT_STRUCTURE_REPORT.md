# Root structure update (22 Nov 2026)

Target root: `frontend/ backend/ infrastructure/ database/ documentation/ scripts/ tests/ .gitignore .env.example docker-compose.yml package.json README.md LICENSE`.

## Done (no existing code or config was edited)
| Change | Detail |
| --- | --- |
| Moved | the five `_backup_*` folders and `SomBill-Complete-Organized-Project.zip` to `documentation/project/history/archive/` |
| Moved | `APPLY-WAITER.txt` to `documentation/project/history/` |
| New | `infrastructure/`, `database/`, `tests/`: each with a README indexing where the real files live |
| New | `.env.example`: verbatim copy of the six per-app examples with headers (documentation only; each app still reads its own `.env`) |
| New | `docker-compose.yml`: `include`s `infrastructure/docker/docker-compose.yml`, project name `sombill`. Checked with `docker compose config`: the rendered services, networks, volumes and build contexts match the original |
| New | `LICENSE`: placeholder "All rights reserved" notice. Replace with your real licence |
| Edited | `README.md` structure tree; `.gitignore` (archive folder and `Claude outputs/` ignored instead of the old backup/zip lines) |
| Kept at root | `.github/` (GitHub only reads workflows from here) and `Claude outputs/` (zip delivery folder; git-ignored) |

## Not moved, because it needs reference edits (standing rule: no move that changes paths or file contents)
| Item | References that would change |
| --- | --- |
| `infrastructure/` to `infrastructure/` | Compose build contexts and volumes, `backend/.dockerignore`, `backend/.gitignore`, JWT key paths in 3 service `.env.example`, `generate-jwt-keys.sh`, compose header comments, README |
| `database/supabase/` to `database/` | `pnpm-workspace.yaml`, `@sombill/supabase-legacy` package, `run_db_tests.sh` relative paths, `backend-ci.yml`, `.gitignore`, `.dockerignore`, `.prettierignore`, `eslint.config.js`, root `package.json` (`test:db`) |
| `backend/tests/` to `tests/` | pnpm workspace entry, `tests/package.json` and vitest config relative paths |

Say the word and these three moves can be done together, with every reference above updated and the full gates re-run.

## Notes
- `RESTRUCTURE_REPORT.md` still names `_backup_original_2026-11-22/` at the root; it is now under `documentation/project/history/archive/`.
- `docker-compose.yml` needs Docker Compose 2.20+ (`include`). Only `config` was validated; containers were not started.
