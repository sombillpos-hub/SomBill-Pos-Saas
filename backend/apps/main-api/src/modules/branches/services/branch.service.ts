import { createEvent, enqueueOutbox } from '@sombill/messaging';
import { PERMISSIONS, type Principal } from '@sombill/shared-types';
import { AppError, conflict, forbidden, notFound, toSkipTake } from '@sombill/shared-utils';
import { accessibleBranches, assertCan } from '@sombill/authorization';
import type { Db, Prisma } from '@sombill/database/organization';
import { eventSource, type RequestContext } from '../../../middleware/requestContext.js';
import { writeAudit } from '../../audit-logs/repositories/organization-audit-log.repository.js';
import { OrganizationRepository } from '../../organizations/repositories/organization.repository.js';
import { toBranchView, toSettingsView } from '../models/branch.model.js';
import { BranchRepository } from '../repositories/branch.repository.js';
import type {
  BranchSettingsBody,
  CreateBranchBody,
  ListBranchesQuery,
  UpdateBranchBody,
} from '../validators/branch.validator.js';

export { toBranchView, toSettingsView };

export class BranchesService {
  private readonly branches: BranchRepository;

  constructor(
    private readonly db: Db,
    private readonly serviceName: string,
  ) {
    this.branches = new BranchRepository(db);
  }

  async create(actor: Principal, organizationId: string, body: CreateBranchBody, ctx: RequestContext) {
    // Creating branches is an organization-wide action (branch-scoped roles cannot create siblings).
    assertCan(actor, PERMISSIONS.BRANCH_CREATE, { organizationId });
    return this.db.$transaction(async (tx) => {
      const orgs = new OrganizationRepository(tx);
      const branches = new BranchRepository(tx);
      const org = await orgs.findById(organizationId);
      if (!org) throw notFound('Organization');
      if (org.status !== 'ACTIVE') throw new AppError(409, 'ORGANIZATION_SUSPENDED', 'The organization is suspended.');
      const sub = await orgs.lockSubscription(organizationId);
      if (!sub || sub.status === 'CANCELED')
        throw new AppError(409, 'SUBSCRIPTION_INACTIVE', 'The subscription is not active.');
      if ((await branches.countInOrganization(organizationId)) >= sub.maxBranches) {
        throw new AppError(409, 'PLAN_LIMIT_REACHED', `Your plan allows ${sub.maxBranches} branches.`, {
          maxBranches: sub.maxBranches,
        });
      }
      if (await branches.codeExists(organizationId, body.code)) {
        throw conflict('A branch with this code already exists.', 'BRANCH_CODE_TAKEN');
      }
      const branch = await branches.create(
        {
          organizationId,
          code: body.code,
          name: body.name,
          phone: body.phone ?? null,
          email: body.email ?? null,
          addressLine1: body.addressLine1 ?? null,
          addressLine2: body.addressLine2 ?? null,
          city: body.city ?? null,
          country: body.country ?? org.country,
          timezone: body.timezone ?? org.timezone,
          currency: body.currency ?? org.currency,
        },
        actor.userId,
      );
      await writeAudit(tx, {
        action: 'branch.created',
        actorUserId: actor.userId,
        organizationId,
        targetType: 'branch',
        targetId: branch.id,
        ...ctx,
      });
      await enqueueOutbox(
        tx,
        createEvent(
          'branch.created',
          1,
          { branchId: branch.id, organizationId, name: branch.name, code: branch.code, createdByUserId: actor.userId },
          eventSource(this.serviceName, ctx),
        ),
      );
      return toBranchView(branch);
    });
  }

  async list(actor: Principal, organizationId: string, q: ListBranchesQuery) {
    const scope = accessibleBranches(actor, PERMISSIONS.BRANCH_READ, organizationId);
    if (scope !== 'all' && scope.length === 0) throw forbidden();
    const where: Prisma.BranchWhereInput = {
      organizationId,
      ...(scope === 'all' ? {} : { id: { in: scope } }),
      ...(q.status ? { status: q.status } : {}),
      ...(q.search
        ? {
            OR: [
              { name: { contains: q.search, mode: 'insensitive' } },
              { code: { contains: q.search, mode: 'insensitive' } },
              { city: { contains: q.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const { total, rows } = await this.branches.page(where, toSkipTake(q));
    return { total, items: rows.map(toBranchView) };
  }

  /** Loads a branch and checks the permission in ITS organization and branch; outsiders get 404. */
  private async authorizedBranch(
    actor: Principal,
    branchId: string,
    permission: (typeof PERMISSIONS)[keyof typeof PERMISSIONS],
  ) {
    const branch = await this.branches.findById(branchId);
    if (!branch || !actor.memberships.some((m) => m.organizationId === branch.organizationId)) throw notFound('Branch');
    assertCan(actor, permission, { organizationId: branch.organizationId, branchId: branch.id });
    return branch;
  }

  async get(actor: Principal, branchId: string) {
    return toBranchView(await this.authorizedBranch(actor, branchId, PERMISSIONS.BRANCH_READ));
  }

  async update(actor: Principal, branchId: string, body: UpdateBranchBody, ctx: RequestContext) {
    const branch = await this.authorizedBranch(actor, branchId, PERMISSIONS.BRANCH_UPDATE);
    return this.db.$transaction(async (tx) => {
      const updated = await new BranchRepository(tx).update(branch.id, body);
      const changes = Object.fromEntries(Object.keys(body).map((k) => [k, (updated as Record<string, unknown>)[k]]));
      await writeAudit(tx, {
        action: 'branch.updated',
        actorUserId: actor.userId,
        organizationId: branch.organizationId,
        targetType: 'branch',
        targetId: branch.id,
        metadata: { changes: changes as Record<string, string | null> },
        ...ctx,
      });
      await enqueueOutbox(
        tx,
        createEvent(
          'branch.updated',
          1,
          { branchId: branch.id, organizationId: branch.organizationId, changes },
          eventSource(this.serviceName, ctx),
        ),
      );
      return toBranchView(updated);
    });
  }

  async getSettings(actor: Principal, branchId: string) {
    const branch = await this.authorizedBranch(actor, branchId, PERMISSIONS.BRANCH_READ);
    return toSettingsView(await this.branches.getSettings(branch.id));
  }

  async updateSettings(actor: Principal, branchId: string, body: BranchSettingsBody, ctx: RequestContext) {
    const branch = await this.authorizedBranch(actor, branchId, PERMISSIONS.BRANCH_SETTINGS_MANAGE);
    return this.db.$transaction(async (tx) => {
      const s = await new BranchRepository(tx).updateSettings(branch.id, { ...body, updatedByUserId: actor.userId });
      await writeAudit(tx, {
        action: 'branch.settings_updated',
        actorUserId: actor.userId,
        organizationId: branch.organizationId,
        targetType: 'branch',
        targetId: branch.id,
        metadata: { changes: body as Record<string, string | boolean | null> },
        ...ctx,
      });
      return toSettingsView(s);
    });
  }
}
