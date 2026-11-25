import { SYSTEM_SCOPE } from "../../../backend/apps/main-api/src/modules/roles/services/role.service.js";
import type { SeededRestaurant } from "./restaurants.seed.js";
import { log, type SeedContext } from "./context.js";

const DEMO_STAFF = [
  { email: "manager@sombill.local", fullName: "Demo Manager", role: "manager" },
  { email: "cashier@sombill.local", fullName: "Demo Cashier", role: "cashier" },
  { email: "waiter@sombill.local", fullName: "Demo Waiter", role: "waiter" },
  { email: "kitchen@sombill.local", fullName: "Demo Kitchen", role: "kitchen" },
] as const;

/**
 * Demo staff for local development and demos (one account per main role, organization-wide). Never run in
 * production: it refuses when NODE_ENV=production. Password: SEED_DEMO_PASSWORD.
 */
export async function seedDemoData(
  { identityDb, passwords }: SeedContext,
  restaurant: SeededRestaurant,
): Promise<void> {
  if (process.env.NODE_ENV === "production")
    return log("demo data skipped (NODE_ENV=production)");
  const password = process.env.SEED_DEMO_PASSWORD;
  if (!password || password.length < 12)
    return log("demo data skipped (set SEED_DEMO_PASSWORD, 12+ characters)");
  const hash = await passwords.hash(password);
  for (const s of DEMO_STAFF) {
    const user = await identityDb.user.upsert({
      where: { email: s.email },
      update: {},
      create: { email: s.email, fullName: s.fullName, passwordHash: hash },
    });
    const role = await identityDb.role.findUniqueOrThrow({
      where: { scopeKey_code: { scopeKey: SYSTEM_SCOPE, code: s.role } },
    });
    await identityDb.membership.upsert({
      where: {
        userId_organizationId_branchScope_roleId: {
          userId: user.id,
          organizationId: restaurant.organizationId,
          branchScope: "*",
          roleId: role.id,
        },
      },
      update: {},
      create: {
        userId: user.id,
        organizationId: restaurant.organizationId,
        branchId: null,
        branchScope: "*",
        roleId: role.id,
      },
    });
  }
  log(`${DEMO_STAFF.length} demo staff accounts`);
}
