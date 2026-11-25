import { offlineQueue, startOfflineAutoSync, type OfflineOperation } from './offlineQueue';

/**
 * SomBill Custom Backend REST + Realtime SSE Client.
 * - Connects Frontend (Manager, Cashier, Waiter, Super Admin, Website) to the Node.js API (`/api/v1/*`).
 * - Adaptive 2G/3G retry with exponential backoff.
 * - Automatically queues offline write operations with Idempotency-Key deduplication & auto-syncs on reconnect.
 */

const rawBase = (import.meta.env?.VITE_API_URL as string | undefined) ?? '';
export const API_BASE = rawBase ? `${rawBase.replace(/\/+$/, '')}/api/v1` : '/api/v1';

export interface ApiResponse<T> {
  data: T;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isSlowConnection(): boolean {
  if (typeof navigator === 'undefined') return false;
  const conn = (navigator as Navigator & { connection?: { effectiveType?: string; saveData?: boolean } }).connection;
  return Boolean(
    conn?.saveData || conn?.effectiveType === '2g' || conn?.effectiveType === 'slow-2g' || conn?.effectiveType === '3g',
  );
}

async function fetchWithRetry(url: string, init: RequestInit, maxRetries = 2): Promise<Response> {
  const timeoutMs = isSlowConnection() ? 25_000 : 12_000;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);
      if (res.status < 500 || attempt === maxRetries) return res;
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      if (attempt === maxRetries) throw err;
    }
    await sleep(350 * Math.pow(2, attempt));
  }
  throw lastErr instanceof Error ? lastErr : new Error('Network request failed');
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  token?: string,
  idempotencyKey?: string,
): Promise<T> {
  const isWrite = method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';
  const key = idempotencyKey || (isWrite ? `sb-${Date.now()}-${Math.random().toString(36).slice(2, 9)}` : undefined);

  if (isWrite && typeof navigator !== 'undefined' && !navigator.onLine) {
    const queued = await offlineQueue.enqueue({
      idempotencyKey: key!,
      method: method as OfflineOperation['method'],
      path,
      body,
    });
    return { queued: true, operation: queued } as unknown as T;
  }

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  if (key) headers['Idempotency-Key'] = key;

  const res = await fetchWithRetry(`${API_BASE}${path}`, {
    method,
    headers,
    credentials: 'include',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return undefined as T;
  const json = (await res.json().catch(() => null)) as { data?: T; error?: string } | null;
  if (!res.ok) {
    throw new Error(json?.error || `Request failed (${res.status})`);
  }
  return (json && 'data' in json ? json.data : json) as T;
}

/** Starts automatic background synchronization of offline-queued mutations to the SomBill Backend API. */
export function startSomBillAutoSync(): () => void {
  return startOfflineAutoSync(async (op) => {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Idempotency-Key': op.idempotencyKey,
    };
    if (op.body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(`${API_BASE}${op.path}`, {
      method: op.method,
      headers,
      credentials: 'include',
      body: op.body !== undefined ? JSON.stringify(op.body) : undefined,
    });
    if (res.ok || res.status === 204) return { ok: true, status: res.status };
    const json = (await res.json().catch(() => null)) as { error?: string } | null;
    return { ok: false, status: res.status, error: json?.error || `HTTP ${res.status}` };
  });
}

function crud<T = Record<string, unknown>>(resource: string) {
  return {
    list: (branchId?: string) =>
      request<T[]>('GET', branchId ? `${resource}?branchId=${encodeURIComponent(branchId)}` : resource),
    get: (id: string) => request<T>('GET', `${resource}/${encodeURIComponent(id)}`),
    create: (payload: Record<string, unknown>) => request<T>('POST', resource, payload),
    update: (id: string, patch: Record<string, unknown>) =>
      request<T>('PATCH', `${resource}/${encodeURIComponent(id)}`, patch),
    remove: (id: string) => request<void>('DELETE', `${resource}/${encodeURIComponent(id)}`),
  };
}

export const sombillApi = {
  // Core Hospitality & POS resources
  categories: crud('/categories'),
  products: crud('/products'),
  tables: crud('/tables'),
  orders: {
    ...crud('/orders'),
    requestBill: (id: string) => request('POST', `/orders/${encodeURIComponent(id)}/request-bill`),
    cancel: (id: string, reason?: string) => request('POST', `/orders/${encodeURIComponent(id)}/cancel`, { reason }),
  },
  kitchen: {
    queue: (branchId?: string) =>
      request<Record<string, unknown>[]>(
        'GET',
        branchId ? `/kitchen/queue?branchId=${encodeURIComponent(branchId)}` : '/kitchen/queue',
      ),
    updateStatus: (id: string, status: string) =>
      request('PATCH', `/kitchen/orders/${encodeURIComponent(id)}/status`, { status }),
  },
  pos: {
    bootstrap: (branchId?: string) =>
      request<Record<string, unknown>>(
        'GET',
        branchId ? `/pos/bootstrap?branchId=${encodeURIComponent(branchId)}` : '/pos/bootstrap',
      ),
  },
  payments: {
    ...crud('/payments'),
    verify: (id: string, approved = true) =>
      request('POST', `/payments/${encodeURIComponent(id)}/verify`, { approved }),
    refund: (id: string) => request('POST', `/payments/${encodeURIComponent(id)}/refund`),
  },
  shifts: {
    ...crud('/shifts'),
    open: (branchId?: string) =>
      request<Record<string, unknown> | null>(
        'GET',
        branchId ? `/shifts/open?branchId=${encodeURIComponent(branchId)}` : '/shifts/open',
      ),
    close: (id: string, counted_cash: number) =>
      request('POST', `/shifts/${encodeURIComponent(id)}/close`, { counted_cash }),
  },
  inventory: {
    ...crud('/inventory'),
    adjust: (id: string, delta: number, reason?: string) =>
      request('POST', `/inventory/${encodeURIComponent(id)}/adjust`, { delta, reason }),
  },
  suppliers: crud('/suppliers'),
  purchaseOrders: crud('/purchase-orders'),
  expenses: crud('/expenses'),
  customers: crud('/customers'),
  notifications: {
    ...crud('/notifications'),
    markRead: (id: string) => request('POST', `/notifications/${encodeURIComponent(id)}/read`),
  },
  auditLogs: crud('/audit-logs'),
  reports: {
    salesSummary: (branchId?: string) =>
      request<Record<string, unknown>>(
        'GET',
        branchId ? `/reports/sales-summary?branchId=${encodeURIComponent(branchId)}` : '/reports/sales-summary',
      ),
  },
  publicSite: {
    submitDemo: (payload: { name: string; business: string; city: string; phone: string }) =>
      request('POST', '/public/demo-requests', payload),
    submitContact: (payload: { name: string; email: string; phone?: string; message: string }) =>
      request('POST', '/public/contact', payload),
    subscribeNewsletter: (email: string) => request('POST', '/public/newsletter', { email }),
    listLeads: () => request('GET', '/public/leads'),
  },
};

export interface RealtimeMessage {
  room: string;
  event: string;
  payload: unknown;
  ts: string;
}

/**
 * Subscribes to the live SSE Realtime stream from `main-api` (`/api/v1/realtime/stream`).
 * Returns an unsubscribe cleanup function.
 */
export function subscribeRealtime(room: string, events: string[], onEvent: (msg: RealtimeMessage) => void): () => void {
  if (typeof EventSource === 'undefined') return () => {};
  const url = `${API_BASE}/realtime/stream?room=${encodeURIComponent(room || '*')}`;
  const es = new EventSource(url);
  const handler = (e: MessageEvent) => {
    try {
      onEvent(JSON.parse(String(e.data)) as RealtimeMessage);
    } catch {
      /* ignore malformed frame */
    }
  };
  for (const name of events) {
    es.addEventListener(name, handler);
  }
  return () => {
    for (const name of events) {
      es.removeEventListener(name, handler);
    }
    es.close();
  };
}
