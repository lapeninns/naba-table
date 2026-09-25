import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const services = vi.hoisted(() => ({
  restaurantService: {
    getProfile: vi.fn(async () => ({ id: 'rest-1' })),
    getBusinessContext: vi.fn(async () => ({})),
    getGoogleBusinessProfileConnection: vi.fn(async () => ({})),
    getOperatingHours: vi.fn(async () => ({ weekly: [], overrides: [] })),
    getServicePeriods: vi.fn(async () => []),
    getTurnBands: vi.fn(async () => ({ bands: [] })),
  },
  occasionService: { listOccasions: vi.fn(async () => []) },
  teamService: { listInvites: vi.fn(async () => []) },
  tableInventoryService: { list: vi.fn(async () => []) },
  menuHierarchyService: { listMenus: vi.fn(async () => []) },
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/app/settings/restaurant/profile',
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/contexts/ops-services', () => ({
  useOpsServices: () => services,
}));

vi.mock('@/contexts/ops-session', () => ({
  useOpsSession: () => ({ activeRestaurantId: 'rest-1' }),
}));

vi.mock('@/contexts/ops-unsaved-changes', () => ({
  useOpsUnsavedChanges: () => ({ confirmNavigation: () => true }),
}));

import { useRestaurantSettingsNav } from '@/components/features/restaurant-settings/useRestaurantSettingsNav';
import { queryKeys } from '@/lib/query/keys';

import type { ReactNode } from 'react';

const AVAILABILITY = '/app/settings/restaurant/availability' as const;

function availabilityFetchCount() {
  return (
    services.restaurantService.getOperatingHours.mock.calls.length +
    services.restaurantService.getServicePeriods.mock.calls.length +
    services.occasionService.listOccasions.mock.calls.length +
    services.restaurantService.getTurnBands.mock.calls.length
  );
}

function renderNav() {
  // A bare client (staleTime 0 by default) so the test proves the prefetch
  // brings its own hook-aligned staleTime instead of relying on app defaults.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const view = renderHook(() => useRestaurantSettingsNav(), { wrapper });
  return { queryClient, ...view };
}

async function prefetch(result: { current: ReturnType<typeof useRestaurantSettingsNav> }) {
  await act(async () => {
    result.current.prefetchSettingsView(AVAILABILITY);
    await Promise.resolve();
  });
  // Let the prefetch promises settle so dataUpdatedAt is recorded.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('useRestaurantSettingsNav prefetch', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('@contract hover then click-focus on Availability fetches each query once (4, not 8)', async () => {
    const { result } = renderNav();

    await prefetch(result); // hover
    expect(availabilityFetchCount()).toBe(4);

    vi.advanceTimersByTime(1_500);
    await prefetch(result); // second trigger 1.5 s later (e.g. focus or re-hover)

    expect(availabilityFetchCount()).toBe(4);
  });

  it('@contract repeat hovers within the hook staleTime issue no requests', async () => {
    const { result } = renderNav();

    await prefetch(result);
    for (let i = 0; i < 3; i += 1) {
      vi.advanceTimersByTime(15_000); // stays inside the shortest (occasions, 60 s) window
      await prefetch(result);
    }

    expect(availabilityFetchCount()).toBe(4);
  });

  it('@contract refetches once the hook staleTime has elapsed', async () => {
    const { result } = renderNav();

    await prefetch(result);
    vi.advanceTimersByTime(5 * 60_000 + 1);
    await prefetch(result);

    // Occasions go stale after 1 min; hours, service periods and turn bands after 5 min.
    expect(availabilityFetchCount()).toBe(8);
  });

  it('@contract refetches an invalidated query even while within staleTime', async () => {
    const { result, queryClient } = renderNav();

    await prefetch(result);
    await act(async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.opsRestaurants.hours('rest-1'),
        refetchType: 'none',
      });
    });
    await prefetch(result);

    expect(services.restaurantService.getOperatingHours).toHaveBeenCalledTimes(2);
    expect(availabilityFetchCount()).toBe(5);
  });
});
