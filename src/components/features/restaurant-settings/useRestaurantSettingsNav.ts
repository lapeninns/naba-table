'use client';

import { useQueryClient } from '@tanstack/react-query';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useMemo, type MouseEvent } from 'react';

import { useOpsServices } from '@/contexts/ops-services';
import { useOpsSession } from '@/contexts/ops-session';
import { useOpsUnsavedChanges } from '@/contexts/ops-unsaved-changes';
import { prefetchIfStale } from '@/lib/prefetchers';
import { queryKeys } from '@/lib/query/keys';
import { normalizeOpsPathname } from '@/lib/url/opsHref';

import {
  getGbpDriftNavBadge,
  getGbpDriftSectionBadge,
  useGbpDriftStatus,
} from './GbpDriftProvider';
import { mergeGbpDriftSectionStatuses } from './gbpDriftStatus';
import { RESTAURANT_SETTINGS_NAV_ITEMS } from './routes';

import type { DualSyncSectionKey } from '@/server/dual-sync';

type Prefetcher = () => Promise<unknown> | undefined;
export type SettingsHref = (typeof RESTAURANT_SETTINGS_NAV_ITEMS)[number]['href'];
type PrefetchMap = Partial<Record<SettingsHref, Prefetcher>>;
type NavDriftSectionMap = Partial<Record<SettingsHref, ReadonlyArray<DualSyncSectionKey>>>;

export const RESTAURANT_SETTINGS_NAV_GROUPS: Array<{
  label: string;
  hrefs: SettingsHref[];
}> = [
  {
    label: 'Required setup',
    hrefs: [
      '/app/settings/restaurant/profile',
      '/app/settings/restaurant/availability',
      '/app/settings/restaurant/tables',
    ],
  },
  {
    label: 'Operations',
    hrefs: [
      '/app/settings/restaurant/discovery',
      '/app/settings/restaurant/menu',
      '/app/settings/restaurant/team',
    ],
  },
  {
    label: 'Integrations',
    hrefs: ['/app/settings/restaurant/google-business-profile'],
  },
];

export const GROUPED_RESTAURANT_SETTINGS_NAV_ITEMS = RESTAURANT_SETTINGS_NAV_GROUPS.map(
  (group) => ({
    ...group,
    items: group.hrefs
      .map((href) => RESTAURANT_SETTINGS_NAV_ITEMS.find((item) => item.href === href))
      .filter((item): item is (typeof RESTAURANT_SETTINGS_NAV_ITEMS)[number] => Boolean(item)),
  }),
);

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
  if (normalizedHref === '/settings/restaurant') {
    return pathname === normalizedHref;
  }
  return pathname === normalizedHref || pathname.startsWith(`${normalizedHref}/`);
}

export function isRestaurantSettingsNavItemActive(
  pathname: string,
  item: (typeof RESTAURANT_SETTINGS_NAV_ITEMS)[number],
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
          queryFn: () => restaurantService.getProfile(id),
          enabled: true,
        }),
      '/app/settings/restaurant/discovery': () =>
        prefetchIfStale({
          queryClient,
          queryKey: queryKeys.opsRestaurants.businessContext(id),
          queryFn: () => restaurantService.getBusinessContext(id),
          enabled: true,
        }),
      '/app/settings/restaurant/google-business-profile': () =>
        prefetchIfStale({
          queryClient,
          queryKey: queryKeys.opsRestaurants.googleBusinessProfile(id),
          queryFn: () => restaurantService.getGoogleBusinessProfileConnection(id),
          enabled: true,
        }),
      '/app/settings/restaurant/availability': () =>
        Promise.all([
          prefetchIfStale({
            queryClient,
            queryKey: queryKeys.opsRestaurants.hours(id),
            queryFn: () => restaurantService.getOperatingHours(id),
            enabled: true,
          }),
          prefetchIfStale({
            queryClient,
            queryKey: queryKeys.opsRestaurants.servicePeriods(id),
            queryFn: () => restaurantService.getServicePeriods(id),
            enabled: true,
          }),
          prefetchIfStale({
            queryClient,
            queryKey: queryKeys.opsOccasions.list(),
            queryFn: () => occasionService.listOccasions(),
            enabled: true,
          }),
          prefetchIfStale({
            queryClient,
            queryKey: queryKeys.opsRestaurants.turnBands(id),
            queryFn: () => restaurantService.getTurnBands(id),
            enabled: true,
          }),
        ]),
      '/app/settings/restaurant/menu': () =>
        prefetchIfStale({
          queryClient,
          queryKey: queryKeys.opsMenuHierarchy.list(id),
          queryFn: () => menuHierarchyService.listMenus(id),
          enabled: true,
        }),
      '/app/settings/restaurant/tables': () =>
        prefetchIfStale({
          queryClient,
          queryKey: queryKeys.opsTables.list(id, {}),
          queryFn: () => tableInventoryService.list(id),
          enabled: true,
        }),
      '/app/settings/restaurant/team': () =>
        prefetchIfStale({
          queryClient,
          queryKey: queryKeys.team.invitations(id),
          queryFn: () => teamService.listInvites(id, 'pending'),
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
