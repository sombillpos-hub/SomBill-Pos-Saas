// Real-browser check of the Super Admin / Group HQ dashboard (system Chrome via playwright-core), light and dark.
// Usage: node e2e/hq.mjs <baseUrl> <chromePath> <outDir>   (THEME=dark for the dark theme; default light)
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const [base = 'http://127.0.0.1:4179', chrome = '/usr/bin/google-chrome', out = 'e2e/screens-hq'] =
  process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });

const OWNER = '88888888-8888-4888-8888-888888888888';
const ORG = '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a';
const now = Date.now();
const ago = (m) => new Date(now - m * 60000).toISOString();
const B = [
  ['b1', 'Hargeisa Main', 'USD', 4200],
  ['b2', 'Berbera Port', 'USD', 2650],
  ['b3', 'Burco Central', 'SLS', 38000000],
  ['b4', 'Borama Grill', 'USD', 980],
].map(([id, name, currency, gross], i) => ({ id, name, currency, gross, i }));

const restaurants = B.map((b) => ({
  id: b.id,
  name: b.name,
  address: `${b.name} Road`,
  phone: '+252634000000',
  email: null,
  currency: b.currency,
  timezone: 'Africa/Mogadishu',
  tax_rate: 0.05,
  tax_label: 'VAT',
  tax_inclusive: false,
  receipt_footer: null,
  settings: {},
  organization_id: ORG,
}));
const org = {
  id: ORG,
  name: 'Horn Hospitality Group',
  plan: 'growth',
  max_branches: 6,
  max_staff: 80,
  license_status: 'active',
  license_expires_at: '2027-06-30T00:00:00Z',
  settings: { reporting_currency: 'USD', fx_rates: { SLS: 11800 } },
  created_at: ago(100000),
  updated_at: ago(100000),
};
const people = ['Hodan Ali', 'Mohamed Jama', 'Fadumo Yusuf', 'Abdi Warsame', 'Ladan Omar', 'Said Guled'];
const profiles = [
  {
    id: OWNER,
    full_name: 'Hassan Owner',
    email: 'owner@horn.so',
    phone: null,
    avatar_url: null,
    last_login_at: ago(5),
  },
  ...people.map((n, i) => ({
    id: `u${i}`,
    full_name: n,
    email: `u${i}@horn.so`,
    phone: '+2526341100' + i,
    avatar_url: null,
    last_login_at: ago(60 * i),
  })),
];
const roles = ['manager', 'cashier', 'waiter', 'kitchen', 'cashier', 'waiter'];
const members = people.map((_, i) => ({
  id: `m${i}`,
  restaurant_id: B[i % 4].id,
  user_id: `u${i}`,
  role: roles[i],
  status: i === 5 ? 'suspended' : 'active',
  created_at: ago(90000),
  updated_at: ago(90000),
}));
const summary = B.map((b) => ({
  restaurant_id: b.id,
  name: b.name,
  address: `${b.name} Road`,
  phone: '+252634000000',
  currency: b.currency,
  timezone: 'Africa/Mogadishu',
  tax_rate: 0.05,
  orders_count: 60 + b.i * 11,
  gross: b.gross,
  net: b.gross * 0.95,
  tax: b.gross * 0.05,
  discounts: b.gross * 0.02,
  guests: 150 + b.i * 20,
  cancelled_count: b.i,
  collected: b.gross,
  refunded: 0,
  open_orders: 3 + b.i,
  tables_total: 20,
  tables_occupied: 6 + b.i * 3,
  open_cashier_shifts: b.i < 3 ? 1 : 0,
  staff_on_duty: 4 + b.i,
  staff_active: 12,
  last_order_at: ago(b.i * 40 + 3),
}));
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
// Buckets are text in the format the real RPC returns (hour "YYYY-MM-DD HH:00", day "YYYY-MM-DD", month "YYYY-MM").
const seriesFor = (bucket) =>
  B.flatMap((b) => {
    const pts = [];
    const d0 = new Date();
    if (bucket === 'hour') for (let h = 8; h <= 21; h++) pts.push(`${ymd(d0)} ${pad(h)}:00`);
    else if (bucket === 'day')
      for (let k = 0; k < 28; k++) pts.push(ymd(new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() - k)));
    else for (let m = 1; m <= d0.getMonth() + 1; m++) pts.push(`${d0.getFullYear()}-${pad(m)}`);
    return pts.map((bk, k) => ({
      bucket: bk,
      restaurant_id: b.id,
      gross: Math.round((b.gross / pts.length) * (0.6 + ((k * 7 + b.i * 3) % 8) / 10)),
      orders: 10 + (k % 7),
    }));
  });
const mix = B.flatMap((b) =>
  [
    ['cash', 'not_required', 0.35],
    ['zaad', 'verified', 0.3],
    ['evc_plus', 'verified', 0.2],
    ['card', 'not_required', 0.15],
  ].map(([method, v, share]) => ({
    restaurant_id: b.id,
    method,
    kind: 'payment',
    status: 'completed',
    verification_status: v,
    amount: Math.round(b.gross * share),
    txns: 12,
  })),
);
const matrix = ['Camel Burger', 'Bariis iyo Hilib', 'Shaah Cadeys', 'Fresh Mango Juice'].flatMap((name, di) =>
  B.map((b) => ({
    restaurant_id: b.id,
    product_id: `p${di}${b.i}`,
    name,
    category: di < 2 ? 'Mains' : 'Drinks',
    price: 3 + di * 2 + (b.i === 2 ? 1 : 0),
    is_available: !(di === 3 && b.i === 1),
  })),
);
const audit = [
  ['cancel', 'order', { order_number: 482 }, 'customer left'],
  ['refund', 'payment', { amount: 180, order_number: 470 }, 'wrong dish'],
  ['delete', 'product', { name: 'Old special' }, null],
  ['shift_close', 'cashier_shift', { cash_difference: -42, expected_cash: 400 }, null],
  ['discount', 'order', { discount: 45 }, 'manager friend'],
  ['receipt_reprint', 'receipt', {}, null],
].map(([action, entity_type, new_data, reason], i) => ({
  id: i + 1,
  restaurant_id: B[i % 4].id,
  actor_id: `u${i % 6}`,
  action,
  entity_type,
  entity_id: `e${i}`,
  old_data: null,
  new_data,
  reason,
  created_at: ago(30 + i * 90),
}));
const TABLES = {
  organization_members: [{ organization_id: ORG, user_id: OWNER, status: 'active' }],
  organizations: [org],
  profiles,
  restaurant_members: members,
  restaurants,
  audit_logs: audit,
  audit_reviews: [],
  tax_filings: [],
  orders: [],
  cashier_shifts: B.slice(0, 3).map((b, i) => ({
    id: `cs${i}`,
    restaurant_id: b.id,
    cashier_id: `u${i + 1}`,
    status: 'open',
    opened_at: ago(200 + i * 30),
    opening_cash: 100,
  })),
  staff_shifts: members
    .filter((m) => m.status === 'active')
    .map((m, i) => ({
      id: `ss${i}`,
      restaurant_id: m.restaurant_id,
      user_id: m.user_id,
      started_at: ago(120 + i * 20),
      ended_at: null,
    })),
  payments: [
    {
      id: 'pp1',
      restaurant_id: 'b1',
      order_id: 'o1',
      method: 'zaad',
      status: 'pending',
      amount: 64,
      reference: 'ZD-88213',
      created_at: ago(12),
      orders: { order_number: 512 },
    },
    {
      id: 'pp2',
      restaurant_id: 'b2',
      order_id: 'o2',
      method: 'evc_plus',
      status: 'pending',
      amount: 31.5,
      reference: 'EV-22910',
      created_at: ago(35),
      orders: { order_number: 233 },
    },
  ],
};
const RPC = {
  org_branch_summary: summary,
  org_payment_mix: mix,
  org_menu_matrix: matrix,
  org_inventory_summary: B.map((b) => ({
    restaurant_id: b.id,
    items: 80,
    low_stock: b.i,
    out_of_stock: b.i === 3 ? 2 : 0,
    stock_value: 5400 + b.i * 800,
    open_purchase_orders: b.i + 1,
    open_po_value: 900,
  })),
  org_low_stock: [
    { restaurant_id: 'b1', item_id: 'i1', name: 'Rice (basmati)', unit: 'kg', quantity: 12, min_stock: 40 },
    { restaurant_id: 'b2', item_id: 'i2', name: 'Cooking oil', unit: 'l', quantity: 6, min_stock: 20 },
  ],
  org_tax_due: B.map((b) => ({
    restaurant_id: b.id,
    currency: b.currency,
    gross: b.gross,
    tax: b.gross * 0.05,
    orders_count: 60,
    filed: false,
  })),
};

const PAGES = [
  ['overview', '/dashboard/super-admin', /Command HQ$/],
  ['branches', '/dashboard/super-admin/branches', /^Multi-Branch Fleet$/],
  ['terminals', '/dashboard/super-admin/terminals', /^Active POS Fleet$/],
  ['revenue', '/dashboard/super-admin/revenue', /^Global Revenues$/],
  ['tax', '/dashboard/super-admin/tax', /^Tax Filings$/],
  ['mobile-money', '/dashboard/super-admin/mobile-money', /^Mobile Money Portals$/],
  ['licenses', '/dashboard/super-admin/licenses', /^SaaS Subscription$/],
  ['menu-push', '/dashboard/super-admin/menu-push', /^Central Menu Push$/],
  ['users', '/dashboard/super-admin/users', /^Global Staff & RBAC$/],
  ['inventory', '/dashboard/super-admin/inventory', /^Master Supply Chain$/],
  ['audit', '/dashboard/super-admin/audit', /^Audit & Anti-Fraud$/],
  ['system', '/dashboard/super-admin/system', /^Cloud Telemetry$/],
  ['settings', '/dashboard/super-admin/settings', /^Platform Controls$/],
];
const VIEWPORTS = [
  ['phone', 390, 844],
  ['tablet', 820, 1180],
  ['laptop', 1280, 720],
  ['desktop', 1600, 900],
];

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
      body: JSON.stringify({ id: OWNER, email: 'owner@horn.so', aud: 'authenticated', role: 'authenticated' }),
    });
  if (url.pathname.startsWith('/rest/v1/rpc/')) {
    const fn = url.pathname.slice('/rest/v1/rpc/'.length);
    if (fn === 'org_revenue_series') {
      const b = JSON.parse(req.postData() || '{}').p_bucket;
      return route.fulfill({ status: 200, headers, body: JSON.stringify(seriesFor(b)) });
    }
    return route.fulfill({ status: 200, headers, body: JSON.stringify(RPC[fn] ?? null) });
  }
  if (url.pathname.startsWith('/functions/')) return route.fulfill({ status: 200, headers, body: '{}' });
  const table = url.pathname.replace('/rest/v1/', '');
  let rows = TABLES[table] ?? [];
  for (const [col, raw] of url.searchParams) {
    if (['select', 'order', 'limit', 'offset'].includes(col)) continue;
    if (raw.startsWith('eq.')) rows = rows.filter((r) => !(col in r) || String(r[col]) === raw.slice(3));
    else if (raw.startsWith('in.(')) {
      const allowed = raw
        .slice(4, -1)
        .split(',')
        .map((s) => s.replace(/"/g, ''));
      rows = rows.filter((r) => !(col in r) || allowed.includes(String(r[col])));
    }
  }
  headers['content-range'] = `0-${Math.max(rows.length - 1, 0)}/${rows.length}`;
  if (req.method() === 'HEAD') return route.fulfill({ status: 200, headers });
  const single = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object');
  return route.fulfill({ status: 200, headers, body: JSON.stringify(single ? (rows[0] ?? null) : rows) });
}

const session = {
  access_token: 'e2e-token',
  refresh_token: 'e2e-refresh',
  token_type: 'bearer',
  expires_in: 31536000,
  expires_at: Math.floor(now / 1000) + 31536000,
  user: {
    id: OWNER,
    email: 'owner@horn.so',
    aud: 'authenticated',
    role: 'authenticated',
    app_metadata: {},
    user_metadata: {},
  },
};

const browser = await chromium.launch({ executablePath: chrome, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const results = [];
let failures = 0;
for (const [vp, width, height] of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: width < 1000, deviceScaleFactor: 1 });
  await ctx.route('http://supabase.test/**', stub);
  await ctx.addInitScript((s) => localStorage.setItem('sb-supabase-auth-token', JSON.stringify(s)), session);
  if (process.env.THEME === 'dark') await ctx.addInitScript(() => localStorage.setItem('sombill.theme', 'dark'));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  for (const [name, path, heading] of PAGES) {
    await page.goto(base + path, { waitUntil: 'networkidle' });
    let found = true;
    try {
      await page.getByRole('heading', { level: 1, name: heading }).waitFor({ timeout: 8000 });
    } catch {
      found = false;
    }
    await page.waitForTimeout(900); // let count-up and chart animations settle
    const m = await page.evaluate(() => {
      const doc = document.documentElement;
      const main = document.querySelector('main');
      const clipped = [...document.querySelectorAll('main h1, main h2, main h3, main .sa-kpi-value, main button')]
        .filter(
          (e) =>
            e.scrollWidth > e.clientWidth + 2 &&
            getComputedStyle(e).overflow === 'hidden' &&
            !e.classList.contains('truncate'),
        )
        .map((e) => (e.textContent || '').trim().slice(0, 30));
      return {
        scrollWidth: doc.scrollWidth,
        innerWidth: window.innerWidth,
        theme: doc.getAttribute('data-sb-theme'),
        text: (main?.textContent || '').length,
        clipped,
      };
    });
    await page.screenshot({ path: `${out}/${vp}-${name}.png`, fullPage: process.env.FULL === '1' });
    const overflow = m.scrollWidth > m.innerWidth + 1;
    const wantTheme = process.env.THEME === 'dark' ? 'obsidian' : 'light';
    const pass = found && !overflow && m.theme === wantTheme && m.text > 40 && m.clipped.length === 0;
    if (!pass) failures++;
    results.push({
      viewport: vp,
      page: name,
      found,
      overflowPx: Math.max(0, m.scrollWidth - m.innerWidth),
      theme: m.theme,
      clipped: m.clipped,
      pass,
    });
  }
  if (errors.length) {
    failures++;
    results.push({ viewport: vp, page: 'runtime', errors, pass: false });
  }
  await ctx.close();
}
await browser.close();
fs.writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
for (const r of results)
  console.log(
    `${r.pass ? '✓' : '✗'} ${r.viewport.padEnd(8)} ${String(r.page).padEnd(13)} ${r.errors ? 'ERRORS ' + r.errors.join('; ') : `found=${r.found} overflow=${r.overflowPx}px theme=${r.theme}${r.clipped.length ? ' clipped=' + r.clipped.join('|') : ''}`}`,
  );
console.log(failures ? `HQ CHECK FAILED (${failures})` : 'HQ CHECK PASSED');
process.exit(failures ? 1 : 0);
