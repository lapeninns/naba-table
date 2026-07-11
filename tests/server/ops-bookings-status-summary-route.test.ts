import { NextRequest, NextResponse } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getRouteHandlerSupabaseClientMock = vi.hoisted(() => vi.fn());
const fetchUserMembershipsMock = vi.hoisted(() => vi.fn());
const getBookingStatusSummaryMock = vi.hoisted(() => vi.fn());
const requireApiRateLimitMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/supabase', () => ({
  getRouteHandlerSupabaseClient: getRouteHandlerSupabaseClientMock,
}));

vi.mock('@/server/team/access', () => ({
  fetchUserMemberships: fetchUserMembershipsMock,
}));

vi.mock('@/server/ops/booking-lifecycle/summary', () => ({
  getBookingStatusSummary: getBookingStatusSummaryMock,
}));

vi.mock('@/server/security/api-rate-limit', () => ({
  requireApiRateLimit: requireApiRateLimitMock,
}));

import { GET } from '@/src/app/api/ops/bookings/status-summary/route';

const RESTAURANT_A = '11111111-1111-4111-8111-111111111111';
const RESTAURANT_B = '22222222-2222-4222-8222-222222222222';
const PINNED_NOW = '2026-07-11T12:00:00.000Z';

function request(query: string) {
  return new NextRequest(`https://app.nabatable.com/api/ops/bookings/status-summary${query}`);
}

function mockSupabase(user: { id: string } | null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(PINNED_NOW));
  getRouteHandlerSupabaseClientMock.mockReset();
  fetchUserMembershipsMock.mockReset();
  getBookingStatusSummaryMock.mockReset();
  requireApiRateLimitMock.mockReset().mockResolvedValue(null);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('GET /api/ops/bookings/status-summary', () => {
  it('rejects requests missing required query params before auth @p1 @api @contract', async () => {
    const response = await GET(request(`?restaurantId=${RESTAURANT_A}&from=2026-07-01`));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid query parameters');
    expect(getRouteHandlerSupabaseClientMock).not.toHaveBeenCalled();
    expect(getBookingStatusSummaryMock).not.toHaveBeenCalled();
  });

  it('rejects non-calendar dates rejected by safeDate @p1 @api @contract', async () => {
    const response = await GET(
      request(`?restaurantId=${RESTAURANT_A}&from=2026-02-30&to=2026-03-01`),
    );

    expect(response.status).toBe(400);
    expect(getBookingStatusSummaryMock).not.toHaveBeenCalled();
  });

  it('rejects unknown status filters @p1 @api @contract', async () => {
    const response = await GET(
      request(
        `?restaurantId=${RESTAURANT_A}&from=2026-07-01&to=2026-07-31&statuses=confirmed,bogus`,
      ),
    );

    expect(response.status).toBe(400);
    expect(getBookingStatusSummaryMock).not.toHaveBeenCalled();
  });

  it('rejects windows larger than 93 days before auth @p1 @api @contract', async () => {
    const response = await GET(
      request(`?restaurantId=${RESTAURANT_A}&from=2026-01-01&to=2026-06-30`),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Status summary range must be between 1 and 93 days',
    });
    expect(getRouteHandlerSupabaseClientMock).not.toHaveBeenCalled();
  });

  it('rejects inverted date ranges @p2 @api @contract', async () => {
    const response = await GET(
      request(`?restaurantId=${RESTAURANT_A}&from=2026-07-10&to=2026-07-01`),
    );

    expect(response.status).toBe(400);
    expect(getRouteHandlerSupabaseClientMock).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated summary reads @p1 @api @security', async () => {
    getRouteHandlerSupabaseClientMock.mockResolvedValue(mockSupabase(null));

    const response = await GET(
      request(`?restaurantId=${RESTAURANT_A}&from=2026-07-01&to=2026-07-31`),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Authentication required' });
    expect(fetchUserMembershipsMock).not.toHaveBeenCalled();
    expect(getBookingStatusSummaryMock).not.toHaveBeenCalled();
  });

  it('rejects members of other restaurants before computing summaries @p1 @api @security', async () => {
    const supabase = mockSupabase({ id: 'user-1' });
    getRouteHandlerSupabaseClientMock.mockResolvedValue(supabase);
    fetchUserMembershipsMock.mockResolvedValue([{ restaurant_id: RESTAURANT_B, role: 'owner' }]);

    const response = await GET(
      request(`?restaurantId=${RESTAURANT_A}&from=2026-07-01&to=2026-07-31`),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'Forbidden' });
    expect(fetchUserMembershipsMock).toHaveBeenCalledWith('user-1', supabase);
    expect(requireApiRateLimitMock).not.toHaveBeenCalled();
    expect(getBookingStatusSummaryMock).not.toHaveBeenCalled();
  });

  it('returns the rate-limit response without computing summaries when throttled @p2 @api', async () => {
    getRouteHandlerSupabaseClientMock.mockResolvedValue(mockSupabase({ id: 'user-1' }));
    fetchUserMembershipsMock.mockResolvedValue([{ restaurant_id: RESTAURANT_A, role: 'host' }]);
    requireApiRateLimitMock.mockResolvedValue(
      NextResponse.json({ error: 'Too many requests' }, { status: 429 }),
    );

    const response = await GET(
      request(`?restaurantId=${RESTAURANT_A}&from=2026-07-01&to=2026-07-31`),
    );

    expect(response.status).toBe(429);
    expect(requireApiRateLimitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: 'ops-bookings:status-summary',
        tenantId: RESTAURANT_A,
        userId: 'user-1',
        limit: 60,
        windowMs: 60_000,
      }),
    );
    expect(getBookingStatusSummaryMock).not.toHaveBeenCalled();
  });

  it('aggregates status totals for members over the requested range @p1 @api', async () => {
    getRouteHandlerSupabaseClientMock.mockResolvedValue(mockSupabase({ id: 'user-2' }));
    fetchUserMembershipsMock.mockResolvedValue([{ restaurant_id: RESTAURANT_A, role: 'host' }]);
    getBookingStatusSummaryMock.mockResolvedValue([
      { status: 'confirmed', total: 5 },
      { status: 'cancelled', total: 2 },
    ]);

    const response = await GET(
      request(`?restaurantId=${RESTAURANT_A}&from=2026-07-01&to=2026-07-31`),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      restaurantId: RESTAURANT_A,
      range: { from: '2026-07-01', to: '2026-07-31' },
      filter: { statuses: null },
      totals: {
        pending: 0,
        pending_allocation: 0,
        confirmed: 5,
        checked_in: 0,
        completed: 0,
        cancelled: 2,
        no_show: 0,
        PRIORITY_WAITLIST: 0,
      },
      generatedAt: PINNED_NOW,
    });
    // The summary boundary receives no client override: it resolves its own
    // service-role client internally.
    expect(getBookingStatusSummaryMock).toHaveBeenCalledWith({
      restaurantId: RESTAURANT_A,
      startDate: '2026-07-01',
      endDate: '2026-07-31',
      statuses: null,
    });
  });

  it('passes explicit status filters through to the summary boundary @p2 @api', async () => {
    getRouteHandlerSupabaseClientMock.mockResolvedValue(mockSupabase({ id: 'user-2' }));
    fetchUserMembershipsMock.mockResolvedValue([{ restaurant_id: RESTAURANT_A, role: 'owner' }]);
    getBookingStatusSummaryMock.mockResolvedValue([{ status: 'confirmed', total: 3 }]);

    const response = await GET(
      request(
        `?restaurantId=${RESTAURANT_A}&from=2026-07-01&to=2026-07-02&statuses=confirmed,no_show`,
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.filter).toEqual({ statuses: ['confirmed', 'no_show'] });
    expect(body.totals.confirmed).toBe(3);
    expect(getBookingStatusSummaryMock).toHaveBeenCalledWith({
      restaurantId: RESTAURANT_A,
      startDate: '2026-07-01',
      endDate: '2026-07-02',
      statuses: ['confirmed', 'no_show'],
    });
  });

  it('returns 500 when the summary computation fails @p2 @api', async () => {
    getRouteHandlerSupabaseClientMock.mockResolvedValue(mockSupabase({ id: 'user-2' }));
    fetchUserMembershipsMock.mockResolvedValue([{ restaurant_id: RESTAURANT_A, role: 'owner' }]);
    getBookingStatusSummaryMock.mockRejectedValue(new Error('db offline'));

    const response = await GET(
      request(`?restaurantId=${RESTAURANT_A}&from=2026-07-01&to=2026-07-31`),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Unable to compute booking status summary',
    });
  });
});
