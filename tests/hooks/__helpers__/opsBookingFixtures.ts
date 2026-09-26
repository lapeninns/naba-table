import { vi } from 'vitest';

import { createAppQueryClient } from '@/lib/query/client';
import { queryKeys } from '@/lib/query/keys';

import type { OpsBookingDialogBundle } from '@/services/ops/bookings';
import type {
  OpsBookingListItem,
  OpsBookingsPage,
  OpsTodayBooking,
  OpsTodayBookingsSummary,
} from '@/types/ops';
import type { InfiniteData } from '@tanstack/react-query';

export const RESTAURANT_ID = 'rest-1';
export const DATE = '2026-07-11';

export function makeRow(overrides: Partial<OpsTodayBooking> & { id: string }): OpsTodayBooking {
  return {
    status: 'confirmed',
    startTime: '18:00',
    endTime: '20:00',
    partySize: 2,
    customerName: `Guest ${overrides.id}`,
    customerEmail: null,
    customerPhone: null,
    notes: null,
    reference: null,
    details: null,
    source: null,
    tableAssignments: [],
    requiresTableAssignment: true,
    checkedInAt: null,
    checkedOutAt: null,
    ...overrides,
  };
}

export function makeSummary(rows: OpsTodayBooking[], date: string = DATE): OpsTodayBookingsSummary {
  return {
    meta: { date, timezone: 'UTC', restaurantId: RESTAURANT_ID },
    date,
    timezone: 'UTC',
    restaurantId: RESTAURANT_ID,
    totals: {
      total: rows.length,
      confirmed: 0,
      completed: 0,
      pending: 0,
      cancelled: 0,
      noShow: 0,
      upcoming: 0,
      covers: 0,
    },
    bookings: rows,
  };
}

export function makeListItem(
  overrides: Partial<OpsBookingListItem> & { id: string },
): OpsBookingListItem {
  return {
    restaurantId: RESTAURANT_ID,
    restaurantName: 'Old Crown',
    restaurantSlug: 'old-crown',
    restaurantTimezone: 'UTC',
    partySize: 2,
    startIso: `${DATE}T18:00:00.000Z`,
    endIso: `${DATE}T20:00:00.000Z`,
    status: 'confirmed',
    customerName: `Guest ${overrides.id}`,
    customerPhone: null,
    tableAssignments: [],
    checkedInAt: null,
    checkedOutAt: null,
    ...overrides,
  };
}

export function makeInfiniteList(items: OpsBookingListItem[]): InfiniteData<OpsBookingsPage> {
  return {
    pages: [{ items, pageInfo: { page: 1, pageSize: 50, total: items.length, hasNext: false } }],
    pageParams: [1],
  };
}

export function makeBundle(item: OpsBookingListItem): OpsBookingDialogBundle {
  return {
    booking: item,
    assignmentContext: {
      booking: {
        id: item.id,
        restaurant_id: RESTAURANT_ID,
        start_at: item.startIso,
        booking_date: DATE,
        start_time: '18:00',
        party_size: item.partySize,
        status: item.status,
      },
      timezone: 'UTC',
      tables: [
        {
          id: 't1',
          tableNumber: 'T1',
          capacity: 4,
          minPartySize: 1,
          maxPartySize: 4,
          section: 'Main',
          category: 'dining',
          seatingType: 'standard',
          mobility: 'movable',
          zoneId: 'z1',
          status: 'available',
          active: true,
          position: null,
        },
      ],
      bookingAssignments: [],
      conflicts: [],
      window: { startAt: `${DATE}T18:00:00.000Z`, endAt: `${DATE}T20:00:00.000Z` },
      serverNow: `${DATE}T17:00:00.000Z`,
    },
  };
}

/** A query client with the app's global mutation feedback, and spies for its toasts. */
export function createFeedbackQueryClient() {
  const notify = { success: vi.fn(), error: vi.fn() };
  const queryClient = createAppQueryClient({ notify });
  queryClient.setDefaultOptions({
    ...queryClient.getDefaultOptions(),
    queries: { ...queryClient.getDefaultOptions().queries, retry: false },
  });
  return { queryClient, notify };
}

export const summaryKey = (date: string | null = DATE) =>
  queryKeys.opsDashboard.summary(RESTAURANT_ID, date);

export function summaryRow(
  queryClient: ReturnType<typeof createAppQueryClient>,
  bookingId: string,
  date: string | null = DATE,
) {
  return queryClient
    .getQueryData<OpsTodayBookingsSummary>(summaryKey(date))
    ?.bookings.find((booking) => booking.id === bookingId);
}

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
