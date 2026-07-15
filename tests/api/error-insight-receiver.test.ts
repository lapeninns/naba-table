import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

describe('error insight webhook receiver', () => {
  beforeEach(() => {
    vi.stubEnv('ERROR_INSIGHT_RECEIVER_TOKEN', 'receiver-secret');
    vi.stubEnv('ERROR_INSIGHT_GITHUB_TOKEN', 'github-token');
    vi.stubEnv('ERROR_INSIGHT_GITHUB_REPOSITORY', 'lapeninns/nabatable');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('authenticates, validates, and dispatches safe error metadata', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetcher);

    const response = await POST(
      new NextRequest('https://app.nabatable.com/api/webhook/error-insight', {
        method: 'POST',
        headers: {
          authorization: 'Bearer receiver-secret',
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
      }),
    );

    expect(response.status).toBe(202);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const dispatchBody = await new Response(fetcher.mock.calls[0]?.[1]?.body).json();
    expect(dispatchBody).toMatchObject({
      event_type: 'runtime-error',
      client_payload: {
        service: 'booking-short-links',
        trace_id: 'trace-123',
        fingerprint: 'booking-short-links:POST:/internal/links',
      },
    });
    expect(JSON.stringify(dispatchBody)).not.toContain('provider unavailable');
  });

  it('rejects unauthorized requests before dispatch', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);

    const response = await POST(
      new NextRequest('https://app.nabatable.com/api/webhook/error-insight', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    );

    expect(response.status).toBe(401);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
