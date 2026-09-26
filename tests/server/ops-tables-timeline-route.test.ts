import { beforeEach, describe, expect, it, vi } from 'vitest';

const getRouteHandlerSupabaseClientMock = vi.hoisted(() => vi.fn());
const getTableAvailabilityTimelineMock = vi.hoisted(() => vi.fn());
const requireMembershipForRestaurantMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/auth/supabase-auth-errors', () => ({
  mapSupabaseAuthError: vi.fn(() => ({
    code: 'AUTH_RESOLUTION_FAILED',
    message: 'Authentication could not be resolved',
    status: 401,
  })),
}));

vi.mock('@/server/ops/table-timeline', () => ({
  getTableAvailabilityTimeline: getTableAvailabilityTimelineMock,
}));

vi.mock('@/server/supabase', () => ({
  getRouteHandlerSupabaseClient: getRouteHandlerSupabaseClientMock,
}));

vi.mock('@/server/team/access', () => ({
  requireMembershipForRestaurant: requireMembershipForRestaurantMock,
}));

import { GET } from '@/src/app/api/ops/tables/timeline/route';
import {
  appHostRequest,
  expectNoProtectedSideEffects,
  SECURITY_RESTAURANTS,
} from '@/tests/server/security/protected-route-helpers';

const RESTAURANT_ID = SECURITY_RESTAURANTS.primary;
const OTHER_RESTAURANT_ID = SECURITY_RESTAURANTS.other;
const ZONE_ID = '33333333-3333-4333-8333-333333333333';

function mockAuthenticatedSupabase(userId = 'user-1') {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: userId } },
        error: null,
      }),
    },
  };
}

describe('GET /api/ops/tables/timeline', () => {
  beforeEach(() => {
    getRouteHandlerSupabaseClientMock.mockReset();
    getTableAvailabilityTimelineMock.mockReset();
    requireMembershipForRestaurantMock.mockReset();

    getRouteHandlerSupabaseClientMock.mockResolvedValue(mockAuthenticatedSupabase());
    requireMembershipForRestaurantMock.mockResolvedValue({ role: 'host' });
    getTableAvailabilityTimelineMock.mockResolvedValue({
      date: '2026-07-01',
      tables: [],
      summary: { totalTables: 0 },
    });
  });

  it('rejects invalid query parameters before auth or table timeline reads @p1 @api @contract', async () => {
    const response = await GET(appHostRequest('/api/ops/tables/timeline?restaurantId=not-a-uuid'));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      code: 'VALIDATION_FAILED',
      fields: { restaurantId: [expect.any(String)] },
    });
    expectNoProtectedSideEffects({
      routeClient: getRouteHandlerSupabaseClientMock,
      membership: requireMembershipForRestaurantMock,
      timeline: getTableAvailabilityTimelineMock,
    });
  });

  it('rejects unauthenticated users before membership or timeline reads @p1 @api @security', async () => {
    getRouteHandlerSupabaseClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
    });

    const response = await GET(
      appHostRequest(`/api/ops/tables/timeline?restaurantId=${RESTAURANT_ID}`),
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toMatchObject({ code: 'UNAUTHENTICATED' });
    expectNoProtectedSideEffects({
      membership: requireMembershipForRestaurantMock,
      timeline: getTableAvailabilityTimelineMock,
    });
  });

  it('blocks wrong-restaurant timeline reads before building availability @p1 @api @security', async () => {
    requireMembershipForRestaurantMock.mockRejectedValue(new Error('membership denied'));
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      const response = await GET(
        appHostRequest(`/api/ops/tables/timeline?restaurantId=${OTHER_RESTAURANT_ID}`),
      );
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body).toMatchObject({ code: 'FORBIDDEN' });
      expect(requireMembershipForRestaurantMock).toHaveBeenCalledWith({
        userId: 'user-1',
        restaurantId: OTHER_RESTAURANT_ID,
      });
      expect(getTableAvailabilityTimelineMock).not.toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('loads the timeline with parsed filters after membership passes @p1 @api @contract', async () => {
    const supabase = mockAuthenticatedSupabase('user-2');
    getRouteHandlerSupabaseClientMock.mockResolvedValue(supabase);

    const response = await GET(
      appHostRequest(
        `/api/ops/tables/timeline?restaurantId=${RESTAURANT_ID}&date=2026-07-01&zoneId=${ZONE_ID}&service=dinner&includeSummary=0`,
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      date: '2026-07-01',
      tables: [],
      summary: { totalTables: 0 },
    });
    expect(requireMembershipForRestaurantMock).toHaveBeenCalledWith({
      userId: 'user-2',
      restaurantId: RESTAURANT_ID,
    });
    expect(getTableAvailabilityTimelineMock).toHaveBeenCalledWith({
      restaurantId: RESTAURANT_ID,
      date: '2026-07-01',
      zoneId: ZONE_ID,
      service: 'dinner',
      includeSummary: false,
      client: supabase,
    });
  });

  it('fails closed when timeline construction cannot prove booking or hold occupancy @p1 @api @security', async () => {
    getTableAvailabilityTimelineMock.mockRejectedValue(new Error('booking load failed'));
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      const response = await GET(
        appHostRequest(`/api/ops/tables/timeline?restaurantId=${RESTAURANT_ID}`),
      );
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body).toMatchObject({ code: 'INTERNAL_ERROR' });
      expect(JSON.stringify(body)).not.toContain('booking load failed');
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('answers a retryable 503 when membership cannot be checked, not a 403 @p2 @api', async () => {
    requireMembershipForRestaurantMock.mockRejectedValue(
      Object.assign(new Error('lookup failed'), { code: 'MEMBERSHIP_VALIDATION_UNAVAILABLE' }),
    );

    const response = await GET(
      appHostRequest(`/api/ops/tables/timeline?restaurantId=${RESTAURANT_ID}`),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      code: 'MEMBERSHIP_VALIDATION_UNAVAILABLE',
      retryable: true,
    });
    expect(getTableAvailabilityTimelineMock).not.toHaveBeenCalled();
  });
});
