import { renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import { describe, expect, it, vi } from 'vitest';

import { useOpsBookingEmailDeliveryLog } from '@src/hooks/ops/useOpsBookingEmailDeliveryLog';

const bookingService = vi.hoisted(() => ({
  getBookingEmailDeliveryLog: vi.fn(),
}));

vi.mock('@/contexts/ops-services', () => ({
  useBookingService: () => bookingService,
}));

function setup(
  bookingId: string | null,
  options?: Parameters<typeof useOpsBookingEmailDeliveryLog>[1],
) {
  const queryClient = createTestQueryClient();
  const wrapper = createQueryWrapper(queryClient);
  return renderHook(() => useOpsBookingEmailDeliveryLog(bookingId, options), { wrapper });
}

describe('useOpsBookingEmailDeliveryLog', () => {
  it('@contract stays disabled without a booking id', () => {
    setup(null);

    expect(bookingService.getBookingEmailDeliveryLog).not.toHaveBeenCalled();
  });

  it('@contract exposes delivery events on a successful response', async () => {
    const events = [{ id: 'evt-1', status: 'delivered' }];
    bookingService.getBookingEmailDeliveryLog.mockResolvedValue({ ok: true, events });

    const { result } = setup('booking-1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.events).toEqual(events);
    expect(result.current.unavailable).toBe(false);
    expect(result.current.apiError).toBeNull();
    expect(bookingService.getBookingEmailDeliveryLog).toHaveBeenCalledWith('booking-1', {
      limit: 20,
    });
  });

  it('@contract flags DELIVERY_LOG_UNAVAILABLE responses as unavailable, not errors', async () => {
    const response = { ok: false, code: 'DELIVERY_LOG_UNAVAILABLE', error: 'no table' };
    bookingService.getBookingEmailDeliveryLog.mockResolvedValue(response);

    const { result } = setup('booking-1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.unavailable).toBe(true);
    expect(result.current.events).toBeNull();
    expect(result.current.apiError).toBeNull();
  });

  it('@contract exposes other ok:false responses as api errors', async () => {
    const response = { ok: false, code: 'FORBIDDEN', error: 'nope' };
    bookingService.getBookingEmailDeliveryLog.mockResolvedValue(response);

    const { result } = setup('booking-1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.apiError).toEqual(response);
    expect(result.current.unavailable).toBe(false);
  });

  it('@contract clamps the limit option into the 1-200 range and floors fractions', async () => {
    bookingService.getBookingEmailDeliveryLog.mockResolvedValue({ ok: true, events: [] });

    const tooHigh = setup('booking-1', { limit: 500 });
    await waitFor(() =>
      expect(bookingService.getBookingEmailDeliveryLog).toHaveBeenCalledWith('booking-1', {
        limit: 200,
      }),
    );
    tooHigh.unmount();

    const tooLow = setup('booking-2', { limit: 0 });
    await waitFor(() =>
      expect(bookingService.getBookingEmailDeliveryLog).toHaveBeenCalledWith('booking-2', {
        limit: 1,
      }),
    );
    tooLow.unmount();

    setup('booking-3', { limit: 33.9 });
    await waitFor(() =>
      expect(bookingService.getBookingEmailDeliveryLog).toHaveBeenCalledWith('booking-3', {
        limit: 33,
      }),
    );
  });
});
