// Route check: every dashboards route in real Chrome with stubbed Supabase.
//   - signed out: every protected route lands on /login (and /login, /reset-password render);
//   - each role: every route it may open renders an <h1> with no runtime error; routes of other roles redirect to
//     the right home; unknown paths show the 404 page.
// Usage: node e2e/routes.mjs <baseUrl> <chromePath>
import { chromium } from 'playwright-core';
import * as F from './fixtures.mjs';

const [base, chrome = '/usr/bin/google-chrome'] = process.argv.slice(2);
const MANAGER = '77777777-7777-4777-8777-777777777777';
const managerProfile = { ...F.profile, id: MANAGER, full_name: 'Hassan Abdikadir', email: 'hassan@grill.so' };
const managerMember = { ...F.member, id: 'm9', user_id: MANAGER, role: 'manager' };
const iso = (min) => new Date(Date.now() - min * 60000).toISOString();
const ts = { created_at: iso(9000), updated_at: iso(9000), archived_at: null };
const customers = [
  { id: 'cu0', restaurant_id: F.RID, name: 'Ahmed Jama', phone: '+252634000000', email: null, notes: null, ...ts },
];
const suppliers = [
  {
    id: 'su0',
    restaurant_id: F.RID,
    name: 'Berbera Foods',
    contact_name: 'Sales',
    phone: '+252630000',
    email: null,
    address: null,
    notes: null,
    is_active: true,
    ...ts,
  },
];
const purchaseOrders = [
  {
    id: 'po0',
    restaurant_id: F.RID,
    supplier_id: 'su0',
    po_number: 'PO-0001',
    status: 'ordered',
    expected_date: null,
    notes: null,
    subtotal: 50,
    total: 50,
    amount_paid: 0,
    ...ts,
  },
];
const TABLES = {
  profiles: [managerProfile, F.profile, F.cashierProfile],
  restaurant_members: [managerMember, F.member, F.cashierMember],
  restaurants: [F.restaurant],
  categories: F.categories,
  products: F.products,
  table_status_v: F.tables,
  restaurant_tables: F.tables,
  // cashierOrders already contains the waiter orders; ids must stay unique.
  orders: F.cashierOrders,
  order_items: [...F.orderItems, ...F.cashierItems.filter((i) => !F.orderItems.some((w) => w.id === i.id))],
  payments: F.cashierPayments,
  receipts: F.receipts,
  notifications: F.notifications,
  staff_shifts: [F.shift],
  cashier_shifts: [F.cashierShift],
  customers,
  suppliers,
  purchase_orders: purchaseOrders,
  purchase_order_items: [],
  purchase_order_receipts: [],
};

let USER = MANAGER;
async function stub(route) {
  const req = route.request();
  const url = new URL(req.url());
  const headers = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': '*',
    'access-control-expose-headers': 'content-range',
    'content-type': 'application/json',
  };
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 200, headers });
  if (url.pathname.startsWith('/auth/v1/user'))
    return route.fulfill({
      status: 200,
      headers,
      body: JSON.stringify({ id: USER, aud: 'authenticated', role: 'authenticated' }),
    });
  if (url.pathname.startsWith('/rest/v1/rpc/')) {
    const name = url.pathname.slice('/rest/v1/rpc/'.length);
    const body = name === 'cashier_shift_summary' ? F.shiftSummary : name === 'sales_summary' ? {} : null;
    return route.fulfill({ status: 200, headers, body: JSON.stringify(body) });
  }
  const table = url.pathname.replace('/rest/v1/', '');
  if (process.env.DEBUG_STUB)
    console.log(
      '   stub',
      req.method(),
      table,
      (req.headers()['accept'] ?? '').includes('vnd.pgrst.object') ? 'SINGLE' : '',
      url.search.slice(0, 140),
    );
  let rows = TABLES[table] ?? [];
  for (const [k, v] of url.searchParams) {
    if (v.startsWith('eq.') && ['id', 'user_id'].includes(k)) rows = rows.filter((r) => String(r[k]) === v.slice(3));
  }
  if (Number(url.searchParams.get('offset') ?? 0) > 0) rows = [];
  headers['content-range'] = `0-${Math.max(rows.length - 1, 0)}/${rows.length}`;
  if (req.method() === 'HEAD') return route.fulfill({ status: 200, headers });
  const single = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object');
  return route.fulfill({ status: 200, headers, body: JSON.stringify(single ? (rows[0] ?? null) : rows) });
}
const session = (id) => ({
  access_token: 'e2e',
  refresh_token: 'e2e',
  token_type: 'bearer',
  expires_in: 3e7,
  expires_at: Math.floor(Date.now() / 1000) + 3e7,
  user: { id, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} },
});

const MANAGER_ROUTES = [
  '/dashboard',
  '/orders',
  '/orders/o3',
  '/menu',
  '/categories',
  '/tables',
  '/staff',
  '/customers',
  '/customers/cu0',
  '/inventory',
  '/suppliers',
  '/suppliers/su0',
  '/purchase-orders',
  '/purchase-orders/po0',
  '/expenses',
  '/reports',
  '/settings',
];
const WAITER_ROUTES = [
  '/waiter',
  '/waiter/tables',
  '/waiter/new-order',
  '/waiter/orders',
  '/waiter/orders/o3',
  '/waiter/menu',
  '/waiter/kitchen',
  '/waiter/bills',
  '/waiter/notifications',
  '/waiter/profile',
];
const CASHIER_ROUTES = [
  '/cashier',
  '/cashier/new-sale',
  '/cashier/active-orders',
  '/cashier/bills',
  '/cashier/payments',
  '/cashier/transactions',
  '/cashier/receipts',
  '/cashier/refunds',
  '/cashier/shift',
  '/cashier/profile',
];
const HQ_ROUTES = ['/dashboard/super-admin', '/dashboard/super-admin/branches', '/dashboard/super-admin/settings'];
const ALL = [...MANAGER_ROUTES, ...WAITER_ROUTES, ...CASHIER_ROUTES, ...HQ_ROUTES, '/'];

const browser = await chromium.launch({ executablePath: chrome, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const failures = [];
let checks = 0;

async function newPage(user) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  await ctx.route('http://supabase.test/**', stub);
  if (user)
    await ctx.addInitScript((s) => localStorage.setItem('sb-supabase-auth-token', JSON.stringify(s)), session(user));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  return { page, errors, ctx };
}

async function visit({ page, errors }, path, expectPath, label, expectText) {
  checks++;
  const before = failures.length;
  errors.length = 0;
  await page.goto(base + path, { waitUntil: 'networkidle' });
  try {
    if (expectText) await page.getByText(expectText).first().waitFor({ timeout: 8000 });
    else await page.waitForFunction(() => document.querySelector('h1')?.textContent?.trim(), null, { timeout: 8000 });
  } catch {
    const shown = (
      await page
        .locator('main')
        .innerText()
        .catch(() => '')
    )
      .replace(/\s+/g, ' ')
      .slice(0, 160);
    failures.push(
      `${label} ${path}: ${expectText ? `text ${expectText} not shown` : 'no <h1> rendered'} (page shows: ${shown})`,
    );
  }
  const at = new URL(page.url()).pathname;
  const h1 = (
    await page
      .locator('h1')
      .first()
      .textContent()
      .catch(() => '')
  )?.trim();
  const crashed = await page.getByText(/something went wrong/i).count();
  if (expectPath && at !== expectPath) failures.push(`${label} ${path}: ended at ${at}, expected ${expectPath}`);
  if (errors.length) failures.push(`${label} ${path}: runtime error ${errors[0]}`);
  if (crashed) failures.push(`${label} ${path}: error boundary shown`);
  const n = failures.length;
  console.log(`  ${n > before ? '✗' : '✓'} ${label.padEnd(9)} ${path.padEnd(34)} → ${at.padEnd(28)} "${h1}"`);
}

console.log('Signed out');
const anon = await newPage(null);
for (const p of ALL) await visit(anon, p, '/login', 'anon');
await visit(anon, '/login', '/login', 'anon');
await visit(anon, '/reset-password', '/reset-password', 'anon');
await anon.ctx.close();

console.log('Manager');
USER = MANAGER;
const mgr = await newPage(MANAGER);
for (const p of [...MANAGER_ROUTES, ...WAITER_ROUTES, ...CASHIER_ROUTES]) await visit(mgr, p, p, 'manager');
await visit(mgr, '/', '/dashboard', 'manager');
await visit(mgr, '/login', '/dashboard', 'manager');
await visit(mgr, '/dashboard/super-admin', '/dashboard', 'manager');
await visit(mgr, '/no-such-page', '/no-such-page', 'manager', /page not found/i);
await mgr.ctx.close();

console.log('Waiter');
USER = F.WAITER;
const w = await newPage(F.WAITER);
for (const p of WAITER_ROUTES) await visit(w, p, p, 'waiter');
await visit(w, '/', '/waiter', 'waiter');
await visit(w, '/dashboard', '/waiter', 'waiter');
await visit(w, '/cashier', '/waiter', 'waiter');
await w.ctx.close();

console.log('Cashier');
USER = F.CASHIER;
const c = await newPage(F.CASHIER);
for (const p of CASHIER_ROUTES) await visit(c, p, p, 'cashier');
await visit(c, '/cashier-print/receipt/o2', '/cashier-print/receipt/o2', 'cashier', /receipt/i);
await visit(c, '/', '/cashier', 'cashier');
await visit(c, '/orders', '/cashier', 'cashier');
await visit(c, '/waiter', '/cashier', 'cashier');
await c.ctx.close();

await browser.close();
console.log(`\n${checks} route checks, ${failures.length} failures`);
if (failures.length) {
  console.log(failures.join('\n'));
  process.exit(1);
}
