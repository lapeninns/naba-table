'use client';

import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback } from 'react';

import { useOpsServices } from '@/contexts/ops-services';
import { useOpsSession } from '@/contexts/ops-session';
import { prefetchIfStale } from '@/lib/prefetchers';
import { queryKeys } from '@/lib/query/keys';
import { cn } from '@/lib/utils';

import { RESTAURANT_SETTINGS_NAV_ITEMS } from './routes';

export function RestaurantSettingsSubnav() {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { restaurantService, occasionService, teamService, tableInventoryService } = useOpsServices();
  const { activeRestaurantId } = useOpsSession();

  const prefetchSettingsView = useCallback(
    (href: string) => {
      const id = activeRestaurantId;
      if (!id) return;
      switch (href) {
        case '/settings/restaurant/profile':
          return prefetchIfStale({
            queryClient,
            queryKey: queryKeys.opsRestaurants.detail(id),
            queryFn: () => restaurantService.getProfile(id),
            enabled: true,
          });
        case '/settings/restaurant/operating-hours':
          return prefetchIfStale({
            queryClient,
            queryKey: queryKeys.opsRestaurants.hours(id),
            queryFn: () => restaurantService.getOperatingHours(id),
            enabled: true,
          });
        case '/settings/restaurant/email-templates':
          return prefetchIfStale({
            queryClient,
            queryKey: queryKeys.opsRestaurants.emailTemplates(id),
            queryFn: () => restaurantService.getEmailTemplates(id),
            enabled: true,
          });
        case '/settings/restaurant/service-periods':
          return prefetchIfStale({
            queryClient,
            queryKey: queryKeys.opsRestaurants.servicePeriods(id),
            queryFn: () => restaurantService.getServicePeriods(id),
            enabled: true,
          });
        case '/settings/restaurant/turn-durations':
          return prefetchIfStale({
            queryClient,
            queryKey: queryKeys.opsRestaurants.turnBands(id),
            queryFn: () => restaurantService.getTurnBands(id),
            enabled: true,
          });
        case '/settings/restaurant/occasions':
          return prefetchIfStale({
            queryClient,
            queryKey: queryKeys.opsOccasions.list(),
            queryFn: () => occasionService.listOccasions(),
            enabled: true,
          });
        case '/settings/restaurant/team':
          return prefetchIfStale({
            queryClient,
            queryKey: queryKeys.team.invitations(id),
            queryFn: () => teamService.listInvites(id, 'pending'),
            enabled: true,
          });
        case '/settings/tables':
          return prefetchIfStale({
            queryClient,
            queryKey: queryKeys.opsTables.list(id, {}),
            queryFn: () => tableInventoryService.list(id),
            enabled: true,
          });
        default:
          return undefined;
      }
    },
    [activeRestaurantId, occasionService, queryClient, restaurantService, tableInventoryService, teamService],
  );

  return (
    <nav aria-label="Restaurant settings" className="overflow-x-auto">
      <div className="inline-flex min-w-full gap-2 rounded-lg border border-border/60 bg-muted/40 p-1">
        {RESTAURANT_SETTINGS_NAV_ITEMS.map((item) => {
          const active = pathname?.startsWith(item.href) ?? false;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              onMouseEnter={() => void prefetchSettingsView(item.href)}
              onFocus={() => void prefetchSettingsView(item.href)}
              className={cn(
                'group flex min-w-[180px] flex-col gap-1 rounded-md px-3 py-2 text-left text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                active
                  ? 'bg-background text-foreground shadow-sm ring-1 ring-border'
                  : 'text-muted-foreground hover:text-foreground hover:ring-1 hover:ring-border'
              )}
            >
              <span className="leading-5">{item.title}</span>
              <span className="text-xs font-normal text-muted-foreground/90">{item.description}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
