import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HttpError } from '@/lib/http/errors';
import { createAppQueryClient } from '@/lib/query/client';
import { queryKeys } from '@/lib/query/keys';
import { dualSyncQueryKeys } from '@src/hooks/ops/opsIntegrationQueries';
import {
  useOpsRestaurantBusinessContext,
  useOpsUpdateRestaurantBusinessContext,
} from '@src/hooks/ops/useOpsRestaurantBusinessContext';

import type {
  RestaurantBusinessContextSnapshot,
  UpdateRestaurantBusinessContextInput,
} from '@/services/ops/restaurants';

const restaurantService = vi.hoisted(() => ({
  getBusinessContext: vi.fn(),
  updateBusinessContext: vi.fn(),
}));

vi.mock('@/contexts/ops-services', () => ({
  useRestaurantService: () => restaurantService,
}));

const restaurantId = 'restaurant-1';
const otherRestaurantId = 'restaurant-2';
const contextKey = queryKeys.opsRestaurants.businessContext(restaurantId);

function snapshot(label: string): RestaurantBusinessContextSnapshot {
  return { label } as unknown as RestaurantBusinessContextSnapshot;
}

const payload = { categories: [] } as unknown as UpdateRestaurantBusinessContextInput;

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void };

function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function setup<T>(hook: () => T) {
  const queryClient: QueryClient = createAppQueryClient();
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return { queryClient, invalidateSpy, ...renderHook(hook, { wrapper: Wrapper }) };
}

function invalidatedKeys(invalidateSpy: ReturnType<typeof vi.spyOn>) {
  return (invalidateSpy.mock.calls as Array<[{ queryKey: readonly unknown[] }]>).map(
    ([filters]) => filters.queryKey,
  );
}

describe('useOpsUpdateRestaurantBusinessContext', () => {
  beforeEach(() => {
    restaurantService.getBusinessContext.mockReset();
    restaurantService.updateBusinessContext.mockReset();
  });

  it('@contract writes the saved snapshot and invalidates only the dual-sync state for the restaurant', async () => {
    restaurantService.getBusinessContext.mockResolvedValue(snapshot('loaded'));
    restaurantService.updateBusinessContext.mockResolvedValue(snapshot('saved'));

    const { result, queryClient, invalidateSpy } = setup(() => ({
      query: useOpsRestaurantBusinessContext(restaurantId),
      save: useOpsUpdateRestaurantBusinessContext(restaurantId),
    }));
    await waitFor(() => expect(result.current.query.data).toEqual(snapshot('loaded')));

    await act(async () => {
      await result.current.save.mutateAsync(payload);
    });

    expect(restaurantService.updateBusinessContext).toHaveBeenCalledWith(restaurantId, payload);
    expect(queryClient.getQueryData(contextKey)).toEqual(snapshot('saved'));
    expect(invalidatedKeys(invalidateSpy)).toEqual([dualSyncQueryKeys.state(restaurantId)]);
    expect(restaurantService.getBusinessContext).toHaveBeenCalledTimes(1);
  });

  it('@contract a stale GET that resolves after the save does not overwrite the saved snapshot', async () => {
    restaurantService.getBusinessContext.mockResolvedValueOnce(snapshot('loaded'));
    restaurantService.updateBusinessContext.mockResolvedValue(snapshot('saved'));

    const { result, queryClient } = setup(() => ({
      query: useOpsRestaurantBusinessContext(restaurantId),
      save: useOpsUpdateRestaurantBusinessContext(restaurantId),
    }));
    await waitFor(() => expect(result.current.query.data).toEqual(snapshot('loaded')));

    const staleGet = deferred<RestaurantBusinessContextSnapshot>();
    restaurantService.getBusinessContext.mockReturnValueOnce(staleGet.promise);
    act(() => {
      void queryClient.refetchQueries({ queryKey: contextKey });
    });
    await waitFor(() => expect(restaurantService.getBusinessContext).toHaveBeenCalledTimes(2));

    await act(async () => {
      await result.current.save.mutateAsync(payload);
    });
    await act(async () => {
      staleGet.resolve(snapshot('stale'));
      await staleGet.promise;
    });

    expect(queryClient.getQueryData(contextKey)).toEqual(snapshot('saved'));
    await waitFor(() => expect(result.current.query.data).toEqual(snapshot('saved')));
  });

  it('@contract two quick saves for the same restaurant run one after the other', async () => {
    const first = deferred<RestaurantBusinessContextSnapshot>();
    restaurantService.updateBusinessContext
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce(snapshot('second'));

    const { result, queryClient } = setup(() => ({
      a: useOpsUpdateRestaurantBusinessContext(restaurantId),
      b: useOpsUpdateRestaurantBusinessContext(restaurantId),
    }));

    let firstSave: Promise<RestaurantBusinessContextSnapshot> = Promise.resolve(snapshot('none'));
    let secondSave: Promise<RestaurantBusinessContextSnapshot> = Promise.resolve(snapshot('none'));
    act(() => {
      firstSave = result.current.a.mutateAsync(payload);
      secondSave = result.current.b.mutateAsync(payload);
    });
    await waitFor(() => expect(restaurantService.updateBusinessContext).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(restaurantService.updateBusinessContext).toHaveBeenCalledTimes(1);

    await act(async () => {
      first.resolve(snapshot('first'));
      await firstSave;
      await secondSave;
    });

    expect(restaurantService.updateBusinessContext).toHaveBeenCalledTimes(2);
    expect(queryClient.getQueryData(contextKey)).toEqual(snapshot('second'));
  });

  it('@contract saves for different restaurants do not wait on each other', async () => {
    const first = deferred<RestaurantBusinessContextSnapshot>();
    restaurantService.updateBusinessContext
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce(snapshot('other'));

    const { result } = setup(() => ({
      a: useOpsUpdateRestaurantBusinessContext(restaurantId),
      b: useOpsUpdateRestaurantBusinessContext(otherRestaurantId),
    }));

    let firstSave: Promise<RestaurantBusinessContextSnapshot> = Promise.resolve(snapshot('none'));
    act(() => {
      firstSave = result.current.a.mutateAsync(payload);
    });
    await act(async () => {
      await result.current.b.mutateAsync(payload);
    });

    expect(restaurantService.updateBusinessContext).toHaveBeenNthCalledWith(
      2,
      otherRestaurantId,
      payload,
    );
    await act(async () => {
      first.resolve(snapshot('first'));
      await firstSave;
    });
  });

  it('@contract a failed save leaves the cache and dual-sync state untouched', async () => {
    restaurantService.updateBusinessContext.mockRejectedValue(new Error('rejected'));

    const { result, queryClient, invalidateSpy } = setup(() =>
      useOpsUpdateRestaurantBusinessContext(restaurantId),
    );
    queryClient.setQueryData(contextKey, snapshot('loaded'));

    await act(async () => {
      await expect(result.current.mutateAsync(payload)).rejects.toThrow('rejected');
    });

    expect(queryClient.getQueryData(contextKey)).toEqual(snapshot('loaded'));
    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it('@contract a 409 STALE_WRITE refetches the snapshot once so the next save sends the new revision', async () => {
    restaurantService.getBusinessContext
      .mockResolvedValueOnce({ ...snapshot('loaded'), revision: 1 })
      .mockResolvedValueOnce({ ...snapshot('latest'), revision: 2 });
    restaurantService.updateBusinessContext
      .mockRejectedValueOnce(new HttpError({ message: 'stale', status: 409, code: 'STALE_WRITE' }))
      .mockResolvedValueOnce({ ...snapshot('saved'), revision: 3 });

    const { result } = setup(() => ({
      query: useOpsRestaurantBusinessContext(restaurantId),
      save: useOpsUpdateRestaurantBusinessContext(restaurantId),
    }));
    await waitFor(() => expect(result.current.query.data).toMatchObject({ revision: 1 }));

    await act(async () => {
      await expect(
        result.current.save.mutateAsync({ ...payload, expectedRevision: 1 }),
      ).rejects.toThrow('stale');
    });
    await waitFor(() => expect(result.current.query.data).toMatchObject({ revision: 2 }));
    expect(restaurantService.getBusinessContext).toHaveBeenCalledTimes(2);

    await act(async () => {
      await result.current.save.mutateAsync({ ...payload, expectedRevision: 2 });
    });
    expect(restaurantService.updateBusinessContext).toHaveBeenLastCalledWith(restaurantId, {
      ...payload,
      expectedRevision: 2,
    });
  });
});
