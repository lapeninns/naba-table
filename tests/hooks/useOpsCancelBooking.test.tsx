import { act, renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper } from '@tests/utils/reactQuery';
import { describe, expect, it, vi } from 'vitest';


import { HttpError } from '@/lib/http/errors';
import { queryKeys } from '@/lib/query/keys';
import { useOpsCancelBooking } from '@src/hooks/ops/useOpsCancelBooking';

import {
  DATE,
  RESTAURANT_ID,
  createFeedbackQueryClient,
  deferred,
  makeInfiniteList,
  makeListItem,
  makeRow,
  makeSummary,
  summaryKey,
  summaryRow,
} from './__helpers__/opsBookingFixtures';

import type { OpsBookingListItem, OpsBookingsPage } from '@/types/ops';
import type { InfiniteData } from '@tanstack/react-query';

const bookingService = vi.hoisted(() => ({ cancelBooking: vi.fn(), getBooking: vi.fn() }));

vi.mock('@/contexts/ops-services', () => ({ useBookingService: () => bookingService }));

const upcomingListKey = queryKeys.opsBookings.list({
  restaurantId: RESTAURANT_ID,
  statuses: 'pending,confirmed',
});
const allListKey = queryKeys.opsBookings.list({ restaurantId: RESTAURANT_ID });

function setup() {
  const { queryClient, notify } = createFeedbackQueryClient();
  queryClient.setQueryData(summaryKey(), makeSummary([makeRow({ id: 'b1', customerName: 'Ada' })]));
  queryClient.setQueryData(queryKeys.opsBookings.detail('b1'), makeListItem({ id: 'b1' }));
  queryClient.setQueryData(upcomingListKey, makeInfiniteList([makeListItem({ id: 'b1' })]));
  queryClient.setQueryData(allListKey, makeInfiniteList([makeListItem({ id: 'b1' })]));
  const hook = renderHook(() => useOpsCancelBooking(), {
    wrapper: createQueryWrapper(queryClient),
  });
  return { queryClient, notify, ...hook };
}

function listStatus(
  queryClient: ReturnType<typeof setup>['queryClient'],
  key: readonly unknown[],
): string[] {
  const data = queryClient.getQueryData<InfiniteData<OpsBookingsPage>>(key);
  return data?.pages.flatMap((page) => page.items.map((item) => item.status)) ?? [];
}

describe('useOpsCancelBooking', () => {
  it('@contract cancels optimistically everywhere, then drops the row from lists filtered away from it', async () => {
    const request = deferred<{ id: string; status: string }>();
    bookingService.cancelBooking.mockReturnValue(request.promise);
    const { result, queryClient, notify } = setup();

    let outcome: Promise<unknown> = Promise.resolve();
    act(() => {
      outcome = result.current.cancel({ bookingId: 'b1', restaurantId: RESTAURANT_ID });
    });

    await waitFor(() => expect(summaryRow(queryClient, 'b1')?.status).toBe('cancelled'));
    expect(
      queryClient.getQueryData<OpsBookingListItem>(queryKeys.opsBookings.detail('b1'))?.status,
    ).toBe('cancelled');
    expect(listStatus(queryClient, upcomingListKey)).toEqual(['cancelled']);
    await waitFor(() => expect(result.current.isPending('b1')).toBe(true));

    request.resolve({ id: 'b1', status: 'cancelled' });
    await act(async () => {
      await expect(outcome).resolves.toMatchObject({ status: 'done' });
    });

    expect(listStatus(queryClient, upcomingListKey)).toEqual([]);
    expect(listStatus(queryClient, allListKey)).toEqual(['cancelled']);
    expect(notify.success).toHaveBeenCalledWith('Cancelled: Ada');
    expect(bookingService.cancelBooking).toHaveBeenCalledWith({ id: 'b1' });
    await waitFor(() => expect(result.current.isPending('b1')).toBe(false));
  });

  it('@contract rolls back the summary, detail and list rows when the cancel fails', async () => {
    bookingService.cancelBooking.mockRejectedValue(
      new HttpError({ message: 'Server error', status: 500, code: 'INTERNAL_ERROR' }),
    );
    const { result, queryClient, notify } = setup();

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.cancel({ bookingId: 'b1', restaurantId: RESTAURANT_ID });
    });

    expect(outcome).toMatchObject({ status: 'failed' });
    expect(summaryRow(queryClient, 'b1')?.status).toBe('confirmed');
    expect(
      queryClient.getQueryData<OpsBookingListItem>(queryKeys.opsBookings.detail('b1'))?.status,
    ).toBe('confirmed');
    expect(listStatus(queryClient, upcomingListKey)).toEqual(['confirmed']);
    expect(listStatus(queryClient, allListKey)).toEqual(['confirmed']);
    expect(notify.error).toHaveBeenCalledWith('Something went wrong on our side. Try again.');
  });

  it('@contract a not-cancellable 409 shows the server state and explains why', async () => {
    bookingService.cancelBooking.mockRejectedValue(
      new HttpError({
        message: 'Booking cannot be cancelled.',
        status: 409,
        code: 'BOOKING_NOT_CANCELLABLE',
        details: { currentStatus: 'checked_in' },
      }),
    );
    bookingService.getBooking.mockResolvedValue(
      makeListItem({ id: 'b1', status: 'checked_in', checkedInAt: `${DATE}T18:02:00.000Z` }),
    );
    const { result, queryClient, notify } = setup();

    await act(async () => {
      await result.current.cancel({ bookingId: 'b1', restaurantId: RESTAURANT_ID });
    });

    expect(summaryRow(queryClient, 'b1')?.status).toBe('checked_in');
    // Then only this booking is refetched, and its row picks up the server timestamps.
    await waitFor(() =>
      expect(summaryRow(queryClient, 'b1')?.checkedInAt).toBe(`${DATE}T18:02:00.000Z`),
    );
    expect(bookingService.getBooking).toHaveBeenCalledTimes(1);
    expect(notify.error).toHaveBeenCalledWith(
      'This booking can no longer be cancelled: it was seated, finished or marked as a no-show.',
    );
  });

  it('@contract invalidates heatmap and tab counts lazily and never refetches the summary', async () => {
    bookingService.cancelBooking.mockResolvedValue({ id: 'b1', status: 'cancelled' });
    const { result, queryClient } = setup();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      await result.current.cancel({
        bookingId: 'b1',
        restaurantId: RESTAURANT_ID,
        targetDate: DATE,
      });
    });

    const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
    expect(keys).toContainEqual(queryKeys.opsDashboard.heatmapPrefix(RESTAURANT_ID));
    expect(keys).toContainEqual(queryKeys.opsBookings.statusSummaryPrefix(RESTAURANT_ID));
    expect(keys).not.toContainEqual(summaryKey());
  });

  it('@contract tolerates a cold cache', async () => {
    bookingService.cancelBooking.mockResolvedValue({ id: 'b9', status: 'cancelled' });
    const { result } = setup();

    await act(async () => {
      await expect(
        result.current.cancel({ bookingId: 'b9', restaurantId: RESTAURANT_ID }),
      ).resolves.toMatchObject({ status: 'done' });
    });
  });
});
