// Screenshots every Manager dashboard page in real Chrome with stubbed Supabase data (visual review aid).
// Usage: node e2e/manager-shots.mjs <baseUrl> <chromePath> <outDir> [width] [height]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import * as F from './fixtures.mjs';

const [base, chrome = '/usr/bin/google-chrome', out = 'e2e/screens-manager', w = '1440', h = '900'] =
  process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const MANAGER = '77777777-7777-4777-8777-777777777777';
const profile = { ...F.profile, id: MANAGER, full_name: 'Hassan Abdikadir', email: 'hassan@grill.so' };
const member = { ...F.member, id: 'm9', user_id: MANAGER, role: 'manager' };
const now = Date.now();
const iso = (min) => new Date(now - min * 60000).toISOString();
const ts = { created_at: iso(9000), updated_at: iso(9000), archived_at: null };
const customers = ['Ahmed Jama', 'Fadumo Ali', 'Mohamed Nuur', 'Hodan Yusuf'].map((n, i) => ({
  id: `cu${i}`,
  restaurant_id: F.RID,
  name: n,
  phone: `+25263400${i}00${i}`,
  email: null,
  notes: i ? null : 'VIP – window table',
  total_spent: 120 * (i + 1),
  visit_count: 3 + i,
  ...ts,
}));
const inventory = ['Rice 25kg', 'Camel meat', 'Tomatoes', 'Cooking oil', 'Tea leaves', 'Milk'].map((n, i) => ({
  id: `iv${i}`,
  restaurant_id: F.RID,
  name: n,
  sku: `SKU-${i}`,
  unit: i % 2 ? 'kg' : 'l',
  quantity: i === 2 ? 2 : 40 - i * 5,
  reorder_level: 10,
  cost_per_unit: 1.5 + i,
  supplier_id: null,
  ...ts,
}));
const suppliers = ['Berbera Foods', 'Hargeisa Dairy', 'Burao Meat Co'].map((n, i) => ({
  id: `su${i}`,
  restaurant_id: F.RID,
  name: n,
  contact_name: 'Sales',
  phone: `+2526300${i}00`,
  email: null,
  address: null,
  notes: null,
  ...ts,
}));
const TABLES = {
  profiles: [profile, F.profile, F.cashierProfile],
  restaurant_members: [member, F.member, F.cashierMember],
  restaurants: [F.restaurant],
  categories: F.categories,
  products: F.products,
  table_status_v: F.tables,
  restaurant_tables: F.tables,
  orders: [...F.orders, ...F.cashierOrders],
  order_items: [...F.orderItems, ...F.cashierItems],
  payments: F.cashierPayments,
  customers,
  inventory_items: inventory,
  suppliers,
  notifications: [],
  audit_log: [],
  expenses: [],
  purchase_orders: [],
  recipes: [],
  stock_movements: [],
};
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
      body: JSON.stringify({ id: MANAGER, email: profile.email, aud: 'authenticated', role: 'authenticated' }),
    });
  if (url.pathname.startsWith('/rest/v1/rpc/')) {
    const name = url.pathname.slice('/rest/v1/rpc/'.length);
    const summary = {
      orders_count: 41,
      gross_sales: 1860.5,
      net_sales: 1692,
      tax: 168.5,
      discounts: 42,
      refunds: 0,
      collected: 1604,
      outstanding: 88,
      cancelled_count: 2,
      avg_order_value: 45.4,
    };
    return route.fulfill({ status: 200, headers, body: JSON.stringify(name === 'sales_summary' ? summary : null) });
  }
  const table = url.pathname.replace('/rest/v1/', '');
  let rows = TABLES[table] ?? [];
  const idEq = url.searchParams.get('id');
  if (idEq?.startsWith('eq.')) rows = rows.filter((r) => r.id === idEq.slice(3));
  if (Number(url.searchParams.get('offset') ?? 0) > 0) rows = [];
  headers['content-range'] = `0-${Math.max(rows.length - 1, 0)}/${rows.length}`;
  if (req.method() === 'HEAD') return route.fulfill({ status: 200, headers });
  const single = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object');
  return route.fulfill({ status: 200, headers, body: JSON.stringify(single ? (rows[0] ?? null) : rows) });
}
const session = {
  access_token: 'e2e',
  refresh_token: 'e2e',
  token_type: 'bearer',
  expires_in: 3e7,
  expires_at: Math.floor(now / 1000) + 3e7,
  user: {
    id: MANAGER,
    email: profile.email,
    aud: 'authenticated',
    role: 'authenticated',
    app_metadata: {},
    user_metadata: {},
  },
};
const PAGES = [
  ['01-dashboard', '/dashboard', /^Business Control Center$/],
  ['02-orders', '/orders', /^Orders$/],
  ['03-menu', '/menu', /^Menu Management$/],
  ['04-categories', '/categories', /^Categories$/],
  ['05-tables', '/tables', /^Tables & Floor Plans$/],
  ['06-staff', '/staff', /^Staff Management$/],
  ['07-customers', '/customers', /^Customers$/],
  ['08-inventory', '/inventory', /^Inventory$/],
  ['09-suppliers', '/suppliers', /^Suppliers$/],
  ['10-purchase-orders', '/purchase-orders', /^Purchase Orders$/],
  ['11-expenses', '/expenses', /^Expenses$/],
  ['12-reports', '/reports', /^Reports & Analytics$/],
  ['13-settings', '/settings', /^Settings$/],
];
const only = process.env.ONLY?.split(',');
const browser = await chromium.launch({ executablePath: chrome, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const ctx = await browser.newContext({
  viewport: { width: Number(w), height: Number(h) },
  deviceScaleFactor: 1,
  reducedMotion: process.env.MOTION ? 'no-preference' : 'reduce',
});
await ctx.route('http://supabase.test/**', stub);
await ctx.addInitScript((s) => localStorage.setItem('sb-supabase-auth-token', JSON.stringify(s)), session);
// THEME=dark starts in the dark theme; the default is light
if (process.env.THEME === 'dark') await ctx.addInitScript(() => localStorage.setItem('sombill.theme', 'dark'));
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
for (const [name, path, heading] of PAGES) {
  if (only && !only.some((o) => name.includes(o))) continue;
  await page.goto(base + path, { waitUntil: 'networkidle' });
  try {
    await page.getByRole('heading', { level: 1, name: heading }).waitFor({ timeout: 8000 });
  } catch {
    errors.push(`${name}: heading not found`);
  }
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/${name}.png` });
  if (process.env.FULL) await page.screenshot({ path: `${out}/${name}-full.png`, fullPage: true });
}
await browser.close();
console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'no page errors');
