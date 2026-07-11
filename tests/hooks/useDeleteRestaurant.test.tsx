import { renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import { describe, expect, it, vi } from 'vitest';

import { useDeleteRestaurant } from '@/hooks/ops/useDeleteRestaurant';
import { HttpError } from '@/lib/http/errors';
import { fetchJson } from '@/lib/http/fetchJson';
import { queryKeys } from '@/lib/query/keys';

import type { RestaurantsListResponse } from '@/app/api/ops/restaurants/schema';

vi.mock('@/lib/http/fetchJson', () => ({ fetchJson: vi.fn() }));

const restaurantA = { id: 'rest-a', name: 'Alpha' };
const restaurantB = { id: 'rest-b', name: 'Beta' };

function seededClient() {
  const queryClient = createTestQueryClient();
  const list = {
    items: [restaurantA, restaurantB],
    pageInfo: { page: 1, pageSize: 10, total: 2, hasNext: false },
  } as unknown as RestaurantsListResponse;

  queryClient.setQueryData(queryKeys.opsRestaurants.list({ page: 1 }), list);
  return queryClient;
}

describe('useDeleteRestaurant', () => {
  it('@contract optimistically removes the restaurant from list caches and decrements totals', async () => {
    const queryClient = seededClient();
    const wrapper = createQueryWrapper(queryClient);

    let resolveRequest: (value: unknown) => void = () => {};
    vi.mocked(fetchJson).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );

    const { result } = renderHook(() => useDeleteRestaurant(), { wrapper });
    const mutation = result.current.mutateAsync({ id: 'rest-a', name: 'Alpha' });

    await waitFor(() => {
      const list = queryClient.getQueryData<RestaurantsListResponse>(
        queryKeys.opsRestaurants.list({ page: 1 }),
      );
      expect(list?.items).toEqual([restaurantB]);
      expect(list?.pageInfo.total).toBe(1);
    });

    resolveRequest({ success: true });
    await mutation;

    expect(fetchJson).toHaveBeenCalledWith('/api/ops/restaurants/rest-a', { method: 'DELETE' });
  });

  it('@contract restores list caches when the delete fails', async () => {
    const queryClient = seededClient();
    const wrapper = createQueryWrapper(queryClient);

    vi.mocked(fetchJson).mockRejectedValue(
      new HttpError({ message: 'Denied', status: 403, code: 'FORBIDDEN' }),
    );

    const { result } = renderHook(() => useDeleteRestaurant(), { wrapper });

    await expect(
      result.current.mutateAsync({ id: 'rest-a', name: 'Alpha' }),
    ).rejects.toMatchObject({ status: 403 });

    const list = queryClient.getQueryData<RestaurantsListResponse>(
      queryKeys.opsRestaurants.list({ page: 1 }),
    );
    expect(list?.items).toEqual([restaurantA, restaurantB]);
    expect(list?.pageInfo.total).toBe(2);
  });

  it('@contract invalidates list and detail caches once the mutation settles', async () => {
    const queryClient = seededClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const wrapper = createQueryWrapper(queryClient);

    vi.mocked(fetchJson).mockResolvedValue({ success: true } as never);

    const { result } = renderHook(() => useDeleteRestaurant(), { wrapper });
    await result.current.mutateAsync({ id: 'rest-a', name: 'Alpha' });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.opsRestaurants.all });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.opsRestaurants.detail('rest-a'),
    });
  });

  // KNOWN-ISSUE: onMutate reads every cache entry under queryKeys.opsRestaurants.all
  // (['ops', 'restaurants']) via getQueriesData and treats each one as a list. A cached
  // detail entry (['ops', 'restaurants', 'detail', id]) matches that prefix but has no
  // `items`, so `listData.items.filter` throws a TypeError inside onMutate and the DELETE
  // request is never sent. Deleting a restaurant whose detail view was visited therefore
  // fails client-side. Fix belongs in hooks/ops/useDeleteRestaurant.ts (filter to the
  // list key prefix, e.g. queryKeys.opsRestaurants.list()), out of scope for this spec.
  it('@contract KNOWN-ISSUE: a cached detail entry under the restaurants prefix breaks the delete', async () => {
    const queryClient = seededClient();
    queryClient.setQueryData(queryKeys.opsRestaurants.detail('rest-a'), restaurantA);
    const wrapper = createQueryWrapper(queryClient);

    vi.mocked(fetchJson).mockResolvedValue({ success: true } as never);

    const { result } = renderHook(() => useDeleteRestaurant(), { wrapper });

    await expect(
      result.current.mutateAsync({ id: 'rest-a', name: 'Alpha' }),
    ).rejects.toBeInstanceOf(TypeError);
    expect(fetchJson).not.toHaveBeenCalled();
  });
});
