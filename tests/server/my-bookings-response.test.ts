import { describe, expect, it, vi } from 'vitest';

import {
  buildMyBookingsHttpResponse,
  type MyBookingsHttpPageFetcher,
  type MyBookingsHttpQueryParser,
  type MyBookingsHttpResponseClient,
} from '@/server/bookings/my-bookings-response';

import type { MyBookingRow } from '@/server/bookings/my-bookings-dto';

const client = {} as MyBookingsHttpResponseClient;

const row: MyBookingRow = {
  id: 'booking-1',
  restaurant_id: 'restaurant-1',
  booking_date: '2026-05-23',
  start_time: '18:30',
  end_time: '20:00',
  start_at: '2026-05-23T17:30:00.000Z',
  end_at: '2026-05-23T19:00:00.000Z',
  party_size: 4,
  status: 'confirmed',
  notes: null,
  restaurants: {
    id: 'restaurant-1',
    name: 'Old Crown',
    slug: 'old-crown',
    timezone: 'Europe/London',
    reservation_interval_minutes: 30,
  },
};

describe('buildMyBookingsHttpResponse', () => {
  it('parses the query, fetches the page with a normalized email, and returns the page DTO', async () => {
    const pageFetcher = vi.fn(async ({ email, query }) => {
      expect(email).toBe('guest@example.com');
      expect(query.page).toBe(2);
      expect(query.pageSize).toBe(1);
      expect(query.offset).toBe(1);
      return { ok: true, rows: [row], total: 3 };
    }) as MyBookingsHttpPageFetcher;

    const response = await buildMyBookingsHttpResponse({
      client,
      userId: 'user-1',
      email: 'Guest@Example.com',
      pageFetcher,
      searchParams: new URLSearchParams({ me: '1', page: '2', pageSize: '1' }),
    });

    await expect(response.json()).resolves.toEqual({
      items: [
        {
          id: 'booking-1',
          restaurantId: 'restaurant-1',
          restaurantName: 'Old Crown',
          restaurantSlug: 'old-crown',
          restaurantTimezone: 'Europe/London',
          partySize: 4,
          startIso: '2026-05-23T17:30:00.000Z',
          endIso: '2026-05-23T19:00:00.000Z',
          status: 'confirmed',
          notes: null,
          customerName: null,
          customerEmail: null,
          reservationIntervalMinutes: 30,
        },
      ],
      pageInfo: {
        page: 2,
        pageSize: 1,
        total: 3,
        hasNext: true,
      },
    });
    expect(response.status).toBe(200);
    expect(pageFetcher).toHaveBeenCalledOnce();
  });

  it('maps parser date-range failures to the existing route response', async () => {
    const queryParser = vi.fn(() => ({
      ok: false,
      kind: 'date_range',
    })) as MyBookingsHttpQueryParser;
    const pageFetcher = vi.fn() as unknown as MyBookingsHttpPageFetcher;

    const response = await buildMyBookingsHttpResponse({
      client,
      userId: 'user-1',
      email: 'guest@example.com',
      pageFetcher,
      queryParser,
      searchParams: new URLSearchParams({ me: '1' }),
    });

    await expect(response.json()).resolves.toMatchObject({
      code: 'INVALID_DATE_RANGE',
      error: 'Invalid date range.',
    });
    expect(response.status).toBe(400);
    expect(pageFetcher).not.toHaveBeenCalled();
  });

  it('maps parser validation failures through the booking zod failure mapper', async () => {
    const clientFor = vi.fn(() => client);
    const pageFetcher = vi.fn() as unknown as MyBookingsHttpPageFetcher;

    const response = await buildMyBookingsHttpResponse({
      clientFor,
      userId: 'user-1',
      email: 'guest@example.com',
      pageFetcher,
      searchParams: new URLSearchParams({ me: '0', status: 'completed' }),
    });

    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      code: 'VALIDATION_FAILED',
    });
    expect(clientFor).not.toHaveBeenCalled();
    expect(pageFetcher).not.toHaveBeenCalled();
  });

  it('keeps page fetch failures behind the existing generic error response', async () => {
    const error = { message: 'database unavailable' };
    const onPageFetchError = vi.fn();
    const pageFetcher = vi.fn(async () => ({ ok: false, error })) as MyBookingsHttpPageFetcher;

    const response = await buildMyBookingsHttpResponse({
      client,
      userId: 'user-1',
      email: 'guest@example.com',
      onPageFetchError,
      pageFetcher,
      searchParams: new URLSearchParams({ me: '1' }),
    });

    await expect(response.json()).resolves.toMatchObject({ code: 'INTERNAL_ERROR' });
    expect(response.status).toBe(500);
    expect(onPageFetchError).toHaveBeenCalledWith(error);
  });
});
