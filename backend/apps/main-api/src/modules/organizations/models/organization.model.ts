import type { Organization, Subscription } from '@sombill/database/organization';

export const toOrganizationView = (o: Organization) => ({
  id: o.id,
  name: o.name,
  legalName: o.legalName,
  slug: o.slug,
  country: o.country,
  currency: o.currency,
  timezone: o.timezone,
  status: o.status,
  createdAt: o.createdAt.toISOString(),
  updatedAt: o.updatedAt.toISOString(),
});

export const toSubscriptionView = (s: Subscription) => ({
  plan: s.plan,
  status: s.status,
  maxBranches: s.maxBranches,
  trialEndsAt: s.trialEndsAt?.toISOString() ?? null,
  currentPeriodStart: s.currentPeriodStart.toISOString(),
  currentPeriodEnd: s.currentPeriodEnd.toISOString(),
});

export type OrganizationView = ReturnType<typeof toOrganizationView>;
export type SubscriptionView = ReturnType<typeof toSubscriptionView>;
