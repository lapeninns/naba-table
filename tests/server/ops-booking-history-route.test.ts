import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const routeAuthGetUserMock = vi.hoisted(() => vi.fn());
const fetchUserMembershipsMock = vi.hoisted(() => vi.fn());
const listBookingHistoryMock = vi.hoisted(() => vi.fn());
const bookingMaybeSingleMock = vi.hoisted(() => vi.fn());
const bookingQueryMock = vi.hoisted(() => {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    in: vi.fn(() => query),
    maybeSingle: bookingMaybeSingleMock,
  };
  return query;
});
const serviceFromMock = vi.hoisted(() => vi.fn(() => bookingQueryMock));

vi.mock('@/server/ops/booking-lifecycle/history', () => ({
  listBookingHistory: listBookingHistoryMock,
}));

vi.mock('@/server/supabase', () => ({
  getRouteHandlerSupabaseClient: vi.fn(async () => ({
    auth: {
      getUser: routeAuthGetUserMock,
    },
  })),
  getServiceSupabaseClient: vi.fn(() => ({
    from: serviceFromMock,
  })),
}));

vi.mock('@/server/team/access', () => ({
  fetchUserMemberships: fetchUserMembershipsMock,
}));

import { GET } from '@/src/app/api/ops/bookings/[id]/history/route';

function routeParams(id = 'booking-1') {
  return {
    params: Promise.resolve({ id }),
  };
}

describe('ops booking history route security', () => {
  beforeEach(() => {
    routeAuthGetUserMock.mockReset().mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    fetchUserMembershipsMock
      .mockReset()
      .mockResolvedValue([{ restaurant_id: 'rest-1', role: 'owner' }]);
    listBookingHistoryMock.mockReset().mockResolvedValue([]);
    bookingMaybeSingleMock.mockReset().mockResolvedValue({
      data: { id: 'booking-1', restaurant_id: 'rest-1' },
      error: null,
    });
    bookingQueryMock.select.mockClear();
    bookingQueryMock.eq.mockClear();
    bookingQueryMock.in.mockClear();
    serviceFromMock.mockClear();
  });

  it('constrains service-role booking history lookups to authorized restaurants', async () => {
    const response = await GET(
      new NextRequest('https://app.nabatable.com/api/ops/bookings/booking-1/history'),
      routeParams(),
    );

    expect(response.status).toBe(200);
    expect(fetchUserMembershipsMock).toHaveBeenCalledWith('user-1', expect.anything());
    expect(bookingQueryMock.eq).toHaveBeenCalledWith('id', 'booking-1');
    expect(bookingQueryMock.in).toHaveBeenCalledWith('restaurant_id', ['rest-1']);
    expect(listBookingHistoryMock).toHaveBeenCalledWith('booking-1');
  });

  it('returns not found before service-role lookup when the user has no memberships', async () => {
    fetchUserMembershipsMock.mockResolvedValue([]);

    const response = await GET(
      new NextRequest('https://app.nabatable.com/api/ops/bookings/booking-1/history'),
      routeParams(),
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({
      error: 'Booking not found',
      code: 'BOOKING_NOT_FOUND',
      message: 'Booking not found',
    });
    expect(serviceFromMock).not.toHaveBeenCalled();
    expect(listBookingHistoryMock).not.toHaveBeenCalled();
  });
});
