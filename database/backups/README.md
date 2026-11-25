# backups/

Local database dumps. **Dump files are git-ignored** (`*.dump`, `*.sql`, `*.sql.gz`, `*.tar`); only this README is
committed. Production backups belong in managed storage (the hosting provider's automated backups or an encrypted
bucket), never in the repository.

```bash
# from the project root; one file per module database
pg_dump --format=custom --file=database/backups/identity_$(date +%F).dump     "$IDENTITY_DATABASE_URL"
pg_dump --format=custom --file=database/backups/organization_$(date +%F).dump "$ORGANIZATION_DATABASE_URL"

# restore into an empty database
pg_restore --clean --if-exists --no-owner --dbname="$IDENTITY_DATABASE_URL" database/backups/identity_2026-11-22.dump
```

The current live Supabase database is backed up by Supabase (Project Settings → Database → Backups).
