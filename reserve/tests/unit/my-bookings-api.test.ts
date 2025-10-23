import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from '@/app/api/bookings/route';
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from '@/server/supabase';

import type * as BookingsModule from '@/server/bookings';

vi.mock('@/server/bookings', async () => {
  const actual = await vi.importActual<typeof BookingsModule>('@/server/bookings');
  return {
    ...actual,
    fetchBookingsForContact: vi.fn(async () => []),
  };
});

vi.mock('@/server/supabase', () => ({
  getRouteHandlerSupabaseClient: vi.fn(),
  getServiceSupabaseClient: vi.fn(),
  getDefaultRestaurantId: vi.fn(async () => 'default-restaurant-id'),
}));

type Mock = ReturnType<typeof vi.fn>;

const tenantMock = {
  auth: {
    getSession: vi.fn(),
    getUser: vi.fn(),
  },
  from: vi.fn(),
};

const serviceMock = {
  from: vi.fn(),
};

describe('GET /api/bookings?me=1', () => {
  const originalConsoleError = console.error;

  beforeEach(() => {
    vi.resetAllMocks();
    console.error = vi.fn();
    tenantMock.auth.getSession.mockReset();
    tenantMock.auth.getUser.mockReset();
    tenantMock.from.mockReset();
    serviceMock.from.mockReset();
    (getRouteHandlerSupabaseClient as unknown as Mock).mockResolvedValue(tenantMock);
    (getServiceSupabaseClient as unknown as Mock).mockReturnValue(serviceMock);
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  it('returns 401 when session is missing', async () => {
    tenantMock.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });

    const request = new NextRequest('http://example.com/api/bookings?me=1');
    const response = await GET(request);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
  });

  it('returns paginated results for the session email', async () => {
    tenantMock.auth.getUser.mockResolvedValue({
      data: {
        user: {
          email: 'user@example.com',
        },
      },
      error: null,
    });

    const rangeMock = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'booking-1',
          start_at: '2025-01-15T18:00:00.000Z',
          end_at: '2025-01-15T20:00:00.000Z',
          party_size: 4,
          status: 'confirmed',
          notes: 'Anniversary dinner',
          restaurants: { name: 'The Corner House Pub', reservation_interval_minutes: 30 },
        },
        {
          id: 'booking-2',
          start_at: '2025-01-20T12:00:00.000Z',
          end_at: '2025-01-20T13:30:00.000Z',
          party_size: 2,
          status: 'pending',
          notes: 'Lunch meeting',
          restaurants: { name: 'Sajilo Kitchen' },
        },
      ],
      count: 12,
      error: null,
    });

    type QueryBuilderMock = {
      eq: Mock;
      gte: Mock;
      lt: Mock;
      order: Mock;
      range: Mock;
    };

    const queryBuilder: QueryBuilderMock = {
      eq: vi.fn(),
      gte: vi.fn(),
      lt: vi.fn(),
      order: vi.fn(),
      range: rangeMock,
    };

    queryBuilder.eq.mockImplementation(() => queryBuilder);
    queryBuilder.gte.mockImplementation(() => queryBuilder);
    queryBuilder.lt.mockImplementation(() => queryBuilder);
    queryBuilder.order.mockImplementation(() => queryBuilder);

    const selectMock = vi.fn().mockReturnValue(queryBuilder);
    serviceMock.from.mockReturnValue({ select: selectMock });

    const request = new NextRequest(
      'http://example.com/api/bookings?me=1&page=2&pageSize=5&status=confirmed&sort=desc',
    );

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(serviceMock.from).toHaveBeenCalledWith('bookings');
    expect(selectMock).toHaveBeenCalledWith(
      'id, start_at, end_at, party_size, status, notes, restaurants(name, reservation_interval_minutes)',
      { count: 'exact' },
    );
    expect(queryBuilder.eq).toHaveBeenCalledWith('customer_email', 'user@example.com');
    expect(queryBuilder.eq).toHaveBeenCalledWith('status', 'confirmed');
    expect(queryBuilder.order).toHaveBeenCalledWith('start_at', { ascending: false });
    expect(rangeMock).toHaveBeenCalledWith(5, 9);

    const body = await response.json();

    expect(body).toEqual({
      items: [
        {
          id: 'booking-1',
          restaurantName: 'The Corner House Pub',
          partySize: 4,
          startIso: '2025-01-15T18:00:00.000Z',
          endIso: '2025-01-15T20:00:00.000Z',
          status: 'confirmed',
          notes: 'Anniversary dinner',
          customerName: null,
          customerEmail: null,
          reservationIntervalMinutes: 30,
        },
        {
          id: 'booking-2',
          restaurantName: 'Sajilo Kitchen',
          partySize: 2,
          startIso: '2025-01-20T12:00:00.000Z',
          endIso: '2025-01-20T13:30:00.000Z',
          status: 'pending',
          notes: 'Lunch meeting',
          customerName: null,
          customerEmail: null,
          reservationIntervalMinutes: null,
        },
      ],
      pageInfo: {
        page: 2,
        pageSize: 5,
        total: 12,
        hasNext: true,
      },
    });
  });
});
