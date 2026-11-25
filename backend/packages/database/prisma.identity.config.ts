import { defineConfig } from 'prisma/config';

export default defineConfig({
  // Schemas and migrations live in the project-level database/ folder.
  schema: '../../../database/prisma/schema.prisma',
  migrations: { path: '../../../database/prisma/migrations/identity' },
  // Not required for `prisma generate`; required for `prisma migrate *`.
  datasource: { url: process.env.IDENTITY_DATABASE_URL, shadowDatabaseUrl: process.env.IDENTITY_SHADOW_DATABASE_URL },
});
