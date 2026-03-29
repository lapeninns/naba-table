import { describe, expect, it } from 'vitest';

import { computeDashboardTotals, patchDashboardSummaryBooking } from '@src/utils/ops/dashboardSummary';

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
  });
});
