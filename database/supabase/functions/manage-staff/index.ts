// SomBill – manage-staff Edge Function (Deno).
// Deploy: supabase functions deploy manage-staff
// Secrets required (set with `supabase secrets set`):
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (provided by platform)
//   ALLOWED_ORIGINS  e.g. "http://localhost:3000,https://staging.sombill.com,https://app.sombill.com"
import { createClient } from 'npm:@supabase/supabase-js@2';
import { handleStaffAction, HttpError, type Member, type StaffBackend } from './handler.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function cors(origin: string | null): HeadersInit {
  const allow =
    ALLOWED_ORIGINS.length === 0
      ? (origin ?? '*')
      : origin && ALLOWED_ORIGINS.includes(origin)
        ? origin
        : (ALLOWED_ORIGINS[0] ?? '*');
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });

function must<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new HttpError(500, res.error.message);
  return res.data;
}

const backend: StaffBackend = {
  async findMembership(restaurantId, userId) {
    return must(
      await admin
        .from('restaurant_members')
        .select('id, restaurant_id, user_id, role, status')
        .eq('restaurant_id', restaurantId)
        .eq('user_id', userId)
        .maybeSingle(),
    ) as Member | null;
  },
  async isOrgOwner(restaurantId, userId) {
    const r = must(await admin.from('restaurants').select('organization_id').eq('id', restaurantId).maybeSingle()) as {
      organization_id: string | null;
    } | null;
    if (!r?.organization_id) return false;
    const om = must(
      await admin
        .from('organization_members')
        .select('id')
        .eq('organization_id', r.organization_id)
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle(),
    );
    return om !== null;
  },
  async getMember(memberId) {
    return must(
      await admin
        .from('restaurant_members')
        .select('id, restaurant_id, user_id, role, status')
        .eq('id', memberId)
        .maybeSingle(),
    ) as Member | null;
  },
  async countActiveManagers(restaurantId) {
    const { count, error } = await admin
      .from('restaurant_members')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId)
      .eq('role', 'manager')
      .eq('status', 'active');
    if (error) throw new HttpError(500, error.message);
    return count ?? 0;
  },
  async findUserIdByEmail(email) {
    const row = must(await admin.from('profiles').select('id').ilike('email', email).maybeSingle()) as {
      id: string;
    } | null;
    return row?.id ?? null;
  },
  async inviteUser(email, meta, redirectTo) {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { data: meta, redirectTo });
    if (error || !data.user) throw new HttpError(400, error?.message ?? 'Could not invite user');
    return data.user.id;
  },
  async createUserWithPassword(email, password, meta) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: meta,
    });
    if (error || !data.user) throw new HttpError(400, error?.message ?? 'Could not create user');
    return data.user.id;
  },
  async upsertProfile(userId, patch) {
    must(await admin.from('profiles').upsert({ id: userId, ...patch }, { onConflict: 'id' }));
  },
  async insertMember(m) {
    return must(
      await admin.from('restaurant_members').insert(m).select('id, restaurant_id, user_id, role, status').single(),
    ) as Member;
  },
  async updateMember(memberId, patch) {
    return must(
      await admin
        .from('restaurant_members')
        .update(patch)
        .eq('id', memberId)
        .select('id, restaurant_id, user_id, role, status')
        .single(),
    ) as Member;
  },
  async getUserEmail(userId) {
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error) throw new HttpError(500, error.message);
    return data.user?.email ?? null;
  },
  async sendPasswordReset(email, redirectTo) {
    const { error } = await anon.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw new HttpError(400, error.message);
  },
  async audit(e) {
    must(await admin.from('audit_logs').insert({ ...e, entity_type: 'restaurant_members' }));
  },
};

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(origin) });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: cors(origin) });
  }
  try {
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    let callerId: string | null = null;
    if (jwt) {
      const { data } = await admin.auth.getUser(jwt);
      callerId = data.user?.id ?? null;
    }
    const body = await req.json().catch(() => null);
    const result = await handleStaffAction(backend, callerId, body, ALLOWED_ORIGINS);
    return new Response(JSON.stringify(result.data), {
      status: result.status,
      headers: { ...cors(origin), 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    const message = e instanceof HttpError ? e.message : 'Internal error';
    if (!(e instanceof HttpError)) console.error(e);
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...cors(origin), 'Content-Type': 'application/json' },
    });
  }
});
