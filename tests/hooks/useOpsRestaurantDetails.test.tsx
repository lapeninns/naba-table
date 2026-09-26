import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createAppQueryClient } from '@/lib/query/client';
import { queryKeys } from '@/lib/query/keys';
import { dualSyncQueryKeys } from '@src/hooks/ops/opsIntegrationQueries';
import {
  useOpsRestaurantDetails,
  useOpsUpdateRestaurantDetails,
} from '@src/hooks/ops/useOpsRestaurantDetails';

import type { RestaurantProfile } from '@/services/ops/restaurants';

const restaurantService = vi.hoisted(() => ({
  getProfile: vi.fn(),
  updateProfile: vi.fn(),
}));

vi.mock('@/contexts/ops-services', () => ({
  useRestaurantService: () => restaurantService,
}));

const restaurantId = 'restaurant-1';
const otherRestaurantId = 'restaurant-2';
const detailKey = queryKeys.opsRestaurants.detail(restaurantId);

function profile(label: string): RestaurantProfile {
  return { label } as unknown as RestaurantProfile;
}

const payload: Partial<RestaurantProfile> = { contactPhone: '+441223000000' };

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

describe('useOpsUpdateRestaurantDetails', () => {
  beforeEach(() => {
    restaurantService.getProfile.mockReset();
    restaurantService.updateProfile.mockReset();
  });

  it('@contract writes the saved profile and invalidates only the dual-sync state for the restaurant', async () => {
    restaurantService.getProfile.mockResolvedValue(profile('loaded'));
    restaurantService.updateProfile.mockResolvedValue(profile('saved'));

    const { result, queryClient, invalidateSpy } = setup(() => ({
      query: useOpsRestaurantDetails(restaurantId),
      save: useOpsUpdateRestaurantDetails(restaurantId),
    }));
    await waitFor(() => expect(result.current.query.data).toEqual(profile('loaded')));

    await act(async () => {
      await result.current.save.mutateAsync(payload);
    });

    expect(restaurantService.updateProfile).toHaveBeenCalledWith(restaurantId, payload);
    expect(queryClient.getQueryData(detailKey)).toEqual(profile('saved'));
    expect(invalidatedKeys(invalidateSpy)).toEqual([dualSyncQueryKeys.state(restaurantId)]);
    expect(restaurantService.getProfile).toHaveBeenCalledTimes(1);
  });

  it('@contract a stale GET that resolves after the save does not overwrite the saved profile', async () => {
    restaurantService.getProfile.mockResolvedValueOnce(profile('loaded'));
    restaurantService.updateProfile.mockResolvedValue(profile('saved'));

    const { result, queryClient } = setup(() => ({
      query: useOpsRestaurantDetails(restaurantId),
      save: useOpsUpdateRestaurantDetails(restaurantId),
    }));
    await waitFor(() => expect(result.current.query.data).toEqual(profile('loaded')));

    const staleGet = deferred<RestaurantProfile>();
    restaurantService.getProfile.mockReturnValueOnce(staleGet.promise);
    act(() => {
      void queryClient.refetchQueries({ queryKey: detailKey });
    });
    await waitFor(() => expect(restaurantService.getProfile).toHaveBeenCalledTimes(2));

    await act(async () => {
      await result.current.save.mutateAsync(payload);
    });
    await act(async () => {
      staleGet.resolve(profile('stale'));
      await staleGet.promise;
    });

    expect(queryClient.getQueryData(detailKey)).toEqual(profile('saved'));
    await waitFor(() => expect(result.current.query.data).toEqual(profile('saved')));
  });

  it('@contract two quick saves for the same restaurant run one after the other', async () => {
    const first = deferred<RestaurantProfile>();
    restaurantService.updateProfile
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce(profile('second'));

    const { result, queryClient } = setup(() => ({
      a: useOpsUpdateRestaurantDetails(restaurantId),
      b: useOpsUpdateRestaurantDetails(restaurantId),
    }));

    let firstSave: Promise<RestaurantProfile> = Promise.resolve(profile('none'));
    let secondSave: Promise<RestaurantProfile> = Promise.resolve(profile('none'));
    act(() => {
      firstSave = result.current.a.mutateAsync(payload);
      secondSave = result.current.b.mutateAsync(payload);
    });
    await waitFor(() => expect(restaurantService.updateProfile).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(restaurantService.updateProfile).toHaveBeenCalledTimes(1);

    await act(async () => {
      first.resolve(profile('first'));
      await firstSave;
      await secondSave;
    });

    expect(restaurantService.updateProfile).toHaveBeenCalledTimes(2);
    expect(queryClient.getQueryData(detailKey)).toEqual(profile('second'));
  });

  it('@contract saves for different restaurants do not wait on each other', async () => {
    const first = deferred<RestaurantProfile>();
    restaurantService.updateProfile
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce(profile('other'));

    const { result } = setup(() => ({
      a: useOpsUpdateRestaurantDetails(restaurantId),
      b: useOpsUpdateRestaurantDetails(otherRestaurantId),
    }));

    let firstSave: Promise<RestaurantProfile> = Promise.resolve(profile('none'));
    act(() => {
      firstSave = result.current.a.mutateAsync(payload);
    });
    await act(async () => {
      await result.current.b.mutateAsync(payload);
    });

    expect(restaurantService.updateProfile).toHaveBeenNthCalledWith(2, otherRestaurantId, payload);
    await act(async () => {
      first.resolve(profile('first'));
      await firstSave;
    });
  });

  it('@contract a failed save leaves the cache and dual-sync state untouched', async () => {
    restaurantService.updateProfile.mockRejectedValue(new Error('rejected'));

    const { result, queryClient, invalidateSpy } = setup(() =>
      useOpsUpdateRestaurantDetails(restaurantId),
    );
    queryClient.setQueryData(detailKey, profile('loaded'));

    await act(async () => {
      await expect(result.current.mutateAsync(payload)).rejects.toThrow('rejected');
    });

    expect(queryClient.getQueryData(detailKey)).toEqual(profile('loaded'));
    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it('@contract booking-rule fields refresh the guest booking schedule, not the dashboard', async () => {
    restaurantService.updateProfile.mockResolvedValue(profile('saved'));
    const { result, invalidateSpy } = setup(() => useOpsUpdateRestaurantDetails(restaurantId));

    await act(async () => {
      await result.current.mutateAsync({ reservationIntervalMinutes: 30 });
    });

    expect(invalidatedKeys(invalidateSpy)).toEqual([
      dualSyncQueryKeys.state(restaurantId),
      queryKeys.reservations.schedulePrefix(),
    ]);
  });

  it('@contract a timezone change also refreshes the dashboard summaries', async () => {
    restaurantService.updateProfile.mockResolvedValue(profile('saved'));
    const { result, invalidateSpy } = setup(() => useOpsUpdateRestaurantDetails(restaurantId));

    await act(async () => {
      await result.current.mutateAsync({ timezone: 'Europe/Paris' });
    });

    expect(invalidatedKeys(invalidateSpy)).toEqual([
      dualSyncQueryKeys.state(restaurantId),
      queryKeys.reservations.schedulePrefix(),
      queryKeys.opsDashboard.summaryPrefix(restaurantId),
    ]);
  });

  it('@contract a name or slug change refreshes restaurant lists and notifies the page', async () => {
    restaurantService.updateProfile.mockResolvedValue(profile('saved'));
    const onIdentityChange = vi.fn();
    const { result, queryClient, invalidateSpy } = setup(() =>
      useOpsUpdateRestaurantDetails(restaurantId, { onIdentityChange }),
    );

    await act(async () => {
      await result.current.mutateAsync({ contactPhone: '+441223000000' });
    });
    expect(onIdentityChange).not.toHaveBeenCalled();
    // No cached profile to compare against: a name or slug in the payload counts as a change.
    queryClient.removeQueries({ queryKey: detailKey });

    await act(async () => {
      await result.current.mutateAsync({ name: 'The Bell', slug: 'the-bell' });
    });

    expect(onIdentityChange).toHaveBeenCalledTimes(1);
    expect(onIdentityChange).toHaveBeenCalledWith(profile('saved'));
    expect(invalidatedKeys(invalidateSpy)).toContainEqual(queryKeys.opsRestaurants.list());
  });

  it('@contract a full public-details save that only changes the address invalidates nothing field-based', async () => {
    const stored = {
      name: 'The Bell',
      slug: 'the-bell',
      timezone: 'Europe/London',
      address: '1 Old Street',
      reservationIntervalMinutes: 15,
      reservationDefaultDurationMinutes: 90,
      reservationLastSeatingBufferMinutes: 15,
      reservationLifecycleGraceMinutes: 15,
    } as unknown as RestaurantProfile;
    const saved = { ...stored, address: '1 High Street' } as RestaurantProfile;
    restaurantService.updateProfile.mockResolvedValue(saved);
    const onIdentityChange = vi.fn();
    const { result, queryClient, invalidateSpy } = setup(() =>
      useOpsUpdateRestaurantDetails(restaurantId, { onIdentityChange }),
    );
    queryClient.setQueryData(detailKey, stored);

    await act(async () => {
      // The keys are present but the stored values did not change.
      await result.current.mutateAsync({
        name: 'The Bell',
        slug: 'the-bell',
        timezone: 'Europe/London',
        address: '1 High Street',
      });
    });

    expect(invalidatedKeys(invalidateSpy)).toEqual([dualSyncQueryKeys.state(restaurantId)]);
    expect(onIdentityChange).not.toHaveBeenCalled();
  });

  it('@contract compares against the cached profile: a real rename and timezone change still refresh', async () => {
    const stored = {
      name: 'The Bell',
      slug: 'the-bell',
      timezone: 'Europe/London',
    } as unknown as RestaurantProfile;
    const saved = { ...stored, name: 'The New Bell', timezone: 'Europe/Paris' } as RestaurantProfile;
    restaurantService.updateProfile.mockResolvedValue(saved);
    const onIdentityChange = vi.fn();
    const { result, queryClient, invalidateSpy } = setup(() =>
      useOpsUpdateRestaurantDetails(restaurantId, { onIdentityChange }),
    );
    queryClient.setQueryData(detailKey, stored);

    await act(async () => {
      await result.current.mutateAsync({ name: 'The New Bell', timezone: 'Europe/Paris' });
    });

    expect(invalidatedKeys(invalidateSpy)).toEqual([
      dualSyncQueryKeys.state(restaurantId),
      queryKeys.reservations.schedulePrefix(),
      queryKeys.opsDashboard.summaryPrefix(restaurantId),
      queryKeys.opsRestaurants.list(),
    ]);
    expect(onIdentityChange).toHaveBeenCalledWith(saved);
  });
});
