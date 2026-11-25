/**
 * Where the dashboards (manager, cashier, waiter, Group HQ) run. "Log In" and /login on the website go there.
 * Set VITE_DASHBOARDS_URL per environment; in development it defaults to same-origin (port 3000 unified server).
 */
const DASHBOARDS_URL = (import.meta.env.VITE_DASHBOARDS_URL ?? '').replace(/\/+$/, '');
const API_BASE_URL = (import.meta.env.VITE_API_URL ?? '/api/v1').replace(/\/+$/, '');

export const DASHBOARD_ROUTES = {
  login: `${DASHBOARDS_URL}/login`,
  resetPassword: `${DASHBOARDS_URL}/reset-password`,
  manager: `${DASHBOARDS_URL}/manager`,
  cashier: `${DASHBOARDS_URL}/cashier`,
  waiter: `${DASHBOARDS_URL}/waiter`,
  superAdmin: `${DASHBOARDS_URL}/dashboard/super-admin`,
} as const;

export const SITE_CONFIG = {
  dashboardsUrl: DASHBOARDS_URL,
  apiBaseUrl: API_BASE_URL,
  signInUrl: DASHBOARD_ROUTES.login,
  brandName: 'SomBill',
  tagline: 'Hospitality OS',
  subtitle: 'Trusted Hospitality Partner',
  version: 'v2.4.0',
  logoPath: '/images/sombill-logo.jpeg',
  defaultTheme: 'light' as const,
  defaultLang: 'en' as const,
  supportPhone: '+252 63 440 8910',
  supportEmail: 'support@sombill.com',
  salesEmail: 'sales@sombill.com',
  headquarters: '26 June District, Presidential Road, Hargeisa, Somaliland',
  regionalOffices: ['Hargeisa', 'Berbera', 'Burao', 'Borama', 'Mogadishu', 'Garowe'],
  paymentGateways: ['Telesom ZAAD', 'Hormuud EVC Plus', 'Somtel e-Dahab', 'Golis Sahal', 'Visa / Mastercard'],
} as const;
