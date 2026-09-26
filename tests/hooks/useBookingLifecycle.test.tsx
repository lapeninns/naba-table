import { act, renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper } from '@tests/utils/reactQuery';
import { beforeEach, describe, expect, it, vi } from 'vitest';


import { HttpError } from '@/lib/http/errors';
import { queryKeys } from '@/lib/query/keys';
import {
  BOOKING_STATE_CONFLICT_COPY,
  useBookingLifecycle,
  type UseBookingLifecycleOptions,
} from '@src/hooks/ops/useBookingLifecycle';

import {
  DATE,
  RESTAURANT_ID,
  createFeedbackQueryClient,
  deferred,
  makeBundle,
  makeInfiniteList,
  makeListItem,
  makeRow,
  makeSummary,
  summaryKey,
  summaryRow,
} from './__helpers__/opsBookingFixtures';

import type { OpsBookingDialogBundle } from '@/services/ops/bookings';
import type { OpsBookingListItem, OpsBookingsPage } from '@/types/ops';
import type { InfiniteData } from '@tanstack/react-query';

const bookingService = vi.hoisted(() => ({
  checkInBooking: vi.fn(),
  checkOutBooking: vi.fn(),
  markNoShowBooking: vi.fn(),
  undoNoShowBooking: vi.fn(),
  getBooking: vi.fn(),
}));
const offlineQueue = vi.hoisted(() => ({
  value: null as { isOffline: boolean; enqueue: ReturnType<typeof vi.fn> } | null,
}));
const stateMachine = vi.hoisted(() => ({
  value: null as {
    beginTransition: ReturnType<typeof vi.fn>;
    commitTransition: ReturnType<typeof vi.fn>;
    rollbackTransition: ReturnType<typeof vi.fn>;
  } | null,
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), message: vi.fn() }));
const analytics = vi.hoisted(() => ({ track: vi.fn() }));

vi.mock('@/contexts/ops-services', () => ({ useBookingService: () => bookingService }));
vi.mock('@/contexts/booking-offline-queue', () => ({
  useBookingOfflineQueue: () => offlineQueue.value,
}));
vi.mock('@/contexts/booking-state-machine', () => ({
  useOptionalBookingStateMachine: () => stateMachine.value,
}));
vi.mock('sonner', () => ({ toast }));
vi.mock('@/lib/analytics', () => ({ track: analytics.track }));

const listKey = queryKeys.opsBookings.list({ restaurantId: RESTAURANT_ID, statuses: 'confirmed' });

function seed() {
  const { queryClient, notify } = createFeedbackQueryClient();
  queryClient.setQueryData(
    summaryKey(),
    makeSummary([makeRow({ id: 'b1', customerName: 'Ada' }), makeRow({ id: 'b2' })]),
  );
  // The dashboard's "today" key for the same date also holds the booking.
  queryClient.setQueryData(
    summaryKey(null),
    makeSummary([makeRow({ id: 'b1', customerName: 'Ada' })]),
  );
  queryClient.setQueryData(queryKeys.opsBookings.detail('b1'), makeListItem({ id: 'b1' }));
  queryClient.setQueryData(
    queryKeys.opsBookings.dialog('b1'),
    makeBundle(makeListItem({ id: 'b1' })),
  );
  queryClient.setQueryData(
    listKey,
    makeInfiniteList([makeListItem({ id: 'b1' }), makeListItem({ id: 'b2' })]),
  );
  return { queryClient, notify };
}

function setup(options?: UseBookingLifecycleOptions) {
  const seeded = seed();
  const hook = renderHook(() => useBookingLifecycle(options), {
    wrapper: createQueryWrapper(seeded.queryClient),
  });
  return { ...seeded, ...hook };
}

const vars = (action: 'check-in' | 'check-out' | 'no-show' | 'undo-no-show', bookingId = 'b1') => ({
  action,
  restaurantId: RESTAURANT_ID,
  bookingId,
  targetDate: DATE,
});

beforeEach(() => {
  offlineQueue.value = null;
  stateMachine.value = {
    beginTransition: vi.fn(),
    commitTransition: vi.fn(),
    rollbackTransition: vi.fn(),
  };
});

describe('useBookingLifecycle', () => {
  it('@contract check-in is optimistic, then writes the canonical row into every cache without refetching', async () => {
    const request = deferred<unknown>();
    bookingService.checkInBooking.mockReturnValue(request.promise);
    const { result, queryClient, notify } = setup();
    const fetchSpy = vi.spyOn(queryClient, 'fetchQuery');
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    let outcome: Promise<unknown> = Promise.resolve();
    act(() => {
      outcome = result.current.run({ ...vars('check-in'), performedAt: `${DATE}T18:00:00.000Z` });
    });

    await waitFor(() => expect(summaryRow(queryClient, 'b1')?.status).toBe('checked_in'));
    expect(summaryRow(queryClient, 'b1', null)?.status).toBe('checked_in');
    expect(result.current.pendingActions.b1).toMatchObject({
      action: 'check-in',
      snapshot: { status: 'confirmed', startTime: '18:00', endTime: '20:00' },
    });
    expect(stateMachine.value?.beginTransition).toHaveBeenCalledWith(
      'b1',
      'checked_in',
      expect.objectContaining({ action: 'check-in' }),
    );

    request.resolve({
      status: 'checked_in',
      checkedInAt: `${DATE}T18:01:00.000Z`,
      checkedOutAt: null,
      changed: true,
      booking: {
        id: 'b1',
        restaurantId: RESTAURANT_ID,
        status: 'checked_in',
        checkedInAt: `${DATE}T18:01:00.000Z`,
        checkedOutAt: null,
        updatedAt: `${DATE}T18:01:00.100Z`,
      },
    });
    await act(async () => {
      await expect(outcome).resolves.toMatchObject({ status: 'done' });
    });

    expect(summaryRow(queryClient, 'b1')?.checkedInAt).toBe(`${DATE}T18:01:00.000Z`);
    expect(
      queryClient.getQueryData<OpsBookingListItem>(queryKeys.opsBookings.detail('b1'))?.status,
    ).toBe('checked_in');
    expect(
      queryClient.getQueryData<OpsBookingDialogBundle>(queryKeys.opsBookings.dialog('b1'))?.booking
        .status,
    ).toBe('checked_in');
    expect(stateMachine.value?.commitTransition).toHaveBeenCalledWith({
      id: 'b1',
      status: 'checked_in',
      updatedAt: `${DATE}T18:01:00.100Z`,
    });
    // The list is filtered to confirmed bookings, so the seated booking leaves it.
    const list = queryClient.getQueryData<InfiniteData<OpsBookingsPage>>(listKey);
    expect(list?.pages[0].items.map((item) => item.id)).toEqual(['b2']);
    expect(list?.pages[0].pageInfo.total).toBe(1);
    // No refetch of summaries, lists or the dialog: only lazy count invalidations.
    expect(fetchSpy).not.toHaveBeenCalled();
    const invalidatedKeys = invalidateSpy.mock.calls.map(([filters]) => filters?.queryKey);
    expect(invalidatedKeys).toEqual(
      expect.arrayContaining([
        queryKeys.opsDashboard.heatmapPrefix(RESTAURANT_ID),
        queryKeys.opsBookings.statusSummaryPrefix(RESTAURANT_ID),
      ]),
    );
    expect(invalidatedKeys).not.toContainEqual(summaryKey());
    expect(notify.success).toHaveBeenCalledWith('Seated: Ada');
    expect(analytics.track).toHaveBeenCalledWith(
      'booking_check_in',
      expect.objectContaining({ booking_id: 'b1' }),
    );
    await waitFor(() => expect(result.current.pendingActions).toEqual({}));
  });

  it('@contract rolls back only the failed booking and shows the action fallback', async () => {
    bookingService.checkInBooking.mockRejectedValue(new TypeError('Failed to fetch'));
    const { result, queryClient, notify } = setup({ getBookingLabel: () => 'Ada' });
    bookingService.checkOutBooking.mockResolvedValue({
      status: 'completed',
      checkedInAt: null,
      checkedOutAt: `${DATE}T20:00:00.000Z`,
    });

    await act(async () => {
      const [failed] = await Promise.all([
        result.current.run(vars('check-in', 'b1')),
        result.current.run(vars('check-out', 'b2')),
      ]);
      expect(failed.status).toBe('failed');
    });

    expect(summaryRow(queryClient, 'b1')?.status).toBe('confirmed');
    expect(summaryRow(queryClient, 'b1')?.checkedInAt).toBeNull();
    // The concurrent change to another booking survives the rollback.
    expect(summaryRow(queryClient, 'b2')?.status).toBe('completed');
    expect(
      queryClient
        .getQueryData<InfiniteData<OpsBookingsPage>>(listKey)
        ?.pages[0].items.find((item) => item.id === 'b1')?.status,
    ).toBe('confirmed');
    expect(stateMachine.value?.rollbackTransition).toHaveBeenCalledWith('b1');
    expect(notify.error).toHaveBeenCalledWith(
      "Couldn't reach the server. Check your connection and try again.",
    );
  });

  it('@contract undo-no-show makes no status guess and applies the server status', async () => {
    const { result, queryClient, notify } = setup();
    queryClient.setQueryData(
      summaryKey(),
      makeSummary([makeRow({ id: 'b1', customerName: 'Ada', status: 'no_show' })]),
    );
    const request = deferred<unknown>();
    bookingService.undoNoShowBooking.mockReturnValue(request.promise);

    let outcome: Promise<unknown> = Promise.resolve();
    act(() => {
      outcome = result.current.run(vars('undo-no-show'));
    });
    await waitFor(() => expect(result.current.pendingActions.b1?.action).toBe('undo-no-show'));
    expect(summaryRow(queryClient, 'b1')?.status).toBe('no_show');
    expect(stateMachine.value?.beginTransition).not.toHaveBeenCalled();

    request.resolve({
      status: 'pending',
      checkedInAt: null,
      checkedOutAt: null,
      assignments: [],
      tablesRestored: false,
      tableRestoration: { status: 'unavailable', tableIds: ['t1'] },
    });
    await act(async () => {
      await outcome;
    });

    expect(summaryRow(queryClient, 'b1')?.status).toBe('pending');
    expect(summaryRow(queryClient, 'b1')?.requiresTableAssignment).toBe(true);
    expect(notify.success).toHaveBeenCalledWith(
      'No-show undone for Ada. Tables were not restored, so assign a table.',
    );
  });

  it('@contract a 409 conflict shows the conflict copy and refreshes only that booking', async () => {
    bookingService.checkInBooking.mockRejectedValue(
      new HttpError({
        message: 'Booking status changed.',
        status: 409,
        code: 'BOOKING_STATE_CONFLICT',
        details: { currentStatus: 'cancelled' },
      }),
    );
    bookingService.getBooking.mockResolvedValue(
      makeListItem({ id: 'b1', status: 'cancelled', checkedInAt: null }),
    );
    const { result, queryClient, notify } = setup();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      await result.current.run(vars('check-in'));
    });

    expect(notify.error).toHaveBeenCalledWith(BOOKING_STATE_CONFLICT_COPY);
    await waitFor(() => expect(bookingService.getBooking).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(summaryRow(queryClient, 'b1')?.status).toBe('cancelled'));
    expect(summaryRow(queryClient, 'b2')?.status).toBe('confirmed');
    expect(invalidateSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: summaryKey() }),
    );
  });

  it('@contract serializes rapid actions on one booking and runs other bookings in parallel', async () => {
    const first = deferred<unknown>();
    bookingService.checkInBooking.mockReturnValueOnce(first.promise);
    bookingService.checkOutBooking.mockResolvedValue({
      status: 'completed',
      checkedInAt: null,
      checkedOutAt: `${DATE}T20:00:00.000Z`,
    });
    bookingService.markNoShowBooking.mockResolvedValue({
      status: 'no_show',
      checkedInAt: null,
      checkedOutAt: null,
    });
    const { result } = setup({ feedback: false });

    let runs: Promise<unknown>[] = [];
    act(() => {
      runs = [
        result.current.run(vars('check-in', 'b1')),
        result.current.run(vars('check-out', 'b1')),
        result.current.run(vars('no-show', 'b2')),
      ];
    });

    await waitFor(() => expect(bookingService.markNoShowBooking).toHaveBeenCalledTimes(1));
    expect(bookingService.checkOutBooking).not.toHaveBeenCalled();

    first.resolve({
      status: 'checked_in',
      checkedInAt: `${DATE}T18:00:00.000Z`,
      checkedOutAt: null,
    });
    await act(async () => {
      await Promise.all(runs);
    });
    expect(bookingService.checkOutBooking).toHaveBeenCalledTimes(1);
  });

  it('@contract no-show success offers Undo, which runs undo-no-show through the same path', async () => {
    bookingService.markNoShowBooking.mockResolvedValue({
      status: 'no_show',
      checkedInAt: null,
      checkedOutAt: null,
      assignments: [],
    });
    bookingService.undoNoShowBooking.mockResolvedValue({
      status: 'confirmed',
      checkedInAt: null,
      checkedOutAt: null,
    });
    const { result, notify } = setup();

    await act(async () => {
      await result.current.run({ ...vars('no-show'), reason: 'late' });
    });
    expect(bookingService.markNoShowBooking).toHaveBeenCalledWith({
      id: 'b1',
      performedAt: undefined,
      reason: 'late',
    });
    expect(notify.success).not.toHaveBeenCalled();
    const [message, options] = toast.success.mock.calls.at(-1) ?? [];
    expect(message).toBe('Marked no-show: Ada');

    await act(async () => {
      (options as { action: { onClick: () => void } }).action.onClick();
    });
    await waitFor(() =>
      expect(bookingService.undoNoShowBooking).toHaveBeenCalledWith({
        id: 'b1',
        reason: undefined,
      }),
    );
  });

  it('@contract treats a no-show replay (409 with the no_show status) as success', async () => {
    bookingService.markNoShowBooking.mockRejectedValue(
      new HttpError({
        message: 'Already a no-show',
        status: 409,
        code: 'BOOKING_STATE_CONFLICT',
        details: { currentStatus: 'no_show' },
      }),
    );
    const { result, queryClient, notify } = setup({ feedback: false });

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.run(vars('no-show'));
    });

    expect(outcome).toMatchObject({ status: 'done' });
    expect(summaryRow(queryClient, 'b1')?.status).toBe('no_show');
    expect(notify.error).not.toHaveBeenCalled();
    expect(bookingService.getBooking).not.toHaveBeenCalled();
  });

  it('@contract treats an undo-no-show replay (409 with the restored status) as success', async () => {
    const { result, queryClient, notify } = setup();
    queryClient.setQueryData(
      summaryKey(),
      makeSummary([makeRow({ id: 'b1', customerName: 'Ada', status: 'no_show' })]),
    );
    bookingService.undoNoShowBooking.mockRejectedValue(
      new HttpError({
        message: 'Already restored',
        status: 409,
        code: 'BOOKING_STATE_CONFLICT',
        details: { currentStatus: 'confirmed' },
      }),
    );

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.run(vars('undo-no-show'));
    });

    // The replayed 409 cannot say whether the first undo restored the tables, so the result says
    // 'unknown' and staff are told to check for a table instead of being told it succeeded cleanly.
    expect(outcome).toMatchObject({
      status: 'done',
      result: { status: 'confirmed', tableRestoration: { status: 'unknown', tableIds: [] } },
    });
    expect(summaryRow(queryClient, 'b1')?.status).toBe('confirmed');
    expect(notify.error).not.toHaveBeenCalled();
    expect(notify.success).toHaveBeenCalledWith(
      'No-show undone for Ada. Tables were not restored, so assign a table.',
    );
    expect(bookingService.getBooking).not.toHaveBeenCalled();
  });

  it('@contract a 409 that is not a state conflict (date locked) rolls back without a refetch', async () => {
    bookingService.checkInBooking.mockRejectedValue(
      new HttpError({ message: 'Locked', status: 409, code: 'LIFECYCLE_DATE_LOCKED' }),
    );
    const { result, queryClient, notify } = setup();

    await act(async () => {
      await result.current.run(vars('check-in'));
    });

    expect(notify.error).toHaveBeenCalledWith(
      'This booking can only be updated on its reservation date.',
    );
    expect(summaryRow(queryClient, 'b1')?.status).toBe('confirmed');
    expect(bookingService.getBooking).not.toHaveBeenCalled();
  });

  it('@contract two queued writes on one booking that both fail end at the server state', async () => {
    const first = deferred<unknown>();
    const second = deferred<unknown>();
    bookingService.checkInBooking.mockReturnValueOnce(first.promise);
    bookingService.checkOutBooking.mockReturnValueOnce(second.promise);
    bookingService.getBooking.mockResolvedValue(
      makeListItem({ id: 'b1', status: 'confirmed', checkedInAt: null, checkedOutAt: null }),
    );
    const { result, queryClient } = setup({ feedback: false });

    let runs: Promise<unknown>[] = [];
    act(() => {
      runs = [
        result.current.run(vars('check-in', 'b1')),
        result.current.run(vars('check-out', 'b1')),
      ];
    });
    // The queued check-out already snapshotted (and patched over) the optimistic check-in.
    await waitFor(() => expect(summaryRow(queryClient, 'b1')?.status).toBe('completed'));

    first.reject(new HttpError({ message: 'Boom', status: 500, code: 'INTERNAL' }));
    await waitFor(() => expect(bookingService.checkOutBooking).toHaveBeenCalledTimes(1));
    second.reject(new HttpError({ message: 'Boom', status: 500, code: 'INTERNAL' }));
    await act(async () => {
      await Promise.all(runs);
    });

    await waitFor(() => expect(summaryRow(queryClient, 'b1')?.status).toBe('confirmed'));
    expect(bookingService.getBooking).toHaveBeenCalledTimes(1);
    expect(
      queryClient
        .getQueryData<InfiniteData<OpsBookingsPage>>(listKey)
        ?.pages[0].items.find((item) => item.id === 'b1')?.status,
    ).toBe('confirmed');
  });

  it('@contract a failure while a later write is queued leaves the booking to that write', async () => {
    const first = deferred<unknown>();
    bookingService.checkInBooking.mockReturnValueOnce(first.promise);
    bookingService.checkOutBooking.mockResolvedValueOnce({
      status: 'completed',
      checkedInAt: null,
      checkedOutAt: `${DATE}T20:00:00.000Z`,
    });
    const { result, queryClient } = setup({ feedback: false });

    let runs: Promise<unknown>[] = [];
    act(() => {
      runs = [
        result.current.run(vars('check-in', 'b1')),
        result.current.run(vars('check-out', 'b1')),
      ];
    });
    await waitFor(() => expect(summaryRow(queryClient, 'b1')?.status).toBe('completed'));

    first.reject(new HttpError({ message: 'Boom', status: 500, code: 'INTERNAL' }));
    await act(async () => {
      await Promise.all(runs);
    });

    expect(summaryRow(queryClient, 'b1')?.status).toBe('completed');
    expect(bookingService.getBooking).not.toHaveBeenCalled();
  });

  it('@contract queues the action offline instead of calling the server', async () => {
    const enqueue = vi.fn();
    offlineQueue.value = { isOffline: true, enqueue };
    const { result } = setup();

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.run(vars('check-in'));
    });

    expect(outcome).toEqual({ status: 'queued' });
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: 'b1',
        action: 'check-in',
        perform: expect.any(Function),
      }),
    );
    expect(toast.message).toHaveBeenCalledWith('Queued seat: Ada', expect.any(Object));
    expect(bookingService.checkInBooking).not.toHaveBeenCalled();
  });

  it('@contract feedback: false keeps toasts off but still syncs caches', async () => {
    bookingService.checkOutBooking.mockResolvedValue({
      status: 'completed',
      checkedInAt: null,
      checkedOutAt: `${DATE}T20:00:00.000Z`,
    });
    const { result, queryClient, notify } = setup({ feedback: false });

    await act(async () => {
      await result.current.run(vars('check-out'));
    });

    expect(summaryRow(queryClient, 'b1')?.status).toBe('completed');
    expect(notify.success).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });
});
