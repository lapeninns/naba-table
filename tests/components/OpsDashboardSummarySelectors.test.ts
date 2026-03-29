import { describe, expect, it } from 'vitest';

import { getDashboardSummaryMetrics } from '@src/components/features/dashboard/dashboardSummarySelectors';

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
    total: 4,
    confirmed: 1,
    completed: 1,
    pending: 1,
    cancelled: 0,
    noShow: 1,
    upcoming: 2,
    covers: 11,
  },
  bookings: [
    {
      id: 'booking-upcoming',
      customerId: 'customer-upcoming',
      status: 'confirmed',
      startTime: '20:00:00',
      endTime: '21:30:00',
      partySize: 2,
      customerName: 'Alex',
      customerEmail: null,
      customerPhone: null,
      notes: null,
      reference: 'UP-1',
      details: null,
      source: null,
      tableAssignments: [],
      requiresTableAssignment: true,
      checkedInAt: null,
      checkedOutAt: null,
    },
    {
      id: 'booking-seated',
      customerId: 'customer-seated',
      status: 'checked_in',
      startTime: '18:00:00',
      endTime: '19:30:00',
      partySize: 3,
      customerName: 'Sam',
      customerEmail: null,
      customerPhone: null,
      notes: null,
      reference: 'SE-1',
      details: null,
      source: null,
      tableAssignments: [],
      requiresTableAssignment: false,
      checkedInAt: '2026-03-19T18:02:00.000Z',
      checkedOutAt: null,
    },
    {
      id: 'booking-pending',
      customerId: 'customer-pending',
      status: 'pending',
      startTime: '17:00:00',
      endTime: '18:00:00',
      partySize: 1,
      customerName: 'Morgan',
      customerEmail: null,
      customerPhone: null,
      notes: null,
      reference: 'PE-1',
      details: null,
      source: null,
      tableAssignments: [],
      requiresTableAssignment: true,
      checkedInAt: null,
      checkedOutAt: null,
    },
    {
      id: 'booking-finished',
      customerId: 'customer-finished',
      status: 'completed',
      startTime: '16:00:00',
      endTime: '17:30:00',
      partySize: 5,
      customerName: 'Taylor',
      customerEmail: null,
      customerPhone: null,
      notes: null,
      reference: 'FI-1',
      details: null,
      source: null,
      tableAssignments: [],
      requiresTableAssignment: false,
      checkedInAt: '2026-03-19T16:03:00.000Z',
      checkedOutAt: '2026-03-19T17:35:00.000Z',
    },
  ],
};

describe('getDashboardSummaryMetrics', () => {
  it('returns empty metrics when summary data is unavailable', () => {
    expect(
      getDashboardSummaryMetrics({
        summary: null,
        allowTableAssignments: true,
        hasAssignmentHandlers: true,
      }),
    ).toEqual({
      guestStats: { upcoming: 0, seated: 0 },
      tabCounts: {
        all: 0,
        upcoming: 0,
        seated: 0,
        attention: 0,
        finished: 0,
        no_show: 0,
      },
    });
  });

  it('derives guest counters and filter tabs from the same summary snapshot', () => {
    expect(
      getDashboardSummaryMetrics({
        summary,
        allowTableAssignments: true,
        hasAssignmentHandlers: true,
      }),
    ).toMatchObject({
      guestStats: {
        upcoming: 2,
        seated: 3,
      },
      tabCounts: {
        all: 4,
        upcoming: 2,
        seated: 1,
        finished: 1,
      },
    });
  });
});
