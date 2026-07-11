import { renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import { describe, expect, it, vi } from 'vitest';

import { useOpsEmailDeliveryFeed } from '@src/hooks/ops/useOpsEmailDeliveryFeed';

const bookingService = vi.hoisted(() => ({
  getRestaurantEmailDeliveryFeed: vi.fn(),
}));

vi.mock('@/contexts/ops-services', () => ({
  useBookingService: () => bookingService,
}));

function setup(params: Parameters<typeof useOpsEmailDeliveryFeed>[0]) {
  const queryClient = createTestQueryClient();
  const wrapper = createQueryWrapper(queryClient);
  return renderHook(() => useOpsEmailDeliveryFeed(params), { wrapper });
}

describe('useOpsEmailDeliveryFeed', () => {
  it('@contract stays disabled without a restaurant id', () => {
    setup({ restaurantId: null });

    expect(bookingService.getRestaurantEmailDeliveryFeed).not.toHaveBeenCalled();
  });

  it('@contract exposes attempts and summary on a successful response', async () => {
    const attempts = [{ id: 'attempt-1' }];
    const summary = { sent: 10, delivered: 9 };
    bookingService.getRestaurantEmailDeliveryFeed.mockResolvedValue({
      ok: true,
      attempts,
      summary,
    });

    const { result } = setup({ restaurantId: 'rest-1' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.attempts).toEqual(attempts);
    expect(result.current.summary).toEqual(summary);
    expect(result.current.unavailable).toBe(false);
    expect(result.current.apiError).toBeNull();
    expect(result.current.isSummaryLoading).toBe(false);
    expect(bookingService.getRestaurantEmailDeliveryFeed).toHaveBeenCalledWith(
      expect.objectContaining({ restaurantId: 'rest-1', range: '7d', page: 1, pageSize: 50 }),
    );
  });

  it('@contract normalises page and pageSize before querying', async () => {
    bookingService.getRestaurantEmailDeliveryFeed.mockResolvedValue({
      ok: true,
      attempts: [],
      summary: null,
    });

    setup({
      restaurantId: 'rest-1',
      page: Number.NaN,
      pageSize: 9_000,
    });

    await waitFor(() =>
      expect(bookingService.getRestaurantEmailDeliveryFeed).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, pageSize: 200 }),
      ),
    );
  });

  it('@contract flags DELIVERY_LOG_UNAVAILABLE responses as unavailable', async () => {
    bookingService.getRestaurantEmailDeliveryFeed.mockResolvedValue({
      ok: false,
      code: 'DELIVERY_LOG_UNAVAILABLE',
      error: 'missing table',
    });

    const { result } = setup({ restaurantId: 'rest-1' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.unavailable).toBe(true);
    expect(result.current.attempts).toBeNull();
    expect(result.current.apiError).toBeNull();
  });

  it('@contract exposes other ok:false responses as api errors', async () => {
    const response = { ok: false, code: 'RATE_LIMITED', error: 'slow down' };
    bookingService.getRestaurantEmailDeliveryFeed.mockResolvedValue(response);

    const { result } = setup({ restaurantId: 'rest-1' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.apiError).toEqual(response);
    expect(result.current.unavailable).toBe(false);
  });
});
