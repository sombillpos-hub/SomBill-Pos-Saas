/**
 * Typed access to the dashboards' environment variables (set in `.env.local`, see `.env.example`).
 * Nothing is hard-coded: every URL comes from the environment.
 */
function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

export const env = {
  /** Supabase project (the backend the current dashboards run on). */
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? '',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
  /** SomBill API Gateway, e.g. https://api.sombill.com/api/v1 */
  apiBaseUrl: trimTrailingSlash(import.meta.env.VITE_API_BASE_URL ?? ''),
  /** Path (relative to apiBaseUrl) that exchanges the refresh token for a new access token. */
  apiRefreshPath: import.meta.env.VITE_API_REFRESH_PATH ?? '/auth/refresh',
  /** Request timeout in milliseconds. */
  apiTimeoutMs: Number(import.meta.env.VITE_API_TIMEOUT_MS ?? 20000),
  /** Socket.IO server origin, e.g. https://api.sombill.com */
  socketUrl: trimTrailingSlash(import.meta.env.VITE_SOCKET_URL ?? ''),
  /** Socket.IO path on that server. */
  socketPath: import.meta.env.VITE_SOCKET_PATH ?? '/socket.io',
} as const;

export const apiConfigured = env.apiBaseUrl.length > 0;
export const socketConfigured = env.socketUrl.length > 0;
