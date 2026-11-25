// Real-browser responsiveness check for the Waiter POS and Cashier POS (system Chrome via playwright-core),
// plus a measurement of the printed 80mm receipt PDF.
// Usage: node e2e/tablet.mjs <baseUrl> <chromePath> <outDir>   (THEME=dark checks the dark Cashier theme; default light)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import * as F from './fixtures.mjs';

const [base = 'http://127.0.0.1:4173', chrome = '/usr/bin/google-chrome', out = 'e2e/screens'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });

const WAITER_TABLES = {
  profiles: [F.profile],
  restaurant_members: [F.member],
  restaurants: [F.restaurant],
  categories: F.categories,
  products: F.products,
  table_status_v: F.tables,
  restaurant_tables: F.tables,
  orders: F.orders,
  order_items: F.orderItems,
  notifications: F.notifications,
  staff_shifts: [F.shift],
  customers: [],
  payments: [],
};
const CASHIER_TABLES = {
  profiles: [F.cashierProfile, F.profile],
  restaurant_members: [F.cashierMember, F.member],
  restaurants: [{ ...F.restaurant, settings: F.cashierSettings }],
  categories: F.categories,
  products: F.products,
  table_status_v: F.tables,
  restaurant_tables: F.tables,
  orders: F.cashierOrders,
  order_items: F.cashierItems,
  notifications: [],
  staff_shifts: [],
  customers: [],
  payments: F.cashierPayments,
  cashier_shifts: [F.cashierShift],
  cash_movements: [],
  refunds: [],
  receipts: F.receipts,
};
const RPC = { cashier_shift_summary: F.shiftSummary };
let TABLES = WAITER_TABLES;
let USER = F.WAITER;

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
      body: JSON.stringify({
        id: USER,
        email: USER === F.WAITER ? F.profile.email : F.cashierProfile.email,
        aud: 'authenticated',
        role: 'authenticated',
      }),
    });
  if (url.pathname.startsWith('/rest/v1/rpc/'))
    return route.fulfill({
      status: 200,
      headers,
      body: JSON.stringify(RPC[url.pathname.slice('/rest/v1/rpc/'.length)] ?? null),
    });
  const table = url.pathname.replace('/rest/v1/', '');
  let rows = TABLES[table] ?? [];
  const idEq = url.searchParams.get('id');
  if (idEq?.startsWith('eq.')) rows = rows.filter((r) => r.id === idEq.slice(3));
  const orderEq = url.searchParams.get('order_id');
  if (orderEq?.startsWith('eq.')) rows = rows.filter((r) => r.order_id === orderEq.slice(3));
  const userEq = url.searchParams.get('user_id') ?? url.searchParams.get('cashier_id');
  if (userEq?.startsWith('eq.') && table !== 'payments')
    rows = rows.filter((r) => (r.user_id ?? r.cashier_id) === userEq.slice(3));
  const status = url.searchParams.get('status');
  if (status?.startsWith('eq.')) rows = rows.filter((r) => r.status === status.slice(3));
  if (status?.startsWith('in.(')) {
    const allowed = status.slice(4, -1).split(',');
    rows = rows.filter((r) => allowed.includes(r.status));
  }
  const offset = Number(url.searchParams.get('offset') ?? 0);
  if (offset > 0) rows = [];
  headers['content-range'] = `0-${Math.max(rows.length - 1, 0)}/${rows.length}`;
  if (req.method() === 'HEAD') return route.fulfill({ status: 200, headers });
  const single = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object');
  return route.fulfill({ status: 200, headers, body: JSON.stringify(single ? (rows[0] ?? null) : rows) });
}

const sessionFor = (id, email) => ({
  access_token: 'e2e-token',
  refresh_token: 'e2e-refresh',
  token_type: 'bearer',
  expires_in: 3600 * 24 * 365,
  expires_at: Math.floor(Date.now() / 1000) + 3600 * 24 * 365,
  user: { id, email, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} },
});

const VIEWPORTS = [
  ['phone', 390, 844],
  ['tablet-portrait', 768, 1024],
  ['tablet-landscape', 1024, 768],
  ['desktop', 1440, 900],
];
const WAITER_PAGES = [
  ['dashboard', '/waiter', /^Hello/],
  ['tables', '/waiter/tables', /^Tables$/],
  ['new-order', '/waiter/new-order', /^New Order$/],
  ['orders', '/waiter/orders', /^My Orders$/],
  ['menu', '/waiter/menu', /^Menu$/],
  ['kitchen', '/waiter/kitchen', /^Kitchen Status$/],
  ['bills', '/waiter/bills?order=o4', /^Bills$/],
  ['notifications', '/waiter/notifications', /^Notifications$/],
  ['profile', '/waiter/profile', /^My Profile$/],
];
const CASHIER_PAGES = [
  ['c-dashboard', '/cashier', /^Hello/],
  ['c-new-sale', '/cashier/new-sale', /^New Sale$/],
  ['c-active', '/cashier/active-orders', /^Active Orders$/],
  ['c-bills', '/cashier/bills?order=o7', /^Bills$/],
  ['c-payments', '/cashier/payments?order=o7', /^Payment Processing$/],
  ['c-transactions', '/cashier/transactions', /^Transactions$/],
  ['c-receipts', '/cashier/receipts?order=o2', /^Receipts$/],
  ['c-refunds', '/cashier/refunds', /^Refunds$/],
  ['c-shift', '/cashier/shift', /^Shift Management$/],
  ['c-profile', '/cashier/profile', /^My Profile$/],
];
const ROLES = [
  {
    role: 'waiter',
    user: F.WAITER,
    email: F.profile.email,
    tables: WAITER_TABLES,
    pages: WAITER_PAGES,
    cartKey: 'sombill.waiter.cart',
  },
  {
    role: 'cashier',
    user: F.CASHIER,
    email: F.cashierProfile.email,
    tables: CASHIER_TABLES,
    pages: CASHIER_PAGES,
    cartKey: 'sombill.cashier.sale',
  },
];

const browser = await chromium.launch({ executablePath: chrome, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const results = [];
let failures = 0;
for (const R of ROLES)
  for (const [vp, width, height] of VIEWPORTS) {
    TABLES = R.tables;
    USER = R.user;
    const ctx = await browser.newContext({
      viewport: { width, height },
      hasTouch: vp !== 'desktop',
      deviceScaleFactor: 1,
    });
    await ctx.route('http://supabase.test/**', stub);
    await ctx.addInitScript(
      ([s, cartKey]) => {
        localStorage.setItem('sb-supabase-auth-token', JSON.stringify(s));
        sessionStorage.setItem(
          cartKey,
          JSON.stringify({
            orderType: cartKey.includes('cashier') ? 'takeaway' : 'dine_in',
            discount: '',
            discountReason: '',
            tableId: 't1',
            existingOrderId: null,
            orderNotes: 'Birthday – bring dessert last',
            customerId: null,
            guestCount: '4',
            idempotencyKey: 'e2e-key',
            lines: [
              {
                key: 'l1',
                product_id: 'p0',
                name: 'Bariis iyo Hilib Ari',
                unit_price: 12,
                tax_exempt: false,
                quantity: 2,
                notes: 'No onions',
              },
              {
                key: 'l2',
                product_id: 'p7',
                name: 'Shaah Cadeys',
                unit_price: 1,
                tax_exempt: true,
                quantity: 3,
                notes: '',
              },
            ],
          }),
        );
      },
      [sessionFor(R.user, R.email), R.cartKey],
    );
    if (process.env.THEME === 'dark') await ctx.addInitScript(() => localStorage.setItem('sombill.theme', 'dark'));
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    for (const [name, path, heading] of R.pages) {
      await page.goto(base + path, { waitUntil: 'networkidle' });
      await page.getByRole('heading', { level: 1, name: heading }).waitFor({ timeout: 8000 });
      await page.waitForTimeout(300);
      const m = await page.evaluate(() => {
        const doc = document.documentElement;
        // Interactive controls inside <main> must be at least 40px tall on touch screens (44px for primary POS controls).
        const small = [
          ...document.querySelectorAll(
            'main button, main a[href], main select, main input:not([type=hidden]):not([type=checkbox])',
          ),
        ]
          .filter((el) => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && r.height < 32 && !el.closest('table');
          })
          .map((el) => (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 40));
        return { scrollWidth: doc.scrollWidth, innerWidth: window.innerWidth, small };
      });
      const overflow = m.scrollWidth > m.innerWidth + 1;
      let posTargets = null;
      if (name === 'new-order' || name === 'c-new-sale') {
        posTargets = await page.evaluate(() => {
          const h = (sel) =>
            [...document.querySelectorAll(sel)].map((e) => Math.round(e.getBoundingClientRect().height));
          const w = [...document.querySelectorAll('[aria-label="Products"] > button')].map((e) =>
            Math.round(e.getBoundingClientRect().width),
          );
          return {
            cardWidth: Math.min(...w),
            send: h('button:has(svg.lucide-send), button:has(svg.lucide-credit-card)')[0] ?? 0,
            products: Math.min(...h('[aria-label="Products"] > button')),
            qty: Math.min(...h('button[aria-label^="Increase"], button[aria-label^="Decrease"]')),
            imgs: [...document.querySelectorAll('[aria-label="Products"] > button > span:first-child')].map((e) =>
              Math.round(e.getBoundingClientRect().width),
            ),
          };
        });
      }
      await page.screenshot({ path: `${out}/${vp}-${name}.png`, fullPage: false });
      const touch = vp !== 'desktop';
      const pass =
        !overflow &&
        (!touch || m.small.length === 0) &&
        (!posTargets ||
          (posTargets.cardWidth >= 160 &&
            posTargets.send >= 48 &&
            posTargets.products >= 44 &&
            posTargets.qty >= 44 &&
            Math.max(...posTargets.imgs) <= 64));
      if (!pass) failures++;
      results.push({
        viewport: vp,
        page: name,
        overflowPx: Math.max(0, m.scrollWidth - m.innerWidth),
        smallControls: m.small.length,
        smallNames: m.small,
        posTargets,
        pass,
      });
    }
    if (errors.length) {
      failures++;
      results.push({ viewport: vp, page: `${R.role}-runtime`, errors });
    }
    await ctx.close();
  }

// ---- 80mm receipt: render the real print page in Chrome and measure the PDF it produces ----
{
  TABLES = CASHIER_TABLES;
  USER = F.CASHIER;
  const ctx = await browser.newContext({ viewport: { width: 400, height: 900 } });
  await ctx.route('http://supabase.test/**', stub);
  await ctx.addInitScript(
    (s) => localStorage.setItem('sb-supabase-auth-token', JSON.stringify(s)),
    sessionFor(F.CASHIER, F.cashierProfile.email),
  );
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  for (const kind of ['receipt', 'bill']) {
    const id = kind === 'receipt' ? 'o2' : 'o7';
    await page.goto(`${base}/cashier-print/${kind}/${id}`, { waitUntil: 'networkidle' });
    await page.getByTestId('receipt').waitFor({ timeout: 8000 });
    await page.waitForFunction(() => document.body.dataset.receiptHeightMm);
    const heightMm = Number(await page.evaluate(() => document.body.dataset.receiptHeightMm));
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    fs.writeFileSync(`${out}/receipt-80mm-${kind}.pdf`, pdf);
    const text = pdf.toString('latin1');
    const boxes = [...text.matchAll(/\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/g)].map((m) => [
      Number(m[3]) - Number(m[1]),
      Number(m[4]) - Number(m[2]),
    ]);
    const pages = boxes.length;
    const widthMm = boxes.length ? +((boxes[0][0] / 72) * 25.4).toFixed(2) : 0;
    const pdfHeightMm = boxes.length ? +((boxes[0][1] / 72) * 25.4).toFixed(1) : 0;
    const content = await page.evaluate(() => {
      const el = document.querySelector('[data-testid=receipt]');
      const r = el.getBoundingClientRect();
      return { widthMm: +((r.width * 25.4) / 96).toFixed(1), text: el.textContent };
    });
    const pass =
      Math.abs(widthMm - 80) < 0.6 &&
      pages === 1 &&
      content.widthMm <= 80 &&
      content.text.includes(kind === 'receipt' ? 'RECEIPT' : 'NOT A RECEIPT') &&
      errors.length === 0;
    if (!pass) failures++;
    results.push({
      viewport: 'print-80mm',
      page: kind,
      pdfWidthMm: widthMm,
      pdfHeightMm,
      cssHeightMm: heightMm,
      pdfPages: pages,
      contentWidthMm: content.widthMm,
      errors,
      pass,
    });
  }
  await ctx.close();
}
await browser.close();
fs.writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
for (const r of results)
  console.log(
    r.pdfWidthMm !== undefined
      ? `${r.pass ? '✓' : '✗'} print-80mm        ${r.page.padEnd(14)} pdf=${r.pdfWidthMm}mm × ${r.pdfHeightMm}mm pages=${r.pdfPages} content=${r.contentWidthMm}mm${r.errors.length ? ' ERRORS ' + r.errors.join('; ') : ''}`
      : `${r.pass === false ? '✗' : '✓'} ${r.viewport.padEnd(17)} ${String(r.page).padEnd(14)} overflow=${r.overflowPx ?? '-'}px small=${r.smallControls ?? '-'}${r.posTargets ? ` cardW=${r.posTargets.cardWidth} send=${r.posTargets.send} card=${r.posTargets.products} qty=${r.posTargets.qty} img≤${Math.max(...r.posTargets.imgs)}` : ''}${r.errors ? ' ERRORS ' + r.errors.join('; ') : ''}`,
  );
console.log(failures ? `TABLET CHECK FAILED (${failures})` : 'TABLET CHECK PASSED');
process.exit(failures ? 1 : 0);
