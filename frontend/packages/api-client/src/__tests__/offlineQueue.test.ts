import { beforeEach, describe, expect, it, vi } from 'vitest';
import { offlineQueue } from '../offlineQueue';

describe('offlineQueue (Offline Functionality & Auto-Sync)', () => {
  beforeEach(async () => {
    localStorage.clear();
    await offlineQueue.clearAll();
  });

  it('queues mutations locally and deduplicates identical idempotency keys', async () => {
    const first = await offlineQueue.enqueue({
      idempotencyKey: 'order-key-1',
      method: 'POST',
      path: '/orders',
      body: { total: 25 },
    });
    const duplicate = await offlineQueue.enqueue({
      idempotencyKey: 'order-key-1',
      method: 'POST',
      path: '/orders',
      body: { total: 25 },
    });

    expect(duplicate.id).toBe(first.id);
    expect(offlineQueue.getSnapshot().pendingCount).toBe(1);
  });

  it('flushes queued operations in FIFO order and clears them when synced', async () => {
    await offlineQueue.enqueue({ idempotencyKey: 'k-1', method: 'POST', path: '/orders', body: { n: 1 } });
    await offlineQueue.enqueue({ idempotencyKey: 'k-2', method: 'POST', path: '/payments', body: { n: 2 } });

    const seen: string[] = [];
    const result = await offlineQueue.flush(async (op) => {
      seen.push(op.idempotencyKey);
      return { ok: true, status: 201 };
    });

    expect(seen).toEqual(['k-1', 'k-2']);
    expect(result).toEqual({ synced: 2, remaining: 0, failed: 0 });
    expect(offlineQueue.getSnapshot().pendingCount).toBe(0);
    expect(offlineQueue.getSnapshot().lastSyncedAt).not.toBeNull();
  });

  it('isolates permanent 4xx conflict errors while keeping subsequent items syncing', async () => {
    await offlineQueue.enqueue({ idempotencyKey: 'bad-1', method: 'POST', path: '/orders', body: {} });
    await offlineQueue.enqueue({ idempotencyKey: 'good-2', method: 'POST', path: '/payments', body: {} });

    const exec = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 409, error: 'Duplicate order' })
      .mockResolvedValueOnce({ ok: true, status: 201 });

    const res = await offlineQueue.flush(exec);
    expect(res).toEqual({ synced: 1, remaining: 0, failed: 1 });
    expect(offlineQueue.getSnapshot().failedCount).toBe(1);
  });

  it('stops flushing on transient network errors so operations retry when back online', async () => {
    await offlineQueue.enqueue({ idempotencyKey: 'net-1', method: 'POST', path: '/orders', body: {} });
    await offlineQueue.enqueue({ idempotencyKey: 'net-2', method: 'POST', path: '/payments', body: {} });

    const res = await offlineQueue.flush(async () => {
      throw new Error('Failed to fetch');
    });

    expect(res).toEqual({ synced: 0, remaining: 2, failed: 0 });
    expect(offlineQueue.getSnapshot().pendingCount).toBe(2);
  });
});
