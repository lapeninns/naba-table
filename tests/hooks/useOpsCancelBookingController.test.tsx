import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HttpError } from '@/lib/http/errors';
import {
  shouldCloseCancelConfirmation,
  useOpsCancelBookingController,
} from '@src/hooks/ops/useOpsCancelBookingController';

import type { BookingDTO } from '@/hooks/useBookings';

const cancelHook = vi.hoisted(() => ({
  cancel: vi.fn(),
  pending: new Set<string>(),
}));

vi.mock('@src/hooks/ops/useOpsCancelBooking', () => ({
  useOpsCancelBooking: () => ({
    cancel: cancelHook.cancel,
    isPending: (id: string | null | undefined) => Boolean(id && cancelHook.pending.has(id)),
  }),
}));

const booking = {
  id: 'b1',
  customerName: 'Ada',
  partySize: 2,
  restaurantId: null,
} as unknown as BookingDTO;

function setup(fallbackRestaurantId: string | null = 'rest-1') {
  return renderHook(() => useOpsCancelBookingController<BookingDTO>({ fallbackRestaurantId }));
}

beforeEach(() => {
  cancelHook.pending = new Set();
  cancelHook.cancel.mockResolvedValue({
    status: 'done',
    result: { id: 'b1', status: 'cancelled' },
  });
});

describe('useOpsCancelBookingController', () => {
  it('@contract opens for a booking and closes on success', async () => {
    const { result } = setup();
    act(() => result.current.request(booking));
    expect(result.current.isOpen).toBe(true);

    await act(async () => {
      await result.current.confirm();
    });

    expect(cancelHook.cancel).toHaveBeenCalledWith({ bookingId: 'b1', restaurantId: 'rest-1' });
    expect(result.current.isOpen).toBe(false);
  });

  it('@contract stays open when the cancel fails so the user can retry', async () => {
    cancelHook.cancel.mockResolvedValue({ status: 'failed', error: new Error('boom') });
    const { result } = setup();
    act(() => result.current.request(booking));

    await act(async () => {
      await result.current.confirm();
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.booking?.id).toBe('b1');
  });

  it.each(['BOOKING_NOT_CANCELLABLE', 'BOOKING_NOT_FOUND', 'BOOKING_STATE_CONFLICT'])(
    '@contract closes when a retry cannot help (%s)',
    async (code) => {
      cancelHook.cancel.mockResolvedValue({
        status: 'failed',
        error: new HttpError({
          message: 'No',
          status: code === 'BOOKING_NOT_FOUND' ? 404 : 409,
          code,
        }),
      });
      const { result } = setup();
      act(() => result.current.request(booking));

      await act(async () => {
        await result.current.confirm();
      });

      expect(result.current.isOpen).toBe(false);
    },
  );

  it('@contract stays open on a retryable server error', async () => {
    cancelHook.cancel.mockResolvedValue({
      status: 'failed',
      error: new HttpError({ message: 'Down', status: 503, code: 'SERVICE_UNAVAILABLE' }),
    });
    const { result } = setup();
    act(() => result.current.request(booking));

    await act(async () => {
      await result.current.confirm();
    });

    expect(result.current.isOpen).toBe(true);
  });

  it('@contract ignores close requests while the cancel is in flight', () => {
    cancelHook.pending.add('b1');
    const { result } = setup();
    act(() => result.current.request(booking));
    expect(result.current.isPending).toBe(true);

    act(() => result.current.onOpenChange(false));

    expect(result.current.isOpen).toBe(true);
  });

  it('@contract does nothing without a resolvable restaurant', async () => {
    const { result } = setup(null);
    act(() => result.current.request(booking));

    await act(async () => {
      await result.current.confirm();
    });

    expect(cancelHook.cancel).not.toHaveBeenCalled();
  });
});

describe('shouldCloseCancelConfirmation (booking-details cancel dialog)', () => {
  it('@contract closes after success and after terminal failures, stays open when a retry can help', () => {
    expect(
      shouldCloseCancelConfirmation({ status: 'done', result: { id: 'b1', status: 'cancelled' } }),
    ).toBe(true);
    for (const code of [
      'BOOKING_NOT_CANCELLABLE',
      'BOOKING_NOT_FOUND',
      'BOOKING_STATE_CONFLICT',
      'CUTOFF_PASSED',
    ]) {
      expect(
        shouldCloseCancelConfirmation({
          status: 'failed',
          error: new HttpError({ message: 'No', status: 409, code }),
        }),
      ).toBe(true);
    }
    expect(
      shouldCloseCancelConfirmation({
        status: 'failed',
        error: new HttpError({ message: 'Down', status: 503, code: 'HTTP_503' }),
      }),
    ).toBe(false);
    expect(
      shouldCloseCancelConfirmation({ status: 'failed', error: new TypeError('Failed to fetch') }),
    ).toBe(false);
    expect(
      shouldCloseCancelConfirmation({
        status: 'failed',
        error: new HttpError({ message: 'Offline', status: 0, code: 'OFFLINE', retryable: true }),
      }),
    ).toBe(false);
  });
});
