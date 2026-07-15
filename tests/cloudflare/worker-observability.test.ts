import { describe, expect, it, vi } from 'vitest';

import {
  buildErrorInsightRequest,
  observeWorkerRequest,
  redactLogFields,
} from '@/cloudflare/shared/observability';
import { resolveWorkerActorContext } from '@/cloudflare/shared/error-context';
import { buildPostHogCaptureRequest, capturePostHogEvent } from '@/cloudflare/shared/posthog';

describe('Cloudflare Worker observability', () => {
  it('hashes authenticated actor context before analytics capture', async () => {
    const actor = await resolveWorkerActorContext(
      new Request('https://worker.test/internal/run', {
        headers: { 'x-ops-user-id': '11111111-1111-4111-8111-111111111111' },
      }),
      'test-worker',
    );

    expect(actor.actorType).toBe('authenticated_ops');
    expect(actor.distinctId).toMatch(/^ops:[0-9a-f]{32}$/u);
    expect(actor.distinctId).not.toContain('11111111');
  });

  it('builds a PII-safe PostHog usage event with trace and deployment context', async () => {
    const request = buildPostHogCaptureRequest({
      apiKey: 'phc_project_key',
      host: 'https://eu.i.posthog.com',
      event: 'worker_http_request_completed',
      distinctId: 'test-worker',
      properties: {
        service: 'test-worker',
        traceId: 'trace-1',
        deploySha: 'abc123',
        email: 'guest@example.com',
      },
    });

    expect(request.url).toBe('https://eu.i.posthog.com/capture/');
    await expect(new Response(request.init.body).json()).resolves.toMatchObject({
      api_key: 'phc_project_key',
      event: 'worker_http_request_completed',
      properties: {
        distinct_id: 'test-worker',
        service: 'test-worker',
        traceId: 'trace-1',
        deploySha: 'abc123',
        email: '[REDACTED]',
      },
    });
  });

  it('surfaces rejected PostHog captures to the background-task boundary', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 503 }));

    await expect(
      capturePostHogEvent({
        apiKey: 'phc_project_key',
        host: 'https://eu.i.posthog.com',
        event: 'worker_http_request_completed',
        distinctId: 'test-worker',
        properties: { traceId: 'trace-1' },
        fetcher,
      }),
    ).rejects.toThrow('PostHog capture returned 503.');
  });

  it('builds a redacted error-to-insight webhook request', async () => {
    const request = buildErrorInsightRequest({
      url: 'https://insights.example.test/events',
      token: 'webhook-token',
      service: 'test-worker',
      event: 'delivery.failed',
      fields: { recipient: '+447700900123', bookingId: 'booking-1' },
    });

    expect(request.url).toBe('https://insights.example.test/events');
    expect(new Headers(request.init.headers).get('authorization')).toBe('Bearer webhook-token');
    await expect(new Response(request.init.body).json()).resolves.toMatchObject({
      service: 'test-worker',
      event: 'delivery.failed',
      fields: { recipient: '[REDACTED]', bookingId: 'booking-1' },
    });
  });

  it('redacts secrets and PII recursively before serialization', () => {
    expect(
      redactLogFields({
        bookingId: 'booking-1',
        authorization: 'Bearer secret-token',
        customer: { email: 'guest@example.com', phone: '+447700900123' },
      }),
    ).toEqual({
      bookingId: 'booking-1',
      authorization: '[REDACTED]',
      customer: { email: '[REDACTED]', phone: '[REDACTED]' },
    });
  });

  it('propagates trace context and emits a structured completion record', async () => {
    const sink = vi.fn();
    const response = await observeWorkerRequest({
      request: new Request('https://worker.test/health', {
        headers: {
          traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
          'x-request-id': 'request-123',
        },
      }),
      service: 'test-worker',
      deploySha: 'abc123',
      sink,
      now: (() => {
        const values = [100, 112];
        return () => values.shift() ?? 112;
      })(),
      handler: async () => new Response('ok', { status: 200 }),
    });

    expect(response.headers.get('x-request-id')).toBe('request-123');
    expect(response.headers.get('traceparent')).toContain('00-4bf92f3577b34da6a3ce929d0e0e4736-');
    expect(response.headers.get('server-timing')).toBe('app;dur=12');
    expect(JSON.parse(sink.mock.calls[0]?.[0] as string)).toMatchObject({
      level: 'info',
      event: 'http.request.completed',
      service: 'test-worker',
      requestId: 'request-123',
      traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
      deploySha: 'abc123',
      status: 200,
      durationMs: 12,
    });
  });

  it('captures contextual Worker exceptions in PostHog without blocking the response', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    const backgroundTasks: Promise<unknown>[] = [];
    vi.stubGlobal('fetch', fetcher);

    try {
      await expect(
        observeWorkerRequest({
          request: new Request('https://worker.test/internal/run'),
          service: 'test-worker',
          deploySha: 'abc123',
          posthog: {
            apiKey: 'phc_project_key',
            host: 'https://eu.i.posthog.com',
            waitUntil: (promise) => backgroundTasks.push(promise),
          },
          handler: async () => {
            throw new Error('provider unavailable');
          },
        }),
      ).rejects.toThrow('provider unavailable');

      await Promise.all(backgroundTasks);
      expect(fetcher).toHaveBeenCalledTimes(1);
      await expect(new Response(fetcher.mock.calls[0]?.[1]?.body).json()).resolves.toMatchObject({
        event: '$exception',
        properties: {
          distinct_id: 'test-worker:anonymous',
          deploySha: 'abc123',
          actorType: 'anonymous',
          $exception_list: [
            {
              type: 'Error',
              value: 'provider unavailable',
              mechanism: { handled: false, type: 'middleware' },
            },
          ],
          $exception_level: 'error',
          $breadcrumbs: [{ category: 'http.request', level: 'error' }],
        },
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
