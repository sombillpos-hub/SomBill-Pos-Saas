// Real-browser check of the sign-in screens (system Chrome via playwright-core): sign in, forgot password, OTP, Arabic (RTL).
// Usage: node e2e/login.mjs <baseUrl> <chromePath> <outDir>
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const [base = 'http://127.0.0.1:4179', chrome = '/usr/bin/google-chrome', out = 'e2e/screens-login'] =
  process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });

const VIEWPORTS = [
  ['phone', 390, 844],
  ['tablet', 820, 1180],
  ['laptop', 1366, 768],
  ['desktop', 1600, 900],
];

async function stub(route) {
  const headers = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': '*',
    'content-type': 'application/json',
  };
  if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 200, headers });
  return route.fulfill({ status: 200, headers, body: '{}' });
}

const browser = await chromium.launch({ executablePath: chrome, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const results = [];
let failures = 0;
const check = (viewport, name, ok, extra = {}) => {
  if (!ok) failures++;
  results.push({ viewport, name, pass: ok, ...extra });
};

for (const [vp, width, height] of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: width < 1000 });
  await ctx.route('http://supabase.test/**', stub);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const overflow = () => page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  const shot = async (name) => {
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${out}/${vp}-${name}.png`, fullPage: true });
    const m = await overflow();
    check(vp, name, m.sw <= m.iw + 1, { overflowPx: Math.max(0, m.sw - m.iw) });
  };

  await page.goto(base + '/login', { waitUntil: 'networkidle' });
  await page.getByRole('heading', { level: 1, name: 'Welcome Back!' }).waitFor({ timeout: 8000 });
  await shot('signin');

  // email focus shows domain chips; typing fills
  await page.getByLabel('Email address').fill('amina');
  await page.getByRole('button', { name: '@gmail.com' }).waitFor({ timeout: 3000 });
  await shot('signin-chips');
  await page.getByRole('button', { name: '@gmail.com' }).click();
  check(vp, 'chip fills email', (await page.getByLabel('Email address').inputValue()) === 'amina@gmail.com');

  // the primary controls are comfortable touch targets
  const small = await page.evaluate(
    () =>
      [...document.querySelectorAll('.au-primary, .au-control, .au-social, .au-otp-box')]
        .map((e) => Math.round(e.getBoundingClientRect().height))
        .filter((h) => h > 0 && h < 44).length,
  );
  check(vp, 'targets >= 44px', small === 0, { small });

  // forgot -> otp
  await page.getByRole('button', { name: 'Forgot password?' }).click();
  await page.getByRole('heading', { level: 1, name: 'Reset Your Password' }).waitFor();
  await page.getByRole('button', { name: /^Send Reset Code/ }).click();
  await page.getByRole('heading', { level: 1, name: 'Enter the 6-digit code' }).waitFor();
  await page.getByLabel('Digit 1').click();
  await page.keyboard.type('123');
  await shot('otp');
  check(
    vp,
    'otp auto-advance',
    (await page.getByLabel('Digit 4').evaluate((e) => e === document.activeElement)) === true,
  );

  // Arabic, right to left
  await page.getByRole('button', { name: 'Back to Sign In' }).click();
  await page.getByRole('heading', { level: 1, name: 'Welcome Back!' }).waitFor();
  await page.getByRole('button', { name: 'AR' }).click();
  await page.getByRole('heading', { level: 1, name: 'مرحباً بعودتك!' }).waitFor();
  check(vp, 'rtl', (await page.locator('.auth-viewport').getAttribute('dir')) === 'rtl');
  await shot('signin-ar');

  if (errors.length) check(vp, 'runtime errors', false, { errors });
  await ctx.close();
}
await browser.close();
fs.writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
for (const r of results)
  console.log(
    `${r.pass ? '✓' : '✗'} ${r.viewport.padEnd(8)} ${r.name.padEnd(20)}${r.overflowPx ? ' overflow=' + r.overflowPx + 'px' : ''}${r.errors ? ' ' + r.errors.join('; ') : ''}`,
  );
console.log(failures ? `LOGIN CHECK FAILED (${failures})` : 'LOGIN CHECK PASSED');
process.exit(failures ? 1 : 0);
