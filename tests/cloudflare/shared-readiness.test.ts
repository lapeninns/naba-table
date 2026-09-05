import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_READINESS_TIMEOUT_MS,
  READINESS_SENTINEL_KEY,
  constantTimeEquals,
  createD1Probe,
  createDurableObjectProbe,
  createKvProbe,
  createQueueBindingProbe,
  handleReadinessRequest,
  isAuthorizedReadinessRequest,
  isReadinessRequest,
  resolveWorkerRevision,
  runReadinessProbe,
  summarizeReadiness,
} from '@/cloudflare/shared/readiness';

const TOKEN = 'worker-monitoring-token-with-thirty-two-plus-chars';

function readyRequest(authorization?: string, path = '/ready', method = 'GET'): Request {
  const headers = new Headers();
  if (authorization) headers.set('authorization', authorization);
  return new Request(`https://worker.example.test${path}`, { method, headers });
}

describe('shared Worker readiness helper', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('compares tokens in constant time including length mismatches', () => {
    expect(constantTimeEquals('abc', 'abc')).toBe(true);
    expect(constantTimeEquals('abc', 'abd')).toBe(false);
    expect(constantTimeEquals('abc', 'ab')).toBe(false);
    expect(constantTimeEquals('abc', 'abcd')).toBe(false);
    expect(constantTimeEquals('', '')).toBe(true);
    expect(constantTimeEquals('', 'a')).toBe(false);
  });

  it('fails closed on missing, wrong, prefix, suffix, and unconfigured tokens', () => {
    expect(isAuthorizedReadinessRequest(readyRequest(`Bearer ${TOKEN}`), TOKEN)).toBe(true);
    expect(isAuthorizedReadinessRequest(readyRequest(`bearer ${TOKEN}`), TOKEN)).toBe(true);
    expect(isAuthorizedReadinessRequest(readyRequest(), TOKEN)).toBe(false);
    expect(isAuthorizedReadinessRequest(readyRequest('Bearer nope'), TOKEN)).toBe(false);
    expect(isAuthorizedReadinessRequest(readyRequest(`Bearer ${TOKEN.slice(0, -1)}`), TOKEN)).toBe(
      false,
    );
    expect(isAuthorizedReadinessRequest(readyRequest(`Bearer ${TOKEN}x`), TOKEN)).toBe(false);
    expect(isAuthorizedReadinessRequest(readyRequest(TOKEN), TOKEN)).toBe(false);
    expect(isAuthorizedReadinessRequest(readyRequest(`Bearer ${TOKEN}`), undefined)).toBe(false);
    expect(isAuthorizedReadinessRequest(readyRequest(`Bearer ${TOKEN}`), '   ')).toBe(false);
    expect(isAuthorizedReadinessRequest(readyRequest('Bearer '), '')).toBe(false);
  });

  it('only matches GET /ready', () => {
    expect(isReadinessRequest(readyRequest())).toBe(true);
    expect(isReadinessRequest(readyRequest(undefined, '/ready?x=1'))).toBe(true);
    expect(isReadinessRequest(readyRequest(undefined, '/health'))).toBe(false);
    expect(isReadinessRequest(readyRequest(undefined, '/ready', 'POST'))).toBe(false);
    expect(isReadinessRequest(readyRequest(undefined, '/ready', 'HEAD'))).toBe(false);
  });

  it('bounds probes: timeout reports degraded and aborts, throw reports down', async () => {
    vi.useFakeTimers();
    let aborted = false;
    const pending = runReadinessProbe({
      name: 'slow',
      run: (signal) =>
        new Promise((resolve) => {
          signal.addEventListener('abort', () => {
            aborted = true;
            resolve({ status: 'ok' });
          });
        }),
    });
    await vi.advanceTimersByTimeAsync(DEFAULT_READINESS_TIMEOUT_MS + 10);
    await expect(pending).resolves.toMatchObject({
      name: 'slow',
      status: 'degraded',
      detail: 'timeout',
    });
    expect(aborted).toBe(true);

    await expect(
      runReadinessProbe({
        name: 'broken',
        run: async () => Promise.reject(new Error('guest@example.com')),
      }),
    ).resolves.toEqual({ name: 'broken', status: 'down', latencyMs: 0, detail: 'error' });
  });

  it('summarizes the worst status', () => {
    expect(summarizeReadiness([])).toBe('ok');
    expect(
      summarizeReadiness([
        { name: 'a', status: 'ok', latencyMs: 1 },
        { name: 'b', status: 'degraded', latencyMs: 1 },
      ]),
    ).toBe('degraded');
    expect(
      summarizeReadiness([
        { name: 'a', status: 'degraded', latencyMs: 1 },
        { name: 'b', status: 'down', latencyMs: 1 },
      ]),
    ).toBe('down');
  });

  it('resolves revision from DEPLOY_SHA first and CF version metadata second', () => {
    expect(
      resolveWorkerRevision({
        DEPLOY_SHA: 'abc123',
        CF_VERSION_METADATA: { id: 'ver-1', tag: 'v1', timestamp: 't' },
      }),
    ).toEqual({ revision: 'abc123', deploymentId: 'ver-1', versionTag: 'v1' });
    expect(
      resolveWorkerRevision({ CF_VERSION_METADATA: { id: 'ver-2', tag: '', timestamp: 't' } }),
    ).toEqual({ revision: 'ver-2', deploymentId: 'ver-2', versionTag: null });
    expect(resolveWorkerRevision({ DEPLOY_SHA: '  ' })).toEqual({
      revision: null,
      deploymentId: null,
      versionTag: null,
    });
  });

  it('rejects unauthorized requests with a generic body before running any probe', async () => {
    const run = vi.fn(async () => ({ status: 'ok' as const }));
    const response = await handleReadinessRequest({
      request: readyRequest('Bearer wrong'),
      env: { MONITORING_TOKEN: TOKEN },
      service: 'worker',
      probes: [{ name: 'p', run }],
    });
    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(run).not.toHaveBeenCalled();

    const unconfigured = await handleReadinessRequest({
      request: readyRequest(`Bearer ${TOKEN}`),
      env: {},
      service: 'worker',
      probes: [{ name: 'p', run }],
    });
    expect(unconfigured.status).toBe(401);
    expect(run).not.toHaveBeenCalled();
  });

  it('answers 200 for ok/degraded and 503 for down with the readiness report shape', async () => {
    const ok = await handleReadinessRequest({
      request: readyRequest(`Bearer ${TOKEN}`),
      env: { MONITORING_TOKEN: TOKEN, DEPLOY_SHA: 'sha-1' },
      service: 'worker',
      probes: [
        { name: 'a', run: async () => ({ status: 'ok' }) },
        { name: 'b', run: async () => ({ status: 'degraded', detail: 'unconfigured' }) },
      ],
    });
    expect(ok.status).toBe(200);
    expect(ok.headers.get('cache-control')).toBe('no-store');
    const body = (await ok.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      service: 'worker',
      status: 'degraded',
      revision: 'sha-1',
      deploymentId: null,
      versionTag: null,
    });
    expect(body.checks).toEqual([
      { name: 'a', status: 'ok', latencyMs: expect.any(Number) },
      { name: 'b', status: 'degraded', latencyMs: expect.any(Number), detail: 'unconfigured' },
    ]);
    expect(typeof body.observedAt).toBe('string');
    expect(JSON.stringify(body)).not.toContain(TOKEN);

    const down = await handleReadinessRequest({
      request: readyRequest(`Bearer ${TOKEN}`),
      env: { MONITORING_TOKEN: TOKEN },
      service: 'worker',
      probes: [{ name: 'a', run: async () => ({ status: 'down', detail: 'error' }) }],
    });
    expect(down.status).toBe(503);
  });

  it('D1 probe runs only `select 1` and reports unconfigured bindings as down', async () => {
    const first = vi.fn(async () => ({ ready: 1 }));
    const bind = vi.fn(() => ({ first }));
    const prepare = vi.fn(() => ({ bind }));
    await expect(runReadinessProbe(createD1Probe({ prepare }))).resolves.toMatchObject({
      name: 'd1',
      status: 'ok',
    });
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(prepare.mock.calls[0]?.[0]).toMatch(/^select 1/iu);
    expect(bind).toHaveBeenCalledWith();
    await expect(
      runReadinessProbe(createD1Probe(undefined, { name: 'db' }), () => 0),
    ).resolves.toEqual({
      name: 'db',
      status: 'down',
      latencyMs: 0,
      detail: 'unconfigured',
    });
  });

  it('KV probe reads the sentinel key only and treats a missing binding as degraded', async () => {
    const get = vi.fn(async () => null);
    await expect(runReadinessProbe(createKvProbe({ get }))).resolves.toMatchObject({
      name: 'kv',
      status: 'ok',
    });
    expect(get).toHaveBeenCalledWith(READINESS_SENTINEL_KEY, 'json');
    await expect(runReadinessProbe(createKvProbe(undefined))).resolves.toMatchObject({
      status: 'degraded',
      detail: 'unconfigured',
    });
  });

  it('queue probe checks binding presence without sending', async () => {
    const send = vi.fn();
    await expect(runReadinessProbe(createQueueBindingProbe({ send }))).resolves.toMatchObject({
      name: 'queue',
      status: 'ok',
    });
    expect(send).not.toHaveBeenCalled();
    await expect(runReadinessProbe(createQueueBindingProbe(undefined))).resolves.toMatchObject({
      status: 'down',
      detail: 'unconfigured',
    });
    await expect(
      runReadinessProbe(createQueueBindingProbe({ send: 'not-a-function' })),
    ).resolves.toMatchObject({ status: 'down', detail: 'unconfigured' });
  });

  it('Durable Object probe issues a GET ping and maps 5xx to down', async () => {
    const seen: Request[] = [];
    const binding = {
      idFromName: vi.fn((name: string) => `id:${name}`),
      get: vi.fn(() => ({
        fetch: async (request: Request) => {
          seen.push(request);
          return new Response(null, { status: request.url.endsWith('/boom') ? 500 : 404 });
        },
      })),
    };
    await expect(
      runReadinessProbe(
        createDurableObjectProbe(binding, {
          name: 'state',
          objectName: 'primary',
          path: '/health',
        }),
      ),
    ).resolves.toMatchObject({ name: 'state', status: 'ok' });
    expect(binding.idFromName).toHaveBeenCalledWith('primary');
    expect(seen[0]?.method).toBe('GET');
    expect(new URL(seen[0]?.url ?? '').pathname).toBe('/health');

    await expect(
      runReadinessProbe(createDurableObjectProbe(binding, { path: '/boom' })),
    ).resolves.toMatchObject({ status: 'down', detail: 'http_500' });
    await expect(runReadinessProbe(createDurableObjectProbe(undefined))).resolves.toMatchObject({
      status: 'down',
      detail: 'unconfigured',
    });
  });
});
