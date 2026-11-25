/**
 * Runs every seed in order. From backend/:  pnpm db:seed   (reads apps/main-api/.env)
 * Variables: SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD (required for a new admin), SEED_ADMIN_NAME,
 *            SEED_RESTAURANT_NAME, SEED_RESTAURANT_SLUG, SEED_DEMO_PASSWORD (demo staff; skipped if unset).
 * Every seed is idempotent: running it twice changes nothing.
 */
import { seedAdmin } from "./admin.seed.js";
import { createSeedContext } from "./context.js";
import { seedDemoData } from "./demo-data.seed.js";
import { seedPermissions } from "./permissions.seed.js";
import { seedRestaurants } from "./restaurants.seed.js";
import { seedRoles } from "./roles.seed.js";

const ctx = await createSeedContext();
try {
  await seedPermissions(ctx);
  await seedRoles(ctx);
  const admin = await seedAdmin(ctx);
  const restaurant = await seedRestaurants(ctx, admin);
  await seedDemoData(ctx, restaurant);
  console.warn("seed complete");
} finally {
  await ctx.close();
}
