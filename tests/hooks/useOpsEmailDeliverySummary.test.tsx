import { renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import { describe, expect, it, vi } from 'vitest';

import { useOpsEmailDeliverySummary } from '@src/hooks/ops/useOpsEmailDeliverySummary';

const bookingService = vi.hoisted(() => ({
  getRestaurantEmailDeliverySummary: vi.fn(),
}));

vi.mock('@/contexts/ops-services', () => ({
  useBookingService: () => bookingService,
}));

function setup(params: Parameters<typeof useOpsEmailDeliverySummary>[0]) {
  const queryClient = createTestQueryClient();
  const wrapper = createQueryWrapper(queryClient);
  return renderHook(() => useOpsEmailDeliverySummary(params), { wrapper });
}

describe('useOpsEmailDeliverySummary', () => {
  it('@contract stays disabled without a restaurant id', () => {
    setup({ restaurantId: null });

    expect(bookingService.getRestaurantEmailDeliverySummary).not.toHaveBeenCalled();
  });

  it('@contract exposes the summary on a successful response', async () => {
    const summary = { sent: 12, delivered: 11 };
    bookingService.getRestaurantEmailDeliverySummary.mockResolvedValue({ ok: true, summary });

    const { result } = setup({ restaurantId: 'rest-1', range: '30d' as never });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.summary).toEqual(summary);
    expect(result.current.unavailable).toBe(false);
    expect(result.current.apiError).toBeNull();
    expect(bookingService.getRestaurantEmailDeliverySummary).toHaveBeenCalledWith(
      expect.objectContaining({ restaurantId: 'rest-1', range: '30d' }),
    );
  });

  it('@contract flags DELIVERY_LOG_UNAVAILABLE responses as unavailable', async () => {
    bookingService.getRestaurantEmailDeliverySummary.mockResolvedValue({
      ok: false,
      code: 'DELIVERY_LOG_UNAVAILABLE',
      error: 'missing',
    });

    const { result } = setup({ restaurantId: 'rest-1' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.unavailable).toBe(true);
    expect(result.current.summary).toBeNull();
    expect(result.current.apiError).toBeNull();
  });

  it('@contract exposes other ok:false responses as api errors', async () => {
    const response = { ok: false, code: 'FORBIDDEN', error: 'nope' };
    bookingService.getRestaurantEmailDeliverySummary.mockResolvedValue(response);

    const { result } = setup({ restaurantId: 'rest-1' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.apiError).toEqual(response);
  });
});
