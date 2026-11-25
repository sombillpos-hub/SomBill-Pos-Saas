import type { Logger } from 'pino';
import type { EventEnvelope } from './contracts.js';

/**
 * Minimal surface of a Prisma client (or transaction client) used by the outbox and inbox helpers.
 * Raw SQL keeps these helpers identical in every service, whatever its generated client looks like.
 */
export interface SqlExecutor {
  $executeRaw(query: TemplateStringsArray, ...values: unknown[]): PromiseLike<number>;
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): PromiseLike<T>;
}

export interface TransactionalSqlClient extends SqlExecutor {
  $transaction<R>(fn: (tx: SqlExecutor) => Promise<R>): Promise<R>;
}

/**
 * Transactional outbox, step 1: store the event in the SAME database transaction as the business change.
 * If the transaction rolls back, the event is never published; if it commits, the relay will publish it.
 */
export async function enqueueOutbox(tx: SqlExecutor, event: EventEnvelope): Promise<void> {
  await tx.$executeRaw`
    INSERT INTO "outbox_events" ("id", "event_type", "event_version", "payload", "occurred_at")
    VALUES (${event.id}::uuid, ${event.type}, ${event.version}, ${JSON.stringify(event)}::jsonb, ${event.occurredAt}::timestamptz)`;
}

interface OutboxRow {
  id: string;
  payload: EventEnvelope;
  attempts: number;
}

export interface OutboxRelayOptions {
  db: TransactionalSqlClient;
  publish: (event: EventEnvelope) => Promise<void>;
  logger: Logger;
  batchSize?: number;
  intervalMs?: number;
}

/**
 * Transactional outbox, step 2: publish pending events in order. Rows are claimed with
 * `FOR UPDATE SKIP LOCKED`, so several service instances can run relays without publishing an event twice
 * at the same time. Delivery is at-least-once; consumers deduplicate by event id (see `markEventProcessed`).
 */
export class OutboxRelay {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly opts: OutboxRelayOptions) {}

  /** Publishes one batch. Returns the number of events published. */
  async tick(): Promise<number> {
    const batch = this.opts.batchSize ?? 50;
    return this.opts.db.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<OutboxRow[]>`
        SELECT "id", "payload", "attempts" FROM "outbox_events"
        WHERE "published_at" IS NULL AND "available_at" <= now()
        ORDER BY "occurred_at", "id"
        LIMIT ${batch}
        FOR UPDATE SKIP LOCKED`;
      let published = 0;
      for (const row of rows) {
        try {
          await this.opts.publish(row.payload);
          await tx.$executeRaw`UPDATE "outbox_events" SET "published_at" = now(), "attempts" = "attempts" + 1, "last_error" = NULL WHERE "id" = ${row.id}::uuid`;
          published += 1;
        } catch (err) {
          // Back off this row (max 60 s) and stop the batch to keep ordering.
          const backoffSeconds = Math.min(60, 2 ** Math.min(row.attempts, 6));
          await tx.$executeRaw`
            UPDATE "outbox_events" SET "attempts" = "attempts" + 1, "last_error" = ${String((err as Error).message).slice(0, 1000)},
              "available_at" = now() + make_interval(secs => ${backoffSeconds})
            WHERE "id" = ${row.id}::uuid`;
          this.opts.logger.warn({ err, eventId: row.id }, 'outbox publish failed; will retry');
          break;
        }
      }
      return published;
    });
  }

  start(): void {
    const interval = this.opts.intervalMs ?? 500;
    const loop = async () => {
      if (this.running) return;
      this.running = true;
      try {
        // Drain quickly while there is a backlog.
        while ((await this.tick()) > 0) {
          /* keep draining */
        }
      } catch (err) {
        this.opts.logger.error({ err }, 'outbox relay tick failed');
      } finally {
        this.running = false;
      }
    };
    this.timer = setInterval(() => void loop(), interval);
    void loop();
  }

  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    while (this.running) await new Promise((r) => setTimeout(r, 20));
  }
}

/**
 * Idempotent consumer: records (event id, consumer) inside the handler's transaction.
 * Returns false if this consumer already processed the event, in which case the handler must do nothing.
 */
export async function markEventProcessed(tx: SqlExecutor, eventId: string, consumer: string): Promise<boolean> {
  const inserted = await tx.$executeRaw`
    INSERT INTO "processed_events" ("event_id", "consumer") VALUES (${eventId}::uuid, ${consumer})
    ON CONFLICT DO NOTHING`;
  return inserted === 1;
}
