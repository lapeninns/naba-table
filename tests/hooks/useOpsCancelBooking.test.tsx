import { renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HttpError } from '@/lib/http/errors';
import { queryKeys } from '@/lib/query/keys';
import { useOpsCancelBooking } from '@src/hooks/ops/useOpsCancelBooking';

import type { OpsBookingsPage, OpsTodayBookingsSummary } from '@/types/ops';

const bookingService = vi.hoisted(() => ({
  cancelBooking: vi.fn(),
}));

vi.mock('@/contexts/ops-services', () => ({
  useBookingService: () => bookingService,
}));

const restaurantId = 'rest-1';
const targetDate = '2026-07-11';

function makeSummary(): OpsTodayBookingsSummary {
  return {
    restaurantId,
    date: targetDate,
    timezone: 'UTC',
    bookings: [
      {
        id: 'booking-1',
        status: 'confirmed',
        partySize: 2,
        bookingType: 'dinner',
        customerName: 'Guest One',
        checkedInAt: null,
        checkedOutAt: null,
      },
    ],
    totals: {
      total: 1,
      confirmed: 1,
      completed: 0,
      pending: 0,
      cancelled: 0,
      noShow: 0,
      upcoming: 1,
      covers: 2,
    },
  } as unknown as OpsTodayBookingsSummary;
}

const summaryKey = queryKeys.opsDashboard.summary(restaurantId, targetDate);
const detailKey = queryKeys.opsBookings.detail('booking-1');
const listKey = queryKeys.opsBookings.list({ restaurantId });

function seededSetup() {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(summaryKey, makeSummary());
  queryClient.setQueryData(detailKey, { id: 'booking-1', status: 'confirmed' });
  queryClient.setQueryData(listKey, {
    items: [{ id: 'booking-1', status: 'confirmed' }],
    pageInfo: { page: 1, pageSize: 50, total: 1, hasNext: false },
  } as unknown as OpsBookingsPage);

  const wrapper = createQueryWrapper(queryClient);
  return { queryClient, ...renderHook(() => useOpsCancelBooking(), { wrapper }) };
}

describe('useOpsCancelBooking', () => {
  beforeEach(() => {
    bookingService.cancelBooking.mockResolvedValue({ id: 'booking-1', status: 'cancelled' });
  });

  it('@contract optimistically marks the booking cancelled in summary, detail, and list caches', async () => {
    let resolveRequest: (value: unknown) => void = () => {};
    bookingService.cancelBooking.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );

    const { result, queryClient } = seededSetup();
    const mutation = result.current.mutateAsync({
      bookingId: 'booking-1',
      restaurantId,
      targetDate,
    });

    await waitFor(() => {
      const summary = queryClient.getQueryData<OpsTodayBookingsSummary>(summaryKey);
      expect(summary?.bookings[0]?.status).toBe('cancelled');
      expect(summary?.totals.cancelled).toBe(1);
      expect(summary?.totals.confirmed).toBe(0);
      expect(
        queryClient.getQueryData<{ status: string }>(detailKey)?.status,
      ).toBe('cancelled');
      const list = queryClient.getQueryData<OpsBookingsPage>(listKey);
      expect(list?.items?.[0]?.status).toBe('cancelled');
    });

    resolveRequest({ id: 'booking-1', status: 'cancelled' });
    await mutation;

    expect(bookingService.cancelBooking).toHaveBeenCalledWith({ id: 'booking-1' });
  });

  it('@contract rolls the summary and detail caches back when the cancel fails', async () => {
    bookingService.cancelBooking.mockRejectedValue(
      new HttpError({ message: 'Too late', status: 409, code: 'CONFLICT' }),
    );

    const { result, queryClient } = seededSetup();

    await expect(
      result.current.mutateAsync({ bookingId: 'booking-1', restaurantId, targetDate }),
    ).rejects.toMatchObject({ status: 409 });

    const summary = queryClient.getQueryData<OpsTodayBookingsSummary>(summaryKey);
    expect(summary?.bookings[0]?.status).toBe('confirmed');
    expect(queryClient.getQueryData<{ status: string }>(detailKey)?.status).toBe('confirmed');
  });

  // KNOWN-ISSUE: onMutate optimistically flips the booking to cancelled in every
  // ['ops','bookings','list'] page, but the mutation context only snapshots the summary
  // and detail caches. onError restores those two and onSettled only invalidates the
  // heatmap, so after a failed cancel the bookings list keeps showing the row as
  // cancelled until some other flow refetches it. Fix belongs in
  // src/hooks/ops/useOpsCancelBooking.ts, out of scope for this spec.
  it('@contract KNOWN-ISSUE: the list cache keeps the optimistic cancelled row after a failure', async () => {
    bookingService.cancelBooking.mockRejectedValue(
      new HttpError({ message: 'Too late', status: 409, code: 'CONFLICT' }),
    );

    const { result, queryClient } = seededSetup();

    await expect(
      result.current.mutateAsync({ bookingId: 'booking-1', restaurantId, targetDate }),
    ).rejects.toMatchObject({ status: 409 });

    const list = queryClient.getQueryData<OpsBookingsPage>(listKey);
    expect(list?.items?.[0]?.status).toBe('cancelled');
    const listQuery = queryClient.getQueryCache().find({ queryKey: listKey });
    expect(listQuery?.state.isInvalidated).toBe(false);
  });

  it('@contract invalidates the restaurant heatmap once the mutation settles', async () => {
    const { result, queryClient } = seededSetup();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ bookingId: 'booking-1', restaurantId, targetDate });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['ops', 'dashboard', restaurantId, 'heatmap'],
      exact: false,
    });
  });

  it('@contract tolerates missing caches when cancelling from a cold state', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createQueryWrapper(queryClient);
    const { result } = renderHook(() => useOpsCancelBooking(), { wrapper });

    await expect(
      result.current.mutateAsync({ bookingId: 'booking-9', restaurantId, targetDate: null }),
    ).resolves.toEqual({ id: 'booking-1', status: 'cancelled' });
  });
});
