import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { buildDefaultOpsCustomersListParams } from '@/components/features/customers/opsCustomersTypes';
import { useOpsServices } from '@/contexts/ops-services';
import { useOpsSession } from '@/contexts/ops-session';
import { queryKeys } from '@/lib/query/keys';
import { OPS_SETTINGS_STALE_TIME } from '@/lib/query/staleTimes';

import type { OpsCustomersPage } from '@/types/ops';

export function useOpsRoutePrefetch() {
  const queryClient = useQueryClient();
  const { activeRestaurantId } = useOpsSession();
  const services = useOpsServices();

  return useCallback(
    (href: string) => {
      if (!activeRestaurantId) return;

      const path = href.replace('/app', '');

      switch (path) {
        case '/dashboard':
          void queryClient.prefetchQuery({
            queryKey: queryKeys.opsDashboard.summary(activeRestaurantId, null),
            queryFn: () =>
              services.bookingService.getTodaySummary({ restaurantId: activeRestaurantId }),
            staleTime: 60_000,
          });
          break;

        case '/customers': {
          const params = buildDefaultOpsCustomersListParams(activeRestaurantId);
          void queryClient.prefetchInfiniteQuery<OpsCustomersPage>({
            queryKey: queryKeys.opsCustomers.list(params),
            queryFn: ({ pageParam }) => {
              const page = typeof pageParam === 'number' ? pageParam : 1;
              return services.customerService.list({
                ...params,
                page,
                pageSize: params.pageSize ?? 50,
              });
            },
            initialPageParam: 1,
            getNextPageParam: (lastPage: OpsCustomersPage) =>
              lastPage.pageInfo.hasNext ? lastPage.pageInfo.page + 1 : undefined,
            staleTime: 30_000,
          });
          break;
        }

        case '/bookings':
          // The bookings status summary API requires a concrete date window.
          // Let the page fetch it once the selected date/window is resolved.
          break;

        case '/settings/restaurant/profile':
          void queryClient.prefetchQuery({
            queryKey: queryKeys.opsRestaurants.detail(activeRestaurantId),
            queryFn: () => services.restaurantService.getProfile(activeRestaurantId),
            staleTime: OPS_SETTINGS_STALE_TIME.restaurantDetail,
          });
          break;

        case '/settings/restaurant/availability':
          void queryClient.prefetchQuery({
            queryKey: queryKeys.opsRestaurants.hours(activeRestaurantId),
            queryFn: () => services.restaurantService.getOperatingHours(activeRestaurantId),
            staleTime: OPS_SETTINGS_STALE_TIME.operatingHours,
          });
          void queryClient.prefetchQuery({
            queryKey: queryKeys.opsRestaurants.servicePeriods(activeRestaurantId),
            queryFn: () => services.restaurantService.getServicePeriods(activeRestaurantId),
            staleTime: OPS_SETTINGS_STALE_TIME.servicePeriods,
          });
          void queryClient.prefetchQuery({
            queryKey: queryKeys.opsOccasions.list(),
            queryFn: () => services.occasionService.listOccasions(),
            staleTime: OPS_SETTINGS_STALE_TIME.occasions,
          });
          void queryClient.prefetchQuery({
            queryKey: queryKeys.opsRestaurants.turnBands(activeRestaurantId),
            queryFn: () => services.restaurantService.getTurnBands(activeRestaurantId),
            staleTime: OPS_SETTINGS_STALE_TIME.turnBands,
          });
          break;

        case '/settings/restaurant/menu':
          void queryClient.prefetchQuery({
            queryKey: queryKeys.opsMenuHierarchy.list(activeRestaurantId),
            queryFn: () => services.menuHierarchyService.listMenus(activeRestaurantId),
            staleTime: OPS_SETTINGS_STALE_TIME.menuHierarchy,
          });
          break;

        case '/settings/restaurant/tables':
          void queryClient.prefetchQuery({
            queryKey: queryKeys.opsTables.list(activeRestaurantId),
            queryFn: () => services.tableInventoryService.list(activeRestaurantId),
            staleTime: OPS_SETTINGS_STALE_TIME.tables,
          });
          break;

        case '/settings/restaurant/team':
          void queryClient.prefetchQuery({
            // The Team page loads every invitation once and filters on the device.
            queryKey: queryKeys.team.invitations(activeRestaurantId, 'all'),
            queryFn: () => services.teamService.listInvites(activeRestaurantId, 'all'),
            staleTime: OPS_SETTINGS_STALE_TIME.teamInvitations,
          });
          break;

        case '/settings/restaurant/google-business-profile':
          void queryClient.prefetchQuery({
            queryKey: queryKeys.opsRestaurants.googleBusinessProfile(activeRestaurantId),
            queryFn: () =>
              services.restaurantService.getGoogleBusinessProfileConnection(activeRestaurantId),
            staleTime: OPS_SETTINGS_STALE_TIME.googleBusinessProfile,
          });
          break;

        case '/new-bookings':
          // The walk-in wizard needs a lot of context to show availability
          void queryClient.prefetchQuery({
            queryKey: queryKeys.opsRestaurants.detail(activeRestaurantId),
            queryFn: () => services.restaurantService.getProfile(activeRestaurantId),
            staleTime: OPS_SETTINGS_STALE_TIME.restaurantDetail,
          });
          void queryClient.prefetchQuery({
            queryKey: queryKeys.opsRestaurants.hours(activeRestaurantId),
            queryFn: () => services.restaurantService.getOperatingHours(activeRestaurantId),
            staleTime: OPS_SETTINGS_STALE_TIME.operatingHours,
          });
          void queryClient.prefetchQuery({
            queryKey: queryKeys.opsRestaurants.servicePeriods(activeRestaurantId),
            queryFn: () => services.restaurantService.getServicePeriods(activeRestaurantId),
            staleTime: OPS_SETTINGS_STALE_TIME.servicePeriods,
          });
          void queryClient.prefetchQuery({
            queryKey: queryKeys.opsTables.timeline(activeRestaurantId, {
              service: 'all',
              includeSummary: true,
            }),
            queryFn: () =>
              services.tableInventoryService.timeline(activeRestaurantId, {
                service: 'all',
                includeSummary: true,
              }),
            staleTime: 60_000,
          });
          break;
      }
    },
    [queryClient, activeRestaurantId, services],
  );
}
