import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HttpError } from '@/lib/http/errors';
import {
  useOpsBookingsLifecycleHandlers,
  type UseOpsBookingsLifecycleHandlersParams,
} from '@src/hooks/ops/useOpsBookingsLifecycleHandlers';

// Seams: the lifecycle mutations bundle (covered by its own suite), sonner
// toasts, and analytics. The handlers only route between them, so no
// QueryClientProvider is needed.
const lifecycle = vi.hoisted(() => ({
  checkIn: { mutate: vi.fn(), mutateAsync: vi.fn() },
  checkOut: { mutate: vi.fn(), mutateAsync: vi.fn() },
  markNoShow: { mutate: vi.fn(), mutateAsync: vi.fn() },
  undoNoShow: { mutate: vi.fn(), mutateAsync: vi.fn() },
}));

const toast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  message: vi.fn(),
}));

const analytics = vi.hoisted(() => ({ track: vi.fn() }));

vi.mock('@/hooks/ops/useOpsBookingStatusActions', () => ({
  useOpsBookingLifecycleActions: () => lifecycle,
}));

vi.mock('sonner', () => ({ toast }));

vi.mock('@/lib/analytics', () => ({ track: analytics.track }));

const restaurantId = 'rest-1';
const targetDate = '2026-07-11';

function setup(overrides: Partial<UseOpsBookingsLifecycleHandlersParams> = {}) {
  const params: UseOpsBookingsLifecycleHandlersParams = {
    restaurantId,
    targetDate,
    isOnline: true,
    getBookingLabel: (bookingId: string) => `Guest ${bookingId}`,
    ...overrides,
  };
  return renderHook(() => useOpsBookingsLifecycleHandlers(params));
}

describe('useOpsBookingsLifecycleHandlers', () => {
  beforeEach(() => {
    for (const mutation of Object.values(lifecycle)) {
      mutation.mutateAsync.mockResolvedValue({ status: 'ok' });
    }
  });

  it('@contract every handler is a no-op without a restaurant id', async () => {
    const { result } = setup({ restaurantId: null });

    await act(async () => {
      await result.current.onCheckIn('b-1');
      await result.current.onCheckOut('b-1');
      await result.current.onMarkNoShow('b-1');
      await result.current.onUndoNoShow('b-1');
    });

    for (const mutation of Object.values(lifecycle)) {
      expect(mutation.mutate).not.toHaveBeenCalled();
      expect(mutation.mutateAsync).not.toHaveBeenCalled();
    }
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.message).not.toHaveBeenCalled();
  });

  it('@contract onCheckIn tracks a pending action across the online mutation', async () => {
    let resolveRequest: (value: unknown) => void = () => {};
    lifecycle.checkIn.mutateAsync.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );

    const { result } = setup();
    let flight: Promise<void>;
    act(() => {
      flight = result.current.onCheckIn('b-1');
    });

    expect(result.current.pendingActionsByBookingId).toEqual({ 'b-1': 'check-in' });
    expect(lifecycle.checkIn.mutateAsync).toHaveBeenCalledWith({
      restaurantId,
      bookingId: 'b-1',
      targetDate,
    });

    await act(async () => {
      resolveRequest({ status: 'checked_in' });
      await flight;
    });

    expect(result.current.pendingActionsByBookingId).toEqual({});
    expect(analytics.track).toHaveBeenCalledWith('booking_check_in', {
      booking_id: 'b-1',
      restaurant_id: restaurantId,
      date: targetDate,
      is_online: true,
    });
    expect(toast.success).toHaveBeenCalledWith('Seated: Guest b-1');
  });

  it('@contract onCheckIn queues offline without a pending marker or await', async () => {
    const { result } = setup({ isOnline: false });

    await act(async () => {
      await result.current.onCheckIn('b-1');
    });

    expect(lifecycle.checkIn.mutate).toHaveBeenCalledWith({
      restaurantId,
      bookingId: 'b-1',
      targetDate,
    });
    expect(lifecycle.checkIn.mutateAsync).not.toHaveBeenCalled();
    expect(result.current.pendingActionsByBookingId).toEqual({});
    expect(toast.message).toHaveBeenCalledWith('Queued seat: Guest b-1', {
      description: 'This will sync automatically once you reconnect.',
    });
    expect(analytics.track).not.toHaveBeenCalled();
  });

  it('@contract onCheckIn surfaces failures and falls back to a generic description', async () => {
    lifecycle.checkIn.mutateAsync.mockRejectedValue(new Error('kitchen fire'));
    const { result } = setup();

    await act(async () => {
      await result.current.onCheckIn('b-1');
    });

    expect(toast.error).toHaveBeenCalledWith('Unable to seat guest', {
      description: 'kitchen fire',
    });
    expect(result.current.pendingActionsByBookingId).toEqual({});
    expect(analytics.track).not.toHaveBeenCalled();

    lifecycle.checkIn.mutateAsync.mockRejectedValue('not-an-error');
    await act(async () => {
      await result.current.onCheckIn('b-1');
    });

    expect(toast.error).toHaveBeenLastCalledWith('Unable to seat guest', {
      description: 'Unable to seat guest.',
    });
  });

  it.each([
    ['onCheckIn', lifecycle.checkIn],
    ['onCheckOut', lifecycle.checkOut],
    ['onMarkNoShow', lifecycle.markNoShow],
    ['onUndoNoShow', lifecycle.undoNoShow],
  ] as const)(
    '@contract %s swallows 409 conflicts silently and clears the pending action',
    async (handlerName, mutation) => {
      mutation.mutateAsync.mockRejectedValue(
        new HttpError({ message: 'Conflict', status: 409, code: 'CONFLICT' }),
      );

      const { result } = setup();
      await act(async () => {
        await result.current[handlerName]('b-1');
      });

      expect(toast.error).not.toHaveBeenCalled();
      expect(toast.success).not.toHaveBeenCalled();
      expect(result.current.pendingActionsByBookingId).toEqual({});
    },
  );

  it('@contract onCheckOut emits both completion analytics events on success', async () => {
    const { result } = setup();

    await act(async () => {
      await result.current.onCheckOut('b-2');
    });

    expect(lifecycle.checkOut.mutateAsync).toHaveBeenCalledWith({
      restaurantId,
      bookingId: 'b-2',
      targetDate,
    });
    const expectedProps = {
      booking_id: 'b-2',
      restaurant_id: restaurantId,
      date: targetDate,
      is_online: true,
    };
    expect(analytics.track).toHaveBeenNthCalledWith(1, 'booking_check_out', expectedProps);
    expect(analytics.track).toHaveBeenNthCalledWith(2, 'booking_completed', expectedProps);
    expect(toast.success).toHaveBeenCalledWith('Finished: Guest b-2');
  });

  it('@contract onCheckOut queues offline and reports failures', async () => {
    const offline = setup({ isOnline: false });
    await act(async () => {
      await offline.result.current.onCheckOut('b-2');
    });
    expect(lifecycle.checkOut.mutate).toHaveBeenCalledWith({
      restaurantId,
      bookingId: 'b-2',
      targetDate,
    });
    expect(toast.message).toHaveBeenCalledWith('Queued finish: Guest b-2', {
      description: 'This will sync automatically once you reconnect.',
    });

    lifecycle.checkOut.mutateAsync.mockRejectedValue(new Error('still eating'));
    const online = setup();
    await act(async () => {
      await online.result.current.onCheckOut('b-2');
    });
    expect(toast.error).toHaveBeenCalledWith('Unable to finish booking', {
      description: 'still eating',
    });
  });

  it('@contract onMarkNoShow forwards options and wires the undo toast action', async () => {
    const { result } = setup();

    await act(async () => {
      await result.current.onMarkNoShow('b-3', {
        performedAt: '2026-07-11T19:00:00.000Z',
        reason: 'guest missing',
      });
    });

    expect(lifecycle.markNoShow.mutateAsync).toHaveBeenCalledWith({
      restaurantId,
      bookingId: 'b-3',
      performedAt: '2026-07-11T19:00:00.000Z',
      reason: 'guest missing',
      targetDate,
    });
    expect(analytics.track).toHaveBeenCalledWith('booking_no_show', {
      booking_id: 'b-3',
      restaurant_id: restaurantId,
      date: targetDate,
      is_online: true,
    });
    expect(toast.success).toHaveBeenCalledWith('Marked no-show: Guest b-3', {
      duration: 5000,
      action: { label: 'Undo', onClick: expect.any(Function) },
    });

    const [, options] = toast.success.mock.calls[0] as [
      string,
      { action: { onClick: () => void } },
    ];
    await act(async () => {
      options.action.onClick();
    });

    expect(lifecycle.undoNoShow.mutateAsync).toHaveBeenCalledWith({
      restaurantId,
      bookingId: 'b-3',
      reason: null,
      targetDate,
    });
  });

  it('@contract onMarkNoShow defaults options to null and queues offline', async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.onMarkNoShow('b-3');
    });
    expect(lifecycle.markNoShow.mutateAsync).toHaveBeenCalledWith({
      restaurantId,
      bookingId: 'b-3',
      performedAt: null,
      reason: null,
      targetDate,
    });

    const offline = setup({ isOnline: false });
    await act(async () => {
      await offline.result.current.onMarkNoShow('b-3', { reason: 'walked out' });
    });
    expect(lifecycle.markNoShow.mutate).toHaveBeenCalledWith({
      restaurantId,
      bookingId: 'b-3',
      performedAt: null,
      reason: 'walked out',
      targetDate,
    });
    expect(toast.message).toHaveBeenCalledWith('Queued no-show: Guest b-3', {
      description: 'This will sync automatically once you reconnect.',
    });
    expect(result.current.pendingActionsByBookingId).toEqual({});
  });

  it('@contract onUndoNoShow succeeds without analytics and reports failures', async () => {
    const { result } = setup();

    await act(async () => {
      await result.current.onUndoNoShow('b-4', 'seated after all');
    });

    expect(lifecycle.undoNoShow.mutateAsync).toHaveBeenCalledWith({
      restaurantId,
      bookingId: 'b-4',
      reason: 'seated after all',
      targetDate,
    });
    expect(toast.success).toHaveBeenCalledWith('Undo no-show: Guest b-4');
    expect(analytics.track).not.toHaveBeenCalled();

    lifecycle.undoNoShow.mutateAsync.mockRejectedValue(new Error('already seated'));
    await act(async () => {
      await result.current.onUndoNoShow('b-4');
    });
    expect(toast.error).toHaveBeenCalledWith('Unable to undo no-show', {
      description: 'already seated',
    });
  });

  it('@contract onUndoNoShow queues offline with a null reason default', async () => {
    const { result } = setup({ isOnline: false });

    await act(async () => {
      await result.current.onUndoNoShow('b-4');
    });

    expect(lifecycle.undoNoShow.mutate).toHaveBeenCalledWith({
      restaurantId,
      bookingId: 'b-4',
      reason: null,
      targetDate,
    });
    expect(lifecycle.undoNoShow.mutateAsync).not.toHaveBeenCalled();
    expect(toast.message).toHaveBeenCalledWith('Queued undo no-show: Guest b-4', {
      description: 'This will sync automatically once you reconnect.',
    });
    expect(result.current.pendingActionsByBookingId).toEqual({});
  });

  it('@contract tracks pending actions per booking independently', async () => {
    const resolvers: Array<(value: unknown) => void> = [];
    lifecycle.checkIn.mutateAsync.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvers.push(resolve);
        }),
    );
    let resolveCheckOut: (value: unknown) => void = () => {};
    lifecycle.checkOut.mutateAsync.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCheckOut = resolve;
        }),
    );

    const { result } = setup();
    let checkInFlight: Promise<void>;
    let checkOutFlight: Promise<void>;
    act(() => {
      checkInFlight = result.current.onCheckIn('b-1');
      checkOutFlight = result.current.onCheckOut('b-2');
    });

    expect(result.current.pendingActionsByBookingId).toEqual({
      'b-1': 'check-in',
      'b-2': 'check-out',
    });

    await act(async () => {
      resolvers[0]!({ status: 'checked_in' });
      await checkInFlight;
    });
    expect(result.current.pendingActionsByBookingId).toEqual({ 'b-2': 'check-out' });

    await act(async () => {
      resolveCheckOut({ status: 'completed' });
      await checkOutFlight;
    });
    expect(result.current.pendingActionsByBookingId).toEqual({});
  });
});
