import { QueryClientProvider, type QueryClient, type QueryKey } from '@tanstack/react-query';
import { act, render, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const RESTAURANT_ID = 'rest-1';

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
  teamService: {
    listInvites: vi.fn(async () => [
      { id: 'invite-1', status: 'pending' },
      { id: 'invite-2', status: 'accepted' },
    ]),
  },
  tableInventoryService: {
    list: vi.fn(async () => ({
      tables: [],
      summary: { totalTables: 2, availableTables: 2, zones: [], serviceCapacities: [] },
    })),
  },
  zoneService: { list: vi.fn(async () => []) },
  menuHierarchyService: { listMenus: vi.fn(async () => ({ menus: [] })) },
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/app/settings/restaurant',
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/contexts/ops-services', () => ({
  useOpsServices: () => services,
  useRestaurantService: () => services.restaurantService,
  useOccasionService: () => services.occasionService,
  useTeamService: () => services.teamService,
  useTableInventoryService: () => services.tableInventoryService,
  useZoneService: () => services.zoneService,
  useMenuHierarchyService: () => services.menuHierarchyService,
}));

vi.mock('@/contexts/ops-session', () => ({
  useOpsSession: () => ({ activeRestaurantId: 'rest-1' }),
}));

vi.mock('@/contexts/ops-unsaved-changes', () => ({
  useOpsUnsavedChanges: () => ({ confirmNavigation: () => true }),
}));

vi.mock('@/components/features/restaurant-settings/shell/useRestaurantSettingsContext', () => ({
  useRestaurantSettingsContext: () => ({ restaurantId: 'rest-1' }),
}));

import { useOpsRoutePrefetch } from '@/components/features/ops-shell/useOpsRoutePrefetch';
import { RestaurantSetupOverview } from '@/components/features/restaurant-settings/RestaurantSetupOverview';
import {
  useRestaurantSettingsNav,
  type SettingsHref,
} from '@/components/features/restaurant-settings/useRestaurantSettingsNav';
import { useTableInventoryDataState } from '@/components/features/tables/useTableInventoryDataState';
import { useOpsOccasions } from '@/hooks/ops/useOccasions';
import { useOpsGoogleBusinessProfileConnection } from '@/hooks/ops/useOpsGoogleBusinessProfile';
import { useOpsMenuHierarchy } from '@/hooks/ops/useOpsMenuHierarchy';
import { useOpsOperatingHours } from '@/hooks/ops/useOpsOperatingHours';
import { useOpsRestaurantBusinessContext } from '@/hooks/ops/useOpsRestaurantBusinessContext';
import { useOpsRestaurantDetails } from '@/hooks/ops/useOpsRestaurantDetails';
import { useOpsServicePeriods } from '@/hooks/ops/useOpsServicePeriods';
import { useOpsTeamInvitations } from '@/hooks/ops/useOpsTeamInvitations';
import { useOpsTurnBands } from '@/hooks/ops/useOpsTurnBands';
import { createAppQueryClient } from '@/lib/query/client';
import { queryKeys } from '@/lib/query/keys';

import type { ReactNode } from 'react';

type CacheEntry = { key: QueryKey; staleTime: unknown };

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function sortEntries(entries: CacheEntry[]): CacheEntry[] {
  return [...entries].sort((a, b) => JSON.stringify(a.key).localeCompare(JSON.stringify(b.key)));
}

/** What a prefetcher asked for: its key and the staleTime the client resolves for it. */
function spyOnPrefetches(queryClient: QueryClient): () => CacheEntry[] {
  const spy = vi.spyOn(queryClient, 'prefetchQuery');
  return () =>
    sortEntries(
      spy.mock.calls.map(([options]) => ({
        key: options.queryKey,
        staleTime: queryClient.defaultQueryOptions(options).staleTime,
      })),
    );
}

/** What the mounted page hooks fetched: each observed key and its resolved staleTime. */
function observedEntries(queryClient: QueryClient): CacheEntry[] {
  return sortEntries(
    queryClient
      .getQueryCache()
      .getAll()
      // Disabled observers (e.g. the Tables page zones fallback) never request anything.
      .filter(
        (query) =>
          query.observers.length > 0 &&
          query.state.dataUpdateCount + query.state.errorUpdateCount > 0,
      )
      .map((query) => ({
        key: query.queryKey,
        staleTime: query.observers[0]?.options.staleTime,
      })),
  );
}

/** The queries each settings page mounts, as named hooks so the rules of hooks hold. */
function useProfilePage() {
  return useOpsRestaurantDetails(RESTAURANT_ID);
}

function useDiscoveryPage() {
  return useOpsRestaurantBusinessContext(RESTAURANT_ID);
}

function useGoogleBusinessProfilePage() {
  return useOpsGoogleBusinessProfileConnection(RESTAURANT_ID);
}

function useAvailabilityPage() {
  return [
    useOpsOperatingHours(RESTAURANT_ID),
    useOpsServicePeriods(RESTAURANT_ID),
    useOpsOccasions(),
    useOpsTurnBands(RESTAURANT_ID),
  ];
}

function useMenuPage() {
  return useOpsMenuHierarchy(RESTAURANT_ID);
}

function useTablesPage() {
  return useTableInventoryDataState(RESTAURANT_ID);
}

function useTeamPage() {
  // The Team page loads every invitation and filters on the device.
  return useOpsTeamInvitations({ restaurantId: RESTAURANT_ID, status: 'all' });
}

const PAGE_HOOKS = {
  '/app/settings/restaurant/profile': useProfilePage,
  // Staff communications edits the same restaurant record as Profile.
  '/app/settings/restaurant/staff-communications': useProfilePage,
  '/app/settings/restaurant/discovery': useDiscoveryPage,
  '/app/settings/restaurant/google-business-profile': useGoogleBusinessProfilePage,
  '/app/settings/restaurant/availability': useAvailabilityPage,
  '/app/settings/restaurant/menu': useMenuPage,
  '/app/settings/restaurant/tables': useTablesPage,
  '/app/settings/restaurant/team': useTeamPage,
} satisfies Partial<Record<SettingsHref, () => unknown>>;

type PageHref = keyof typeof PAGE_HOOKS;

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function mountPage(href: PageHref): Promise<CacheEntry[]> {
  const queryClient = createAppQueryClient();
  const usePage = PAGE_HOOKS[href];
  const page = renderHook(() => usePage(), { wrapper: createWrapper(queryClient) });
  await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  const entries = observedEntries(queryClient);
  page.unmount();
  return entries;
}

async function settingsNavPrefetch(href: PageHref): Promise<CacheEntry[]> {
  const queryClient = createAppQueryClient();
  const readPrefetches = spyOnPrefetches(queryClient);
  const nav = renderHook(() => useRestaurantSettingsNav(), {
    wrapper: createWrapper(queryClient),
  });
  act(() => nav.result.current.prefetchSettingsView(href));
  await settle();
  nav.unmount();
  return readPrefetches();
}

async function opsShellPrefetch(href: PageHref): Promise<CacheEntry[]> {
  const queryClient = createAppQueryClient();
  const readPrefetches = spyOnPrefetches(queryClient);
  const shell = renderHook(() => useOpsRoutePrefetch(), { wrapper: createWrapper(queryClient) });
  act(() => shell.result.current(href));
  await settle();
  shell.unmount();
  return readPrefetches();
}

describe('settings prefetch key and staleTime parity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(Object.keys(PAGE_HOOKS) as PageHref[])(
    '@contract settings nav prefetch for %s warms the exact keys and staleTimes the page reads',
    async (href) => {
      const pageEntries = await mountPage(href);
      expect(pageEntries.length).toBeGreaterThan(0);
      expect(await settingsNavPrefetch(href)).toEqual(pageEntries);
    },
  );

  it.each([
    '/app/settings/restaurant/profile',
    '/app/settings/restaurant/availability',
    '/app/settings/restaurant/menu',
    '/app/settings/restaurant/tables',
    '/app/settings/restaurant/team',
    '/app/settings/restaurant/google-business-profile',
  ] satisfies PageHref[])(
    '@contract ops shell prefetch for %s warms the exact keys and staleTimes the page reads',
    async (href) => {
      const pageEntries = await mountPage(href);
      expect(await opsShellPrefetch(href)).toEqual(pageEntries);
    },
  );

  it('@contract the setup overview shares the Tables and Team page cache entries', async () => {
    const tablesPage = await mountPage('/app/settings/restaurant/tables');
    const teamPage = await mountPage('/app/settings/restaurant/team');

    const queryClient = createAppQueryClient();
    const view = render(<RestaurantSetupOverview />, { wrapper: createWrapper(queryClient) });
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));

    const overview = observedEntries(queryClient);
    const overviewTables = overview.filter(
      (entry) => entry.key[0] === 'ops' && entry.key[1] === 'tables',
    );
    const overviewTeam = overview.filter((entry) => entry.key[0] === 'team');

    expect(overviewTables).toEqual(tablesPage);
    expect(overviewTeam).toEqual(teamPage);
    // One HTTP request per resource: the overview does not ask for a second variant.
    expect(services.tableInventoryService.list).toHaveBeenCalledTimes(2);
    expect(services.teamService.listInvites).toHaveBeenCalledTimes(2);
    // The overview counts only pending invitations from the shared list.
    expect(await view.findByText('1 pending invite.')).toBeTruthy();
    view.unmount();
  });

  it('@contract placeholder keys for a missing restaurant come from the key factory', () => {
    const queryClient = createAppQueryClient();
    const { result } = renderHook(() => useTableInventoryDataState(null), {
      wrapper: createWrapper(queryClient),
    });
    expect(result.current.tablesQueryKey).toEqual(queryKeys.opsTables.list('none'));
    expect(result.current.zonesQueryKey).toEqual(queryKeys.opsTables.zones('none'));
  });
});
