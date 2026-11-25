import { OutboxRelay, type RabbitEventBus } from '@sombill/messaging';
import type { Logger } from '@sombill/logger';
import type { Db as IdentityDb } from '@sombill/database/identity';
import type { Db as OrganizationDb } from '@sombill/database/organization';

export interface OutboxJobOptions {
  identityDb: IdentityDb;
  organizationDb: OrganizationDb;
  bus: RabbitEventBus;
  logger: Logger;
  intervalMs: number;
}

/**
 * Background job: publishes pending outbox rows of every module database to RabbitMQ (transactional outbox,
 * at-least-once). Returns a function that stops all relays.
 */
export function startOutboxJobs(opts: OutboxJobOptions): () => Promise<void> {
  const relays = [opts.identityDb, opts.organizationDb].map(
    (db) =>
      new OutboxRelay({
        db,
        publish: (e) => opts.bus.publish(e),
        logger: opts.logger,
        intervalMs: opts.intervalMs,
      }),
  );
  relays.forEach((r) => r.start());
  return async () => {
    await Promise.all(relays.map((r) => r.stop()));
  };
}
