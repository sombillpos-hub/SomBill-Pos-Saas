/**
 * SomBill Offline Transaction Queue & Automatic Synchronization Engine.
 * - Persists pending mutations locally (IndexedDB with automatic localStorage fallback).
 * - Prevents duplicate transactions using deterministic `idempotencyKey` deduplication.
 * - Automatically synchronizes in FIFO order when internet connectivity returns.
 * - Tracks conflicts / failed requests separately from transient network retries.
 */

export interface OfflineOperation {
  id: string;
  idempotencyKey: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  body?: unknown;
  createdAt: string;
  attempts: number;
  lastError?: string;
  status: 'pending' | 'failed';
}

export interface OfflineSyncSnapshot {
  online: boolean;
  syncing: boolean;
  pendingCount: number;
  failedCount: number;
  lastSyncedAt: string | null;
}

export type OfflineExecutor = (op: OfflineOperation) => Promise<{ ok: boolean; status?: number; error?: string }>;

const STORAGE_KEY = 'sombill.offline.queue.v1';
const DB_NAME = 'sombill_offline_db';
const STORE_NAME = 'operations';

type Listener = (snapshot: OfflineSyncSnapshot) => void;

function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined' && indexedDB !== null;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function readAll(): Promise<OfflineOperation[]> {
  if (hasIndexedDb()) {
    try {
      const db = await openDb();
      return await new Promise<OfflineOperation[]>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).getAll();
        req.onsuccess = () => resolve((req.result as OfflineOperation[]) ?? []);
        req.onerror = () => reject(req.error);
      });
    } catch {
      /* fall through to localStorage */
    }
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as OfflineOperation[]) : [];
  } catch {
    return [];
  }
}

async function writeAll(ops: OfflineOperation[]): Promise<void> {
  if (hasIndexedDb()) {
    try {
      const db = await openDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.clear();
        for (const op of ops) store.put(op);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      return;
    } catch {
      /* fall through to localStorage */
    }
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ops));
  } catch {
    /* quota exceeded or private mode */
  }
}

class OfflineQueueManager {
  private listeners = new Set<Listener>();
  private syncing = false;
  private lastSyncedAt: string | null = null;
  private pendingCount = 0;
  private failedCount = 0;
  private initialized = false;

  getSnapshot(): OfflineSyncSnapshot {
    return {
      online: typeof navigator === 'undefined' ? true : navigator.onLine,
      syncing: this.syncing,
      pendingCount: this.pendingCount,
      failedCount: this.failedCount,
      lastSyncedAt: this.lastSyncedAt,
    };
  }

  private emit() {
    const snap = this.getSnapshot();
    for (const fn of this.listeners) fn(snap);
  }

  async refreshCounts(): Promise<OfflineOperation[]> {
    const ops = await readAll();
    this.pendingCount = ops.filter((o) => o.status === 'pending').length;
    this.failedCount = ops.filter((o) => o.status === 'failed').length;
    this.initialized = true;
    this.emit();
    return ops;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    if (!this.initialized) {
      void this.refreshCounts();
    } else {
      listener(this.getSnapshot());
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Queues a write operation locally. If an operation with the same `idempotencyKey`
   * already exists, it is NOT duplicated.
   */
  async enqueue(input: {
    idempotencyKey: string;
    method: OfflineOperation['method'];
    path: string;
    body?: unknown;
  }): Promise<OfflineOperation> {
    const ops = await readAll();
    const existing = ops.find((o) => o.idempotencyKey === input.idempotencyKey);
    if (existing) {
      this.pendingCount = ops.filter((o) => o.status === 'pending').length;
      this.failedCount = ops.filter((o) => o.status === 'failed').length;
      this.emit();
      return existing;
    }

    const op: OfflineOperation = {
      id: `op-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      idempotencyKey: input.idempotencyKey,
      method: input.method,
      path: input.path,
      body: input.body,
      createdAt: new Date().toISOString(),
      attempts: 0,
      status: 'pending',
    };

    const next = [...ops, op];
    await writeAll(next);
    this.pendingCount = next.filter((o) => o.status === 'pending').length;
    this.failedCount = next.filter((o) => o.status === 'failed').length;
    this.emit();
    return op;
  }

  /** Replays all pending operations in FIFO order when online. */
  async flush(executor: OfflineExecutor): Promise<{ synced: number; remaining: number; failed: number }> {
    if (this.syncing) {
      return { synced: 0, remaining: this.pendingCount, failed: this.failedCount };
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.emit();
      return { synced: 0, remaining: this.pendingCount, failed: this.failedCount };
    }

    const ops = await readAll();
    const pending = ops.filter((o) => o.status === 'pending');
    if (pending.length === 0) {
      this.pendingCount = 0;
      this.failedCount = ops.filter((o) => o.status === 'failed').length;
      this.emit();
      return { synced: 0, remaining: 0, failed: this.failedCount };
    }

    this.syncing = true;
    this.emit();

    let synced = 0;
    const remaining: OfflineOperation[] = ops.filter((o) => o.status === 'failed');

    for (let i = 0; i < pending.length; i++) {
      const op = pending[i]!;
      try {
        const res = await executor(op);
        if (res.ok) {
          synced++;
        } else if (res.status && res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) {
          // Permanent client/conflict error (e.g. 409 conflict / 400 validation) — isolate so queue keeps moving
          remaining.push({
            ...op,
            attempts: op.attempts + 1,
            status: 'failed',
            lastError: res.error || `HTTP ${res.status}`,
          });
        } else {
          // Transient server/network error — keep pending and stop flushing until next retry
          remaining.push({ ...op, attempts: op.attempts + 1, lastError: res.error || 'Network error' });
          for (let j = i + 1; j < pending.length; j++) remaining.push(pending[j]!);
          break;
        }
      } catch (err) {
        remaining.push({
          ...op,
          attempts: op.attempts + 1,
          lastError: err instanceof Error ? err.message : 'Network error',
        });
        for (let j = i + 1; j < pending.length; j++) remaining.push(pending[j]!);
        break;
      }
    }

    await writeAll(remaining);
    this.syncing = false;
    if (synced > 0) this.lastSyncedAt = new Date().toISOString();
    this.pendingCount = remaining.filter((o) => o.status === 'pending').length;
    this.failedCount = remaining.filter((o) => o.status === 'failed').length;
    this.emit();

    return { synced, remaining: this.pendingCount, failed: this.failedCount };
  }

  async retryFailed(): Promise<void> {
    const ops = await readAll();
    const reset = ops.map((o) => (o.status === 'failed' ? { ...o, status: 'pending' as const } : o));
    await writeAll(reset);
    await this.refreshCounts();
  }

  async clearAll(): Promise<void> {
    await writeAll([]);
    this.pendingCount = 0;
    this.failedCount = 0;
    this.emit();
  }
}

export const offlineQueue = new OfflineQueueManager();

/** Attaches automatic online/offline listeners to flush queued operations upon reconnect. */
export function startOfflineAutoSync(executor: OfflineExecutor): () => void {
  if (typeof window === 'undefined') return () => {};
  const onOnline = () => {
    void offlineQueue.flush(executor);
  };
  const onOffline = () => {
    void offlineQueue.refreshCounts();
  };
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  void offlineQueue.refreshCounts().then(() => {
    if (navigator.onLine) void offlineQueue.flush(executor);
  });
  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
  };
}
