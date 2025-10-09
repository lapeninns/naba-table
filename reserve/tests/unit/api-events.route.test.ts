import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { POST } from '@/app/api/events/route';

function createRequest(payload: unknown) {
  return new NextRequest('http://example.com/api/events', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

describe('POST /api/events', () => {
  const consoleDebug = console.debug;
  const consoleError = console.error;

  beforeEach(() => {
    console.debug = vi.fn();
    console.error = vi.fn();
  });

  afterEach(() => {
    console.debug = consoleDebug;
    console.error = consoleError;
  });

  it('accepts valid analytics payloads', async () => {
    const payload: Record<string, unknown> = {
      events: [
        {
          name: 'booking_edit_submitted',
          ts: new Date().toISOString(),
          user: { anonId: 'anon-1', emailHash: 'deadbeef' },
          context: { route: '/my-bookings', version: 'web-dev' },
          props: { bookingId: 'booking-1' },
        },
      ],
    };

    const response = await POST(createRequest(payload));

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ ok: true, count: 1 });
  });

  it('rejects invalid payloads', async () => {
    const payload: Record<string, unknown> = {
      events: [
        {
          name: '',
          ts: 'not-a-date',
          user: { anonId: 123 },
          context: { route: 42, version: null },
          props: null,
        },
      ],
    };

    const response = await POST(createRequest(payload));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Invalid analytics payload' });
  });
});
