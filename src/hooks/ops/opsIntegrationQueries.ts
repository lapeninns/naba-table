import { queryKeys } from '@/lib/query/keys';

import type { QueryClient } from '@tanstack/react-query';

export const dualSyncQueryKeys = {
  state: (restaurantId: string) => ['dual-sync-state', restaurantId] as const,
  operations: (restaurantId: string) => ['dual-sync-operations', restaurantId] as const,
  publishJobs: (restaurantId: string) => ['dual-sync-publish-jobs', restaurantId] as const,
  publishJobDetail: (restaurantId: string) =>
    ['dual-sync-publish-job-detail', restaurantId] as const,
};

export function invalidateGoogleBusinessProfileQueries(
  queryClient: QueryClient,
  restaurantId: string,
) {
  queryClient.invalidateQueries({
    queryKey: queryKeys.opsRestaurants.googleBusinessProfile(restaurantId),
  });
  queryClient.invalidateQueries({
    queryKey: queryKeys.opsRestaurants.googleBusinessProfileLocations(restaurantId),
  });
}

export function invalidateDualSyncWorkspaceQueries(queryClient: QueryClient, restaurantId: string) {
  queryClient.invalidateQueries({ queryKey: dualSyncQueryKeys.state(restaurantId) });
  queryClient.invalidateQueries({ queryKey: dualSyncQueryKeys.operations(restaurantId) });
  queryClient.invalidateQueries({ queryKey: dualSyncQueryKeys.publishJobs(restaurantId) });
  queryClient.invalidateQueries({ queryKey: dualSyncQueryKeys.publishJobDetail(restaurantId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.opsFoodMenus.importReviews(restaurantId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.opsRestaurants.detail(restaurantId) });
}

export function invalidateOpsIntegrationQueries(queryClient: QueryClient, restaurantId: string) {
  invalidateGoogleBusinessProfileQueries(queryClient, restaurantId);
  invalidateDualSyncWorkspaceQueries(queryClient, restaurantId);
}
