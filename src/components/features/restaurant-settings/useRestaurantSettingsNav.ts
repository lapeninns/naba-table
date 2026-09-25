'use client';

import { useQueryClient } from '@tanstack/react-query';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useMemo, type MouseEvent } from 'react';

import { useOpsServices } from '@/contexts/ops-services';
import { useOpsSession } from '@/contexts/ops-session';
import { useOpsUnsavedChanges } from '@/contexts/ops-unsaved-changes';
import { prefetchIfStale } from '@/lib/prefetchers';
import { queryKeys } from '@/lib/query/keys';
import { OPS_SETTINGS_STALE_TIME } from '@/lib/query/staleTimes';
import { normalizeOpsPathname } from '@/lib/url/opsHref';

import {
  getGbpDriftNavBadge,
  getGbpDriftSectionBadge,
  useGbpDriftStatus,
} from './GbpDriftProvider';
import { mergeGbpDriftSectionStatuses } from './gbpDriftStatus';
import {
  RESTAURANT_SETTINGS_NAV_ITEMS,
  RESTAURANT_SETTINGS_OVERVIEW_ROUTE,
  RESTAURANT_SETTINGS_ROUTE_MAP,
  RESTAURANT_SETTINGS_UNSAVED_ENTRY_IDS,
  type RestaurantSettingsNavItem,
} from './routes';

import type { DualSyncSectionKey } from '@/server/dual-sync';

type Prefetcher = () => Promise<unknown> | undefined;
const OVERVIEW_NAV_ITEM: RestaurantSettingsNavItem = RESTAURANT_SETTINGS_OVERVIEW_ROUTE;

export type SettingsHref =
  | (typeof RESTAURANT_SETTINGS_NAV_ITEMS)[number]['href']
  | typeof OVERVIEW_NAV_ITEM.href;
type PrefetchMap = Partial<Record<SettingsHref, Prefetcher>>;
type NavDriftSectionMap = Partial<Record<SettingsHref, ReadonlyArray<DualSyncSectionKey>>>;

/** `label: null` renders the group without a heading (Restaurant setup sits above the groups). */
export const RESTAURANT_SETTINGS_NAV_GROUPS: Array<{
  label: string | null;
  hrefs: SettingsHref[];
}> = [
  { label: null, hrefs: ['/app/settings/restaurant'] },
  {
    label: 'Required setup',
    hrefs: [
      '/app/settings/restaurant/profile',
      '/app/settings/restaurant/availability',
      '/app/settings/restaurant/tables',
    ],
  },
  {
    label: 'Restaurant details',
    hrefs: ['/app/settings/restaurant/discovery', '/app/settings/restaurant/menu'],
  },
  {
    label: 'Staff',
    hrefs: ['/app/settings/restaurant/team', '/app/settings/restaurant/staff-communications'],
  },
  {
    label: 'Integrations',
    hrefs: ['/app/settings/restaurant/google-business-profile'],
  },
];

const ALL_NAV_ITEMS: RestaurantSettingsNavItem[] = [
  OVERVIEW_NAV_ITEM,
  ...RESTAURANT_SETTINGS_NAV_ITEMS,
];

export const GROUPED_RESTAURANT_SETTINGS_NAV_ITEMS = RESTAURANT_SETTINGS_NAV_GROUPS.map(
  (group) => ({
    ...group,
    items: group.hrefs
      .map((href) => ALL_NAV_ITEMS.find((item) => item.href === href))
      .filter((item): item is RestaurantSettingsNavItem => Boolean(item)),
  }),
);

/** Unsaved-changes registry ids that mark each sidebar item "Unsaved". */
const NAV_UNSAVED_ENTRY_IDS: Partial<Record<SettingsHref, string>> = Object.fromEntries(
  Object.entries(RESTAURANT_SETTINGS_UNSAVED_ENTRY_IDS).map(([view, id]) => [
    RESTAURANT_SETTINGS_ROUTE_MAP[view as keyof typeof RESTAURANT_SETTINGS_UNSAVED_ENTRY_IDS].href,
    id,
  ]),
);

export function getRestaurantSettingsNavUnsavedEntryId(href: string): string | undefined {
  return NAV_UNSAVED_ENTRY_IDS[href as SettingsHref];
}

const NAV_DRIFT_SECTIONS: NavDriftSectionMap = {
  '/app/settings/restaurant/profile': ['profile'],
  '/app/settings/restaurant/discovery': [
    'businessContext.categories',
    'businessContext.serviceAreas',
    'businessContext.attributes',
    'businessContext.serviceItems',
  ],
  '/app/settings/restaurant/google-business-profile': [
    'profile',
    'operatingHours',
    'servicePeriods',
    'businessContext.categories',
    'businessContext.serviceAreas',
    'businessContext.attributes',
    'businessContext.serviceItems',
    'foodMenus',
  ],
  '/app/settings/restaurant/availability': ['operatingHours', 'servicePeriods'],
  '/app/settings/restaurant/menu': ['foodMenus'],
};

export function isRestaurantSettingsRouteActive(pathname: string, href: string) {
  const normalizedHref = normalizeOpsPathname(href);
  if (normalizedHref === normalizeOpsPathname(OVERVIEW_NAV_ITEM.href)) {
    return pathname === normalizedHref;
  }
  return pathname === normalizedHref || pathname.startsWith(`${normalizedHref}/`);
}

export function isRestaurantSettingsNavItemActive(
  pathname: string,
  item: RestaurantSettingsNavItem,
) {
  if (isRestaurantSettingsRouteActive(pathname, item.href)) {
    return true;
  }

  return (item.aliases ?? []).some((alias) => isRestaurantSettingsRouteActive(pathname, alias));
}

export function useRestaurantSettingsNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { confirmNavigation } = useOpsUnsavedChanges();
  const normalizedPathname = useMemo(
    () => (pathname != null ? normalizeOpsPathname(pathname) : null),
    [pathname],
  );
  const queryClient = useQueryClient();
  const {
    restaurantService,
    occasionService,
    teamService,
    tableInventoryService,
    menuHierarchyService,
  } = useOpsServices();
  const { activeRestaurantId } = useOpsSession();
  const { status: gbpStatus } = useGbpDriftStatus();

  const getNavBadge = useCallback(
    (href: SettingsHref): string | undefined => {
      const sectionKeys = NAV_DRIFT_SECTIONS[href];
      if (!sectionKeys) {
        return undefined;
      }

      if (href === '/app/settings/restaurant/google-business-profile') {
        return getGbpDriftNavBadge(gbpStatus) ?? undefined;
      }

      return (
        getGbpDriftSectionBadge(
          mergeGbpDriftSectionStatuses(gbpStatus.sectionStatuses, sectionKeys),
        ) ?? undefined
      );
    },
    [gbpStatus],
  );

  const prefetchMap = useMemo<PrefetchMap>(() => {
    const id = activeRestaurantId;
    if (!id) return {};

    return {
      '/app/settings/restaurant/profile': () =>
        prefetchIfStale({
          queryClient,
          queryKey: queryKeys.opsRestaurants.detail(id),
          staleTime: OPS_SETTINGS_STALE_TIME.restaurantDetail,
          queryFn: ({ signal }) => restaurantService.getProfile(id, { signal }),
          enabled: true,
        }),
      // Same restaurant record as Profile.
      '/app/settings/restaurant/staff-communications': () =>
        prefetchIfStale({
          queryClient,
          queryKey: queryKeys.opsRestaurants.detail(id),
          staleTime: OPS_SETTINGS_STALE_TIME.restaurantDetail,
          queryFn: ({ signal }) => restaurantService.getProfile(id, { signal }),
          enabled: true,
        }),
      '/app/settings/restaurant/discovery': () =>
        prefetchIfStale({
          queryClient,
          queryKey: queryKeys.opsRestaurants.businessContext(id),
          staleTime: OPS_SETTINGS_STALE_TIME.businessContext,
          queryFn: ({ signal }) => restaurantService.getBusinessContext(id, { signal }),
          enabled: true,
        }),
      '/app/settings/restaurant/google-business-profile': () =>
        prefetchIfStale({
          queryClient,
          queryKey: queryKeys.opsRestaurants.googleBusinessProfile(id),
          staleTime: OPS_SETTINGS_STALE_TIME.googleBusinessProfile,
          queryFn: ({ signal }) =>
            restaurantService.getGoogleBusinessProfileConnection(id, { signal }),
          enabled: true,
        }),
      '/app/settings/restaurant/availability': () =>
        Promise.all([
          prefetchIfStale({
            queryClient,
            queryKey: queryKeys.opsRestaurants.hours(id),
            staleTime: OPS_SETTINGS_STALE_TIME.operatingHours,
            queryFn: ({ signal }) => restaurantService.getOperatingHours(id, { signal }),
            enabled: true,
          }),
          prefetchIfStale({
            queryClient,
            queryKey: queryKeys.opsRestaurants.servicePeriods(id),
            staleTime: OPS_SETTINGS_STALE_TIME.servicePeriods,
            queryFn: ({ signal }) => restaurantService.getServicePeriods(id, { signal }),
            enabled: true,
          }),
          prefetchIfStale({
            queryClient,
            queryKey: queryKeys.opsOccasions.list(),
            staleTime: OPS_SETTINGS_STALE_TIME.occasions,
            queryFn: ({ signal }) => occasionService.listOccasions({ signal }),
            enabled: true,
          }),
          prefetchIfStale({
            queryClient,
            queryKey: queryKeys.opsRestaurants.turnBands(id),
            staleTime: OPS_SETTINGS_STALE_TIME.turnBands,
            queryFn: ({ signal }) => restaurantService.getTurnBands(id, { signal }),
            enabled: true,
          }),
        ]),
      '/app/settings/restaurant/menu': () =>
        prefetchIfStale({
          queryClient,
          queryKey: queryKeys.opsMenuHierarchy.list(id),
          staleTime: OPS_SETTINGS_STALE_TIME.menuHierarchy,
          queryFn: ({ signal }) => menuHierarchyService.listMenus(id, { signal }),
          enabled: true,
        }),
      '/app/settings/restaurant/tables': () =>
        prefetchIfStale({
          queryClient,
          queryKey: queryKeys.opsTables.list(id),
          staleTime: OPS_SETTINGS_STALE_TIME.tables,
          queryFn: ({ signal }) => tableInventoryService.list(id, {}, { signal }),
          enabled: true,
        }),
      '/app/settings/restaurant/team': () =>
        prefetchIfStale({
          queryClient,
          // The Team page loads every invitation once and filters on the device.
          queryKey: queryKeys.team.invitations(id, 'all'),
          staleTime: OPS_SETTINGS_STALE_TIME.teamInvitations,
          queryFn: ({ signal }) => teamService.listInvites(id, 'all', { signal }),
          enabled: true,
        }),
    };
  }, [
    activeRestaurantId,
    menuHierarchyService,
    occasionService,
    queryClient,
    restaurantService,
    tableInventoryService,
    teamService,
  ]);

  const prefetchSettingsView = useCallback(
    (href: SettingsHref) => {
      void prefetchMap[href]?.();
    },
    [prefetchMap],
  );

  const activeItem = useMemo(() => {
    if (normalizedPathname == null) return RESTAURANT_SETTINGS_NAV_ITEMS[0];
    return (
      RESTAURANT_SETTINGS_NAV_ITEMS.find((item) =>
        isRestaurantSettingsNavItemActive(normalizedPathname, item),
      ) ?? RESTAURANT_SETTINGS_NAV_ITEMS[0]
    );
  }, [normalizedPathname]);

  const handleLinkClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      if (!confirmNavigation()) {
        event.preventDefault();
      }
    },
    [confirmNavigation],
  );

  return {
    normalizedPathname,
    activeItem,
    getNavBadge,
    prefetchSettingsView,
    handleLinkClick,
    router,
    confirmNavigation,
  };
}
