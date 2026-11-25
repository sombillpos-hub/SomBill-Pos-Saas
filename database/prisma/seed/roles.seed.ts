import { SYSTEM_ROLES } from "../../../backend/packages/shared-types/src/index.js";
import { syncSystemCatalog } from "../../../backend/apps/main-api/src/modules/roles/services/role.service.js";
import { log, type SeedContext } from "./context.js";

/**
 * System roles (owner, manager, cashier, waiter, …) with their permissions. Uses the same function the main API runs
 * at start-up, so the seed and the API can never disagree. Idempotent.
 */
export async function seedRoles({ identityDb }: SeedContext): Promise<void> {
  await syncSystemCatalog(identityDb);
  log(`${Object.keys(SYSTEM_ROLES).length} system roles`);
}
