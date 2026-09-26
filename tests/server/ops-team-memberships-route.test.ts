import { beforeEach, describe, expect, it, vi } from 'vitest';

const getRouteHandlerSupabaseClientMock = vi.hoisted(() => vi.fn());
const fetchUserMembershipsMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/supabase', () => ({
  getRouteHandlerSupabaseClient: getRouteHandlerSupabaseClientMock,
}));

vi.mock('@/server/team/access', () => ({
  fetchUserMemberships: fetchUserMembershipsMock,
}));

import { GET } from '@/src/app/api/ops/team/memberships/route';

const RESTAURANT_A = '44444444-4444-4444-8444-444444444444';
const RESTAURANT_B = '55555555-5555-4555-8555-555555555555';

function mockAuthenticatedSupabase(userId = 'user-123') {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: userId } },
        error: null,
      }),
    },
  };
}

describe('GET /api/ops/team/memberships', () => {
  beforeEach(() => {
    getRouteHandlerSupabaseClientMock.mockReset();
    fetchUserMembershipsMock.mockReset();
  });

  it('@api @security requires authentication before loading memberships', async () => {
    getRouteHandlerSupabaseClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    });

    const response = await GET();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Authentication required' });
    expect(fetchUserMembershipsMock).not.toHaveBeenCalled();
  });

  it('@api @security maps supabase auth failures to 401 UNAUTHENTICATED', async () => {
    getRouteHandlerSupabaseClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: { status: 401, message: 'invalid JWT' },
        }),
      },
    });

    const response = await GET();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: 'Authentication required',
      code: 'UNAUTHENTICATED',
    });
    expect(fetchUserMembershipsMock).not.toHaveBeenCalled();
  });

  it("@api @security scopes the membership lookup to the caller's own user id", async () => {
    getRouteHandlerSupabaseClientMock.mockResolvedValue(mockAuthenticatedSupabase('user-789'));
    fetchUserMembershipsMock.mockResolvedValue([]);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(fetchUserMembershipsMock).toHaveBeenCalledTimes(1);
    expect(fetchUserMembershipsMock).toHaveBeenCalledWith('user-789');
  });

  it('@api returns memberships with restaurant details and id fallbacks', async () => {
    getRouteHandlerSupabaseClientMock.mockResolvedValue(mockAuthenticatedSupabase('user-123'));
    fetchUserMembershipsMock.mockResolvedValue([
      {
        restaurant_id: RESTAURANT_A,
        role: 'owner',
        restaurants: { id: RESTAURANT_A, name: 'Cafe Alpha', slug: 'cafe-alpha' },
      },
      {
        restaurant_id: RESTAURANT_B,
        role: 'host',
        restaurants: null,
      },
    ]);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      memberships: [
        {
          restaurantId: RESTAURANT_A,
          role: 'owner',
          restaurant: { id: RESTAURANT_A, name: 'Cafe Alpha', slug: 'cafe-alpha' },
        },
        {
          restaurantId: RESTAURANT_B,
          role: 'host',
          restaurant: { id: RESTAURANT_B, name: null, slug: null },
        },
      ],
    });
  });

  it('@api returns a generic 500 when membership loading fails', async () => {
    getRouteHandlerSupabaseClientMock.mockResolvedValue(mockAuthenticatedSupabase());
    fetchUserMembershipsMock.mockRejectedValue(new Error('memberships table unavailable'));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      error: 'Unable to load memberships',
      code: 'INTERNAL_ERROR',
      message: 'Unable to load memberships',
    });
    expect(JSON.stringify(body)).not.toContain('memberships table unavailable');
  });
});
