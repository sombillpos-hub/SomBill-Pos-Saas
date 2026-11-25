import { randomUUID } from 'node:crypto';
import { z } from 'zod';

/**
 * Event envelope shared by every SomBill event. `type` is the RabbitMQ routing key; `version` is the contract
 * version of `data`. A breaking change to `data` gets a new version, and both are published during migration.
 */
export const envelopeSchema = z.object({
  id: z.uuid(),
  type: z.string().min(1),
  version: z.number().int().min(1),
  occurredAt: z.iso.datetime({ offset: true }),
  source: z.string().min(1),
  correlationId: z.string().optional(),
  causationId: z.string().optional(),
  data: z.unknown(),
});

export type EventEnvelope<T = unknown> = Omit<z.infer<typeof envelopeSchema>, 'data'> & { data: T };

// ---------------------------------------------------------------------------
// Contracts. Add new events here; consumers and publishers share these schemas.
// ---------------------------------------------------------------------------
const uuid = z.uuid();

export const contracts = {
  'user.registered': { 1: z.object({ userId: uuid, email: z.email(), fullName: z.string() }) },
  'organization.created': {
    1: z.object({
      organizationId: uuid,
      ownerUserId: uuid,
      name: z.string(),
      currency: z.string().length(3),
      timezone: z.string(),
    }),
  },
  'organization.updated': { 1: z.object({ organizationId: uuid, changes: z.record(z.string(), z.unknown()) }) },
  'branch.created': {
    1: z.object({ branchId: uuid, organizationId: uuid, name: z.string(), code: z.string(), createdByUserId: uuid }),
  },
  'branch.updated': {
    1: z.object({ branchId: uuid, organizationId: uuid, changes: z.record(z.string(), z.unknown()) }),
  },
  'role.assigned': {
    1: z.object({
      userId: uuid,
      organizationId: uuid,
      branchId: uuid.nullable(),
      role: z.string(),
      assignedByUserId: uuid.nullable(),
    }),
  },
  'role.revoked': {
    1: z.object({
      userId: uuid,
      organizationId: uuid,
      branchId: uuid.nullable(),
      role: z.string(),
      revokedByUserId: uuid,
    }),
  },
} as const;

export type EventType = keyof typeof contracts;
type Versions<T extends EventType> = keyof (typeof contracts)[T] & number;
export type EventData<T extends EventType, V extends Versions<T> = Versions<T>> = z.infer<(typeof contracts)[T][V]>;

/**
 * Event names reserved for later phases (catalog, POS, payments, kitchen, inventory, finance). Their contracts are
 * added to `contracts` when the owning service is built.
 */
export const PLANNED_EVENTS = [
  'product.created',
  'order.created',
  'order.status_changed',
  'payment.completed',
  'payment.refunded',
  'kitchen.ticket_updated',
  'stock.low',
  'expense.created',
] as const;

export class ContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContractError';
  }
}

function schemaFor(type: string, version: number): z.ZodType {
  const byVersion = (contracts as Record<string, Record<number, z.ZodType>>)[type];
  const schema = byVersion?.[version];
  if (!schema) throw new ContractError(`No contract for ${type} v${version}`);
  return schema;
}

export interface CreateEventOptions {
  source: string;
  correlationId?: string;
  causationId?: string;
  id?: string;
  occurredAt?: Date;
}

/** Builds a validated envelope. Throws if `data` does not match the contract. */
export function createEvent<T extends EventType, V extends Versions<T>>(
  type: T,
  version: V,
  data: EventData<T, V>,
  opts: CreateEventOptions,
): EventEnvelope<EventData<T, V>> {
  const parsed = schemaFor(type, version).parse(data) as EventData<T, V>;
  return {
    id: opts.id ?? randomUUID(),
    type,
    version,
    occurredAt: (opts.occurredAt ?? new Date()).toISOString(),
    source: opts.source,
    ...(opts.correlationId ? { correlationId: opts.correlationId } : {}),
    ...(opts.causationId ? { causationId: opts.causationId } : {}),
    data: parsed,
  };
}

/** Validates an incoming message: envelope shape first, then `data` against its versioned contract. */
export function parseEvent(raw: unknown): EventEnvelope {
  const envelope = envelopeSchema.parse(raw);
  const data = schemaFor(envelope.type, envelope.version).parse(envelope.data);
  return { ...envelope, data };
}
