#!/usr/bin/env bash
# Creates one database per service with two roles each (database least privilege):
#   <svc>_migrator  owns the database and schema; used only by the migration job (DDL).
#   <svc>_app       used by the running service; can read and write rows, nothing else.
# Services never get credentials for another service's database.
set -euo pipefail

create_service_db() {
  local svc="$1" migrator_pw="$2" app_pw="$3"
  local db="sombill_${svc}"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres <<SQL
    CREATE ROLE ${svc}_migrator LOGIN PASSWORD '${migrator_pw}';
    CREATE ROLE ${svc}_app LOGIN PASSWORD '${app_pw}';
    CREATE DATABASE ${db} OWNER ${svc}_migrator;
    REVOKE ALL ON DATABASE ${db} FROM PUBLIC;
    GRANT CONNECT, TEMPORARY ON DATABASE ${db} TO ${svc}_app;
SQL
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$db" <<SQL
    ALTER SCHEMA public OWNER TO ${svc}_migrator;
    REVOKE CREATE ON SCHEMA public FROM PUBLIC;
    GRANT USAGE ON SCHEMA public TO ${svc}_app;
    -- Every table and sequence the migrator creates is usable (DML only) by the app role.
    ALTER DEFAULT PRIVILEGES FOR ROLE ${svc}_migrator IN SCHEMA public
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${svc}_app;
    ALTER DEFAULT PRIVILEGES FOR ROLE ${svc}_migrator IN SCHEMA public
      GRANT USAGE, SELECT ON SEQUENCES TO ${svc}_app;
    ALTER DEFAULT PRIVILEGES FOR ROLE ${svc}_migrator IN SCHEMA public
      GRANT USAGE ON TYPES TO ${svc}_app;
SQL
}

create_service_db identity "${IDENTITY_DB_MIGRATOR_PASSWORD:?}" "${IDENTITY_DB_APP_PASSWORD:?}"
create_service_db organization "${ORGANIZATION_DB_MIGRATOR_PASSWORD:?}" "${ORGANIZATION_DB_APP_PASSWORD:?}"
