import { act, renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper } from '@tests/utils/reactQuery';
import { describe, expect, it, vi } from 'vitest';


import { useOpsDashboardBookingActions } from '@/components/features/dashboard/useOpsDashboardBookingActions';
import { useBookingLifecycle } from '@src/hooks/ops/useBookingLifecycle';
import { useOpsTableAssignmentActions } from '@src/hooks/ops/useOpsTableAssignments';

import {
  DATE,
  RESTAURANT_ID,
  createFeedbackQueryClient,
  deferred,
  makeRow,
  makeSummary,
  summaryKey,
} from '../hooks/__helpers__/opsBookingFixtures';

const bookingService = vi.hoisted(() => ({
  checkInBooking: vi.fn(),
  markNoShowBooking: vi.fn(),
  assignTable: vi.fn(),
  unassignTable: vi.fn(),
}));

vi.mock('@/contexts/ops-services', () => ({ useBookingService: () => bookingService }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() } }));

function setup() {
  const { queryClient, notify } = createFeedbackQueryClient();
  queryClient.setQueryData(
    summaryKey(),
    makeSummary([makeRow({ id: 'b1' }), makeRow({ id: 'b2' })]),
  );
  const hook = renderHook(
    () => {
      const lifecycle = useBookingLifecycle();
      const tableAssignmentActions = useOpsTableAssignmentActions({
        restaurantId: RESTAURANT_ID,
        date: DATE,
      });
      return useOpsDashboardBookingActions({
        restaurantId: RESTAURANT_ID,
        selectedDate: DATE,
        lifecycle,
        tableAssignmentActions,
      });
    },
    { wrapper: createQueryWrapper(queryClient) },
  );
  return { queryClient, notify, ...hook };
}

describe('useOpsDashboardBookingActions', () => {
  it('@contract tracks pending actions per booking, so two bookings can be pending at once', async () => {
    const first = deferred<unknown>();
    const second = deferred<unknown>();
    bookingService.checkInBooking.mockImplementation(({ id }: { id: string }) =>
      id === 'b1' ? first.promise : second.promise,
    );
    const { result } = setup();

    let runs: Promise<void>[] = [];
    act(() => {
      runs = [result.current.handleCheckIn('b1'), result.current.handleCheckIn('b2')];
    });

    await waitFor(() =>
      expect(Object.keys(result.current.pendingLifecycleActions).sort()).toEqual(['b1', 'b2']),
    );
    expect(result.current.pendingLifecycleActions.b1).toMatchObject({
      action: 'check-in',
      snapshot: { status: 'confirmed', startTime: '18:00', endTime: '20:00' },
    });

    first.resolve({
      status: 'checked_in',
      checkedInAt: `${DATE}T18:00:00.000Z`,
      checkedOutAt: null,
    });
    await waitFor(() =>
      expect(Object.keys(result.current.pendingLifecycleActions)).toEqual(['b2']),
    );

    second.resolve({
      status: 'checked_in',
      checkedInAt: `${DATE}T18:00:00.000Z`,
      checkedOutAt: null,
    });
    await act(async () => {
      await Promise.all(runs);
    });
    await waitFor(() => expect(result.current.pendingLifecycleActions).toEqual({}));
  });

  it('@contract handlers resolve on failure and the error reaches the user as a toast', async () => {
    bookingService.markNoShowBooking.mockRejectedValue(new TypeError('Failed to fetch'));
    const { result, notify } = setup();

    await act(async () => {
      await expect(
        result.current.handleMarkNoShow('b1', { reason: 'late' }),
      ).resolves.toBeUndefined();
    });

    expect(bookingService.markNoShowBooking).toHaveBeenCalledWith({
      id: 'b1',
      performedAt: undefined,
      reason: 'late',
    });
    expect(notify.error).toHaveBeenCalledWith(
      "Couldn't reach the server. Check your connection and try again.",
    );
  });

  it('@contract quick-assign reports its pending table and passes an idempotency key', async () => {
    const request = deferred<unknown>();
    bookingService.assignTable.mockReturnValue(request.promise);
    const { result } = setup();

    let done: Promise<unknown> = Promise.resolve();
    act(() => {
      done = result.current.handleAssignTable('b1', 't1', 'T1');
    });
    await waitFor(() =>
      expect(result.current.tableActionState).toEqual({
        type: 'assign',
        bookingId: 'b1',
        tableId: 't1',
        tableName: 'T1',
      }),
    );
    expect(bookingService.assignTable).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: expect.any(String) }),
    );

    request.resolve({ tableAssignments: [] });
    await act(async () => {
      await done;
    });
    await waitFor(() => expect(result.current.tableActionState).toBeNull());
  });
});
