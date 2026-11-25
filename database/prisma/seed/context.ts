/**
 * Shared set-up for every seed: validated settings (same variables as the main API), both module databases and a
 * password hasher. Seeds import the main API's own code, so they apply exactly the same rules as the API.
 */
import { PasswordHasher } from "../../../backend/packages/authentication/src/index.js";
import { createDb as createIdentityDb } from "../../../backend/packages/database/src/identity/index.js";
import { createDb as createOrganizationDb } from "../../../backend/packages/database/src/organization/index.js";
import {
  ALL_PERMISSIONS,
  type Principal,
} from "../../../backend/packages/shared-types/src/index.js";
import { loadConfig } from "../../../backend/apps/main-api/src/config/env.js";

const PLACEHOLDER_PEM =
  "-----BEGIN PUBLIC KEY-----\nunused-by-seeds\n-----END PUBLIC KEY-----";

export type SeedContext = Awaited<ReturnType<typeof createSeedContext>>;

export async function createSeedContext(env: NodeJS.ProcessEnv = process.env) {
  // Seeds never sign tokens; a placeholder PEM lets the shared settings schema validate without the key files.
  const config = loadConfig({
    JWT_PRIVATE_KEY: PLACEHOLDER_PEM,
    JWT_PUBLIC_KEY: PLACEHOLDER_PEM,
    ...env,
  });
  const identityDb = createIdentityDb(config.IDENTITY_DATABASE_URL);
  const organizationDb = createOrganizationDb(config.ORGANIZATION_DATABASE_URL);
  const passwords = new PasswordHasher({
    memoryCost: config.ARGON2_MEMORY_KIB,
    timeCost: config.ARGON2_TIME_COST,
    parallelism: config.ARGON2_PARALLELISM,
  });
  return {
    config,
    identityDb,
    organizationDb,
    passwords,
    close: async () => {
      await Promise.all([
        identityDb.$disconnect(),
        organizationDb.$disconnect(),
      ]);
    },
  };
}

/** A principal acting as owner of `organizationId` (used to call organization services from seeds). */
export function ownerPrincipal(
  userId: string,
  email: string,
  organizationId?: string,
): Principal {
  return {
    userId,
    sessionId: "seed",
    email,
    memberships: organizationId
      ? [
          {
            organizationId,
            branchId: null,
            role: "owner",
            permissions: [...ALL_PERMISSIONS],
          },
        ]
      : [],
  };
}

export const SEED_CTX = {
  ipAddress: null,
  userAgent: "database-seed",
  requestId: "seed",
};

export const log = (msg: string) => console.warn(`  seed: ${msg}`);
