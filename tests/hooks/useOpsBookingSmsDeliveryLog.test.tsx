import { renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import { describe, expect, it, vi } from 'vitest';

import { useOpsBookingSmsDeliveryLog } from '@src/hooks/ops/useOpsBookingSmsDeliveryLog';

const bookingService = vi.hoisted(() => ({
  getBookingSmsDeliveryLog: vi.fn(),
}));

vi.mock('@/contexts/ops-services', () => ({
  useBookingService: () => bookingService,
}));

function setup(
  bookingId: string | null,
  options?: Parameters<typeof useOpsBookingSmsDeliveryLog>[1],
) {
  const queryClient = createTestQueryClient();
  const wrapper = createQueryWrapper(queryClient);
  return renderHook(() => useOpsBookingSmsDeliveryLog(bookingId, options), { wrapper });
}

describe('useOpsBookingSmsDeliveryLog', () => {
  it('@contract stays disabled without a booking id', () => {
    setup(null);

    expect(bookingService.getBookingSmsDeliveryLog).not.toHaveBeenCalled();
  });

  it('@contract exposes delivery events on a successful response', async () => {
    const events = [{ id: 'sms-1', status: 'delivered' }];
    bookingService.getBookingSmsDeliveryLog.mockResolvedValue({ ok: true, events });

    const { result } = setup('booking-1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.events).toEqual(events);
    expect(result.current.unavailable).toBe(false);
    expect(result.current.apiError).toBeNull();
    expect(bookingService.getBookingSmsDeliveryLog).toHaveBeenCalledWith('booking-1', {
      limit: 20,
    });
  });

  it('@contract flags DELIVERY_LOG_UNAVAILABLE responses as unavailable, not errors', async () => {
    bookingService.getBookingSmsDeliveryLog.mockResolvedValue({
      ok: false,
      code: 'DELIVERY_LOG_UNAVAILABLE',
      error: 'missing',
    });

    const { result } = setup('booking-1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.unavailable).toBe(true);
    expect(result.current.events).toBeNull();
    expect(result.current.apiError).toBeNull();
  });

  it('@contract exposes other ok:false responses as api errors', async () => {
    const response = { ok: false, code: 'FORBIDDEN', error: 'nope' };
    bookingService.getBookingSmsDeliveryLog.mockResolvedValue(response);

    const { result } = setup('booking-1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.apiError).toEqual(response);
  });

  it('@contract clamps the limit option into the 1-200 range', async () => {
    bookingService.getBookingSmsDeliveryLog.mockResolvedValue({ ok: true, events: [] });

    setup('booking-1', { limit: 9999 });

    await waitFor(() =>
      expect(bookingService.getBookingSmsDeliveryLog).toHaveBeenCalledWith('booking-1', {
        limit: 200,
      }),
    );
  });
});
