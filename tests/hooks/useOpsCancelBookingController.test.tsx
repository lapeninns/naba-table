import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useOpsCancelBookingController } from '@src/hooks/ops/useOpsCancelBookingController';

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
