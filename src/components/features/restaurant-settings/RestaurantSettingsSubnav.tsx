'use client';

import { useQueryClient } from '@tanstack/react-query';
import {
  CalendarClock,
  LayoutGrid,
  ListChecks,
  MapPinned,
  Store,
  Users,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useMemo, type ComponentPropsWithoutRef } from 'react';

import { useOpsServices } from '@/contexts/ops-services';
import { useOpsSession } from '@/contexts/ops-session';
import { prefetchIfStale } from '@/lib/prefetchers';
import { queryKeys } from '@/lib/query/keys';
import { normalizeOpsPathname } from '@/lib/url/opsHref';
import { cn } from '@/lib/utils';

import { RESTAURANT_SETTINGS_NAV_ITEMS } from './routes';
import { SETTINGS_COMPACT_STATUS_ROW_CLASS } from './shared';

type Prefetcher = () => Promise<unknown> | undefined;
type SettingsHref = (typeof RESTAURANT_SETTINGS_NAV_ITEMS)[number]['href'];
type PrefetchMap = Partial<Record<SettingsHref, Prefetcher>>;
type NavIconMap = Record<SettingsHref, LucideIcon>;

const NAV_ICONS: NavIconMap = {
  '/app/settings/restaurant': ListChecks,
  '/app/settings/restaurant/profile': Store,
  '/app/settings/restaurant/google-business-profile': MapPinned,
  '/app/settings/restaurant/availability': CalendarClock,
  '/app/settings/restaurant/menu': LayoutGrid,
  '/app/settings/restaurant/tables': LayoutGrid,
  '/app/settings/restaurant/team': Users,
};

function isRestaurantSettingsRouteActive(pathname: string, href: string) {
  const normalizedHref = normalizeOpsPathname(href);
  if (normalizedHref === '/settings/restaurant') {
    return pathname === normalizedHref;
  }
  return pathname === normalizedHref || pathname.startsWith(`${normalizedHref}/`);
}

function isRestaurantSettingsNavItemActive(
  pathname: string,
  item: (typeof RESTAURANT_SETTINGS_NAV_ITEMS)[number],
) {
  if (isRestaurantSettingsRouteActive(pathname, item.href)) {
    return true;
  }

  return (item.aliases ?? []).some((alias) => isRestaurantSettingsRouteActive(pathname, alias));
}

type RestaurantSettingsSubnavItemProps = {
  title: string;
  active: boolean;
  Icon: LucideIcon;
} & Pick<ComponentPropsWithoutRef<typeof Link>, 'href' | 'onMouseEnter' | 'onFocus'>;

function RestaurantSettingsSubnavItem({
  href,
  title,
  active,
  Icon,
  onMouseEnter,
  onFocus,
}: RestaurantSettingsSubnavItemProps) {
  return (
    <Link
      href={href}
      aria-label={title}
      aria-current={active ? 'page' : undefined}
      onMouseEnter={onMouseEnter}
      onFocus={onFocus}
      className={cn(
        'group relative flex min-w-[160px] shrink-0 items-start gap-2 rounded-md border-l-2 border-transparent px-3 py-2 text-left text-sm font-medium transition-[transform,box-shadow,background-color,color,ring-color,border-color] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none lg:min-w-0 lg:flex-1',
        active
          ? 'border-primary bg-background text-foreground shadow-sm ring-1 ring-border motion-safe:hover:-translate-y-[1px] motion-safe:hover:shadow-md'
          : 'text-muted-foreground hover:bg-background/70 hover:text-foreground hover:ring-1 hover:ring-border motion-safe:hover:-translate-y-[1px] motion-safe:hover:shadow-sm',
      )}
    >
      <span
        className={cn(
          'mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-md border transition-[transform,background-color,color,border-color] duration-200 ease-out motion-reduce:transition-none [&_svg]:size-3.5',
          active
            ? 'border-border bg-primary/10 text-primary motion-safe:group-hover:scale-105'
            : 'border-border/70 bg-background text-muted-foreground group-hover:text-foreground motion-safe:group-hover:scale-105',
        )}
        aria-hidden="true"
      >
        <Icon className="transition-transform duration-200 ease-out motion-reduce:transition-none motion-safe:group-hover:scale-110" />
      </span>
      <span className="min-w-0">
        <span className="block min-w-0 text-wrap leading-5 text-foreground transition-colors duration-200 motion-reduce:transition-none">
          {title}
        </span>
      </span>
    </Link>
  );
}

type RestaurantSettingsSubnavProps = Pick<ComponentPropsWithoutRef<'nav'>, 'className'> & {
  variant?: 'inline' | 'focused';
};

export function RestaurantSettingsSubnav({
  className,
  variant = 'inline',
}: RestaurantSettingsSubnavProps) {
  const pathname = usePathname();
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

  const prefetchMap = useMemo<PrefetchMap>(() => {
    const id = activeRestaurantId;
    if (!id) return {};

    return {
      '/app/settings/restaurant': () =>
        Promise.all([
          prefetchIfStale({
            queryClient,
            queryKey: queryKeys.opsRestaurants.detail(id),
            queryFn: () => restaurantService.getProfile(id),
            enabled: true,
          }),
          prefetchIfStale({
            queryClient,
            queryKey: queryKeys.opsRestaurants.hours(id),
            queryFn: () => restaurantService.getOperatingHours(id),
            enabled: true,
          }),
          prefetchIfStale({
            queryClient,
            queryKey: queryKeys.opsTables.list(id),
            queryFn: () => tableInventoryService.list(id),
            enabled: true,
          }),
        ]),
      '/app/settings/restaurant/profile': () =>
        prefetchIfStale({
          queryClient,
          queryKey: queryKeys.opsRestaurants.detail(id),
          queryFn: () => restaurantService.getProfile(id),
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

  const isFocused = variant === 'focused';

  return (
    <nav aria-label="Restaurant settings" className={cn('min-w-0', className)}>
      <div
        className={cn(
          'min-w-0 p-2',
          isFocused
            ? 'lg:overflow-y-auto lg:py-4 lg:pr-3'
            : 'overflow-x-auto rounded-lg border border-border/60 bg-muted/30 lg:sticky lg:top-20 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:border-r lg:bg-muted/20',
        )}
      >
        <div
          className={cn(
            'gap-1.5',
            isFocused ? 'flex min-w-0 flex-col' : 'flex min-w-max lg:min-w-0 lg:flex-col',
          )}
        >
          {RESTAURANT_SETTINGS_NAV_ITEMS.map((item) => {
            const active =
              normalizedPathname != null
                ? isRestaurantSettingsNavItemActive(normalizedPathname, item)
                : false;
            return (
              <RestaurantSettingsSubnavItem
                key={item.href}
                href={item.href}
                title={item.title}
                active={active}
                Icon={NAV_ICONS[item.href] ?? LayoutGrid}
                onMouseEnter={() => prefetchSettingsView(item.href)}
                onFocus={() => prefetchSettingsView(item.href)}
              />
            );
          })}
        </div>
      </div>
      <p className={cn(SETTINGS_COMPACT_STATUS_ROW_CLASS, 'sr-only')}>
        Seven restaurant settings sections are available in this compact navigation.
      </p>
    </nav>
  );
}
