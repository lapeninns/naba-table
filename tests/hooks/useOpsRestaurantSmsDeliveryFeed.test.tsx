import { renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import { describe, expect, it, vi } from 'vitest';

import { SMS_DELIVERY_STATUS_VALUES } from '@/types/smsDelivery';
import { useOpsRestaurantSmsDeliveryFeed } from '@src/hooks/ops/useOpsRestaurantSmsDeliveryFeed';

import type { SmsDeliveryStatus } from '@/types/smsDelivery';

const bookingService = vi.hoisted(() => ({
  getRestaurantSmsDeliveryFeed: vi.fn(),
}));

vi.mock('@/contexts/ops-services', () => ({
  useBookingService: () => bookingService,
}));

function setup(params: Parameters<typeof useOpsRestaurantSmsDeliveryFeed>[0]) {
  const queryClient = createTestQueryClient();
  const wrapper = createQueryWrapper(queryClient);
  return renderHook(() => useOpsRestaurantSmsDeliveryFeed(params), { wrapper });
}

const baseParams = { range: '7d' as const, page: 1, pageSize: 25 };

describe('useOpsRestaurantSmsDeliveryFeed', () => {
  it('@contract stays disabled without a restaurant id', () => {
    setup({ restaurantId: null, ...baseParams });

    expect(bookingService.getRestaurantSmsDeliveryFeed).not.toHaveBeenCalled();
  });

  it('@contract exposes the feed on a successful response', async () => {
    const response = { ok: true, attempts: [{ id: 'sms-1' }] };
    bookingService.getRestaurantSmsDeliveryFeed.mockResolvedValue(response);

    const { result } = setup({ restaurantId: 'rest-1', ...baseParams });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.feed).toEqual(response);
    expect(result.current.unavailable).toBe(false);
    expect(result.current.apiError).toBeNull();
    expect(bookingService.getRestaurantSmsDeliveryFeed).toHaveBeenCalledWith({
      restaurantId: 'rest-1',
      range: '7d',
      page: 1,
      pageSize: 25,
      status: undefined,
    });
  });

  it('@contract normalises statuses to the canonical order and drops unknown values', async () => {
    bookingService.getRestaurantSmsDeliveryFeed.mockResolvedValue({ ok: true, attempts: [] });

    const reversed = [...SMS_DELIVERY_STATUS_VALUES].reverse() as SmsDeliveryStatus[];
    setup({ restaurantId: 'rest-1', ...baseParams, statuses: reversed });

    await waitFor(() =>
      expect(bookingService.getRestaurantSmsDeliveryFeed).toHaveBeenCalledWith(
        expect.objectContaining({ status: [...SMS_DELIVERY_STATUS_VALUES] }),
      ),
    );
  });

  it('@contract flags DELIVERY_LOG_UNAVAILABLE responses as unavailable', async () => {
    bookingService.getRestaurantSmsDeliveryFeed.mockResolvedValue({
      ok: false,
      code: 'DELIVERY_LOG_UNAVAILABLE',
      error: 'missing',
    });

    const { result } = setup({ restaurantId: 'rest-1', ...baseParams });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.unavailable).toBe(true);
    expect(result.current.feed).toBeNull();
    expect(result.current.apiError).toBeNull();
  });

  it('@contract exposes other ok:false responses as api error strings', async () => {
    bookingService.getRestaurantSmsDeliveryFeed.mockResolvedValue({
      ok: false,
      code: 'FORBIDDEN',
      error: 'no access',
    });

    const { result } = setup({ restaurantId: 'rest-1', ...baseParams });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.apiError).toBe('no access');
    expect(result.current.unavailable).toBe(false);
  });
});
