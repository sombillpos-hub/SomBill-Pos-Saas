import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { Principal } from '@sombill/shared-types';
import { AppError, toErrorResponse } from '@sombill/shared-utils';
import { accessibleBranches, can } from '@sombill/authorization';
import { bearerToken } from '../src/index.js';

const org = 'org-1';
const principal = (memberships: Principal['memberships']): Principal => ({
  userId: 'u',
  sessionId: 's',
  email: 'u@x.so',
  memberships,
});

describe('can (organization isolation + branch scope + permission)', () => {
  const orgWideManager = principal([
    { organizationId: org, branchId: null, role: 'manager', permissions: ['branch.read', 'branch.update'] },
  ]);
  const branchCashier = principal([
    { organizationId: org, branchId: 'b1', role: 'cashier', permissions: ['branch.read', 'payment.create'] },
  ]);

  it('grants organization-wide roles in every branch of their organization only', () => {
    expect(can(orgWideManager, 'branch.read', { organizationId: org })).toBe(true);
    expect(can(orgWideManager, 'branch.read', { organizationId: org, branchId: 'any' })).toBe(true);
    expect(can(orgWideManager, 'branch.read', { organizationId: 'org-2' })).toBe(false);
    expect(can(orgWideManager, 'payment.create', { organizationId: org })).toBe(false);
  });

  it('limits branch roles to their branch and never to organization-wide actions', () => {
    expect(can(branchCashier, 'payment.create', { organizationId: org, branchId: 'b1' })).toBe(true);
    expect(can(branchCashier, 'payment.create', { organizationId: org, branchId: 'b2' })).toBe(false);
    expect(can(branchCashier, 'payment.create', { organizationId: org })).toBe(false);
  });

  it('reports accessible branches', () => {
    expect(accessibleBranches(orgWideManager, 'branch.read', org)).toBe('all');
    expect(accessibleBranches(branchCashier, 'branch.read', org)).toEqual(['b1']);
    expect(accessibleBranches(branchCashier, 'branch.update', org)).toEqual([]);
  });
});

describe('bearerToken', () => {
  it('parses only well-formed Bearer headers', () => {
    expect(bearerToken('Bearer abc')).toBe('abc');
    expect(bearerToken('bearer abc')).toBe('abc');
    expect(bearerToken('Basic abc')).toBeNull();
    expect(bearerToken('Bearer')).toBeNull();
    expect(bearerToken(undefined)).toBeNull();
  });
});

describe('toErrorResponse', () => {
  it('passes through AppErrors and formats Zod errors', () => {
    expect(toErrorResponse(new AppError(409, 'X', 'conflict'), 'r1')).toEqual({
      status: 409,
      body: { error: { code: 'X', message: 'conflict', requestId: 'r1' } },
    });
    const zerr = z.object({ a: z.number() }).safeParse({ a: 'no' }).error!;
    const r = toErrorResponse(zerr);
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('VALIDATION_ERROR');
    expect(r.body.error.details).toEqual([{ path: 'a', message: expect.any(String) }]);
  });

  it('maps Prisma unique violations to 409 and hides unknown errors', () => {
    const prismaErr = Object.assign(new Error('Unique constraint failed on secret_column'), {
      name: 'PrismaClientKnownRequestError',
      code: 'P2002',
    });
    expect(toErrorResponse(prismaErr).status).toBe(409);
    expect(JSON.stringify(toErrorResponse(prismaErr).body)).not.toContain('secret_column');
    const internal = toErrorResponse(new Error('db password is hunter2'));
    expect(internal).toEqual({
      status: 500,
      body: { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } },
    });
  });
});
