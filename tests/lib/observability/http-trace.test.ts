import { describe, expect, it } from 'vitest';

import { observeHttpRequest } from '@/lib/observability/http-trace';

describe('root HTTP trace propagation', () => {
  it('continues a valid W3C trace and preserves a safe request ID @contract', async () => {
    const traceId = '4bf92f3577b34da6a3ce929d0e0e4736';
    const request = new Request('https://app.nabatable.com/api/health', {
      headers: {
        traceparent: `00-${traceId}-00f067aa0ba902b7-01`,
        'x-request-id': 'request-123',
      },
    });

    const response = await observeHttpRequest(request, async () => Response.json({ ok: true }));

    expect(response.headers.get('traceparent')).toMatch(
      new RegExp(`^00-${traceId}-[0-9a-f]{16}-01$`, 'u'),
    );
    expect(response.headers.get('x-request-id')).toBe('request-123');
    expect(response.headers.get('server-timing')).toMatch(/^app;dur=\d+$/u);
  });

  it('creates trace context when incoming headers are absent @contract', async () => {
    const response = await observeHttpRequest(
      new Request('https://app.nabatable.com/api/health'),
      async () => new Response(null, { status: 204 }),
    );

    expect(response.headers.get('traceparent')).toMatch(
      /^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/u,
    );
    expect(response.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/u);
  });
});
