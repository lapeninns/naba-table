import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';

import {
  getBookingTabCounts,
  matchesBookingFilter,
  normalizeBookingFilter,
} from '@src/components/features/dashboard/bookingFilters';

import type { OpsTodayBookingsSummary } from '@src/types/ops';

const summary: OpsTodayBookingsSummary = {
  date: '2026-03-19',
  timezone: 'Europe/London',
  restaurantId: 'restaurant-1',
  totals: {
    total: 3,
    confirmed: 1,
    completed: 1,
    pending: 0,
    cancelled: 0,
    noShow: 1,
    upcoming: 1,
    covers: 9,
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
      tableAssignments: [
        {
          groupId: null,
          capacitySum: 4,
          members: [
            {
              tableId: 'table-1',
              tableNumber: '1',
              capacity: 4,
              section: 'Main',
            },
          ],
        },
      ],
      requiresTableAssignment: false,
      checkedInAt: '2026-03-19T18:02:00.000Z',
      checkedOutAt: null,
    },
    {
      id: 'booking-finished',
      customerId: 'customer-finished',
      status: 'completed',
      startTime: '16:00:00',
      endTime: '17:30:00',
      partySize: 4,
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

describe('dashboard booking filters', () => {
  it('normalizes legacy completed filters onto finished', () => {
    expect(normalizeBookingFilter('completed')).toBe('finished');
  });

  it('counts the visible dashboard filters, including attention', () => {
    expect(
      getBookingTabCounts({
        summary,
        allowTableAssignments: true,
        hasAssignmentHandlers: true,
        now: DateTime.fromISO('2026-03-19T19:55:00', { zone: summary.timezone }),
      }),
    ).toEqual({
      all: 3,
      upcoming: 1,
      seated: 1,
      attention: 2,
      finished: 1,
      no_show: 0,
    });
  });

  it('treats an imminent unassigned booking as attention-worthy', () => {
    expect(
      matchesBookingFilter({
        booking: summary.bookings[0]!,
        filter: 'attention',
        summary,
        now: DateTime.fromISO('2026-03-19T19:55:00', { zone: summary.timezone }),
        allowTableAssignments: true,
        hasAssignmentHandlers: true,
      }),
    ).toBe(true);
  });
});
