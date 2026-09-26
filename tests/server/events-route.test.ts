import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

import { POST } from '@/src/app/api/events/route';

const VALID_EVENT = {
  name: 'booking_started',
  ts: '2026-09-26T12:00:00.000Z',
  user: { anonId: 'anon-1' },
  context: { route: '/reserve', version: '1' },
  props: {},
};

function eventsRequest(body: string) {
  return new NextRequest('https://www.nabatable.com/api/events', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  });
}

describe('POST /api/events', () => {
  it('accepts a valid batch', async () => {
    const response = await POST(eventsRequest(JSON.stringify({ events: [VALID_EVENT] })));

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ ok: true, count: 1 });
  });

  it('returns 400 INVALID_ANALYTICS_PAYLOAD for an invalid event', async () => {
    const response = await POST(eventsRequest(JSON.stringify({ events: [{ name: 'x' }] })));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid analytics payload.',
      code: 'INVALID_ANALYTICS_PAYLOAD',
      message: 'Invalid analytics payload.',
    });
  });

  it('returns 400 for malformed JSON', async () => {
    const response = await POST(eventsRequest('{not json'));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'INVALID_ANALYTICS_PAYLOAD' });
  });

  it('returns a generic 500 without raw failure text on unexpected errors', async () => {
    const request = eventsRequest(JSON.stringify({ events: [VALID_EVENT] }));
    Object.defineProperty(request, 'json', {
      value: () =>
        Promise.resolve({
          events: new Proxy([VALID_EVENT], {
            get(target, prop, receiver) {
              if (prop === 'every') {
                throw new Error('SECRET_INTERNAL_DETAIL analytics sink exploded');
              }
              return Reflect.get(target, prop, receiver);
            },
          }),
        }),
    });

    const response = await POST(request);

    expect(response.status).toBe(500);
    const text = await response.text();
    expect(text).not.toContain('SECRET_INTERNAL_DETAIL');
    expect(JSON.parse(text)).toMatchObject({ code: 'INTERNAL_ERROR' });
  });
});
