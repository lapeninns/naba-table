import { renderHook } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import { describe, expect, it, vi } from 'vitest';

import { emit } from '@/lib/analytics/emit';
import { HttpError } from '@/lib/http/errors';
import { queryKeys } from '@/lib/query/keys';
import { useOpsUpdateBooking } from '@src/hooks/ops/useOpsUpdateBooking';

const bookingService = vi.hoisted(() => ({
  updateBooking: vi.fn(),
}));

vi.mock('@/contexts/ops-services', () => ({
  useBookingService: () => bookingService,
}));

vi.mock('@/lib/analytics/emit', () => ({ emit: vi.fn() }));

const input = {
  id: 'booking-1',
  startIso: '2026-07-11T18:00:00.000Z',
  endIso: '2026-07-11T20:00:00.000Z',
  partySize: 4,
  notes: null,
};

const updated = { id: 'booking-1', status: 'confirmed', partySize: 4 };

function setup() {
  const queryClient = createTestQueryClient();
  const wrapper = createQueryWrapper(queryClient);
  return { queryClient, ...renderHook(() => useOpsUpdateBooking(), { wrapper }) };
}

describe('useOpsUpdateBooking', () => {
  it('@contract emits analytics around the update and strips restaurantId from the payload', async () => {
    bookingService.updateBooking.mockResolvedValue(updated);

    const { result } = setup();

    await result.current.mutateAsync({ ...input, restaurantId: 'rest-1' });

    expect(emit).toHaveBeenCalledWith('booking_edit_submitted', { bookingId: 'booking-1' });
    expect(emit).toHaveBeenCalledWith('booking_edit_succeeded', { bookingId: 'booking-1' });
    expect(bookingService.updateBooking).toHaveBeenCalledWith({
      id: 'booking-1',
      startIso: input.startIso,
      endIso: input.endIso,
      partySize: 4,
      notes: null,
    });
  });

  it('@contract primes the booking detail cache with the server response', async () => {
    bookingService.updateBooking.mockResolvedValue(updated);

    const { result, queryClient } = setup();

    await result.current.mutateAsync(input);

    expect(queryClient.getQueryData(queryKeys.opsBookings.detail('booking-1'))).toEqual(
      updated,
    );
  });

  it('@contract patches the list row and invalidates only the summaries for the old and new dates', async () => {
    const moved = {
      id: 'booking-1',
      restaurantId: 'rest-1',
      restaurantTimezone: 'UTC',
      status: 'confirmed',
      partySize: 4,
      startIso: '2026-07-12T18:00:00.000Z',
      endIso: '2026-07-12T20:00:00.000Z',
    };
    bookingService.updateBooking.mockResolvedValue(moved);

    const { result, queryClient } = setup();
    const listKey = queryKeys.opsBookings.list({ restaurantId: 'rest-1' });
    queryClient.setQueryData(listKey, {
      items: [{ id: 'booking-1', status: 'confirmed', partySize: 2 }],
      pageInfo: { page: 1, pageSize: 50, total: 1, hasNext: false },
    });
    const summary = (date: string, ids: string[]) => ({
      restaurantId: 'rest-1',
      date,
      bookings: ids.map((id) => ({ id })),
    });
    // Old date (holds the booking), new date, an unrelated date, and another restaurant.
    queryClient.setQueryData(queryKeys.opsDashboard.summary('rest-1', '2026-07-11'), summary('2026-07-11', ['booking-1']));
    queryClient.setQueryData(queryKeys.opsDashboard.summary('rest-1', null), summary('2026-07-12', []));
    queryClient.setQueryData(queryKeys.opsDashboard.summary('rest-1', '2026-07-20'), summary('2026-07-20', []));
    queryClient.setQueryData(queryKeys.opsDashboard.summary('rest-2', '2026-07-11'), summary('2026-07-11', ['booking-1']));

    await result.current.mutateAsync({ ...input, startIso: moved.startIso, restaurantId: 'rest-1' });

    const state = (key: readonly unknown[]) => queryClient.getQueryState(key)?.isInvalidated;
    expect(state(queryKeys.opsDashboard.summary('rest-1', '2026-07-11'))).toBe(true);
    expect(state(queryKeys.opsDashboard.summary('rest-1', null))).toBe(true);
    expect(state(queryKeys.opsDashboard.summary('rest-1', '2026-07-20'))).toBe(false);
    expect(state(queryKeys.opsDashboard.summary('rest-2', '2026-07-11'))).toBe(false);
    expect(state(listKey)).toBe(false);
    expect(
      queryClient.getQueryData<{ items: { partySize: number }[] }>(listKey)?.items[0]?.partySize,
    ).toBe(4);
  });

  it('@contract emits a failure event with the error code on error', async () => {
    bookingService.updateBooking.mockRejectedValue(
      new HttpError({ message: 'Conflict', status: 409, code: 'BOOKING_CONFLICT' }),
    );

    const { result } = setup();

    await expect(result.current.mutateAsync(input)).rejects.toMatchObject({ status: 409 });
    expect(emit).toHaveBeenCalledWith('booking_edit_failed', {
      bookingId: 'booking-1',
      code: 'BOOKING_CONFLICT',
    });
    expect(emit).not.toHaveBeenCalledWith('booking_edit_succeeded', expect.anything());
  });
});
