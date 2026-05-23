import { describe, expect, it } from 'vitest';

import {
  buildMyBookingsPageResponse,
  selectActiveMyBookingsPage,
  toMyBookingDTO,
  type MyBookingRow,
} from '@/server/bookings/my-bookings-dto';

const baseRow: MyBookingRow = {
  id: 'booking-1',
  restaurant_id: 'restaurant-1',
  booking_date: '2026-01-15',
  start_time: '18:30',
  end_time: '20:00',
  start_at: null,
  end_at: null,
  party_size: 4,
  status: 'confirmed',
  notes: 'Window table',
  restaurants: {
    id: 'restaurant-1',
    name: 'Old Crown',
    slug: 'old-crown',
    timezone: 'UTC',
    reservation_interval_minutes: 30,
  },
};

describe('my bookings DTO serialization', () => {
  it('maps singleton restaurant rows and derives fallback ISO values', () => {
    expect(toMyBookingDTO(baseRow)).toEqual({
      id: 'booking-1',
      restaurantId: 'restaurant-1',
      restaurantName: 'Old Crown',
      restaurantSlug: 'old-crown',
      restaurantTimezone: 'UTC',
      partySize: 4,
      startIso: '2026-01-15T18:30:00.000Z',
      endIso: '2026-01-15T20:00:00.000Z',
      status: 'confirmed',
      notes: 'Window table',
      customerName: null,
      customerEmail: null,
      reservationIntervalMinutes: 30,
    });
  });

  it('uses explicit start and end instants before fallback values', () => {
    expect(
      toMyBookingDTO({
        ...baseRow,
        start_at: '2026-01-15T18:35:00.000Z',
        end_at: '2026-01-15T20:05:00.000Z',
      }),
    ).toMatchObject({
      startIso: '2026-01-15T18:35:00.000Z',
      endIso: '2026-01-15T20:05:00.000Z',
    });
  });

  it('uses the first restaurant from array joins and preserves null defaults', () => {
    expect(
      toMyBookingDTO({
        ...baseRow,
        restaurant_id: null,
        notes: null,
        restaurants: [
          {
            name: 'First Restaurant',
            slug: null,
            timezone: null,
            reservation_interval_minutes: null,
          },
          {
            name: 'Second Restaurant',
            slug: 'second',
            timezone: 'UTC',
            reservation_interval_minutes: 15,
          },
        ],
      }),
    ).toMatchObject({
      restaurantId: null,
      restaurantName: 'First Restaurant',
      restaurantSlug: null,
      restaurantTimezone: null,
      notes: null,
      reservationIntervalMinutes: null,
    });
  });

  it('builds page metadata with the existing hasNext calculation', () => {
    expect(
      buildMyBookingsPageResponse({
        rows: [baseRow],
        page: 2,
        pageSize: 10,
        total: 12,
      }),
    ).toMatchObject({
      pageInfo: {
        page: 2,
        pageSize: 10,
        total: 12,
        hasNext: true,
      },
    });
  });

  it('selects active rows by restaurant timezone and applies paging', () => {
    const rows: MyBookingRow[] = [
      {
        ...baseRow,
        id: 'past-london',
        booking_date: '2026-05-22',
        restaurants: { ...baseRow.restaurants, timezone: 'Europe/London' },
      },
      {
        ...baseRow,
        id: 'today-london',
        booking_date: '2026-05-23',
        restaurants: { ...baseRow.restaurants, timezone: 'Europe/London' },
      },
      {
        ...baseRow,
        id: 'future-london',
        booking_date: '2026-05-24',
        restaurants: { ...baseRow.restaurants, timezone: 'Europe/London' },
      },
    ];

    expect(
      selectActiveMyBookingsPage({
        rows,
        offset: 1,
        pageSize: 1,
        todayForTimezone: (timezone) => {
          expect(timezone).toBe('Europe/London');
          return '2026-05-23';
        },
      }),
    ).toEqual({
      rows: [expect.objectContaining({ id: 'future-london' })],
      total: 2,
    });
  });

  it('uses the first joined restaurant timezone and falls back to UTC', () => {
    const todayByTimezone: string[] = [];
    const result = selectActiveMyBookingsPage({
      rows: [
        {
          ...baseRow,
          id: 'array-restaurant',
          booking_date: '2026-05-23',
          restaurants: [
            {
              name: 'First Restaurant',
              slug: null,
              timezone: 'Europe/London',
              reservation_interval_minutes: null,
            },
          ],
        },
        {
          ...baseRow,
          id: 'missing-timezone',
          booking_date: '2026-05-23',
          restaurants: { ...baseRow.restaurants, timezone: '' },
        },
      ],
      offset: 0,
      pageSize: 10,
      todayForTimezone: (timezone) => {
        todayByTimezone.push(timezone);
        return '2026-05-23';
      },
    });

    expect(todayByTimezone).toEqual(['Europe/London', 'UTC']);
    expect(result.rows.map((row) => row.id)).toEqual(['array-restaurant', 'missing-timezone']);
    expect(result.total).toBe(2);
  });
});
