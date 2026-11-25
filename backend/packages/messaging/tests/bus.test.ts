import { randomUUID } from 'node:crypto';
import amqp from 'amqplib';
import { pino } from 'pino';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ContractError, createEvent, parseEvent, RabbitEventBus, type EventEnvelope } from '../src/index.js';

const RABBITMQ_URL = process.env.RABBITMQ_URL ?? 'amqp://guest:guest@127.0.0.1:5672';
const logger = pino({ level: 'silent' });
const exchange = `test.events.${randomUUID().slice(0, 8)}`;

const orgCreated = (name = 'Hargeisa Grill') =>
  createEvent(
    'organization.created',
    1,
    { organizationId: randomUUID(), ownerUserId: randomUUID(), name, currency: 'USD', timezone: 'Africa/Mogadishu' },
    { source: 'test' },
  );

async function waitFor<T>(fn: () => T | undefined, timeoutMs = 8000): Promise<T> {
  const start = Date.now();
  for (;;) {
    const v = fn();
    if (v !== undefined) return v;
    if (Date.now() - start > timeoutMs) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 25));
  }
}

async function queueDepth(queue: string): Promise<number> {
  const conn = await amqp.connect(RABBITMQ_URL);
  const ch = await conn.createChannel();
  const { messageCount } = await ch.checkQueue(queue);
  await conn.close();
  return messageCount;
}

describe('event contracts', () => {
  it('creates valid envelopes and rejects data that breaks the contract', () => {
    const e = orgCreated();
    expect(e).toMatchObject({ type: 'organization.created', version: 1, source: 'test' });
    expect(parseEvent(JSON.parse(JSON.stringify(e)))).toEqual(e);
    expect(() =>
      createEvent('organization.created', 1, { ...e.data, currency: 'DOLLARS' } as never, { source: 'test' }),
    ).toThrow();
    expect(() => parseEvent({ ...e, type: 'nope.unknown' })).toThrow(ContractError);
  });
});

describe('RabbitEventBus (real RabbitMQ)', () => {
  let bus: RabbitEventBus;
  beforeAll(async () => {
    bus = await RabbitEventBus.connect({ url: RABBITMQ_URL, exchange, logger, connectionName: 'bus-test' });
  });
  afterAll(async () => {
    await bus.close();
  });

  it('delivers published events to bound queues only', async () => {
    const queue = `t.${randomUUID()}`;
    const got: EventEnvelope[] = [];
    await bus.subscribe({ queue, events: ['organization.created'], handler: async (e) => void got.push(e) });
    const e = orgCreated();
    await bus.publish(e);
    await bus.publish(
      createEvent('user.registered', 1, { userId: randomUUID(), email: 'a@b.so', fullName: 'A' }, { source: 'test' }),
    );
    const received = await waitFor(() => got[0]);
    expect(received.id).toBe(e.id);
    await new Promise((r) => setTimeout(r, 200));
    expect(got).toHaveLength(1);
  });

  it('retries a failing handler and succeeds on a later attempt', async () => {
    const queue = `t.${randomUUID()}`;
    let calls = 0;
    await bus.subscribe({
      queue,
      events: ['organization.created'],
      retryDelaysMs: [100],
      handler: async () => {
        calls += 1;
        if (calls < 3) throw new Error('transient');
      },
    });
    await bus.publish(orgCreated());
    await waitFor(() => (calls >= 3 ? true : undefined));
    await new Promise((r) => setTimeout(r, 300));
    expect(calls).toBe(3);
    expect(await queueDepth(`${queue}.dlq`)).toBe(0);
  });

  it('sends a message to the dead-letter queue after maxAttempts', async () => {
    const queue = `t.${randomUUID()}`;
    let calls = 0;
    await bus.subscribe({
      queue,
      events: ['organization.created'],
      maxAttempts: 3,
      retryDelaysMs: [50],
      handler: async () => {
        calls += 1;
        throw new Error('permanent');
      },
    });
    await bus.publish(orgCreated());
    await waitFor(() => (calls >= 3 ? true : undefined));
    let dlq = 0;
    for (let i = 0; i < 40 && dlq === 0; i++) {
      await new Promise((r) => setTimeout(r, 50));
      dlq = await queueDepth(`${queue}.dlq`);
    }
    expect(calls).toBe(3);
    expect(dlq).toBe(1);
  });

  it('dead-letters messages that violate the contract without calling the handler', async () => {
    const queue = `t.${randomUUID()}`;
    let calls = 0;
    await bus.subscribe({ queue, events: ['organization.created'], handler: async () => void (calls += 1) });
    const bad = { ...orgCreated(), data: { organizationId: 'not-a-uuid' } } as EventEnvelope;
    await bus.publish(bad);
    let dlq = 0;
    for (let i = 0; i < 40 && dlq === 0; i++) {
      await new Promise((r) => setTimeout(r, 50));
      dlq = await queueDepth(`${queue}.dlq`);
    }
    expect(dlq).toBe(1);
    expect(calls).toBe(0);
  });
});
