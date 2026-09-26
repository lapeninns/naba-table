import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getRouteHandlerSupabaseClientMock = vi.hoisted(() => vi.fn());
const requireMembershipForRestaurantMock = vi.hoisted(() => vi.fn());
const buildOperationsHubMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/supabase', () => ({
  getRouteHandlerSupabaseClient: getRouteHandlerSupabaseClientMock,
}));

vi.mock('@/server/team/access', () => ({
  requireMembershipForRestaurant: requireMembershipForRestaurantMock,
}));

vi.mock('@/server/ops/operations-hub', () => ({
  buildOperationsHub: buildOperationsHubMock,
}));

import { GET } from '@/src/app/api/ops/operations-hub/route';

const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111';
const ZONE_ID = '22222222-2222-4222-8222-222222222222';

const HUB_PAYLOAD = {
  date: '2026-07-11',
  timezone: 'Europe/London',
  window: { start: '17:00', end: '23:00' },
  tables: [{ id: 'table-1', name: 'T1', capacity: 4, zone: 'Main', zoneId: ZONE_ID }],
  reservations: [
    {
      id: 'table-1:start:end:reserved:booking:none',
      tableId: 'table-1',
      name: 'Ada Lovelace',
      guests: 2,
      start: '18:00',
      end: '20:00',
      status: 'arriving',
      bookingId: 'booking-1',
    },
  ],
  kpis: { occupancyPercentage: 50, turnRateMinutes: 120, bookingsCount: 1, alertsCount: 0 },
  feed: [
    {
      id: 'feed:sync',
      time: '12:00:00',
      title: 'Live sync',
      detail: 'Timeline updated',
      priority: 'log',
    },
  ],
};

function request(query: string) {
  return new NextRequest(`https://app.nabatable.com/api/ops/operations-hub${query}`);
}

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

describe('GET /api/ops/operations-hub', () => {
  beforeEach(() => {
    getRouteHandlerSupabaseClientMock.mockReset();
    requireMembershipForRestaurantMock.mockReset();
    buildOperationsHubMock.mockReset();
  });

  it.each([
    ['missing restaurantId', '?date=2026-07-11'],
    ['non-uuid restaurantId', '?restaurantId=not-a-uuid'],
    ['malformed date', `?restaurantId=${RESTAURANT_ID}&date=11-07-2026`],
    ['unknown service', `?restaurantId=${RESTAURANT_ID}&service=brunch`],
    ['non-uuid zoneId', `?restaurantId=${RESTAURANT_ID}&zoneId=main-floor`],
  ])('@api rejects %s with 400 before touching auth', async (_name, query) => {
    const response = await GET(request(query));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Invalid query' });
    expect(getRouteHandlerSupabaseClientMock).not.toHaveBeenCalled();
    expect(buildOperationsHubMock).not.toHaveBeenCalled();
  });

  it('@api @security requires authentication before building the hub payload', async () => {
    getRouteHandlerSupabaseClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    });

    const response = await GET(request(`?restaurantId=${RESTAURANT_ID}`));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Authentication required' });
    expect(requireMembershipForRestaurantMock).not.toHaveBeenCalled();
    expect(buildOperationsHubMock).not.toHaveBeenCalled();
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

    const response = await GET(request(`?restaurantId=${RESTAURANT_ID}`));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: 'Authentication required',
      code: 'UNAUTHENTICATED',
    });
    expect(buildOperationsHubMock).not.toHaveBeenCalled();
  });

  it('@api @security rejects cross-tenant access with 403 before building the hub', async () => {
    getRouteHandlerSupabaseClientMock.mockResolvedValue(mockAuthenticatedSupabase('user-123'));
    requireMembershipForRestaurantMock.mockRejectedValue(new Error('membership denied'));

    const response = await GET(request(`?restaurantId=${RESTAURANT_ID}`));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'Forbidden' });
    expect(requireMembershipForRestaurantMock).toHaveBeenCalledWith({
      userId: 'user-123',
      restaurantId: RESTAURANT_ID,
    });
    expect(buildOperationsHubMock).not.toHaveBeenCalled();
  });

  it('@api returns the operations hub payload built from the domain module for a member', async () => {
    const supabase = mockAuthenticatedSupabase('user-456');
    getRouteHandlerSupabaseClientMock.mockResolvedValue(supabase);
    requireMembershipForRestaurantMock.mockResolvedValue({ role: 'host' });
    buildOperationsHubMock.mockResolvedValue(HUB_PAYLOAD);

    const response = await GET(
      request(`?restaurantId=${RESTAURANT_ID}&date=2026-07-11&zoneId=${ZONE_ID}&service=lunch`),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(HUB_PAYLOAD);
    expect(buildOperationsHubMock).toHaveBeenCalledWith({
      restaurantId: RESTAURANT_ID,
      date: '2026-07-11',
      zoneId: ZONE_ID,
      service: 'lunch',
      client: supabase,
    });
  });

  it('@api returns a generic 500 when hub building fails', async () => {
    getRouteHandlerSupabaseClientMock.mockResolvedValue(mockAuthenticatedSupabase());
    requireMembershipForRestaurantMock.mockResolvedValue({ role: 'owner' });
    buildOperationsHubMock.mockRejectedValue(new Error('timeline query exploded'));

    const response = await GET(request(`?restaurantId=${RESTAURANT_ID}`));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      error: 'Unable to load operations hub',
      code: 'INTERNAL_ERROR',
      message: 'Unable to load operations hub',
    });
    expect(JSON.stringify(body)).not.toContain('timeline query exploded');
  });
});
