import { log, type SeedContext } from "./context.js";

export interface SeededUser {
  id: string;
  email: string;
}

/**
 * First account (becomes the owner of the seeded restaurant). Credentials come from SEED_ADMIN_EMAIL and
 * SEED_ADMIN_PASSWORD; an existing account is left unchanged.
 */
export async function seedAdmin({
  identityDb,
  passwords,
}: SeedContext): Promise<SeededUser> {
  const email = (
    process.env.SEED_ADMIN_EMAIL ?? "admin@sombill.local"
  ).toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const existing = await identityDb.user.findUnique({ where: { email } });
  if (existing) {
    log(`admin ${email} already exists`);
    return { id: existing.id, email };
  }
  if (!password || password.length < 12) {
    throw new Error(
      "Set SEED_ADMIN_PASSWORD (at least 12 characters) to create the admin account.",
    );
  }
  const user = await identityDb.user.create({
    data: {
      email,
      fullName: process.env.SEED_ADMIN_NAME ?? "SomBill Admin",
      passwordHash: await passwords.hash(password),
    },
  });
  log(`admin ${email} created`);
  return { id: user.id, email };
}
