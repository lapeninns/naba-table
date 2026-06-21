import { act, renderHook } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  useOpsDisconnectGoogleBusinessProfile,
  useOpsLinkGoogleBusinessProfileLocation,
} from '@/hooks/ops/useOpsGoogleBusinessProfile';
import { queryKeys } from '@/lib/query/keys';

import type { GoogleBusinessProfileConnection } from '@/services/ops/restaurants';

const restaurantService = vi.hoisted(() => ({
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
    restaurantService.linkGoogleBusinessProfileLocation.mockReset();
    restaurantService.disconnectGoogleBusinessProfileConnection.mockReset();
    restaurantService.linkGoogleBusinessProfileLocation.mockResolvedValue(connectionState());
    restaurantService.disconnectGoogleBusinessProfileConnection.mockResolvedValue(
      connectionState(),
    );
  });

  it('invalidates GBP and dual-sync workspace queries after linking a location', async () => {
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

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.opsRestaurants.googleBusinessProfile(restaurantId),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.opsRestaurants.googleBusinessProfileLocations(restaurantId),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dual-sync-state', restaurantId] });
  });

  it('invalidates GBP and dual-sync workspace queries after disconnecting', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createQueryWrapper(queryClient);
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useOpsDisconnectGoogleBusinessProfile(restaurantId), {
      wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.opsRestaurants.googleBusinessProfile(restaurantId),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.opsRestaurants.googleBusinessProfileLocations(restaurantId),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dual-sync-state', restaurantId] });
  });
});
