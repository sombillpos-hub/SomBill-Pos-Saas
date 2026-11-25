import {
  AxiosError,
  AxiosHeaders,
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { ApiError, createHttpClient, SESSION_EXPIRED_EVENT, toApiError } from '@sombill/api-client/httpClient';
import { shouldRetry } from '@sombill/api-client/queryClient';
import { useSessionStore } from '@sombill/api-client/sessionStore';

type Reply = { status: number; data?: unknown };

/** A client whose API and refresh calls are answered by `handler` instead of the network. */
function clientWith(handler: (config: InternalAxiosRequestConfig) => Reply) {
  const calls: InternalAxiosRequestConfig[] = [];
  const adapter: AxiosAdapter = (config) => {
    calls.push(config);
    const { status, data = {} } = handler(config);
    const response: AxiosResponse = { data, status, statusText: String(status), headers: {}, config };
    return status >= 400
      ? Promise.reject(
          new AxiosError(`Request failed with status code ${status}`, 'ERR_BAD_RESPONSE', config, null, response),
        )
      : Promise.resolve(response);
  };
  return { client: createHttpClient({ baseURL: 'https://api.test/api/v1', adapter }), calls };
}

const auth = (c: InternalAxiosRequestConfig) => AxiosHeaders.from(c.headers).get('Authorization');

describe('httpClient', () => {
  beforeEach(() => useSessionStore.getState().clear());

  it('attaches the in-memory access token and sends the refresh cookie', async () => {
    useSessionStore.getState().setAccessToken('tok-1');
    const { client, calls } = clientWith(() => ({ status: 200, data: { ok: true } }));
    const res = await client.get('/orders');
    expect(res.data).toEqual({ ok: true });
    expect(auth(calls[0]!)).toBe('Bearer tok-1');
    expect(calls[0]!.withCredentials).toBe(true);
    expect(calls[0]!.baseURL).toBe('https://api.test/api/v1');
  });

  it('refreshes once for concurrent 401s (SomBill { data: { accessToken } } envelope), then retries every request', async () => {
    useSessionStore.getState().setAccessToken('expired');
    let refreshCalls = 0;
    const { client } = clientWith((c) => {
      if (c.url === '/auth/refresh') {
        refreshCalls += 1;
        return { status: 200, data: { data: { accessToken: 'fresh', tokenType: 'Bearer', expiresIn: 900 } } };
      }
      return auth(c) === 'Bearer fresh' ? { status: 200, data: { url: c.url } } : { status: 401 };
    });
    const results = await Promise.all([client.get('/a'), client.get('/b'), client.get('/c')]);
    expect(results.map((r) => r.data.url)).toEqual(['/a', '/b', '/c']);
    expect(refreshCalls).toBe(1);
    expect(useSessionStore.getState().accessToken).toBe('fresh');
  });

  it('also accepts a bare snake_case access_token from the refresh endpoint', async () => {
    useSessionStore.getState().setAccessToken('expired');
    const { client } = clientWith((c) =>
      c.url === '/auth/refresh'
        ? { status: 200, data: { access_token: 'fresh2' } }
        : auth(c) === 'Bearer fresh2'
          ? { status: 200 }
          : { status: 401 },
    );
    await client.get('/x');
    expect(useSessionStore.getState().accessToken).toBe('fresh2');
  });

  it('marks the session expired and emits an event when refresh is rejected', async () => {
    useSessionStore.getState().setAccessToken('expired');
    const { client } = clientWith(() => ({ status: 401, data: { message: 'invalid refresh token' } }));
    const onExpired = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    try {
      await expect(client.get('/orders')).rejects.toMatchObject({ status: 401, code: 'SESSION_EXPIRED' });
      expect(onExpired).toHaveBeenCalledTimes(1);
      expect(useSessionStore.getState()).toMatchObject({ accessToken: null, expired: true });
    } finally {
      window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
    }
  });

  it('does not refresh for requests flagged skipAuthRefresh (e.g. login)', async () => {
    const { client, calls } = clientWith(() => ({ status: 401, data: { message: 'Wrong email or password.' } }));
    await expect(client.post('/auth/login', {}, { skipAuthRefresh: true })).rejects.toMatchObject({
      status: 401,
      message: 'Wrong email or password.',
    });
    expect(calls).toHaveLength(1);
  });

  it('normalises API error bodies into ApiError', async () => {
    const { client } = clientWith(() => ({
      status: 422,
      data: { error: { message: 'Quantity must be positive', code: 'VALIDATION' } },
    }));
    const err = await client.post('/orders', {}).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 422, code: 'VALIDATION', message: 'Quantity must be positive' });
  });

  it('gives a friendly message for network failures', () => {
    const e = toApiError(new AxiosError('Network Error', 'ERR_NETWORK'));
    expect(e.status).toBeNull();
    expect(e.message).toMatch(/network error/i);
  });
});

describe('query retry policy', () => {
  it('never retries client errors and retries server or network errors twice', () => {
    expect(shouldRetry(0, new ApiError('nope', 403))).toBe(false);
    expect(shouldRetry(0, new ApiError('missing', 404))).toBe(false);
    expect(shouldRetry(0, new ApiError('boom', 500))).toBe(true);
    expect(shouldRetry(1, new ApiError('offline', null))).toBe(true);
    expect(shouldRetry(2, new ApiError('boom', 503))).toBe(false);
  });
});
