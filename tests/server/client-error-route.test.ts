import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireApiRateLimitMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/security/api-rate-limit', () => ({
  requireApiRateLimit: requireApiRateLimitMock,
}));

import { POST } from '@/src/app/api/client-error/route';

describe('client error route', () => {
  beforeEach(() => {
    requireApiRateLimitMock.mockReset().mockResolvedValue(null);
  });

  it('rate limits before parsing client error payloads', async () => {
    requireApiRateLimitMock.mockResolvedValueOnce(
      NextResponse.json({ error: 'Too many client error reports' }, { status: 429 }),
    );

    const request = new NextRequest('https://www.nabatable.com/api/client-error', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{bad-json',
    });

    const response = await POST(request);

    expect(response.status).toBe(429);
    expect(requireApiRateLimitMock).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'client-error' }),
    );
  });

  it('rejects oversized client error bodies', async () => {
    const response = await POST(
      new NextRequest('https://www.nabatable.com/api/client-error', {
        method: 'POST',
        headers: { 'content-length': String(17 * 1024) },
        body: JSON.stringify({ message: 'too large' }),
      }),
    );

    expect(response.status).toBe(413);
  });
});
