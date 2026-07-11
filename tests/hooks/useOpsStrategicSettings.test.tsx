import { renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import { describe, expect, it, vi } from 'vitest';

import { queryKeys } from '@/lib/query/keys';
import {
  useOpsStrategicSettings,
  useUpdateOpsStrategicSettings,
} from '@src/hooks/ops/useOpsStrategicSettings';

const bookingService = vi.hoisted(() => ({
  getStrategicSettings: vi.fn(),
  updateStrategicSettings: vi.fn(),
}));

vi.mock('@/contexts/ops-services', () => ({
  useBookingService: () => bookingService,
}));

const settings = { restaurantId: 'rest-1', pacing: 'steady' };

function setup<T>(hook: () => T) {
  const queryClient = createTestQueryClient();
  const wrapper = createQueryWrapper(queryClient);
  return { queryClient, ...renderHook(hook, { wrapper }) };
}

describe('useOpsStrategicSettings', () => {
  it('@contract stays disabled without a restaurant id', () => {
    setup(() => useOpsStrategicSettings({ restaurantId: null }));

    expect(bookingService.getStrategicSettings).not.toHaveBeenCalled();
  });

  it('@contract stays disabled when explicitly disabled', () => {
    setup(() => useOpsStrategicSettings({ restaurantId: 'rest-1', enabled: false }));

    expect(bookingService.getStrategicSettings).not.toHaveBeenCalled();
  });

  it('@contract fetches strategic settings for the restaurant', async () => {
    bookingService.getStrategicSettings.mockResolvedValue(settings);

    const { result } = setup(() => useOpsStrategicSettings({ restaurantId: 'rest-1' }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(settings);
    expect(bookingService.getStrategicSettings).toHaveBeenCalledWith({
      restaurantId: 'rest-1',
    });
  });

  it('@contract surfaces service errors', async () => {
    bookingService.getStrategicSettings.mockRejectedValue(new Error('boom'));

    const { result } = setup(() => useOpsStrategicSettings({ restaurantId: 'rest-1' }));

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useUpdateOpsStrategicSettings', () => {
  it('@contract primes the settings cache keyed by the response restaurant id', async () => {
    bookingService.updateStrategicSettings.mockResolvedValue(settings);

    const { result, queryClient } = setup(() => useUpdateOpsStrategicSettings());

    await result.current.mutateAsync({ restaurantId: 'rest-1', pacing: 'steady' } as never);

    expect(
      queryClient.getQueryData(queryKeys.opsSettings.strategicConfig('rest-1')),
    ).toEqual(settings);
  });

  it('@contract propagates update failures', async () => {
    bookingService.updateStrategicSettings.mockRejectedValue(new Error('rejected'));

    const { result } = setup(() => useUpdateOpsStrategicSettings());

    await expect(result.current.mutateAsync({} as never)).rejects.toThrow('rejected');
  });
});
