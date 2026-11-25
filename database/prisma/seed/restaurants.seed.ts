import { BranchesService } from "../../../backend/apps/main-api/src/modules/branches/services/branch.service.js";
import { createBranchBody } from "../../../backend/apps/main-api/src/modules/branches/validators/branch.validator.js";
import { OrganizationsService } from "../../../backend/apps/main-api/src/modules/organizations/services/organization.service.js";
import { createOrganizationBody } from "../../../backend/apps/main-api/src/modules/organizations/validators/organization.validator.js";
import type { SeededUser } from "./admin.seed.js";
import { log, ownerPrincipal, SEED_CTX, type SeedContext } from "./context.js";

export interface SeededRestaurant {
  organizationId: string;
  branchId: string;
}

/**
 * One restaurant (organization + trial subscription + main branch), created through the real services so audit
 * rows and outbox events are written. When the main API runs, the `organization.created` event makes the admin the
 * owner in the identity database. Skipped if the slug already exists.
 */
export async function seedRestaurants(
  ctx: SeedContext,
  admin: SeededUser,
): Promise<SeededRestaurant> {
  const slug = process.env.SEED_RESTAURANT_SLUG ?? "demo-restaurant";
  const existing = await ctx.organizationDb.organization.findUnique({
    where: { slug },
    include: { branches: { take: 1, orderBy: { createdAt: "asc" } } },
  });
  if (existing?.branches[0]) {
    log(`restaurant ${slug} already exists`);
    return { organizationId: existing.id, branchId: existing.branches[0].id };
  }
  const organizations = new OrganizationsService(ctx.organizationDb, {
    serviceName: "database-seed",
    trialDays: ctx.config.TRIAL_DAYS,
    trialMaxBranches: ctx.config.TRIAL_MAX_BRANCHES,
  });
  const org = await organizations.create(
    ownerPrincipal(admin.id, admin.email),
    createOrganizationBody.parse({
      name: process.env.SEED_RESTAURANT_NAME ?? "Demo Restaurant",
      slug,
      country: "SO",
      currency: "USD",
      timezone: "Africa/Mogadishu",
    }),
    SEED_CTX,
  );
  const branches = new BranchesService(ctx.organizationDb, "database-seed");
  const branch = await branches.create(
    ownerPrincipal(admin.id, admin.email, org.id),
    org.id,
    createBranchBody.parse({
      code: "MAIN",
      name: "Main branch",
      city: "Mogadishu",
    }),
    SEED_CTX,
  );
  log(`restaurant ${slug} with branch MAIN`);
  return { organizationId: org.id, branchId: branch.id };
}
