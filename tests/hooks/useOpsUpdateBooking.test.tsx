import { renderHook, waitFor } from '@testing-library/react';
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

  it('@contract invalidates ops booking queries and the dashboard summary for the restaurant', async () => {
    bookingService.updateBooking.mockResolvedValue(updated);

    const { result, queryClient } = setup();
    queryClient.setQueryData(queryKeys.opsBookings.list({ restaurantId: 'rest-1' }), {
      items: [],
    });
    queryClient.setQueryData(queryKeys.opsDashboard.summary('rest-1', null), {
      bookings: [],
    });
    queryClient.setQueryData(queryKeys.opsDashboard.summary('rest-2', null), {
      bookings: [],
    });

    await result.current.mutateAsync({ ...input, restaurantId: 'rest-1' });

    const bookingsQuery = queryClient
      .getQueryCache()
      .find({ queryKey: queryKeys.opsBookings.list({ restaurantId: 'rest-1' }) });
    const summaryQuery = queryClient
      .getQueryCache()
      .find({ queryKey: queryKeys.opsDashboard.summary('rest-1', null) });
    const otherSummaryQuery = queryClient
      .getQueryCache()
      .find({ queryKey: queryKeys.opsDashboard.summary('rest-2', null) });

    expect(bookingsQuery?.state.isInvalidated).toBe(true);
    expect(summaryQuery?.state.isInvalidated).toBe(true);
    expect(otherSummaryQuery?.state.isInvalidated).toBe(false);
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
