import { describe, expect, it } from 'vitest';

import { computeDashboardTotals, patchDashboardSummaryBooking } from '@src/utils/ops/dashboardSummary';
import {
  computeServiceBreakdown,
  formatDailyBookingSummaryMessage,
} from '@/lib/ops/daily-booking-summary';

import type { OpsTodayBookingsSummary } from '@src/types/ops';

const summary: OpsTodayBookingsSummary = {
  meta: {
    date: '2026-03-19',
    timezone: 'Europe/London',
    restaurantId: 'restaurant-1',
  },
  date: '2026-03-19',
  timezone: 'Europe/London',
  restaurantId: 'restaurant-1',
  totals: {
    total: 3,
    confirmed: 1,
    completed: 0,
    pending: 1,
    cancelled: 0,
    noShow: 1,
    upcoming: 2,
    covers: 3,
  },
  bookings: [
    {
      id: 'pending-booking',
      customerId: 'customer-1',
      status: 'pending',
      bookingType: 'lunch',
      startTime: '18:00:00',
      endTime: '19:00:00',
      partySize: 2,
      customerName: 'Alex',
      customerEmail: null,
      customerPhone: null,
      notes: null,
      reference: 'A-1',
      details: null,
      source: null,
      tableAssignments: [],
      requiresTableAssignment: true,
      checkedInAt: null,
      checkedOutAt: null,
    },
    {
      id: 'confirmed-booking',
      customerId: 'customer-2',
      status: 'confirmed',
      bookingType: 'dinner',
      startTime: '19:00:00',
      endTime: '20:00:00',
      partySize: 1,
      customerName: 'Sam',
      customerEmail: null,
      customerPhone: null,
      notes: null,
      reference: 'B-1',
      details: null,
      source: null,
      tableAssignments: [],
      requiresTableAssignment: true,
      checkedInAt: null,
      checkedOutAt: null,
    },
    {
      id: 'no-show-booking',
      customerId: 'customer-3',
      status: 'no_show',
      bookingType: 'dinner',
      startTime: '17:00:00',
      endTime: '18:00:00',
      partySize: 4,
      customerName: 'Taylor',
      customerEmail: null,
      customerPhone: null,
      notes: null,
      reference: 'C-1',
      details: null,
      source: null,
      tableAssignments: [],
      requiresTableAssignment: false,
      checkedInAt: null,
      checkedOutAt: null,
    },
  ],
};

summary.serviceBreakdown = computeServiceBreakdown(summary.bookings);

describe('dashboard summary helpers', () => {
  it('computes totals from booking statuses and cover rules', () => {
    expect(computeDashboardTotals(summary.bookings)).toEqual(summary.totals);
  });

  it('recomputes totals when a booking status changes in the summary', () => {
    const updated = patchDashboardSummaryBooking(summary, 'pending-booking', (booking) => ({
      ...booking,
      status: 'checked_in',
      checkedInAt: '2026-03-19T18:01:00.000Z',
    }));

    expect(updated.bookings.find((booking) => booking.id === 'pending-booking')?.status).toBe(
      'checked_in',
    );
    expect(updated.totals).toEqual({
      total: 3,
      confirmed: 2,
      completed: 1,
      pending: 0,
      cancelled: 0,
      noShow: 1,
      upcoming: 1,
      covers: 3,
    });
    expect(updated.serviceBreakdown).toEqual({
      activeBookings: 2,
      activeCovers: 3,
      periods: [
        { key: 'lunch', bookings: 1, covers: 2 },
        { key: 'dinner', bookings: 1, covers: 1 },
      ],
    });
  });

  it('groups unknown booking types into Other and excludes cancelled/no-show from the breakdown', () => {
    const breakdown = computeServiceBreakdown([
      {
        ...summary.bookings[0],
        id: 'lunch-1',
        status: 'confirmed',
        bookingType: 'lunch',
        partySize: 4,
      },
      {
        ...summary.bookings[1],
        id: 'dinner-1',
        status: 'pending',
        bookingType: 'dinner',
        partySize: 6,
      },
      {
        ...summary.bookings[1],
        id: 'other-1',
        status: 'checked_in',
        bookingType: 'brunch',
        partySize: 2,
      },
      {
        ...summary.bookings[2],
        id: 'cancelled-1',
        status: 'cancelled',
        bookingType: 'lunch',
        partySize: 10,
      },
      {
        ...summary.bookings[2],
        id: 'no-show-1',
        status: 'no_show',
        bookingType: 'dinner',
        partySize: 9,
      },
    ]);

    expect(breakdown).toEqual({
      activeBookings: 3,
      activeCovers: 12,
      periods: [
        { key: 'lunch', bookings: 1, covers: 4 },
        { key: 'dinner', bookings: 1, covers: 6 },
        { key: 'other', bookings: 1, covers: 2 },
      ],
    });
  });

  it('formats the booking summary message with exact compact venue-prefixed output', () => {
    expect(formatDailyBookingSummaryMessage(summary, { venueName: 'Old Crown Girton' })).toBe(
      'Old Crown Girton: Today 2 bkgs, 3 covers. Lunch 1/2. Dinner 1/1. app.nabatable.com',
    );

    expect(
      formatDailyBookingSummaryMessage({
        serviceBreakdown: {
          activeBookings: 1,
          activeCovers: 1,
          periods: [{ key: 'lunch', bookings: 1, covers: 1 }],
        },
      }, { venueName: 'Old Crown Girton' }),
    ).toBe('Old Crown Girton: Today 1 bkgs, 1 covers. Lunch 1/1. Dinner 0/0. app.nabatable.com');

    expect(
      formatDailyBookingSummaryMessage({
        serviceBreakdown: {
          activeBookings: 0,
          activeCovers: 0,
          periods: [],
        },
      }, { venueName: 'Old Crown Girton' }),
    ).toBe('Old Crown Girton: Today 0 bkgs, 0 covers. Lunch 0/0. Dinner 0/0. app.nabatable.com');
  });

  it('adds an Other sentence only when non-lunch/dinner bookings are present', () => {
    expect(
      formatDailyBookingSummaryMessage(
        {
          serviceBreakdown: {
            activeBookings: 4,
            activeCovers: 14,
            periods: [
              { key: 'lunch', bookings: 1, covers: 4 },
              { key: 'dinner', bookings: 2, covers: 8 },
              { key: 'other', bookings: 1, covers: 2 },
            ],
          },
        },
        { venueName: 'Old Crown Girton' },
      ),
    ).toBe(
      'Old Crown Girton: Today 4 bkgs, 14 covers. Lunch 1/4. Dinner 2/8. Other 1/2. app.nabatable.com',
    );
  });
});
