import type { Branch, BranchSettings } from '@sombill/database/organization';

export const toBranchView = (b: Branch) => ({
  id: b.id,
  organizationId: b.organizationId,
  code: b.code,
  name: b.name,
  phone: b.phone,
  email: b.email,
  addressLine1: b.addressLine1,
  addressLine2: b.addressLine2,
  city: b.city,
  country: b.country,
  timezone: b.timezone,
  currency: b.currency,
  status: b.status,
  createdAt: b.createdAt.toISOString(),
  updatedAt: b.updatedAt.toISOString(),
});

/** Decimals are returned as fixed 4-place strings: exact, and safe for JavaScript clients. */
export const toSettingsView = (s: BranchSettings) => ({
  branchId: s.branchId,
  taxRate: s.taxRate.toFixed(4),
  serviceChargeRate: s.serviceChargeRate.toFixed(4),
  pricesIncludeTax: s.pricesIncludeTax,
  receiptHeader: s.receiptHeader,
  receiptFooter: s.receiptFooter,
  updatedAt: s.updatedAt.toISOString(),
});

export type BranchView = ReturnType<typeof toBranchView>;
export type BranchSettingsView = ReturnType<typeof toSettingsView>;
