import { renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import { describe, expect, it, vi } from 'vitest';

import { HttpError } from '@/lib/http/errors';
import { useOpsRestaurantsList } from '@src/hooks/ops/useOpsRestaurants';

const restaurantService = vi.hoisted(() => ({
  listRestaurants: vi.fn(),
}));

vi.mock('@/contexts/ops-services', () => ({
  useRestaurantService: () => restaurantService,
}));

const restaurants = [{ id: 'rest-1', name: 'The Fox', role: 'owner' }];

function setup(options?: Parameters<typeof useOpsRestaurantsList>[0]) {
  const queryClient = createTestQueryClient();
  const wrapper = createQueryWrapper(queryClient);
  return renderHook(() => useOpsRestaurantsList(options), { wrapper });
}

describe('useOpsRestaurantsList', () => {
  it('@contract lists the restaurants for the operator', async () => {
    restaurantService.listRestaurants.mockResolvedValue(restaurants);

    const { result } = setup();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(restaurants);
    expect(restaurantService.listRestaurants).toHaveBeenCalledTimes(1);
  });

  it('@contract can be disabled via options', () => {
    const { result } = setup({ enabled: false });

    expect(result.current.fetchStatus).toBe('idle');
    expect(restaurantService.listRestaurants).not.toHaveBeenCalled();
  });

  it('@contract surfaces service errors', async () => {
    restaurantService.listRestaurants.mockRejectedValue(
      new HttpError({ message: 'Unauthorized', status: 401, code: 'UNAUTHORIZED' }),
    );

    const { result } = setup();

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.status).toBe(401);
  });
});
