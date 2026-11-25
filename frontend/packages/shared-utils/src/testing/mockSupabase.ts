import { vi } from 'vitest';

// A small in-memory, chainable stand-in for the Supabase JS client.
export interface Call {
  table: string;
  op: 'select' | 'insert' | 'update' | 'upsert' | 'delete';
  payload?: unknown;
  filters: Array<[string, ...unknown[]]>;
  single: boolean;
}
type Result = { data: unknown; error: { message: string; code?: string } | null; count?: number };

export const db: {
  tables: Record<string, Array<Record<string, unknown>>>;
  calls: Call[];
  handler: ((c: Call) => Result | undefined) | null;
  channels: Array<{ name: string; ons: unknown[]; status: null | ((s: string) => void) }>;
} = { tables: {}, calls: [], handler: null, channels: [] };

export function resetDb() {
  db.tables = {};
  db.calls = [];
  db.handler = null;
  db.channels = [];
  supabaseMock.rpc.mockReset().mockResolvedValue({ data: null, error: null });
  supabaseMock.functions.invoke.mockReset().mockResolvedValue({ data: {}, error: null });
  supabaseMock.removeChannel.mockClear();
  supabaseMock.auth.signInWithPassword.mockReset().mockResolvedValue({ data: {}, error: null });
  supabaseMock.auth.signOut.mockReset().mockResolvedValue({ error: null });
  supabaseMock.auth.resetPasswordForEmail.mockReset().mockResolvedValue({ error: null });
  supabaseMock.auth.verifyOtp.mockReset().mockResolvedValue({ data: {}, error: null });
  supabaseMock.auth.updateUser.mockReset().mockResolvedValue({ error: null });
}

function match(row: Record<string, unknown>, f: [string, ...unknown[]]): boolean {
  const [op, col, val] = f as [string, string, unknown];
  if (op === 'eq') return row[col] === val;
  if (op === 'neq') return row[col] !== val;
  if (op === 'is') return val === null ? row[col] === null || row[col] === undefined : row[col] === val;
  if (op === 'in') return (val as unknown[]).includes(row[col]);
  return true;
}

function builder(table: string) {
  const call: Call = { table, op: 'select', filters: [], single: false };
  const self: Record<string, unknown> = {};
  const chain =
    (name: string) =>
    (...args: unknown[]) => {
      call.filters.push([name, ...args]);
      return self;
    };
  for (const m of [
    'eq',
    'neq',
    'gte',
    'gt',
    'lt',
    'lte',
    'in',
    'is',
    'not',
    'or',
    'ilike',
    'like',
    'order',
    'range',
    'limit',
    'filter',
    'match',
  ])
    self[m] = chain(m);
  self.select = (..._a: unknown[]) => {
    if (call.op === 'select') call.op = 'select';
    return self;
  };
  for (const op of ['insert', 'update', 'upsert'] as const)
    self[op] = (payload: unknown) => {
      call.op = op;
      call.payload = payload;
      return self;
    };
  self.delete = () => {
    call.op = 'delete';
    return self;
  };
  self.single = () => {
    call.single = true;
    return self;
  };
  self.maybeSingle = () => {
    call.single = true;
    return self;
  };
  self.then = (resolve: (r: Result) => unknown, reject?: (e: unknown) => unknown) => {
    db.calls.push(call);
    try {
      const custom = db.handler?.(call);
      if (custom) return Promise.resolve(custom).then(resolve, reject);
      const rows = db.tables[table] ?? [];
      let res: Result;
      if (call.op === 'select') {
        const isRange = call.filters.some((f) => f[0] === 'range');
        const offset = isRange ? Number(call.filters.find((f) => f[0] === 'range')![1]) : 0;
        const filtered = rows.filter((r) => call.filters.every((f) => match(r, f)));
        const page = offset > 0 ? [] : filtered;
        res = { data: call.single ? (filtered[0] ?? null) : page, error: null, count: filtered.length };
      } else if (call.op === 'insert' || call.op === 'upsert') {
        const list = (Array.isArray(call.payload) ? call.payload : [call.payload]) as Array<Record<string, unknown>>;
        const inserted = list.map((p) => ({ id: (p.id as string) ?? crypto.randomUUID(), ...p }));
        db.tables[table] = [...rows, ...inserted];
        res = { data: call.single ? inserted[0] : inserted, error: null };
      } else if (call.op === 'update') {
        const hits = rows.filter((r) => call.filters.every((f) => match(r, f)));
        hits.forEach((h) => Object.assign(h, call.payload as object));
        res = { data: call.single ? (hits[0] ?? { id: 'x' }) : hits, error: null };
      } else {
        res = { data: [], error: null };
      }
      return Promise.resolve(res).then(resolve, reject);
    } catch (e) {
      return Promise.reject(e).then(resolve, reject);
    }
  };
  return self;
}

export const supabaseMock = {
  from: vi.fn((t: string) => builder(t)),
  rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  functions: { invoke: vi.fn().mockResolvedValue({ data: {}, error: null }) },
  storage: {
    from: () => ({
      upload: vi.fn().mockResolvedValue({ error: null }),
      getPublicUrl: (p: string) => ({ data: { publicUrl: `https://cdn.test/${p}` } }),
      createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://cdn.test/signed' }, error: null }),
    }),
  },
  channel: vi.fn((name: string) => {
    const ch = {
      name,
      ons: [] as unknown[],
      status: null as null | ((s: string) => void),
      on(...a: unknown[]) {
        ch.ons.push(a);
        return ch;
      },
      subscribe(cb?: (s: string) => void) {
        ch.status = cb ?? null;
        return ch;
      },
    };
    db.channels.push(ch);
    return ch;
  }),
  removeChannel: vi.fn().mockResolvedValue('ok'),
  removeAllChannels: vi.fn().mockResolvedValue([]),
  auth: {
    getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    signInWithPassword: vi.fn().mockResolvedValue({ data: {}, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
    verifyOtp: vi.fn().mockResolvedValue({ data: {}, error: null }),
    signInWithOAuth: vi.fn().mockResolvedValue({ data: {}, error: null }),
    updateUser: vi.fn().mockResolvedValue({ error: null }),
  },
};
