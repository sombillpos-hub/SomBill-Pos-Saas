import { randomBytes } from 'node:crypto';
import { createEvent, enqueueOutbox } from '@sombill/messaging';
import { PERMISSIONS, type Principal } from '@sombill/shared-types';
import { assertCan, organizationIdsOf } from '@sombill/authorization';
import { conflict, notFound, toSkipTake, type PaginationQuery } from '@sombill/shared-utils';
import type { Db } from '@sombill/database/organization';
import { eventSource, type RequestContext } from '../../../middleware/requestContext.js';
import { writeAudit } from '../../audit-logs/repositories/organization-audit-log.repository.js';
import { toOrganizationView, toSubscriptionView } from '../models/organization.model.js';
import { OrganizationRepository } from '../repositories/organization.repository.js';
import type { CreateOrganizationBody, UpdateOrganizationBody } from '../validators/organization.validator.js';

export type { RequestContext };
export { toOrganizationView, toSubscriptionView };

function slugify(name: string): string {
  const base = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return `${base.length >= 3 ? base : 'org'}-${randomBytes(3).toString('hex')}`;
}

export class OrganizationsService {
  private readonly orgs: OrganizationRepository;

  constructor(
    private readonly db: Db,
    private readonly opts: { serviceName: string; trialDays: number; trialMaxBranches: number },
  ) {
    this.orgs = new OrganizationRepository(db);
  }

  /**
   * Any signed-in user can create an organization. The creator becomes its owner asynchronously: identity consumes
   * `organization.created` and grants the owner role, then the client refreshes its token to receive the membership.
   */
  async create(actor: Principal, body: CreateOrganizationBody, ctx: RequestContext) {
    const now = new Date();
    const trialEnds = new Date(now.getTime() + this.opts.trialDays * 86_400_000);
    return this.db.$transaction(async (tx) => {
      const orgs = new OrganizationRepository(tx);
      const slug = body.slug ?? slugify(body.name);
      if (await orgs.slugExists(slug)) throw conflict('This organization address (slug) is taken.', 'SLUG_TAKEN');
      const org = await orgs.create({
        name: body.name,
        legalName: body.legalName ?? null,
        slug,
        country: body.country,
        currency: body.currency,
        timezone: body.timezone,
        createdByUserId: actor.userId,
      });
      const subscription = await orgs.createSubscription({
        organizationId: org.id,
        plan: 'trial',
        status: 'TRIALING',
        maxBranches: this.opts.trialMaxBranches,
        trialEndsAt: trialEnds,
        currentPeriodStart: now,
        currentPeriodEnd: trialEnds,
      });
      await writeAudit(tx, {
        action: 'organization.created',
        actorUserId: actor.userId,
        organizationId: org.id,
        targetType: 'organization',
        targetId: org.id,
        ...ctx,
      });
      await enqueueOutbox(
        tx,
        createEvent(
          'organization.created',
          1,
          {
            organizationId: org.id,
            ownerUserId: actor.userId,
            name: org.name,
            currency: org.currency,
            timezone: org.timezone,
          },
          eventSource(this.opts.serviceName, ctx),
        ),
      );
      return { ...toOrganizationView(org), subscription: toSubscriptionView(subscription) };
    });
  }

  /** Organizations the caller belongs to (from their verified token), never anything else. */
  async listMine(actor: Principal, q: PaginationQuery) {
    const { total, rows } = await this.orgs.pageByIds(organizationIdsOf(actor), toSkipTake(q));
    return { total, items: rows.map(toOrganizationView) };
  }

  async get(actor: Principal, organizationId: string) {
    assertCan(actor, PERMISSIONS.ORGANIZATION_READ, { organizationId });
    const org = await this.orgs.findById(organizationId);
    if (!org) throw notFound('Organization');
    return toOrganizationView(org);
  }

  async update(actor: Principal, organizationId: string, body: UpdateOrganizationBody, ctx: RequestContext) {
    assertCan(actor, PERMISSIONS.ORGANIZATION_UPDATE, { organizationId });
    return this.db.$transaction(async (tx) => {
      const orgs = new OrganizationRepository(tx);
      if (!(await orgs.findById(organizationId))) throw notFound('Organization');
      const org = await orgs.update(organizationId, body);
      const changes = Object.fromEntries(Object.keys(body).map((k) => [k, (org as Record<string, unknown>)[k]]));
      await writeAudit(tx, {
        action: 'organization.updated',
        actorUserId: actor.userId,
        organizationId,
        targetType: 'organization',
        targetId: organizationId,
        metadata: { changes: changes as Record<string, string | null> },
        ...ctx,
      });
      await enqueueOutbox(
        tx,
        createEvent('organization.updated', 1, { organizationId, changes }, eventSource(this.opts.serviceName, ctx)),
      );
      return toOrganizationView(org);
    });
  }

  async subscription(actor: Principal, organizationId: string) {
    assertCan(actor, PERMISSIONS.SUBSCRIPTION_READ, { organizationId });
    const s = await this.orgs.findSubscription(organizationId);
    if (!s) throw notFound('Subscription');
    return toSubscriptionView(s);
  }
}
