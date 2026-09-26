import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createAppQueryClient } from '@/lib/query/client';
import { queryKeys } from '@/lib/query/keys';
import { dualSyncQueryKeys } from '@src/hooks/ops/opsIntegrationQueries';
import {
  useOpsRemoveRestaurantLogo,
  useOpsRestaurantLogoUpload,
} from '@src/hooks/ops/useOpsRestaurantLogoUpload';

import type * as RestaurantsModule from '@/services/ops/restaurants';
import type { RestaurantProfile } from '@/services/ops/restaurants';

const uploadRestaurantLogoMock = vi.hoisted(() => vi.fn());
const removeRestaurantLogoMock = vi.hoisted(() => vi.fn());

vi.mock('@/services/ops/restaurants', async (importOriginal) => ({
  ...(await importOriginal<typeof RestaurantsModule>()),
  uploadRestaurantLogo: uploadRestaurantLogoMock,
  removeRestaurantLogo: removeRestaurantLogoMock,
}));

const restaurantId = 'restaurant-1';
const detailKey = queryKeys.opsRestaurants.detail(restaurantId);

function profile(logoUrl: string | null): RestaurantProfile {
  return { id: restaurantId, logoUrl } as unknown as RestaurantProfile;
}

function setup<T>(hook: () => T) {
  const queryClient = createAppQueryClient();
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
  const cancelSpy = vi.spyOn(queryClient, 'cancelQueries');
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return { queryClient, invalidateSpy, cancelSpy, ...renderHook(hook, { wrapper: Wrapper }) };
}

describe('restaurant logo mutations', () => {
  beforeEach(() => {
    uploadRestaurantLogoMock.mockReset();
    removeRestaurantLogoMock.mockReset();
  });

  it('writes the saved restaurant from the upload response into the details cache', async () => {
    const file = new File(['png'], 'logo.png', { type: 'image/png' });
    uploadRestaurantLogoMock.mockResolvedValue({
      path: `${restaurantId}/logo-abc.png`,
      url: 'https://cdn.example/logo-abc.png',
      cacheKey: 'abc',
      profile: profile('https://cdn.example/logo-abc.png'),
    });
    const { result, queryClient, invalidateSpy } = setup(() =>
      useOpsRestaurantLogoUpload(restaurantId),
    );
    queryClient.setQueryData(detailKey, profile(null));

    await act(async () => {
      await result.current.mutateAsync(file);
    });

    expect(uploadRestaurantLogoMock).toHaveBeenCalledWith(restaurantId, file);
    expect(queryClient.getQueryData(detailKey)).toEqual(
      profile('https://cdn.example/logo-abc.png'),
    );
    // logoUrl is a dual-sync field (core.logoUrl), so the drift view refreshes too.
    expect(
      invalidateSpy.mock.calls.map(([filters]) => (filters as { queryKey: unknown }).queryKey),
    ).toEqual([dualSyncQueryKeys.state(restaurantId)]);
  });

  it('cancels an in-flight details GET before uploading, so it cannot overwrite the save', async () => {
    uploadRestaurantLogoMock.mockResolvedValue({
      path: 'p',
      url: 'u',
      cacheKey: 'c',
      profile: profile('u'),
    });
    const { result, cancelSpy } = setup(() => useOpsRestaurantLogoUpload(restaurantId));

    await act(async () => {
      await result.current.mutateAsync(new File(['png'], 'logo.png', { type: 'image/png' }));
    });

    expect(cancelSpy).toHaveBeenCalledWith({ queryKey: detailKey });
    expect(cancelSpy.mock.invocationCallOrder[0]).toBeLessThan(
      uploadRestaurantLogoMock.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('removes the logo and stores the canonical restaurant', async () => {
    removeRestaurantLogoMock.mockResolvedValue(profile(null));
    const { result, queryClient, invalidateSpy, cancelSpy } = setup(() =>
      useOpsRemoveRestaurantLogo(restaurantId),
    );
    queryClient.setQueryData(detailKey, profile('https://cdn.example/logo.png'));

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(removeRestaurantLogoMock).toHaveBeenCalledWith(restaurantId);
    expect(queryClient.getQueryData(detailKey)).toEqual(profile(null));
    expect(cancelSpy).toHaveBeenCalledWith({ queryKey: detailKey });
    expect(
      invalidateSpy.mock.calls.map(([filters]) => (filters as { queryKey: unknown }).queryKey),
    ).toEqual([dualSyncQueryKeys.state(restaurantId)]);
  });

  it('declares success toasts and inline errors, ordered with profile saves', async () => {
    uploadRestaurantLogoMock.mockResolvedValue({
      path: 'p',
      url: 'u',
      cacheKey: 'c',
      profile: profile('u'),
    });
    removeRestaurantLogoMock.mockResolvedValue(profile(null));
    const { result, queryClient } = setup(() => ({
      upload: useOpsRestaurantLogoUpload(restaurantId),
      remove: useOpsRemoveRestaurantLogo(restaurantId),
    }));

    await act(async () => {
      await result.current.upload.mutateAsync(new File(['png'], 'logo.png', { type: 'image/png' }));
      await result.current.remove.mutateAsync();
    });

    const [upload, remove] = queryClient.getMutationCache().getAll();
    expect(upload?.options.meta?.feedback).toEqual({
      success: 'Logo uploaded and saved.',
      error: false,
    });
    expect(remove?.options.meta?.feedback).toEqual({ success: 'Logo removed.', error: false });
    // Same scope as useOpsUpdateRestaurantDetails, so logo and profile writes never interleave.
    expect(upload?.options.scope).toEqual({ id: `ops-restaurant-details:${restaurantId}` });
    expect(remove?.options.scope).toEqual({ id: `ops-restaurant-details:${restaurantId}` });
  });

  it('keeps the cache untouched when the upload fails', async () => {
    uploadRestaurantLogoMock.mockRejectedValue(new Error('rejected'));
    const { result, queryClient, invalidateSpy } = setup(() => useOpsRestaurantLogoUpload(restaurantId));
    queryClient.setQueryData(detailKey, profile('https://cdn.example/old.png'));

    await act(async () => {
      await expect(
        result.current.mutateAsync(new File(['png'], 'logo.png', { type: 'image/png' })),
      ).rejects.toThrow('rejected');
    });

    expect(queryClient.getQueryData(detailKey)).toEqual(profile('https://cdn.example/old.png'));
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
