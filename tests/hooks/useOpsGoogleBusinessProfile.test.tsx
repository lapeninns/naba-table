import { act, renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  useOpsDisconnectGoogleBusinessProfile,
  useOpsGoogleBusinessProfileConnection,
  useOpsLinkGoogleBusinessProfileLocation,
} from '@/hooks/ops/useOpsGoogleBusinessProfile';
import { queryKeys } from '@/lib/query/keys';

import type { GoogleBusinessProfileConnection } from '@/services/ops/restaurants';

const restaurantService = vi.hoisted(() => ({
  getGoogleBusinessProfileConnection: vi.fn(),
  linkGoogleBusinessProfileLocation: vi.fn(),
  disconnectGoogleBusinessProfileConnection: vi.fn(),
}));

vi.mock('@/contexts/ops-services', () => ({
  useRestaurantService: () => restaurantService,
}));

const restaurantId = 'restaurant-1';

function connectionState(): GoogleBusinessProfileConnection {
  return {
    isConfigured: true,
    provider: 'google_business_profile',
    status: 'linked',
    pushEnabled: true,
    connectedGoogleEmail: 'ops@example.com',
    connectedGoogleName: null,
    externalAccountId: 'account-1',
    externalAccountName: 'accounts/1',
    externalLocationId: 'location-1',
    externalLocationName: 'locations/1',
    externalLocationTitle: 'Test Restaurant',
    externalPlaceId: 'place-1',
    lastPullAt: null,
    lastPushAt: null,
    lastError: null,
    availableLocations: [],
    businessInfo: {
      details: null,
      addresses: [],
      phoneNumbers: [],
      links: [],
      categories: [],
      serviceAreas: [],
      hours: [],
      attributes: [],
      serviceItems: [],
      coreNormalization: {
        operatingHours: {
          source: 'unavailable',
          matchStatus: 'unavailable',
          summary: '',
          warnings: [],
          weekly: [],
          overrides: [],
        },
        servicePeriods: {
          source: 'unavailable',
          matchStatus: 'unavailable',
          summary: '',
          warnings: [],
          periods: [],
        },
        bookingHours: {
          matchStatus: 'unavailable',
          summary: '',
          warnings: [],
          missingInputs: [],
        },
      },
    },
  };
}

describe('useOpsGoogleBusinessProfile', () => {
  beforeEach(() => {
    restaurantService.getGoogleBusinessProfileConnection.mockReset();
    restaurantService.getGoogleBusinessProfileConnection.mockResolvedValue(connectionState());
    restaurantService.linkGoogleBusinessProfileLocation.mockReset();
    restaurantService.disconnectGoogleBusinessProfileConnection.mockReset();
    restaurantService.linkGoogleBusinessProfileLocation.mockResolvedValue(connectionState());
    restaurantService.disconnectGoogleBusinessProfileConnection.mockResolvedValue(
      connectionState(),
    );
  });

  it('fetches the connection when enabled (default)', async () => {
    const queryClient = createTestQueryClient();
    const { result } = renderHook(() => useOpsGoogleBusinessProfileConnection(restaurantId), {
      wrapper: createQueryWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(restaurantService.getGoogleBusinessProfileConnection).toHaveBeenCalledTimes(1);
  });

  it('serves the cached connection without fetching when disabled', () => {
    const queryClient = createTestQueryClient();
    const cached = connectionState();
    // Stale cache entry: an enabled query would refetch it on mount.
    queryClient.setQueryData(queryKeys.opsRestaurants.googleBusinessProfile(restaurantId), cached, {
      updatedAt: 0,
    });

    const { result } = renderHook(
      () => useOpsGoogleBusinessProfileConnection(restaurantId, { enabled: false }),
      { wrapper: createQueryWrapper(queryClient) },
    );

    expect(result.current.data).toEqual(cached);
    expect(restaurantService.getGoogleBusinessProfileConnection).not.toHaveBeenCalled();
  });

  it('writes the linked connection without refetching it and invalidates the rest of the integration surface', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createQueryWrapper(queryClient);
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useOpsLinkGoogleBusinessProfileLocation(restaurantId), {
      wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({
        accountName: 'accounts/1',
        accountId: 'account-1',
        locationName: 'locations/1',
        locationId: 'location-1',
      });
    });

    expect(
      queryClient.getQueryData(queryKeys.opsRestaurants.googleBusinessProfile(restaurantId)),
    ).toEqual(connectionState());
    expect(invalidateSpy).not.toHaveBeenCalledWith({
      queryKey: queryKeys.opsRestaurants.googleBusinessProfile(restaurantId),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.opsRestaurants.googleBusinessProfileLocations(restaurantId),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dual-sync-state', restaurantId] });
  });

  it('writes the disconnected connection without refetching it and invalidates the rest of the integration surface', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createQueryWrapper(queryClient);
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useOpsDisconnectGoogleBusinessProfile(restaurantId), {
      wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(
      queryClient.getQueryData(queryKeys.opsRestaurants.googleBusinessProfile(restaurantId)),
    ).toEqual(connectionState());
    expect(invalidateSpy).not.toHaveBeenCalledWith({
      queryKey: queryKeys.opsRestaurants.googleBusinessProfile(restaurantId),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.opsRestaurants.googleBusinessProfileLocations(restaurantId),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dual-sync-state', restaurantId] });
  });
  it('does not issue a second connection GET after linking while the connection is observed', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createQueryWrapper(queryClient);

    const { result } = renderHook(
      () => ({
        connection: useOpsGoogleBusinessProfileConnection(restaurantId),
        link: useOpsLinkGoogleBusinessProfileLocation(restaurantId),
      }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.connection.isSuccess).toBe(true));
    expect(restaurantService.getGoogleBusinessProfileConnection).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.link.mutateAsync({
        accountName: 'accounts/1',
        accountId: 'account-1',
        locationName: 'locations/1',
        locationId: 'location-1',
      });
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(restaurantService.getGoogleBusinessProfileConnection).toHaveBeenCalledTimes(1);
  });
});
