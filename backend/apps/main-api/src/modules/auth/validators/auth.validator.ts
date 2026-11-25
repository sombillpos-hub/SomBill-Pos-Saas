import { z } from 'zod';

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email().max(254))
  .openapi({ example: 'amina@sombill.com' });

/** NIST SP 800-63B style: long passphrases allowed, no composition rules beyond length and not-only-spaces. */
export const passwordSchema = z
  .string()
  .min(10, 'must be at least 10 characters')
  .max(128, 'must be at most 128 characters')
  .refine((p) => p.trim().length > 0, 'must not be blank')
  .openapi({ example: 'correct-horse-battery-staple' });

export const registerBody = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    fullName: z.string().trim().min(2).max(120).openapi({ example: 'Amina Yusuf' }),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9 ()-]{6,20}$/, 'must be a valid phone number')
      .optional(),
  })
  .openapi('RegisterRequest');

export const loginBody = z.object({ email: emailSchema, password: z.string().min(1).max(128) }).openapi('LoginRequest');

/** Non-browser clients send the refresh token in the body; browsers send the httpOnly cookie. */
export const refreshBody = z.object({ refreshToken: z.string().min(20).max(200).optional() }).openapi('RefreshRequest');

export const changePasswordBody = z
  .object({ currentPassword: z.string().min(1).max(128), newPassword: passwordSchema })
  .openapi('ChangePasswordRequest');

export const userView = z
  .object({
    id: z.uuid(),
    email: z.email(),
    fullName: z.string(),
    phone: z.string().nullable(),
    status: z.enum(['ACTIVE', 'SUSPENDED']),
    createdAt: z.iso.datetime(),
  })
  .openapi('User');

export const membershipView = z
  .object({
    organizationId: z.uuid(),
    branchId: z.uuid().nullable(),
    role: z.string(),
    permissions: z.array(z.string()),
  })
  .openapi('Membership');

export const sessionResponse = z
  .object({
    data: z.object({
      accessToken: z.string(),
      tokenType: z.literal('Bearer'),
      expiresIn: z.number().int().openapi({ description: 'Access-token lifetime in seconds' }),
      refreshToken: z
        .string()
        .optional()
        .openapi({ description: 'Only when the request sent `X-Token-Transport: body`' }),
      user: userView,
      memberships: z.array(membershipView),
    }),
  })
  .openapi('SessionResponse');

export type RegisterBody = z.infer<typeof registerBody>;
export type LoginBody = z.infer<typeof loginBody>;
export type ChangePasswordBody = z.infer<typeof changePasswordBody>;
