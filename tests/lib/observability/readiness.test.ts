import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildReadinessReport,
  createDatabaseProbe,
  createGatewayProbe,
  createStorageProbe,
  isAuthorizedMonitoringRequest,
  readinessHttpStatus,
  resolveRevision,
  runBoundedProbe,
  runReadinessProbes,
  summarizeReadiness,
} from '@/lib/observability/readiness';

describe('isAuthorizedMonitoringRequest', () => {
  it('requires a configured token and an exact bearer match', () => {
    expect(isAuthorizedMonitoringRequest('secret-token', 'Bearer secret-token')).toBe(true);
    expect(isAuthorizedMonitoringRequest('secret-token', 'bearer secret-token')).toBe(true);
    expect(isAuthorizedMonitoringRequest('secret-token', 'Bearer secret-token-x')).toBe(false);
    expect(isAuthorizedMonitoringRequest('secret-token', 'Bearer secret')).toBe(false);
    expect(isAuthorizedMonitoringRequest('secret-token', 'secret-token')).toBe(false);
    expect(isAuthorizedMonitoringRequest('secret-token', null)).toBe(false);
    expect(isAuthorizedMonitoringRequest(undefined, 'Bearer anything')).toBe(false);
    expect(isAuthorizedMonitoringRequest('   ', 'Bearer    ')).toBe(false);
  });
});

describe('resolveRevision', () => {
  it('prefers baked build metadata and falls back to Vercel metadata', () => {
    expect(
      resolveRevision({
        NABATABLE_SOURCE_REVISION: 'baked',
        VERCEL_GIT_COMMIT_SHA: 'vercel',
        NABATABLE_BUILD_ID: 'build',
        VERCEL_DEPLOYMENT_ID: 'dpl',
      }),
    ).toEqual({ revision: 'baked', deploymentId: 'build' });
    expect(
      resolveRevision({ VERCEL_GIT_COMMIT_SHA: 'vercel', VERCEL_DEPLOYMENT_ID: 'dpl' }),
    ).toEqual({ revision: 'vercel', deploymentId: 'dpl' });
    expect(resolveRevision({ NABATABLE_SOURCE_REVISION: '  ' })).toEqual({
      revision: null,
      deploymentId: null,
    });
  });
});

describe('runBoundedProbe', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns degraded with a timeout detail when the probe exceeds its bound', async () => {
    vi.useFakeTimers();
    let aborted = false;
    const pending = runBoundedProbe({
      name: 'slow',
      timeoutMs: 50,
      run: (signal) =>
        new Promise((resolve) => {
          signal.addEventListener('abort', () => {
            aborted = true;
            resolve({ status: 'ok' });
          });
        }),
    });
    await vi.advanceTimersByTimeAsync(60);

    await expect(pending).resolves.toMatchObject({
      name: 'slow',
      status: 'degraded',
      detail: 'timeout',
    });
    expect(aborted).toBe(true);
  });

  it('returns down when the probe throws and ok when it resolves', async () => {
    await expect(
      runBoundedProbe({
        name: 'broken',
        timeoutMs: 100,
        run: async () => Promise.reject(new Error('x')),
      }),
    ).resolves.toMatchObject({ status: 'down', detail: 'error' });
    await expect(
      runBoundedProbe({ name: 'fine', timeoutMs: 100, run: async () => ({ status: 'ok' }) }),
    ).resolves.toMatchObject({ status: 'ok', latencyMs: expect.any(Number) });
  });

  it('runs all probes and summarizes the worst status', async () => {
    const checks = await runReadinessProbes([
      { name: 'a', timeoutMs: 100, run: async () => ({ status: 'ok' }) },
      { name: 'b', timeoutMs: 100, run: async () => ({ status: 'degraded', detail: 'timeout' }) },
    ]);
    expect(summarizeReadiness(checks)).toBe('degraded');
    expect(readinessHttpStatus('degraded')).toBe(200);
    expect(readinessHttpStatus('down')).toBe(503);
    expect(summarizeReadiness([...checks, { name: 'c', status: 'down', latencyMs: 1 }])).toBe(
      'down',
    );
    expect(summarizeReadiness([])).toBe('ok');
  });
});

describe('probe builders', () => {
  it('maps database and storage errors to down without leaking messages', async () => {
    const database = await runBoundedProbe(
      createDatabaseProbe({ selectOne: async () => ({ error: { message: 'guest@example.com' } }) }),
    );
    const storage = await runBoundedProbe(
      createStorageProbe({ listBuckets: async () => ({ error: null }) }),
    );
    expect(database).toMatchObject({ name: 'database', status: 'down', detail: 'error' });
    expect(JSON.stringify(database)).not.toContain('guest@example.com');
    expect(storage).toMatchObject({ name: 'storage', status: 'ok' });
  });

  it('uses HEAD against /health and never sends a body', async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 404 }));
    const check = await runBoundedProbe(
      createGatewayProbe('email-gateway', {
        url: 'https://gateway.example.test/base',
        fetcher: fetcher as unknown as typeof fetch,
      }),
    );
    expect(check).toMatchObject({ status: 'ok' });
    expect(fetcher).toHaveBeenCalledWith(
      'https://gateway.example.test/health',
      expect.objectContaining({ method: 'HEAD', redirect: 'manual' }),
    );
    expect((fetcher.mock.calls[0] as unknown[])[1]).not.toHaveProperty('body');
  });

  it('reports unconfigured gateway URLs as degraded and 5xx as down', async () => {
    const unconfigured = await runBoundedProbe(
      createGatewayProbe('email-gateway', { url: undefined, fetcher: vi.fn() as never }),
    );
    const invalid = await runBoundedProbe(
      createGatewayProbe('email-gateway', { url: 'not a url', fetcher: vi.fn() as never }),
    );
    const failing = await runBoundedProbe(
      createGatewayProbe('email-gateway', {
        url: 'https://gateway.example.test',
        fetcher: (async () => new Response(null, { status: 503 })) as typeof fetch,
      }),
    );
    expect(unconfigured).toMatchObject({ status: 'degraded', detail: 'unconfigured' });
    expect(invalid).toMatchObject({ status: 'degraded', detail: 'unconfigured' });
    expect(failing).toMatchObject({ status: 'down', detail: 'http_503' });
  });

  it('builds a report with the worst status and passthrough metadata', () => {
    const report = buildReadinessReport({
      service: 'nabatable-web',
      checks: [{ name: 'database', status: 'ok', latencyMs: 3 }],
      revision: 'abc',
      deploymentId: 'dpl',
      observedAt: new Date('2026-09-04T00:00:00.000Z'),
    });
    expect(report).toEqual({
      service: 'nabatable-web',
      status: 'ok',
      revision: 'abc',
      deploymentId: 'dpl',
      observedAt: '2026-09-04T00:00:00.000Z',
      checks: [{ name: 'database', status: 'ok', latencyMs: 3 }],
    });
  });
});
