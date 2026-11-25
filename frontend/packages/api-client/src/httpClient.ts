import axios, { AxiosError, type AxiosAdapter, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { env } from '@sombill/shared-config/env';
import { getAccessToken, useSessionStore } from '@sombill/api-client/sessionStore';

/** Fired on `window` when the session cannot be renewed. AppProviders clears cached server data on it. */
export const SESSION_EXPIRED_EVENT = 'sombill:session-expired';

/** One error shape for every API failure, so UI code never inspects Axios internals. */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number | null,
    public readonly code?: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ErrorBody {
  message?: string;
  error?: string | { message?: string; code?: string };
  code?: string;
  details?: unknown;
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as ErrorBody | undefined;
    const nested = typeof body?.error === 'object' ? body.error : undefined;
    const message =
      body?.message ??
      nested?.message ??
      (typeof body?.error === 'string' ? body.error : undefined) ??
      (error.code === 'ECONNABORTED' ? 'The request timed out. Please try again.' : undefined) ??
      (error.response
        ? `Request failed (${error.response.status}).`
        : 'Network error. Check your connection and try again.');
    return new ApiError(message, error.response?.status ?? null, body?.code ?? nested?.code, body?.details);
  }
  return new ApiError(error instanceof Error ? error.message : 'Unexpected error.', null);
}

interface RefreshResponse {
  data?: { accessToken?: string };
  accessToken?: string;
  access_token?: string;
}

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean; skipAuthRefresh?: boolean };

declare module 'axios' {
  interface AxiosRequestConfig {
    /** Set on requests that must not trigger a token refresh (e.g. login). */
    skipAuthRefresh?: boolean;
  }
}

/**
 * Creates the API client: JSON, `Authorization: Bearer <access token>`, refresh-token cookie sent with
 * `withCredentials`, and automatic renewal on 401. Concurrent 401s share one refresh call ("single flight").
 */
export interface HttpClientOptions {
  baseURL?: string;
  /** Transport override (tests). Applies to API and refresh requests alike. */
  adapter?: AxiosAdapter;
}

export function createHttpClient({ baseURL = env.apiBaseUrl, adapter }: HttpClientOptions = {}): AxiosInstance {
  const client = axios.create({
    baseURL,
    timeout: env.apiTimeoutMs,
    withCredentials: true,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    ...(adapter ? { adapter } : {}),
  });
  const refreshClient = axios.create({
    baseURL,
    timeout: env.apiTimeoutMs,
    withCredentials: true,
    ...(adapter ? { adapter } : {}),
  });

  let refreshing: Promise<string> | null = null;

  const refreshAccessToken = (): Promise<string> => {
    refreshing ??= refreshClient
      .post<RefreshResponse>(env.apiRefreshPath)
      .then(({ data }) => {
        // SomBill API Gateway: { data: { accessToken } }. Bare { accessToken } / { access_token } also accepted.
        const token = data.data?.accessToken ?? data.accessToken ?? data.access_token;
        if (!token) throw new ApiError('The session could not be renewed.', 401, 'REFRESH_FAILED');
        useSessionStore.getState().setAccessToken(token);
        return token;
      })
      .finally(() => {
        refreshing = null;
      });
    return refreshing;
  };

  client.interceptors.request.use((config) => {
    const token = getAccessToken();
    if (token && !config.headers.has('Authorization')) config.headers.set('Authorization', `Bearer ${token}`);
    return config;
  });

  client.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const config = error.config as RetriableConfig | undefined;
      if (error.response?.status !== 401 || !config || config._retried || config.skipAuthRefresh) {
        throw toApiError(error);
      }
      config._retried = true;
      try {
        const token = await refreshAccessToken();
        config.headers.set('Authorization', `Bearer ${token}`);
        return await client.request(config);
      } catch (refreshError) {
        const apiError = toApiError(refreshError);
        if (apiError.status === 401 || apiError.code === 'REFRESH_FAILED') {
          useSessionStore.getState().markExpired();
          window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
          throw new ApiError('Your session expired. Please sign in again.', 401, 'SESSION_EXPIRED');
        }
        throw apiError;
      }
    },
  );

  return client;
}

/** Shared client for the SomBill API Gateway (`VITE_API_BASE_URL`). */
export const httpClient = createHttpClient();
