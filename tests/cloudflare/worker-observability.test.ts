import { describe, expect, it, vi } from 'vitest';

import {
  buildErrorInsightRequest,
  observeWorkerRequest,
  redactLogFields,
} from '@/cloudflare/shared/observability';

describe('Cloudflare Worker observability', () => {
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
});
