import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getRouteHandlerSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/supabase', () => ({
  getRouteHandlerSupabaseClient: getRouteHandlerSupabaseClientMock,
}));

import { isPlatformAdminUser, withOpsMutation, withPlatformAdminAuthorization } from '@/server/auth/guards';

function mockSessionUser(user: { id: string; email?: string | null } | null) {
  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    },
  };
  getRouteHandlerSupabaseClientMock.mockResolvedValue(client);
  return client;
}

describe('ops route guards', () => {
  beforeEach(() => {
    getRouteHandlerSupabaseClientMock.mockReset();
  });

  it('does not authenticate safe methods from x-ops-user-id alone', async () => {
    const client = mockSessionUser(null);
    const request = new NextRequest('https://app.nabatable.com/api/ops/bookings', {
      headers: {
        'x-ops-user-id': '11111111-1111-4111-8111-111111111111',
      },
    });

    const result = await withOpsMutation(request);

    expect(client.auth.getUser).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(419);
    }
  });

  it('authenticates safe methods from the resolved Supabase session', async () => {
    const user = {
      id: '22222222-2222-4222-8222-222222222222',
      email: 'owner@example.com',
    };
    mockSessionUser(user);
    const request = new NextRequest('https://app.nabatable.com/api/ops/bookings', {
      headers: {
        'x-ops-user-id': '11111111-1111-4111-8111-111111111111',
      },
    });

    const result = await withOpsMutation(request);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.user).toBe(user);
    }
  });
});

describe('platform admin signal', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('matches the user id or email lists case-insensitively and never matches without a user', () => {
    vi.stubEnv('PLATFORM_ADMIN_USER_IDS', ' AAAAAAAA-0000-4000-8000-000000000001 ,other');
    vi.stubEnv('PLATFORM_ADMIN_EMAILS', 'Ops@Nabatable.test');

    expect(isPlatformAdminUser({ id: 'aaaaaaaa-0000-4000-8000-000000000001', email: null })).toBe(
      true,
    );
    expect(isPlatformAdminUser({ id: 'someone-else', email: ' ops@nabatable.test ' })).toBe(true);
    expect(isPlatformAdminUser({ id: 'someone-else', email: 'owner@example.com' })).toBe(false);
    expect(isPlatformAdminUser({ id: 'someone-else', email: '' })).toBe(false);
    expect(isPlatformAdminUser(null)).toBe(false);
  });

  it('is false when the lists are empty', () => {
    vi.stubEnv('PLATFORM_ADMIN_USER_IDS', '');
    vi.stubEnv('PLATFORM_ADMIN_EMAILS', '');
    expect(isPlatformAdminUser({ id: 'x', email: 'x@example.com' })).toBe(false);
  });

  it('keeps the route guard authoritative with the same rule', async () => {
    vi.stubEnv('PLATFORM_ADMIN_USER_IDS', '');
    vi.stubEnv('PLATFORM_ADMIN_EMAILS', 'ops@nabatable.test');
    getRouteHandlerSupabaseClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'u-1', email: 'owner@example.com' } },
          error: null,
        }),
      },
    });

    const result = await withPlatformAdminAuthorization(
      new NextRequest('https://app.nabatable.com/api/ops/occasions'),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
      expect((await result.response.json()).code).toBe('PLATFORM_ADMIN_REQUIRED');
    }
  });
});
