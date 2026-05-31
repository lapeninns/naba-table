import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

const cookieSetMock = vi.hoisted(() => vi.fn());

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    set: cookieSetMock,
  })),
}));

import { GET } from '@/src/app/api/auth/qa-bypass/route';

describe('QA auth bypass route security', () => {
  afterEach(() => {
    delete process.env.QA_ENABLE_AUTH_FIXTURES;
    cookieSetMock.mockReset();
  });

  it('is disabled unless QA auth fixtures are explicitly enabled', async () => {
    const response = await GET(
      new NextRequest('https://app.nabatable.com/api/auth/qa-bypass?redirect=/settings/restaurant'),
    );

    expect(response.status).toBe(403);
  });

  it('keeps enabled fixture redirects on a local path', async () => {
    process.env.QA_ENABLE_AUTH_FIXTURES = '1';

    const response = await GET(
      new NextRequest('https://app.nabatable.com/api/auth/qa-bypass?redirect=https://evil.example/', {
        headers: {
          host: 'app.localhost:5180',
        },
      }),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://app.localhost:5180/settings/restaurant');
    expect(cookieSetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: '__nabatable_qa_ops_auth',
        value: 'enabled',
      }),
    );
  });
});
