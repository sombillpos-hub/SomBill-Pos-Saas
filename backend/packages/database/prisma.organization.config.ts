import { defineConfig } from 'prisma/config';

export default defineConfig({
  // Schemas and migrations live in the project-level database/ folder.
  schema: '../../../database/prisma/organization.prisma',
  migrations: { path: '../../../database/prisma/migrations/organization' },
  // Not required for `prisma generate`; required for `prisma migrate *`.
  datasource: {
    url: process.env.ORGANIZATION_DATABASE_URL,
    shadowDatabaseUrl: process.env.ORGANIZATION_SHADOW_DATABASE_URL,
  },
});
