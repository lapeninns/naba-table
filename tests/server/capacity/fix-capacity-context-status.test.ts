import { describe, expect, it, vi } from 'vitest';

import { BOOKING_BLOCKING_STATUSES } from '@/lib/enums';

// loadCapacityContext (exercised here via calculateCapacityUtilization) awaits
// getRestaurantSchedule; stub it so the test stays focused on the bookings
// status filter contract.
vi.mock('@/server/restaurants/schedule', () => ({
  getRestaurantSchedule: vi.fn(async () => ({
    isClosed: false,
    defaultDurationMinutes: 90,
    slots: [],
  })),
}));

import { calculateCapacityUtilization } from '@/server/capacity/service';

type StatusFilterCapture = {
  inStatuses?: string[];
  notFilterUsed: boolean;
  bookingRowsReturned: unknown[];
};

/**
 * Fluent stub that records how the bookings query constrains `status`. The
 * bookings table is the only one whose rows are asserted; every other table
 * resolves to an empty data set.
 */
function createClient(capture: StatusFilterCapture, bookingRows: unknown[]) {
  const makeBuilder = (table: string) => {
    const builder: Record<string, unknown> = {};
    const chain = () => builder;
    builder.select = chain;
    builder.eq = chain;
    builder.order = chain;
    builder.in = (column: string, values: string[]) => {
      if (table === 'bookings' && column === 'status') {
        capture.inStatuses = values;
      }
      return builder;
    };
    builder.not = (column: string) => {
      if (table === 'bookings' && column === 'status') {
        capture.notFilterUsed = true;
      }
      return builder;
    };
    builder.then = (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
      resolve({ data: table === 'bookings' ? bookingRows : [], error: null });
    return builder;
  };

  return {
    from: (table: string) => makeBuilder(table),
  } as never;
}

describe('loadCapacityContext status filter (#6)', () => {
  it('counts only BOOKING_BLOCKING_STATUSES and never uses the legacy not-in filter', async () => {
    const capture: StatusFilterCapture = {
      notFilterUsed: false,
      bookingRowsReturned: [],
    };
    // A completed booking must not be counted: the query restricts to blocking
    // statuses, so the DB layer (mocked here) never returns it. We assert the
    // filter contract that guarantees that exclusion.
    const client = createClient(capture, [
      { id: 'b-confirmed', party_size: 4, start_time: '18:00', end_time: '19:30', status: 'confirmed' },
    ]);

    await calculateCapacityUtilization('restaurant-1', '2026-05-23', client);

    expect(capture.inStatuses).toEqual([...BOOKING_BLOCKING_STATUSES]);
    expect(capture.notFilterUsed).toBe(false);
    // Sanity: the blocking set must align with the seatability layer and must
    // exclude completed / checked_in / cancelled / no_show.
    expect(capture.inStatuses).not.toContain('completed');
    expect(capture.inStatuses).not.toContain('checked_in');
    expect(capture.inStatuses).not.toContain('no_show');
    expect(capture.inStatuses).not.toContain('cancelled');
  });
});
