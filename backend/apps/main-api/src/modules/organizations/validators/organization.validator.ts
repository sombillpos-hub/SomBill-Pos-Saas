import { z } from 'zod';
import { currencyCode, timeZone } from '@sombill/validation';
import { paginationQuery } from '@sombill/shared-utils';

export const countryCode = z
  .string()
  .regex(/^[A-Z]{2}$/, 'must be a 2-letter ISO 3166-1 country code')
  .openapi({ example: 'SO' });

export const slug = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'lower-case letters, digits and single hyphens only')
  .min(3)
  .max(60);

export const createOrganizationBody = z
  .object({
    name: z.string().trim().min(2).max(120).openapi({ example: 'Hargeisa Grill Group' }),
    legalName: z.string().trim().min(2).max(200).optional(),
    slug: slug.optional(),
    country: countryCode,
    currency: currencyCode.openapi({ example: 'USD' }),
    timezone: timeZone.openapi({ example: 'Africa/Mogadishu' }),
  })
  .openapi('CreateOrganizationRequest');

export const updateOrganizationBody = z
  .object({
    name: z.string().trim().min(2).max(120),
    legalName: z.string().trim().min(2).max(200).nullable(),
    timezone: timeZone,
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'at least one field is required')
  .openapi('UpdateOrganizationRequest');

export const organizationParams = z.object({ organizationId: z.uuid() });

export const listOrganizationsQuery = paginationQuery;

export const organizationView = z
  .object({
    id: z.uuid(),
    name: z.string(),
    legalName: z.string().nullable(),
    slug: z.string(),
    country: z.string(),
    currency: z.string(),
    timezone: z.string(),
    status: z.enum(['ACTIVE', 'SUSPENDED']),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi('Organization');

export type CreateOrganizationBody = z.infer<typeof createOrganizationBody>;
export type UpdateOrganizationBody = z.infer<typeof updateOrganizationBody>;
