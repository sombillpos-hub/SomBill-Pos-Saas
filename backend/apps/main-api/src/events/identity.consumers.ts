import {
  createEvent,
  enqueueOutbox,
  markEventProcessed,
  type EventData,
  type EventEnvelope,
  type EventHandler,
} from '@sombill/messaging';
import { SYSTEM_ROLES } from '@sombill/shared-types';
import type { Db } from '@sombill/database/identity';
import { writeAudit } from '../modules/audit-logs/repositories/identity-audit-log.repository.js';
import { SYSTEM_SCOPE } from '../modules/roles/services/role.service.js';

export const CONSUMER = 'identity-service';
export const SUBSCRIBED_EVENTS = ['organization.created', 'branch.created'] as const;

/**
 * Identity reacts to organization events:
 * - organization.created → the creator becomes the organization's owner;
 * - branch.created → the branch id is recorded so branch-scoped roles can be validated.
 * Each handler runs in one transaction with an idempotency record, so redelivered events are no-ops.
 */
export function createEventHandler(db: Db, serviceName: string): EventHandler {
  return async (event: EventEnvelope) => {
    switch (event.type) {
      case 'organization.created':
        return onOrganizationCreated(db, serviceName, event as EventEnvelope<EventData<'organization.created', 1>>);
      case 'branch.created':
        return onBranchCreated(db, event as EventEnvelope<EventData<'branch.created', 1>>);
      default:
        return;
    }
  };
}

async function onOrganizationCreated(
  db: Db,
  serviceName: string,
  event: EventEnvelope<EventData<'organization.created', 1>>,
) {
  const { organizationId, ownerUserId } = event.data;
  await db.$transaction(async (tx) => {
    if (!(await markEventProcessed(tx, event.id, CONSUMER))) return;
    const owner = await tx.role.findUniqueOrThrow({
      where: { scopeKey_code: { scopeKey: SYSTEM_SCOPE, code: SYSTEM_ROLES.OWNER } },
    });
    // Throws (→ retry, then dead-letter) if the user does not exist: that would be a real inconsistency.
    await tx.user.findUniqueOrThrow({ where: { id: ownerUserId }, select: { id: true } });
    const m = await tx.membership.upsert({
      where: {
        userId_organizationId_branchScope_roleId: {
          userId: ownerUserId,
          organizationId,
          branchScope: '*',
          roleId: owner.id,
        },
      },
      update: {},
      create: {
        userId: ownerUserId,
        organizationId,
        branchId: null,
        branchScope: '*',
        roleId: owner.id,
        createdByUserId: null,
      },
    });
    await writeAudit(tx, {
      action: 'role.assigned',
      actorUserId: null,
      organizationId,
      targetType: 'membership',
      targetId: m.id,
      metadata: { userId: ownerUserId, role: SYSTEM_ROLES.OWNER, reason: 'organization.created', eventId: event.id },
    });
    await enqueueOutbox(
      tx,
      createEvent(
        'role.assigned',
        1,
        { userId: ownerUserId, organizationId, branchId: null, role: SYSTEM_ROLES.OWNER, assignedByUserId: null },
        {
          source: serviceName,
          causationId: event.id,
          ...(event.correlationId ? { correlationId: event.correlationId } : {}),
        },
      ),
    );
  });
}

async function onBranchCreated(db: Db, event: EventEnvelope<EventData<'branch.created', 1>>) {
  await db.$transaction(async (tx) => {
    if (!(await markEventProcessed(tx, event.id, CONSUMER))) return;
    await tx.knownBranch.upsert({
      where: { id: event.data.branchId },
      update: {},
      create: { id: event.data.branchId, organizationId: event.data.organizationId },
    });
  });
}
