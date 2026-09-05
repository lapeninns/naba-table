import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

import { GET } from '@/src/app/api/ready/route';

const TOKEN = 'monitoring-token-with-at-least-thirty-two-chars';

type FakeSupabase = {
  from: ReturnType<typeof vi.fn>;
  storage: { listBuckets: ReturnType<typeof vi.fn> };
  rpc: ReturnType<typeof vi.fn>;
  calls: string[];
};

function createSupabase(options: {
  selectDelayMs?: number;
  selectError?: boolean;
  bucketsError?: boolean;
}): FakeSupabase {
  const calls: string[] = [];
  const query = {
    select: vi.fn((columns: string) => {
      calls.push(`select:${columns}`);
      return query;
    }),
    limit: vi.fn((count: number) => {
      calls.push(`limit:${count}`);
      return query;
    }),
    abortSignal: vi.fn(
      (signal: AbortSignal) =>
        new Promise<{ error: { message: string } | null }>((resolve) => {
          const delay = options.selectDelayMs ?? 0;
          const timer = setTimeout(
            () => resolve({ error: options.selectError ? { message: 'boom' } : null }),
            delay,
          );
          signal.addEventListener('abort', () => {
            clearTimeout(timer);
            resolve({ error: { message: 'aborted' } });
          });
        }),
    ),
    insert: vi.fn(() => {
      calls.push('insert');
      return query;
    }),
    update: vi.fn(() => {
      calls.push('update');
      return query;
    }),
    delete: vi.fn(() => {
      calls.push('delete');
      return query;
    }),
  };
  return {
    calls,
    from: vi.fn((table: string) => {
      calls.push(`from:${table}`);
      return query;
    }),
    storage: {
      listBuckets: vi.fn(async () => {
        calls.push('storage.listBuckets');
        return { data: [], error: options.bucketsError ? { message: 'denied' } : null };
      }),
    },
    rpc: vi.fn(() => {
      calls.push('rpc');
      return { error: null };
    }),
  };
}

function request(authorization?: string): NextRequest {
  const headers = new Headers();
  if (authorization) headers.set('authorization', authorization);
  return new NextRequest('https://app.nabatable.com/api/ready', { headers });
}

describe('GET /api/ready', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.stubEnv('MONITORING_TOKEN', TOKEN);
    vi.stubEnv('NABATABLE_SOURCE_REVISION', 'abc1234def');
    vi.stubEnv('NABATABLE_BUILD_ID', 'dpl_123');
    vi.stubEnv('CLOUDFLARE_EMAIL_QUEUE_GATEWAY_URL', 'https://email-gateway.example.test');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 200 })),
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('rejects requests without a token using a generic body and never touches dependencies', async () => {
    const supabase = createSupabase({});
    getServiceSupabaseClientMock.mockReturnValue(supabase);

    const response = await GET(request());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(getServiceSupabaseClientMock).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects wrong tokens and a token that is a prefix of the configured one', async () => {
    getServiceSupabaseClientMock.mockReturnValue(createSupabase({}));

    expect((await GET(request('Bearer nope'))).status).toBe(401);
    expect((await GET(request(`Bearer ${TOKEN.slice(0, -1)}`))).status).toBe(401);
    expect((await GET(request(`Bearer ${TOKEN}extra`))).status).toBe(401);
    expect((await GET(request(TOKEN))).status).toBe(401);
    expect(getServiceSupabaseClientMock).not.toHaveBeenCalled();
  });

  it('fails closed with 401 when MONITORING_TOKEN is unconfigured even if a bearer is sent', async () => {
    vi.stubEnv('MONITORING_TOKEN', '');
    getServiceSupabaseClientMock.mockReturnValue(createSupabase({}));

    const response = await GET(request(`Bearer ${TOKEN}`));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(getServiceSupabaseClientMock).not.toHaveBeenCalled();
  });

  it('reports ok with revision passthrough and only read-only dependency calls', async () => {
    const supabase = createSupabase({});
    getServiceSupabaseClientMock.mockReturnValue(supabase);

    const response = await GET(request(`Bearer ${TOKEN}`));
    const body = (await response.json()) as {
      service: string;
      status: string;
      revision: string;
      deploymentId: string;
      checks: Array<{ name: string; status: string; latencyMs: number }>;
    };

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(body.service).toBe('nabatable-web');
    expect(body.status).toBe('ok');
    expect(body.revision).toBe('abc1234def');
    expect(body.deploymentId).toBe('dpl_123');
    expect(body.checks.map((check) => [check.name, check.status])).toEqual([
      ['database', 'ok'],
      ['storage', 'ok'],
      ['email-gateway', 'ok'],
    ]);
    for (const check of body.checks) expect(check.latencyMs).toBeGreaterThanOrEqual(0);

    expect(supabase.calls).toEqual([
      'from:restaurants',
      'select:id',
      'limit:1',
      'storage.listBuckets',
    ]);
    expect(supabase.rpc).not.toHaveBeenCalled();
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://email-gateway.example.test/health');
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: 'HEAD' });
    expect(JSON.stringify(body)).not.toContain(TOKEN);
  });

  it('falls back to Vercel metadata for revision and deployment id', async () => {
    vi.stubEnv('NABATABLE_SOURCE_REVISION', '');
    vi.stubEnv('NABATABLE_BUILD_ID', '');
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'vercel-sha');
    vi.stubEnv('VERCEL_DEPLOYMENT_ID', 'vercel-dpl');
    getServiceSupabaseClientMock.mockReturnValue(createSupabase({}));

    const body = (await (await GET(request(`Bearer ${TOKEN}`))).json()) as {
      revision: string;
      deploymentId: string;
    };

    expect(body.revision).toBe('vercel-sha');
    expect(body.deploymentId).toBe('vercel-dpl');
  });

  it('reports degraded instead of hanging when the database probe exceeds its bound', async () => {
    vi.useFakeTimers();
    getServiceSupabaseClientMock.mockReturnValue(createSupabase({ selectDelayMs: 60_000 }));

    const pending = GET(request(`Bearer ${TOKEN}`));
    await vi.advanceTimersByTimeAsync(2_100);
    const response = await pending;
    const body = (await response.json()) as {
      status: string;
      checks: Array<{ name: string; status: string; detail?: string }>;
    };

    expect(response.status).toBe(200);
    expect(body.status).toBe('degraded');
    expect(body.checks.find((check) => check.name === 'database')).toMatchObject({
      status: 'degraded',
      detail: 'timeout',
    });
  });

  it('returns 503 when a dependency is down and marks the gateway unconfigured when no URL is set', async () => {
    vi.stubEnv('CLOUDFLARE_EMAIL_QUEUE_GATEWAY_URL', '');
    getServiceSupabaseClientMock.mockReturnValue(createSupabase({ selectError: true }));

    const response = await GET(request(`Bearer ${TOKEN}`));
    const body = (await response.json()) as {
      status: string;
      checks: Array<{ name: string; status: string; detail?: string }>;
    };

    expect(response.status).toBe(503);
    expect(body.status).toBe('down');
    expect(body.checks.find((check) => check.name === 'database')).toMatchObject({
      status: 'down',
      detail: 'error',
    });
    expect(body.checks.find((check) => check.name === 'email-gateway')).toMatchObject({
      status: 'degraded',
      detail: 'unconfigured',
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('reports the gateway down on 5xx without exposing provider payloads', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('internal detail with guest@example.com', { status: 502 })),
    );
    getServiceSupabaseClientMock.mockReturnValue(createSupabase({}));

    const response = await GET(request(`Bearer ${TOKEN}`));
    const text = await response.text();

    expect(response.status).toBe(503);
    expect(text).toContain('"http_502"');
    expect(text).not.toContain('guest@example.com');
  });
});
