import { describe, expect, it, vi } from 'vitest';

import bookingShortLinkWorker from '@/cloudflare/booking-short-links/src/index';

const TOKEN = 'short-links-monitoring-token-thirty-two-plus-chars';

function makeEnv(options: { withCache?: boolean; withToken?: boolean; d1Fails?: boolean } = {}) {
  const queries: string[] = [];
  const run = vi.fn(async () => undefined);
  const prepare = vi.fn((query: string) => {
    queries.push(query);
    return {
      bind: (..._args: unknown[]) => ({
        first: async <T>(): Promise<T | null> => {
          if (options.d1Fails) throw new Error('D1_ERROR: database unavailable');
          return null;
        },
        run,
      }),
    };
  });
  const kvGet = vi.fn(async () => null);
  const kvPut = vi.fn(async () => undefined);
  return {
    queries,
    run,
    kvGet,
    kvPut,
    env: {
      BOOKING_SHORT_LINKS_DB: { prepare },
      ...(options.withCache === false
        ? {}
        : { BOOKING_SHORT_LINKS_CACHE: { get: kvGet, put: kvPut } }),
      INTERNAL_LINKS_TOKEN: 'internal-links-token',
      SHORT_LINKS_PUBLIC_BASE_URL: 'https://go.nabatable.com',
      BOOKING_SITE_URL: 'https://nabatable.com',
      DEPLOY_SHA: 'deadbeef',
      CF_VERSION_METADATA: { id: 'ver-123', tag: 'v1.2.3', timestamp: '2026-09-04T00:00:00Z' },
      ...(options.withToken === false ? {} : { MONITORING_TOKEN: TOKEN }),
    },
  };
}

function ready(authorization?: string): Request {
  const headers = new Headers();
  if (authorization) headers.set('authorization', authorization);
  return new Request('https://go.nabatable.com/ready', { headers });
}

describe('booking-short-links GET /ready', () => {
  it('keeps /health unauthenticated and unchanged', async () => {
    const { env } = makeEnv();
    const response = await bookingShortLinkWorker.fetch(
      new Request('https://go.nabatable.com/health'),
      env,
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: 'ok',
      service: 'booking-short-links',
    });
  });

  it('rejects missing, wrong, and unconfigured tokens without touching bindings', async () => {
    const { env, queries, kvGet } = makeEnv();
    for (const request of [ready(), ready('Bearer wrong'), ready(TOKEN)]) {
      const response = await bookingShortLinkWorker.fetch(request, env);
      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
      expect(response.headers.get('cache-control')).toBe('no-store');
    }
    const unconfigured = makeEnv({ withToken: false });
    expect(
      (await bookingShortLinkWorker.fetch(ready(`Bearer ${TOKEN}`), unconfigured.env)).status,
    ).toBe(401);
    expect(queries).toEqual([]);
    expect(kvGet).not.toHaveBeenCalled();
    expect(unconfigured.queries).toEqual([]);
  });

  it('reports D1 and KV readiness with revision passthrough using read-only calls', async () => {
    const { env, queries, run, kvGet, kvPut } = makeEnv();
    const response = await bookingShortLinkWorker.fetch(ready(`Bearer ${TOKEN}`), env);
    const body = (await response.json()) as {
      service: string;
      status: string;
      revision: string;
      deploymentId: string;
      versionTag: string;
      checks: Array<{ name: string; status: string; latencyMs: number }>;
    };

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(body).toMatchObject({
      service: 'booking-short-links',
      status: 'ok',
      revision: 'deadbeef',
      deploymentId: 'ver-123',
      versionTag: 'v1.2.3',
    });
    expect(body.checks.map((check) => [check.name, check.status])).toEqual([
      ['d1', 'ok'],
      ['kv-cache', 'ok'],
    ]);
    expect(queries).toEqual(['select 1 as ready']);
    expect(run).not.toHaveBeenCalled();
    expect(kvGet).toHaveBeenCalledWith('readiness:sentinel', 'json');
    expect(kvPut).not.toHaveBeenCalled();
    expect(JSON.stringify(body)).not.toContain(TOKEN);
  });

  it('returns 503 when D1 fails and degraded when the KV cache binding is absent', async () => {
    const failing = makeEnv({ d1Fails: true });
    const down = await bookingShortLinkWorker.fetch(ready(`Bearer ${TOKEN}`), failing.env);
    expect(down.status).toBe(503);
    const downBody = await down.text();
    expect(downBody).toContain('"status":"down"');
    expect(downBody).not.toContain('database unavailable');

    const noCache = makeEnv({ withCache: false });
    const degraded = await bookingShortLinkWorker.fetch(ready(`Bearer ${TOKEN}`), noCache.env);
    expect(degraded.status).toBe(200);
    await expect(degraded.json()).resolves.toMatchObject({
      status: 'degraded',
      checks: [
        { name: 'd1', status: 'ok' },
        { name: 'kv-cache', status: 'degraded', detail: 'unconfigured' },
      ],
    });
  });
});
