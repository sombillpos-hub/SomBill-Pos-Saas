import amqp, { type Channel, type ChannelModel, type ConfirmChannel, type ConsumeMessage } from 'amqplib';
import type { Logger } from 'pino';
import { parseEvent, type EventEnvelope } from './contracts.js';

export type EventHandler = (event: EventEnvelope) => Promise<void>;

export interface SubscriptionOptions {
  /** Durable queue owned by one consumer (e.g. "identity-service.events"). */
  queue: string;
  /** Routing keys (event types) to bind, e.g. ["organization.created"]. */
  events: string[];
  handler: EventHandler;
  /** Max delivery attempts before the message goes to `<queue>.dlq`. Default 5. */
  maxAttempts?: number;
  /** Delay before each retry, in ms. The last value repeats. Default [1000, 5000, 30000]. */
  retryDelaysMs?: number[];
  prefetch?: number;
}

export interface EventBusOptions {
  url: string;
  exchange: string;
  logger: Logger;
  /** Name shown in RabbitMQ management (connection_name). */
  connectionName: string;
}

const ATTEMPT_HEADER = 'x-sombill-attempt';

/**
 * RabbitMQ event bus:
 * - one durable topic exchange; routing key = event type;
 * - publisher confirms (a publish resolves only after the broker has the message);
 * - per-consumer durable queue, retry queues with TTL that dead-letter back to the main queue,
 *   and a dead-letter queue (`<queue>.dlq`) after `maxAttempts` or for messages that break the contract.
 */
export class RabbitEventBus {
  private connection: ChannelModel | null = null;
  private publishChannel: ConfirmChannel | null = null;
  private consumeChannels: Channel[] = [];
  private closing = false;

  constructor(private readonly opts: EventBusOptions) {}

  static async connect(opts: EventBusOptions): Promise<RabbitEventBus> {
    const bus = new RabbitEventBus(opts);
    await bus.open();
    return bus;
  }

  private async open(): Promise<void> {
    this.connection = await amqp.connect(this.opts.url, {
      clientProperties: { connection_name: this.opts.connectionName },
    });
    this.connection.on('error', (err: Error) => this.opts.logger.error({ err }, 'rabbitmq connection error'));
    this.connection.on('close', () => {
      if (!this.closing) this.opts.logger.error('rabbitmq connection closed unexpectedly');
    });
    this.publishChannel = await this.connection.createConfirmChannel();
    await this.publishChannel.assertExchange(this.opts.exchange, 'topic', { durable: true });
  }

  /** Throws if the broker connection is unusable (used by readiness checks). */
  async ping(): Promise<void> {
    if (!this.publishChannel) throw new Error('not connected');
    await this.publishChannel.checkExchange(this.opts.exchange);
  }

  async publish(event: EventEnvelope): Promise<void> {
    const ch = this.publishChannel;
    if (!ch) throw new Error('Event bus is not connected');
    const body = Buffer.from(JSON.stringify(event));
    await new Promise<void>((resolve, reject) => {
      ch.publish(
        this.opts.exchange,
        event.type,
        body,
        {
          persistent: true,
          contentType: 'application/json',
          messageId: event.id,
          type: event.type,
          timestamp: Math.floor(Date.parse(event.occurredAt) / 1000),
          headers: {
            'x-event-version': event.version,
            ...(event.correlationId ? { 'x-correlation-id': event.correlationId } : {}),
          },
        },
        (err) => (err ? reject(err) : resolve()),
      );
    });
  }

  async subscribe(sub: SubscriptionOptions): Promise<void> {
    if (!this.connection) throw new Error('Event bus is not connected');
    const maxAttempts = sub.maxAttempts ?? 5;
    const delays = sub.retryDelaysMs?.length ? sub.retryDelaysMs : [1000, 5000, 30000];
    const ch = await this.connection.createChannel();
    this.consumeChannels.push(ch);
    await ch.prefetch(sub.prefetch ?? 10);

    const dlq = `${sub.queue}.dlq`;
    await ch.assertQueue(sub.queue, { durable: true });
    await ch.assertQueue(dlq, { durable: true });
    const retryQueues = [...new Set(delays)].map((ms) => ({ ms, name: `${sub.queue}.retry.${ms}ms` }));
    for (const r of retryQueues) {
      // Expired messages dead-letter through the default exchange straight back to the main queue.
      await ch.assertQueue(r.name, {
        durable: true,
        arguments: { 'x-message-ttl': r.ms, 'x-dead-letter-exchange': '', 'x-dead-letter-routing-key': sub.queue },
      });
    }
    for (const key of sub.events) await ch.bindQueue(sub.queue, this.opts.exchange, key);

    const log = this.opts.logger.child({ queue: sub.queue });

    const deadLetter = (msg: ConsumeMessage, reason: string) => {
      ch.sendToQueue(dlq, msg.content, {
        persistent: true,
        contentType: msg.properties.contentType,
        messageId: msg.properties.messageId,
        headers: {
          ...msg.properties.headers,
          'x-dead-letter-reason': reason.slice(0, 500),
          'x-original-routing-key': msg.fields.routingKey,
        },
      });
    };

    await ch.consume(sub.queue, (msg) => {
      if (!msg) return;
      void (async () => {
        const attempt = Number(msg.properties.headers?.[ATTEMPT_HEADER] ?? 1);
        let event: EventEnvelope;
        try {
          event = parseEvent(JSON.parse(msg.content.toString('utf8')));
        } catch (err) {
          log.error({ err, messageId: msg.properties.messageId }, 'invalid event: sent to DLQ');
          deadLetter(msg, `invalid event: ${(err as Error).message}`);
          ch.ack(msg);
          return;
        }
        try {
          await sub.handler(event);
          ch.ack(msg);
        } catch (err) {
          if (attempt >= maxAttempts) {
            log.error({ err, eventId: event.id, type: event.type, attempt }, 'event handler failed: sent to DLQ');
            deadLetter(msg, (err as Error).message ?? 'handler failed');
          } else {
            const delay = delays[Math.min(attempt - 1, delays.length - 1)] ?? 1000;
            const target = retryQueues.find((r) => r.ms === delay)?.name ?? retryQueues[0]!.name;
            log.warn(
              { err, eventId: event.id, type: event.type, attempt, retryInMs: delay },
              'event handler failed: will retry',
            );
            ch.sendToQueue(target, msg.content, {
              persistent: true,
              contentType: msg.properties.contentType,
              messageId: msg.properties.messageId,
              headers: { ...msg.properties.headers, [ATTEMPT_HEADER]: attempt + 1 },
            });
          }
          ch.ack(msg);
        }
      })();
    });
    log.info({ events: sub.events }, 'subscribed');
  }

  async close(): Promise<void> {
    this.closing = true;
    for (const ch of this.consumeChannels) await ch.close().catch(() => undefined);
    await this.publishChannel?.close().catch(() => undefined);
    await this.connection?.close().catch(() => undefined);
    this.connection = null;
    this.publishChannel = null;
    this.consumeChannels = [];
  }
}
