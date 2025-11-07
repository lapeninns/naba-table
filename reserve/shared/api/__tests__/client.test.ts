import { beforeEach, describe, expect, it, vi } from 'vitest';

const originalFetch = global.fetch;
const originalEnv = { ...process.env };

const restoreEnv = () => {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) {
      delete process.env[key];
    }
  }
  Object.assign(process.env, originalEnv);
};

async function loadClient() {
  const mod = await import('../client');
  return mod.apiClient;
}

describe('apiClient', () => {
  beforeEach(() => {
    vi.resetModules();
    restoreEnv();
    process.env.RESERVE_API_BASE_URL = 'https://api.example.com';
    process.env.RESERVE_API_TIMEOUT_MS = '50';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    restoreEnv();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('prefixes requests with the configured base URL', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    global.fetch = fetchMock as unknown as typeof global.fetch;

    const apiClient = await loadClient();
    await apiClient.get('/bookings');

    expect(fetchMock).toHaveBeenCalledWith('https://api.example.com/bookings', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      body: undefined,
      credentials: 'include',
      signal: expect.any(AbortSignal),
    });
  });

  it('normalizes error responses', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'Proxy down', code: 'BAD_GATEWAY' }), {
        status: 502,
        statusText: 'Bad Gateway',
      }),
    );
    global.fetch = fetchMock as unknown as typeof global.fetch;

    const apiClient = await loadClient();

    await expect(apiClient.get('/status')).rejects.toMatchObject({
      status: 502,
      message: 'Proxy down',
      code: 'BAD_GATEWAY',
    });
  });

  it('aborts requests that exceed the configured timeout', async () => {
    vi.useFakeTimers();
    let capturedSignal: AbortSignal | undefined;

    const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      capturedSignal = init?.signal as AbortSignal;
      return new Promise((_resolve, reject) => {
        capturedSignal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
    });
    global.fetch = fetchMock as unknown as typeof global.fetch;

    const apiClient = await loadClient();
    const pending = apiClient.get('/slow').catch((error) => error as unknown);

    await vi.advanceTimersByTimeAsync(60);

    expect(capturedSignal?.aborted).toBe(true);
    const error = await pending;
    expect(error).toMatchObject({ code: 'REQUEST_ABORTED', status: 499 });
  });
});
