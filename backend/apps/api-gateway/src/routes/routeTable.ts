/**
 * Public API surface (`/api/v1/...`) → owning module of the main API. The gateway strips `/api/v1` before forwarding.
 */
export type ServiceName = 'identity' | 'organization' | 'hospitality' | 'public';

export interface RouteRule {
  /** Path prefix after /api/v1, e.g. "/auth" */
  prefix: string;
  service: ServiceName;
}

export const API_PREFIX = '/api/v1';

export const ROUTES: RouteRule[] = [
  // Identity & Organization (JWT-protected by default)
  { prefix: '/auth', service: 'identity' },
  { prefix: '/users', service: 'identity' },
  { prefix: '/roles', service: 'identity' },
  { prefix: '/permissions', service: 'identity' },
  { prefix: '/organizations', service: 'organization' },
  { prefix: '/branches', service: 'organization' },
  { prefix: '/files', service: 'organization' },

  // Hospitality, POS, Kitchen, Supply Chain & Reporting (controlled by AUTH_ENFORCE_HOSPITALITY)
  { prefix: '/categories', service: 'hospitality' },
  { prefix: '/products', service: 'hospitality' },
  { prefix: '/menu', service: 'hospitality' },
  { prefix: '/tables', service: 'hospitality' },
  { prefix: '/orders', service: 'hospitality' },
  { prefix: '/kitchen', service: 'hospitality' },
  { prefix: '/pos', service: 'hospitality' },
  { prefix: '/payments', service: 'hospitality' },
  { prefix: '/shifts', service: 'hospitality' },
  { prefix: '/cash-management', service: 'hospitality' },
  { prefix: '/inventory', service: 'hospitality' },
  { prefix: '/suppliers', service: 'hospitality' },
  { prefix: '/purchase-orders', service: 'hospitality' },
  { prefix: '/purchasing', service: 'hospitality' },
  { prefix: '/expenses', service: 'hospitality' },
  { prefix: '/customers', service: 'hospitality' },
  { prefix: '/reports', service: 'hospitality' },
  { prefix: '/notifications', service: 'hospitality' },
  { prefix: '/audit-logs', service: 'hospitality' },

  // Public Website Leads, Payment Webhooks & Live Realtime SSE
  { prefix: '/public', service: 'public' },
  { prefix: '/webhooks', service: 'public' },
  { prefix: '/realtime', service: 'public' },
];

/** Endpoints reachable without an access token. Everything else needs a valid JWT at the gateway. */
export const PUBLIC_ENDPOINTS = new Set([
  'POST /auth/register',
  'POST /auth/login',
  'POST /auth/refresh',
  'POST /auth/logout',
]);

/** Endpoints with the strict, brute-force rate limit. */
export const CREDENTIAL_ENDPOINTS = new Set(['POST /auth/register', 'POST /auth/login', 'POST /auth/change-password']);

export function matchRoute(path: string): RouteRule | undefined {
  return ROUTES.find((r) => path === r.prefix || path.startsWith(`${r.prefix}/`));
}

export function isOpenRoute(method: string, path: string, enforceHospitalityAuth = false): boolean {
  if (method === 'OPTIONS' || PUBLIC_ENDPOINTS.has(`${method} ${path}`)) return true;
  const rule = matchRoute(path);
  if (!rule) return false;
  if (rule.service === 'public') return true;
  if (rule.service === 'hospitality' && !enforceHospitalityAuth) return true;
  return false;
}
