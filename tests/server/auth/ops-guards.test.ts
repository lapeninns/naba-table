import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getRouteHandlerSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/supabase', () => ({
  getRouteHandlerSupabaseClient: getRouteHandlerSupabaseClientMock,
}));

import { withOpsMutation } from '@/server/auth/guards';

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
