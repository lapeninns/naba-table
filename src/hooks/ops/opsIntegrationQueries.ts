import { queryKeys } from '@/lib/query/keys';

import type { DualSyncSectionKey } from '@/server/dual-sync';
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

/**
 * Publish mutations share one key prefix per restaurant, so every surface can see a publish in
 * flight (`useIsMutating`) and publishes run one at a time (the same `scope`).
 */
export const dualSyncMutationKeys = {
  publishRoot: (restaurantId: string) => ['dual-sync-publish', restaurantId] as const,
  publish: (restaurantId: string) => ['dual-sync-publish', restaurantId, 'decisions'] as const,
  exactPublish: (restaurantId: string) => ['dual-sync-publish', restaurantId, 'exact'] as const,
  scopeId: (restaurantId: string) => `dual-sync-publish:${restaurantId}`,
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
    // `exact`: the connection key is a prefix of the locations key, so a prefix match would
    // refetch the rate-limited locations endpoint and then cancel and repeat it just below.
    queryClient.invalidateQueries({
      queryKey: queryKeys.opsRestaurants.googleBusinessProfile(restaurantId),
      exact: true,
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

type ImportDecisionLike = {
  readonly fieldKey: string;
  readonly sectionKey: DualSyncSectionKey;
  readonly action: string;
};

/**
 * The Nabatable caches a Google import can change, by section. Profile imports write the
 * restaurant row and its Google map/review links (`restaurant_links`, part of the business
 * context snapshot); the other sections write their own tables.
 */
function nabatableKeysForImportSection(restaurantId: string, sectionKey: DualSyncSectionKey) {
  switch (sectionKey) {
    case 'profile':
      return [
        queryKeys.opsRestaurants.detail(restaurantId),
        queryKeys.opsRestaurants.businessContext(restaurantId),
      ];
    case 'operatingHours':
      return [queryKeys.opsRestaurants.hours(restaurantId)];
    case 'servicePeriods':
      return [queryKeys.opsRestaurants.servicePeriods(restaurantId)];
    case 'foodMenus':
      return [queryKeys.opsMenuHierarchy.list(restaurantId)];
    case 'businessContext.categories':
    case 'businessContext.serviceAreas':
    case 'businessContext.attributes':
    case 'businessContext.serviceItems':
      return [queryKeys.opsRestaurants.businessContext(restaurantId)];
  }
}

/**
 * Invalidates the Nabatable caches written by the `import_from_google` decisions that may have
 * applied. `failedFieldKeys` (known failures) are skipped; pass none when the outcome is unknown.
 */
export function invalidateNabatableImportTargets(
  queryClient: QueryClient,
  restaurantId: string,
  decisions: ReadonlyArray<ImportDecisionLike>,
  failedFieldKeys: ReadonlySet<string> = new Set(),
) {
  const keys = new Map<string, readonly unknown[]>();
  for (const decision of decisions) {
    if (decision.action !== 'import_from_google' || failedFieldKeys.has(decision.fieldKey)) {
      continue;
    }
    for (const key of nabatableKeysForImportSection(restaurantId, decision.sectionKey)) {
      keys.set(JSON.stringify(key), key);
    }
  }
  for (const key of keys.values()) {
    void queryClient.invalidateQueries({ queryKey: key });
  }
}
