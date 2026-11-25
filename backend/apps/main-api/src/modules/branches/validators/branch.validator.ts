import { z } from 'zod';
import { currencyCode, timeZone } from '@sombill/validation';
import { paginationQuery } from '@sombill/shared-utils';
import { countryCode } from '../../organizations/validators/organization.validator.js';

const branchCode = z
  .string()
  .trim()
  .toUpperCase()
  .pipe(z.string().regex(/^[A-Z0-9-]{2,20}$/, '2–20 letters, digits or hyphens'))
  .openapi({ example: 'HRG-01' });

const optionalText = (max: number) => z.string().trim().min(1).max(max).nullable().optional();

export const createBranchBody = z
  .object({
    code: branchCode,
    name: z.string().trim().min(2).max(120).openapi({ example: 'Hargeisa – 26 June Road' }),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9 ()-]{6,20}$/)
      .nullable()
      .optional(),
    email: z.email().nullable().optional(),
    addressLine1: optionalText(200),
    addressLine2: optionalText(200),
    city: optionalText(100),
    /** Defaults to the organization's values. */
    country: countryCode.optional(),
    timezone: timeZone.optional(),
    currency: currencyCode.optional(),
  })
  .openapi('CreateBranchRequest');

export const updateBranchBody = createBranchBody
  .omit({ code: true, currency: true })
  .extend({ status: z.enum(['ACTIVE', 'INACTIVE']) })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'at least one field is required')
  .openapi('UpdateBranchRequest');

/** Percentages as decimal strings, e.g. "5.0000". Strings avoid floating-point rounding. */
const percent = z
  .union([z.string(), z.number()])
  .transform((v) => String(v).trim())
  .pipe(
    z
      .string()
      .regex(/^\d{1,3}(\.\d{1,4})?$/, 'up to 4 decimal places')
      .refine((v) => Number(v) >= 0 && Number(v) <= 100, 'must be between 0 and 100'),
  )
  .openapi({ type: 'string', example: '5.0000' });

export const branchSettingsBody = z
  .object({
    taxRate: percent,
    serviceChargeRate: percent,
    pricesIncludeTax: z.boolean(),
    receiptHeader: z.string().trim().max(500).nullable(),
    receiptFooter: z.string().trim().max(500).nullable(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'at least one field is required')
  .openapi('BranchSettingsRequest');

export const listBranchesQuery = paginationQuery.extend({
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  search: z.string().trim().min(1).max(100).optional(),
});

export const branchParams = z.object({ branchId: z.uuid() });

export type CreateBranchBody = z.infer<typeof createBranchBody>;
export type UpdateBranchBody = z.infer<typeof updateBranchBody>;
export type BranchSettingsBody = z.infer<typeof branchSettingsBody>;
export type ListBranchesQuery = z.infer<typeof listBranchesQuery>;
