import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
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
  useRestaurantService: () => services.restaurantService,
  useOccasionService: () => services.occasionService,
}));

vi.mock('@/contexts/ops-session', () => ({
  useOpsSession: () => ({ activeRestaurantId: 'rest-1' }),
}));

vi.mock('@/contexts/ops-unsaved-changes', () => ({
  useOpsUnsavedChanges: () => ({ confirmNavigation: () => true }),
}));

import { useRestaurantSettingsNav } from '@/components/features/restaurant-settings/useRestaurantSettingsNav';
import { useOpsOccasions } from '@/hooks/ops/useOccasions';
import { useOpsOperatingHours } from '@/hooks/ops/useOpsOperatingHours';
import { useOpsServicePeriods } from '@/hooks/ops/useOpsServicePeriods';
import { useOpsTurnBands } from '@/hooks/ops/useOpsTurnBands';
import { appQueryClientDefaultOptions } from '@/lib/query/clientDefaults';

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

function setup() {
  // The app's real defaults: `_experimental_beforeQuery` overrides hook staleTimes
  // with the key-based rules, so the prefetch must follow the same rules.
  const queryClient = new QueryClient({ defaultOptions: appQueryClientDefaultOptions });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const nav = renderHook(() => useRestaurantSettingsNav(), { wrapper });
  return { queryClient, wrapper, nav };
}

async function hover(
  nav: ReturnType<typeof setup>['nav'],
  href: Parameters<ReturnType<typeof useRestaurantSettingsNav>['prefetchSettingsView']>[0],
) {
  await act(async () => {
    nav.result.current.prefetchSettingsView(href);
    await Promise.resolve();
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

/** Mounts the hooks the Availability page uses, as the click navigation does. */
async function mountAvailabilityPage(wrapper: ReturnType<typeof setup>['wrapper']) {
  const page = renderHook(
    () => ({
      hours: useOpsOperatingHours('rest-1'),
      periods: useOpsServicePeriods('rest-1'),
      occasions: useOpsOccasions(),
      turnBands: useOpsTurnBands('rest-1'),
    }),
    { wrapper },
  );
  await waitFor(() => {
    const { hours, periods, occasions, turnBands } = page.result.current;
    expect([hours, periods, occasions, turnBands].every((q) => !q.isFetching)).toBe(true);
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return page;
}

describe('settings nav prefetch with the app QueryClient defaults', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('@contract hover, pause 1.5 s, click: Availability issues 4 requests in total', async () => {
    const { nav, wrapper } = setup();

    await hover(nav, AVAILABILITY);
    expect(availabilityFetchCount()).toBe(4);

    vi.advanceTimersByTime(1_500);
    const page = await mountAvailabilityPage(wrapper);

    expect(availabilityFetchCount()).toBe(4);
    page.unmount();
  });

  it.each([
    // [ms after first hover, requests made by the second hover]
    // App rules: hours, service periods and occasions 5 min; turn bands 30 s (default).
    [1_500, 0],
    [45_000, 1],
    [90_000, 1],
    [6 * 60_000, 4],
  ])(
    '@contract a hover %i ms later fetches exactly what the page would refetch on mount',
    async (elapsed, expectedHoverFetches) => {
      const { nav, wrapper } = setup();

      await hover(nav, AVAILABILITY);
      vi.advanceTimersByTime(elapsed);
      await hover(nav, AVAILABILITY);
      expect(availabilityFetchCount()).toBe(4 + expectedHoverFetches);

      // The page mounted right after that hover must not need anything new:
      // the prefetch neither skipped a query the page considers stale nor
      // fetched one the page still considers fresh.
      const page = await mountAvailabilityPage(wrapper);
      expect(availabilityFetchCount()).toBe(4 + expectedHoverFetches);
      page.unmount();
    },
  );

  it('@contract Profile hover 45 s later refreshes the detail the page would refetch', async () => {
    const { nav } = setup();

    await hover(nav, '/app/settings/restaurant/profile');
    vi.advanceTimersByTime(45_000); // beyond the app's 30 s rule for this key
    await hover(nav, '/app/settings/restaurant/profile');

    expect(services.restaurantService.getProfile).toHaveBeenCalledTimes(2);
  });
});
