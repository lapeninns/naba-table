import { NextRequest } from 'next/server';
import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { setErrorInsightIncidentStore } from '@/lib/observability/error-insight';
import { createInMemoryIncidentStore } from '@/lib/observability/incidents';
import { POST } from '@/src/app/api/webhook/error-insight/route';

const payload = {
  timestamp: '2026-07-15T16:00:00.000Z',
  service: 'booking-short-links',
  event: 'http.request.failed',
  fields: {
    traceId: 'trace-123',
    deploySha: 'abc123',
    requestId: 'request-123',
    method: 'POST',
    path: '/internal/links',
    error: 'provider unavailable',
  },
};

function post(body: unknown = payload): Promise<Response> {
  return POST(
    new NextRequest('https://app.nabatable.com/api/webhook/error-insight', {
      method: 'POST',
      headers: {
        authorization: 'Bearer receiver-secret',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    }),
  );
}

async function dispatchPayload(
  fetcher: ReturnType<typeof vi.fn>,
  callIndex: number,
): Promise<Record<string, unknown>> {
  const body = (await new Response(fetcher.mock.calls[callIndex]?.[1]?.body).json()) as {
    client_payload: Record<string, unknown>;
  };
  return body.client_payload;
}

describe('error insight webhook incident dedupe', () => {
  beforeEach(() => {
    vi.stubEnv('ERROR_INSIGHT_RECEIVER_TOKEN', 'receiver-secret');
    vi.stubEnv('ERROR_INSIGHT_GITHUB_TOKEN', 'github-token');
    vi.stubEnv('ERROR_INSIGHT_GITHUB_REPOSITORY', 'lapeninns/nabatable');
    vi.stubEnv('APP_ENV', 'staging');
    setErrorInsightIncidentStore(createInMemoryIncidentStore());
  });

  afterEach(() => {
    setErrorInsightIncidentStore(null);
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('opens one incident and then updates it instead of opening duplicates', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetcher);

    const first = await post();
    const second = await post();

    expect(first.status).toBe(202);
    expect(second.status).toBe(202);
    expect(fetcher).toHaveBeenCalledTimes(2);

    const opened = await dispatchPayload(fetcher, 0);
    const updated = await dispatchPayload(fetcher, 1);
    expect(opened).toMatchObject({
      service: 'booking-short-links',
      environment: 'staging',
      failure_class: `POST:sha256:${createHash('sha256').update('/internal/links').digest('hex')}`,
      severity: 'critical',
      incident_action: 'opened',
      occurrence_count: 1,
    });
    expect(updated).toMatchObject({ incident_action: 'updated', occurrence_count: 2 });
    expect(updated.incident_id).toBe(opened.incident_id);
    expect(JSON.stringify(opened)).not.toContain('provider unavailable');
  });

  it('stops dispatching after the bounded update budget and persists occurrence counts', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetcher);

    let last: Response | null = null;
    for (let index = 0; index < 12; index += 1) {
      last = await post();
    }

    expect(fetcher).toHaveBeenCalledTimes(10);
    expect(last?.status).toBe(202);
    await expect(last?.json()).resolves.toMatchObject({
      accepted: true,
      incident: { transition: 'suppressed', occurrenceCount: 12, summarizedFailures: 2 },
    });
  });

  it('keeps separate incidents per service, environment, and failure class', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetcher);

    await post();
    await post({ ...payload, fields: { ...payload.fields, path: '/r/other' } });
    await post({ ...payload, service: 'sms-summary-gateway' });

    const actions = await Promise.all([0, 1, 2].map((index) => dispatchPayload(fetcher, index)));
    expect(actions.map((entry) => entry.incident_action)).toEqual(['opened', 'opened', 'opened']);
    expect(new Set(actions.map((entry) => entry.incident_id)).size).toBe(3);
  });

  it('escalates a critical incident left unacknowledged for 15 minutes', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-15T16:00:00.000Z'));
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetcher);

    await post();
    vi.setSystemTime(new Date('2026-07-15T16:16:00.000Z'));
    const response = await post();

    expect(response.status).toBe(202);
    await expect(dispatchPayload(fetcher, 1)).resolves.toMatchObject({
      incident_action: 'escalated',
    });
    vi.useRealTimers();
  });

  it('fails closed without dispatch or leaking database errors when persistence fails', async () => {
    const store = createInMemoryIncidentStore();
    const failure = async () => {
      throw new Error('database provider-secret guest@example.test');
    };
    setErrorInsightIncidentStore({ ...store, getActive: failure, update: failure });
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const response = await post();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'Incident persistence unavailable' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('still returns 502 when GitHub rejects the dispatch', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 500 })));

    expect((await post()).status).toBe(502);
  });
});
