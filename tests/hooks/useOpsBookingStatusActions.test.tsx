import { renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HttpError } from '@/lib/http/errors';
import { queryKeys } from '@/lib/query/keys';
import { useOpsBookingLifecycleActions } from '@src/hooks/ops/useOpsBookingStatusActions';

import type { OpsTodayBookingsSummary } from '@/types/ops';

const bookingService = vi.hoisted(() => ({
  checkInBooking: vi.fn(),
  checkOutBooking: vi.fn(),
  markNoShowBooking: vi.fn(),
  undoNoShowBooking: vi.fn(),
}));

const errorBoundary = vi.hoisted(() => ({
  value: null as { reportConflict: ReturnType<typeof vi.fn> } | null,
}));

const offlineQueue = vi.hoisted(() => ({
  value: null as { isOffline: boolean; enqueue: ReturnType<typeof vi.fn> } | null,
}));

const stateMachine = vi.hoisted(() => ({
  value: null as {
    beginTransition: ReturnType<typeof vi.fn>;
    commitTransition: ReturnType<typeof vi.fn>;
    rollbackTransition: ReturnType<typeof vi.fn>;
    getEntry: ReturnType<typeof vi.fn>;
  } | null,
}));

vi.mock('@/contexts/ops-services', () => ({
  useBookingService: () => bookingService,
}));

vi.mock('@/components/features/booking-state-machine', () => ({
  useBookingErrorBoundary: () => errorBoundary.value,
}));

vi.mock('@/contexts/booking-offline-queue', () => ({
  useBookingOfflineQueue: () => offlineQueue.value,
}));

vi.mock('@/contexts/booking-state-machine', () => ({
  useOptionalBookingStateMachine: () => stateMachine.value,
}));

const restaurantId = 'rest-1';
const targetDate = '2026-07-11';
const summaryKey = queryKeys.opsDashboard.summary(restaurantId, targetDate);
const detailKey = queryKeys.opsBookings.detail('booking-1');

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

function seededSetup() {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(summaryKey, makeSummary());
  queryClient.setQueryData(detailKey, {
    id: 'booking-1',
    status: 'confirmed',
    checkedInAt: null,
    checkedOutAt: null,
  });
  const wrapper = createQueryWrapper(queryClient);
  return {
    queryClient,
    ...renderHook(() => useOpsBookingLifecycleActions(), { wrapper }),
  };
}

function summaryBooking(queryClient: ReturnType<typeof createTestQueryClient>) {
  return queryClient.getQueryData<OpsTodayBookingsSummary>(summaryKey)?.bookings[0];
}

describe('useOpsBookingLifecycleActions', () => {
  beforeEach(() => {
    errorBoundary.value = null;
    offlineQueue.value = null;
    stateMachine.value = {
      beginTransition: vi.fn(),
      commitTransition: vi.fn(),
      rollbackTransition: vi.fn(),
      getEntry: vi.fn(() => null),
    };
  });

  it('@contract checkIn applies the optimistic transition then commits the server snapshot', async () => {
    bookingService.checkInBooking.mockResolvedValue({
      status: 'checked_in',
      checkedInAt: '2026-07-11T18:05:00.000Z',
      checkedOutAt: null,
    });

    const { result, queryClient } = seededSetup();

    await result.current.checkIn.mutateAsync({
      restaurantId,
      bookingId: 'booking-1',
      targetDate,
      performedAt: '2026-07-11T18:00:00.000Z',
    });

    expect(bookingService.checkInBooking).toHaveBeenCalledWith({
      id: 'booking-1',
      performedAt: '2026-07-11T18:00:00.000Z',
    });

    const booking = summaryBooking(queryClient);
    expect(booking?.status).toBe('checked_in');
    expect(booking?.checkedInAt).toBe('2026-07-11T18:05:00.000Z');

    expect(queryClient.getQueryData<{ status: string }>(detailKey)?.status).toBe('checked_in');

    expect(stateMachine.value?.beginTransition).toHaveBeenCalledWith(
      'booking-1',
      'checked_in',
      expect.objectContaining({ action: 'check-in' }),
    );
    expect(stateMachine.value?.commitTransition).toHaveBeenCalledWith({
      id: 'booking-1',
      status: 'checked_in',
      updatedAt: null,
    });
  });

  it('@contract checkIn rolls the caches back and reverts the transition on failure', async () => {
    bookingService.checkInBooking.mockRejectedValue(new Error('network down'));

    const { result, queryClient } = seededSetup();

    await expect(
      result.current.checkIn.mutateAsync({
        restaurantId,
        bookingId: 'booking-1',
        targetDate,
        performedAt: '2026-07-11T18:00:00.000Z',
      }),
    ).rejects.toThrow('network down');

    const booking = summaryBooking(queryClient);
    expect(booking?.status).toBe('confirmed');
    expect(booking?.checkedInAt).toBeNull();
    expect(queryClient.getQueryData<{ status: string }>(detailKey)?.status).toBe('confirmed');
    expect(stateMachine.value?.rollbackTransition).toHaveBeenCalledWith('booking-1');
  });

  it('@contract checkOut optimistically completes the booking with the performed timestamp', async () => {
    let resolveRequest: (value: unknown) => void = () => {};
    bookingService.checkOutBooking.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );

    const { result, queryClient } = seededSetup();
    const mutation = result.current.checkOut.mutateAsync({
      restaurantId,
      bookingId: 'booking-1',
      targetDate,
      performedAt: '2026-07-11T20:00:00.000Z',
    });

    await waitFor(() => {
      const booking = summaryBooking(queryClient);
      expect(booking?.status).toBe('completed');
      expect(booking?.checkedOutAt).toBe('2026-07-11T20:00:00.000Z');
    });

    resolveRequest({
      status: 'completed',
      checkedInAt: null,
      checkedOutAt: '2026-07-11T20:00:05.000Z',
    });
    await mutation;

    expect(summaryBooking(queryClient)?.checkedOutAt).toBe('2026-07-11T20:00:05.000Z');
  });

  it('@contract markNoShow and undoNoShow round-trip the booking status', async () => {
    bookingService.markNoShowBooking.mockResolvedValue({
      status: 'no_show',
      checkedInAt: null,
      checkedOutAt: null,
    });
    bookingService.undoNoShowBooking.mockResolvedValue({
      status: 'confirmed',
      checkedInAt: null,
      checkedOutAt: null,
    });

    const { result, queryClient } = seededSetup();

    await result.current.markNoShow.mutateAsync({
      restaurantId,
      bookingId: 'booking-1',
      targetDate,
      reason: 'guest missing',
    });
    expect(bookingService.markNoShowBooking).toHaveBeenCalledWith({
      id: 'booking-1',
      performedAt: undefined,
      reason: 'guest missing',
    });
    expect(summaryBooking(queryClient)?.status).toBe('no_show');

    await result.current.undoNoShow.mutateAsync({
      restaurantId,
      bookingId: 'booking-1',
      targetDate,
    });
    expect(bookingService.undoNoShowBooking).toHaveBeenCalledWith({
      id: 'booking-1',
      reason: undefined,
    });
    expect(summaryBooking(queryClient)?.status).toBe('confirmed');
  });

  it('@contract reports 409 conflicts to the error boundary with the server status details', async () => {
    const reportConflict = vi.fn();
    errorBoundary.value = { reportConflict };
    bookingService.checkInBooking.mockRejectedValue(
      new HttpError({
        message: 'Already completed',
        status: 409,
        code: 'CONFLICT',
        details: { currentStatus: 'completed', updatedAt: '2026-07-11T19:00:00.000Z' },
      }),
    );

    const { result } = seededSetup();

    await expect(
      result.current.checkIn.mutateAsync({
        restaurantId,
        bookingId: 'booking-1',
        targetDate,
      }),
    ).rejects.toMatchObject({ status: 409 });

    expect(reportConflict).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: 'booking-1',
        attemptedStatus: 'checked_in',
        currentStatus: 'completed',
        updatedAt: '2026-07-11T19:00:00.000Z',
      }),
    );
  });

  it('@contract queues lifecycle actions instead of mutating while offline', async () => {
    const enqueue = vi.fn();
    offlineQueue.value = { isOffline: true, enqueue };

    const { result } = seededSetup();

    result.current.checkIn.mutate({ restaurantId, bookingId: 'booking-1', targetDate });

    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: 'booking-1',
        action: 'check-in',
        label: 'Check in',
        perform: expect.any(Function),
      }),
    );
    expect(bookingService.checkInBooking).not.toHaveBeenCalled();
  });

  it('@contract works without optional contexts (no state machine, boundary, or queue)', async () => {
    stateMachine.value = null;
    bookingService.checkInBooking.mockResolvedValue({
      status: 'checked_in',
      checkedInAt: '2026-07-11T18:05:00.000Z',
      checkedOutAt: null,
    });

    const { result, queryClient } = seededSetup();

    await result.current.checkIn.mutateAsync({
      restaurantId,
      bookingId: 'booking-1',
      targetDate,
    });

    expect(summaryBooking(queryClient)?.status).toBe('checked_in');
  });
});
