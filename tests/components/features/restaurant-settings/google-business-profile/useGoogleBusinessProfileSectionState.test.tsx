import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createTestQueryClient } from '@tests/utils/reactQuery';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useGoogleBusinessProfileSectionState } from '@/components/features/restaurant-settings/google-business-profile/useGoogleBusinessProfileSectionState';

import type { GoogleBusinessProfileConnection } from '@/services/ops/restaurants';

const restaurantService = vi.hoisted(() => ({
  getGoogleBusinessProfileConnection: vi.fn(),
  getGoogleBusinessProfileAvailableLocations: vi.fn(),
  linkGoogleBusinessProfileLocation: vi.fn(),
  disconnectGoogleBusinessProfileConnection: vi.fn(),
  startGoogleBusinessProfileAuthorization: vi.fn(),
}));

vi.mock('@/contexts/ops-services', () => ({
  useRestaurantService: () => restaurantService,
}));
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const LOCATION = {
  accountName: 'accounts/1',
  accountId: 'a-1',
  accountDisplayName: 'Ops Account',
  locationName: 'locations/1',
  locationId: 'l-1',
  title: 'Nabatable Main',
  addressText: '1 Test St, London',
  placeId: 'place-1',
};

function authorizedConnection(): GoogleBusinessProfileConnection {
  return {
    status: 'authorized',
    connectedGoogleEmail: 'ops@example.com',
    availableLocations: [LOCATION],
  } as unknown as GoogleBusinessProfileConnection;
}

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function setup() {
  const queryClient = createTestQueryClient();
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return renderHook(() => useGoogleBusinessProfileSectionState({ restaurantId: 'rest-1' }), {
    wrapper: Wrapper,
  });
}

describe('useGoogleBusinessProfileSectionState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    restaurantService.getGoogleBusinessProfileConnection.mockResolvedValue(authorizedConnection());
    restaurantService.getGoogleBusinessProfileAvailableLocations.mockResolvedValue([LOCATION]);
  });

  it('@contract "Check again" fetches the rate-limited Google endpoints once each', async () => {
    const { result } = setup();
    await waitFor(() =>
      expect(restaurantService.getGoogleBusinessProfileAvailableLocations).toHaveBeenCalledTimes(1),
    );
    expect(restaurantService.getGoogleBusinessProfileConnection).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.refreshHandler();
    });

    await waitFor(() =>
      expect(restaurantService.getGoogleBusinessProfileConnection).toHaveBeenCalledTimes(2),
    );
    await waitFor(() =>
      expect(restaurantService.getGoogleBusinessProfileAvailableLocations).toHaveBeenCalledTimes(2),
    );
    await waitFor(() => expect(result.current.connectionQuery.isFetching).toBe(false));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(restaurantService.getGoogleBusinessProfileConnection).toHaveBeenCalledTimes(2);
    expect(restaurantService.getGoogleBusinessProfileAvailableLocations).toHaveBeenCalledTimes(2);
  });

  it('@contract a double click on Link sends one link request', async () => {
    const link = deferred<GoogleBusinessProfileConnection>();
    restaurantService.linkGoogleBusinessProfileLocation.mockReturnValue(link.promise);
    const { result } = setup();
    await waitFor(() => expect(result.current.selectedLocation).not.toBeNull());

    act(() => {
      result.current.handleLinkLocation();
      result.current.handleLinkLocation();
    });
    await waitFor(() => expect(result.current.linkMutation.isPending).toBe(true));
    act(() => {
      result.current.handleLinkLocation();
    });

    expect(restaurantService.linkGoogleBusinessProfileLocation).toHaveBeenCalledTimes(1);

    await act(async () => {
      link.resolve({
        ...authorizedConnection(),
        status: 'linked',
      } as GoogleBusinessProfileConnection);
      await link.promise;
    });
    await waitFor(() => expect(result.current.linkMutation.isPending).toBe(false));

    // Once settled, a new attempt is allowed again.
    restaurantService.linkGoogleBusinessProfileLocation.mockResolvedValue(authorizedConnection());
    act(() => {
      result.current.handleLinkLocation();
    });
    await waitFor(() =>
      expect(restaurantService.linkGoogleBusinessProfileLocation).toHaveBeenCalledTimes(2),
    );
  });
});
