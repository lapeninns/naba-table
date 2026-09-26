import { queryKeys } from '@/lib/query/keys';

import type { QueryClient } from '@tanstack/react-query';

export const dualSyncQueryKeys = {
  state: (restaurantId: string) => ['dual-sync-state', restaurantId] as const,
  operations: (restaurantId: string) => ['dual-sync-operations', restaurantId] as const,
  jobs: (restaurantId: string) => ['dual-sync-jobs', restaurantId] as const,
  candidates: (restaurantId: string) => ['dual-sync-candidates', restaurantId] as const,
  metrics: (restaurantId: string) => ['dual-sync-metrics', restaurantId] as const,
  publishJobs: (restaurantId: string) => ['dual-sync-publish-jobs', restaurantId] as const,
  publishJobDetail: (restaurantId: string) =>
    ['dual-sync-publish-job-detail', restaurantId] as const,
};

export const gbpOperatorQueryKeys = {
  root: (restaurantId: string) => ['gbp-operator-v1', restaurantId] as const,
  connection: (restaurantId: string) => ['gbp-operator-v1', restaurantId, 'connection'] as const,
  terminalNotices: (restaurantId: string) =>
    ['gbp-operator-v1', restaurantId, 'terminal-notices'] as const,
};

export function removeGbpOperatorQueries(queryClient: QueryClient, restaurantId: string) {
  queryClient.removeQueries({ queryKey: gbpOperatorQueryKeys.root(restaurantId) });
}

type InvalidateIntegrationOptions = {
  /** The caller has just written the GBP connection from a mutation response; skip refetching it. */
  connectionWritten?: boolean;
};

export function invalidateGoogleBusinessProfileQueries(
  queryClient: QueryClient,
  restaurantId: string,
  { connectionWritten = false }: InvalidateIntegrationOptions = {},
) {
  if (!connectionWritten) {
    queryClient.invalidateQueries({
      queryKey: queryKeys.opsRestaurants.googleBusinessProfile(restaurantId),
    });
  }
  queryClient.invalidateQueries({
    queryKey: queryKeys.opsRestaurants.googleBusinessProfileLocations(restaurantId),
  });
  queryClient.invalidateQueries({ queryKey: gbpOperatorQueryKeys.root(restaurantId) });
}

export function invalidateDualSyncWorkspaceQueries(queryClient: QueryClient, restaurantId: string) {
  queryClient.invalidateQueries({ queryKey: dualSyncQueryKeys.state(restaurantId) });
  queryClient.invalidateQueries({ queryKey: dualSyncQueryKeys.operations(restaurantId) });
  queryClient.invalidateQueries({ queryKey: dualSyncQueryKeys.jobs(restaurantId) });
  queryClient.invalidateQueries({ queryKey: dualSyncQueryKeys.candidates(restaurantId) });
  queryClient.invalidateQueries({ queryKey: dualSyncQueryKeys.metrics(restaurantId) });
  queryClient.invalidateQueries({ queryKey: dualSyncQueryKeys.publishJobs(restaurantId) });
  queryClient.invalidateQueries({ queryKey: dualSyncQueryKeys.publishJobDetail(restaurantId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.opsRestaurants.detail(restaurantId) });
}

export function invalidateOpsIntegrationQueries(
  queryClient: QueryClient,
  restaurantId: string,
  options: InvalidateIntegrationOptions = {},
) {
  invalidateGoogleBusinessProfileQueries(queryClient, restaurantId, options);
  invalidateDualSyncWorkspaceQueries(queryClient, restaurantId);
}
