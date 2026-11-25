#!/usr/bin/env node
/**
 * Live smoke test of every API route through the gateway. Run against a started backend (`pnpm dev` or Docker):
 *   node backend/tests/smoke/routes.mjs [http://localhost:4000]
 * Creates a throw-away account, organization and branch (unique names), so it is safe on a development database.
 * Do not run it against production.
 */
/* eslint-disable no-console -- command-line tool: its output is the report */
const BASE = (process.argv[2] ?? 'http://localhost:4000').replace(/\/+$/, '');
const API = `${BASE}/api/v1`;
const stamp = Date.now().toString(36);
const results = [];
let cookie = '';
let token = '';

async function call(method, path, { body, form, auth = true, base = API, raw = false } = {}) {
  const headers = {};
  if (auth && token) headers.authorization = `Bearer ${token}`;
  if (cookie) headers.cookie = cookie;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    headers['content-type'] = 'application/json';
    payload = typeof body === 'string' ? body : JSON.stringify(body);
  }
  const res = await fetch(base + path, { method, headers, body: payload });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie?.startsWith('sombill_rt=')) cookie = setCookie.split(';')[0];
  const text = raw ? '' : await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* not JSON */
  }
  return { status: res.status, json, headers: res.headers, res };
}

async function check(label, expected, fn) {
  try {
    const r = await fn();
    const ok = [expected].flat().includes(r.status);
    results.push({ label, ok, status: r.status });
    console.log(
      `${ok ? '✓' : '✗'} ${String(r.status).padEnd(4)} ${label}${ok ? '' : `  (expected ${expected}) ${JSON.stringify(r.json)?.slice(0, 200)}`}`,
    );
    return r;
  } catch (e) {
    results.push({ label, ok: false, status: 'ERR' });
    console.log(`✗ ERR  ${label}  ${e.message}`);
    return { status: 0, json: null };
  }
}

const email = `smoke-${stamp}@sombill.test`;
const password = 'smoke-password-123';

console.log(`SomBill API smoke test → ${BASE}\n`);
await check('GET  /health/live', 200, () => call('GET', '/health/live', { base: BASE }));
await check('GET  /health/ready', 200, () => call('GET', '/health/ready', { base: BASE }));
await check('GET  /api/docs/', 200, () => call('GET', '/api/docs/', { base: BASE, raw: true }));
await check('GET  /api/docs/identity.json', 200, () => call('GET', '/api/docs/identity.json', { base: BASE }));
await check('GET  /api/docs/organization.json', 200, () => call('GET', '/api/docs/organization.json', { base: BASE }));

// --- auth
await check('POST /auth/register', 201, () =>
  call('POST', '/auth/register', { body: { email, password, fullName: 'Smoke Test' } }),
);
const login = await check('POST /auth/login', 200, () => call('POST', '/auth/login', { body: { email, password } }));
token = login.json?.data?.accessToken ?? '';
await check('POST /auth/login (wrong password)', 401, () =>
  call('POST', '/auth/login', { body: { email, password: 'wrong-password-1' } }),
);
await check('GET  /auth/me', 200, () => call('GET', '/auth/me'));
await check('GET  /auth/me (no token)', 401, () => call('GET', '/auth/me', { auth: false }));
await check('POST /auth/change-password', 204, () =>
  call('POST', '/auth/change-password', { body: { currentPassword: password, newPassword: `${password}-2` } }),
);

// --- organizations and branches
const org = await check('POST /organizations', 201, () =>
  call('POST', '/organizations', {
    body: { name: `Smoke ${stamp}`, country: 'SO', currency: 'USD', timezone: 'Africa/Mogadishu' },
  }),
);
const orgId = org.json?.data?.id;
// The owner membership arrives through RabbitMQ (organization.created); refresh until the token carries it.
for (let i = 0; i < 20; i++) {
  const r = await call('POST', '/auth/refresh', { auth: false });
  token = r.json?.data?.accessToken ?? token;
  if (r.json?.data?.memberships?.some((m) => m.organizationId === orgId)) break;
  await new Promise((res) => setTimeout(res, 500));
}
await check('POST /auth/refresh', 200, () =>
  call('POST', '/auth/refresh', { auth: false }).then((r) => ((token = r.json?.data?.accessToken ?? token), r)),
);
await check('GET  /organizations', 200, () => call('GET', '/organizations?page=1&pageSize=10'));
await check('GET  /organizations/:id', 200, () => call('GET', `/organizations/${orgId}`));
await check('PATCH /organizations/:id', 200, () =>
  call('PATCH', `/organizations/${orgId}`, { body: { legalName: `Smoke ${stamp} Ltd` } }),
);
await check('GET  /organizations/:id/subscription', 200, () => call('GET', `/organizations/${orgId}/subscription`));
const branch = await check('POST /organizations/:id/branches', 201, () =>
  call('POST', `/organizations/${orgId}/branches`, { body: { code: 'MAIN', name: 'Main branch', city: 'Hargeisa' } }),
);
const branchId = branch.json?.data?.id;
await check('POST /organizations/:id/branches (duplicate code)', 409, () =>
  call('POST', `/organizations/${orgId}/branches`, { body: { code: 'MAIN', name: 'Again' } }),
);
await check('GET  /organizations/:id/branches', 200, () => call('GET', `/organizations/${orgId}/branches`));
await check('GET  /branches/:id', 200, () => call('GET', `/branches/${branchId}`));
await check('PATCH /branches/:id', 200, () =>
  call('PATCH', `/branches/${branchId}`, { body: { phone: '+252634000000' } }),
);
await check('GET  /branches/:id/settings', 200, () => call('GET', `/branches/${branchId}/settings`));
await check('PUT  /branches/:id/settings', 200, () =>
  call('PUT', `/branches/${branchId}/settings`, {
    body: { taxRate: '5', serviceChargeRate: '0', pricesIncludeTax: false },
  }),
);
await check('GET  /branches/not-a-uuid', 400, () => call('GET', '/branches/not-a-uuid'));

// --- users, roles, permissions
await check('GET  /users', 200, () => call('GET', `/users?organizationId=${orgId}`));
await check('GET  /roles', 200, () => call('GET', `/roles?organizationId=${orgId}`));
await check('GET  /permissions', 200, () => call('GET', '/permissions'));
const staffEmail = `staff-${stamp}@sombill.test`;
// Registering signs that account in (new refresh cookie); keep the owner's cookie.
const ownerCookie = cookie;
await call('POST', '/auth/register', { body: { email: staffEmail, password, fullName: 'Smoke Staff' }, auth: false });
cookie = ownerCookie;
const assign = await check('POST /users/memberships', 201, () =>
  call('POST', '/users/memberships', { body: { email: staffEmail, organizationId: orgId, role: 'cashier', branchId } }),
);
await check('DELETE /users/memberships/:id', 204, () => call('DELETE', `/users/memberships/${assign.json?.data?.id}`));

// --- files
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const form = () => {
  const f = new FormData();
  f.set('organizationId', orgId);
  f.set('purpose', 'BRANDING');
  f.set('file', new Blob([png], { type: 'image/png' }), 'logo.png');
  return f;
};
const up = await check('POST /files', 201, () => call('POST', '/files', { form: form() }));
const fileId = up.json?.data?.id;
await check('GET  /files', 200, () => call('GET', `/files?organizationId=${orgId}`));
await check('GET  /files/:id', 200, () => call('GET', `/files/${fileId}`));
await check('GET  /files/:id/content', 200, () => call('GET', `/files/${fileId}/content`, { raw: true }));
await check('DELETE /files/:id', 204, () => call('DELETE', `/files/${fileId}`));

// --- errors and sign-out
await check('GET  /does-not-exist', 404, () => call('GET', '/does-not-exist'));
await check('POST /auth/logout-all', 200, () => call('POST', '/auth/logout-all'));
await check('POST /auth/logout', 204, () => call('POST', '/auth/logout', { auth: false }));

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length} checks, ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);
