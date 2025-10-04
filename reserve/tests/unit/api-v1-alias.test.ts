import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

import { GET, POST } from '@/app/api/v1/events/route';

function createPost(payload: unknown) {
  return new NextRequest('http://example.com/api/v1/events', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('API v1 alias routes', () => {
  it('GET /api/v1/events responds OK', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
  });

  it('POST /api/v1/events forwards to existing handler', async () => {
    const payload = {
      events: [
        {
          name: 'test',
          ts: new Date().toISOString(),
          user: { anonId: 'x' },
          context: { route: '/', version: 'v' },
          props: {},
        },
      ],
    };
    const res = await POST(createPost(payload));
    expect([200, 202]).toContain(res.status);
  });
});
