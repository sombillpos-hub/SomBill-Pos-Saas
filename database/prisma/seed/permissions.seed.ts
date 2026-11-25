import { ALL_PERMISSIONS } from "../../../backend/packages/shared-types/src/index.js";
import { log, type SeedContext } from "./context.js";

/** Permission catalogue (codes from @sombill/shared-types). Idempotent. */
export async function seedPermissions({
  identityDb,
}: SeedContext): Promise<void> {
  for (const code of ALL_PERMISSIONS) {
    const [resource, action] = code.split(".");
    const description =
      `${(action ?? "").replace(/_/g, " ")} ${(resource ?? "").replace(/_/g, " ")}`.trim();
    await identityDb.permission.upsert({
      where: { code },
      update: {},
      create: { code, description },
    });
  }
  log(`${ALL_PERMISSIONS.length} permissions`);
}
