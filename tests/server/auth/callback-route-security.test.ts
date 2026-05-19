import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getRouteHandlerSupabaseClientMock = vi.hoisted(() => vi.fn());
const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());
const cookiesMock = vi.hoisted(() => vi.fn());

vi.mock('next/headers', () => ({
  cookies: cookiesMock,
}));

vi.mock('@/server/supabase', () => ({
  getRouteHandlerSupabaseClient: getRouteHandlerSupabaseClientMock,
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

import { GET } from '@/src/app/api/auth/callback/route';

describe('auth callback security', () => {
  beforeEach(() => {
    getRouteHandlerSupabaseClientMock.mockReset();
    getServiceSupabaseClientMock.mockReset();
    cookiesMock.mockReset();
    cookiesMock.mockResolvedValue({ getAll: () => [] });
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = 'nabatable.com';
    process.env.NEXT_PUBLIC_SITE_URL = 'https://www.nabatable.com';
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.nabatable.com';
  });

  it('redacts token-bearing callback values from logs', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    getRouteHandlerSupabaseClientMock.mockResolvedValue({
      auth: {
        verifyOtp: vi.fn().mockResolvedValue({
          data: { session: { user: { id: 'user-1', email: 'guest@example.com' } } },
          error: null,
        }),
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1', email: 'guest@example.com' } },
          error: null,
        }),
      },
    });
    getServiceSupabaseClientMock.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
    });

    await GET(
      new NextRequest(
        'https://evilnabatable.com/api/auth/callback?token_hash=secret-token&redirectedFrom=https%3A%2F%2Fevilnabatable.com%2Fguest&access_token=access-secret&refresh_token=refresh-secret',
        {
          headers: {
            host: 'evilnabatable.com',
            origin: 'https://evilnabatable.com',
            referer: 'https://evilnabatable.com/start?code=referer-secret',
            'x-forwarded-host': 'evilnabatable.com',
          },
        },
      ),
    );

    const logOutput = JSON.stringify([...logSpy.mock.calls, ...warnSpy.mock.calls]);
    expect(logOutput).not.toContain('secret-token');
    expect(logOutput).not.toContain('access-secret');
    expect(logOutput).not.toContain('refresh-secret');
    expect(logOutput).not.toContain('referer-secret');
    expect(logOutput).not.toContain('https://evilnabatable.com/guest');
    logSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('does not let forged host headers choose callback redirect origins', async () => {
    getRouteHandlerSupabaseClientMock.mockResolvedValue({
      auth: {
        verifyOtp: vi.fn().mockResolvedValue({
          data: { session: { user: { id: 'user-1', email: 'guest@example.com' } } },
          error: null,
        }),
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1', email: 'guest@example.com' } },
          error: null,
        }),
      },
    });
    getServiceSupabaseClientMock.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
    });

    const response = await GET(
      new NextRequest(
        'https://evilnabatable.com/api/auth/callback?token_hash=secret-token&redirectedFrom=%2Fguest%2Fdashboard',
        {
          headers: {
            host: 'evilnabatable.com',
            origin: 'https://evilnabatable.com',
            referer: 'https://evilnabatable.com/start',
            'x-forwarded-host': 'evilnabatable.com',
          },
        },
      ),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://www.nabatable.com/guest/dashboard');
  });

  it('does not let forwarded headers switch root-host callbacks into app redirects', async () => {
    getRouteHandlerSupabaseClientMock.mockResolvedValue({
      auth: {
        verifyOtp: vi.fn().mockResolvedValue({
          data: { session: { user: { id: 'user-1', email: 'guest@example.com' } } },
          error: null,
        }),
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1', email: 'guest@example.com' } },
          error: null,
        }),
      },
    });
    getServiceSupabaseClientMock.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
    });

    const response = await GET(
      new NextRequest(
        'https://www.nabatable.com/api/auth/callback?token_hash=secret-token&redirectedFrom=%2Fdashboard',
        {
          headers: {
            'x-forwarded-host': 'app.nabatable.com',
            origin: 'https://app.nabatable.com',
            referer: 'https://app.nabatable.com/dashboard',
          },
        },
      ),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://www.nabatable.com/guest/dashboard');
  });

  it('rejects suffix-bypass absolute redirects', async () => {
    getRouteHandlerSupabaseClientMock.mockResolvedValue({
      auth: {
        verifyOtp: vi.fn().mockResolvedValue({
          data: { session: { user: { id: 'user-1', email: 'guest@example.com' } } },
          error: null,
        }),
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1', email: 'guest@example.com' } },
          error: null,
        }),
      },
    });
    getServiceSupabaseClientMock.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
    });

    const response = await GET(
      new NextRequest(
        'https://www.nabatable.com/api/auth/callback?token_hash=secret-token&redirectedFrom=https%3A%2F%2Fevilnabatable.com%2Fguest%2Fdashboard',
      ),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://www.nabatable.com/guest/dashboard');
  });

  it('rejects backslash-normalized relative redirects', async () => {
    getRouteHandlerSupabaseClientMock.mockResolvedValue({
      auth: {
        verifyOtp: vi.fn().mockResolvedValue({
          data: { session: { user: { id: 'user-1', email: 'guest@example.com' } } },
          error: null,
        }),
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1', email: 'guest@example.com' } },
          error: null,
        }),
      },
    });
    getServiceSupabaseClientMock.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
    });

    const response = await GET(
      new NextRequest(
        'https://www.nabatable.com/api/auth/callback?token_hash=secret-token&redirectedFrom=%2F%5Cevil.example%2Fguest',
      ),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://www.nabatable.com/guest/dashboard');
  });

  it('@p1 @security does not use the service-role customer linker when getUser returns no verified user', async () => {
    getRouteHandlerSupabaseClientMock.mockResolvedValue({
      auth: {
        verifyOtp: vi.fn().mockResolvedValue({
          data: { session: { user: { id: 'user-1', email: 'guest@example.com' } } },
          error: null,
        }),
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
    });

    await GET(
      new NextRequest(
        'https://www.nabatable.com/api/auth/callback?token_hash=secret-token&redirectedFrom=%2Fguest%2Fdashboard',
      ),
    );

    expect(getServiceSupabaseClientMock).not.toHaveBeenCalled();
  });
});
