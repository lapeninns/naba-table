/**
 * Phase 3c of the unified dual-sync engine.
 *
 * react-query hook for the dual-sync ops surface. Exposes typed
 * mutations (`refresh`, `publish`) and a `state` query keyed by
 * restaurant.
 */

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query/keys';
import {
  getDualSyncPublishJobDetail,
  getDualSyncState,
  listDualSyncOperations,
  listDualSyncPublishJobs,
  publishDualSyncDecisions,
  refreshDualSync,
  runDualSyncAutoExport,
} from '@/services/ops/dual-sync';

import type {
  DualSyncPublishRequest,
  DualSyncPublishResponse,
  GetDualSyncPublishJobDetailResponse,
  GetDualSyncStateResponse,
  ListDualSyncOperationsRequest,
  ListDualSyncOperationsResponse,
  ListDualSyncPublishJobsRequest,
  ListDualSyncPublishJobsResponse,
  RefreshDualSyncResponse,
  RunAutoExportRequest,
  RunAutoExportResponse,
} from '@/services/ops/dual-sync';

const stateKey = (restaurantId: string) => ['dual-sync-state', restaurantId] as const;
const operationsKey = (restaurantId: string, request: ListDualSyncOperationsRequest) =>
  [
    'dual-sync-operations',
    restaurantId,
    request.limit ?? null,
    request.since ?? null,
    request.statuses ? [...request.statuses].sort().join(',') : null,
    request.direction ?? null,
  ] as const;
const publishJobsKey = (restaurantId: string, request: ListDualSyncPublishJobsRequest) =>
  [
    'dual-sync-publish-jobs',
    restaurantId,
    request.jobLimit ?? null,
    request.operationLimit ?? null,
    request.since ?? null,
  ] as const;
const publishJobDetailKey = (restaurantId: string, jobId: string) =>
  ['dual-sync-publish-job-detail', restaurantId, jobId] as const;

function invalidateRestaurantProfileAfterDualSync(
  queryClient: ReturnType<typeof useQueryClient>,
  restaurantId: string,
) {
  queryClient.invalidateQueries({ queryKey: stateKey(restaurantId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.opsRestaurants.detail(restaurantId) });
}

export interface UseOpsDualSyncArgs {
  readonly restaurantId: string | null;
  /**
   * When provided, the hook lazily fetches a window of recent operations
   * for the operations dashboard panel. Pass `undefined` to skip this
   * query entirely (the default — keeps the shell's main render path
   * cheap).
   */
  readonly operationsRequest?: ListDualSyncOperationsRequest;
  /**
   * When provided, the hook lazily fetches recent publish-job rollups
   * for the "Recent publishes" panel. Pass `undefined` to skip.
   */
  readonly publishJobsRequest?: ListDualSyncPublishJobsRequest;
  /**
   * When provided, the hook lazily fetches the detail (rollup +
   * operations) for one publish job. Pass `null`/`undefined` to skip.
   */
  readonly publishJobDetailId?: string | null;
}

export function useOpsDualSync({
  restaurantId,
  operationsRequest,
  publishJobsRequest,
  publishJobDetailId,
}: UseOpsDualSyncArgs) {
  const queryClient = useQueryClient();
  const enabled = Boolean(restaurantId);
  const operationsEnabled = enabled && operationsRequest !== undefined;
  const publishJobsEnabled = enabled && publishJobsRequest !== undefined;
  const publishJobDetailEnabled =
    enabled && typeof publishJobDetailId === 'string' && publishJobDetailId.length > 0;

  const stateQuery = useQuery<GetDualSyncStateResponse>({
    enabled,
    queryKey: enabled ? stateKey(restaurantId as string) : ['dual-sync-state', 'noop'],
    queryFn: () => getDualSyncState(restaurantId as string),
  });

  const refreshMutation = useMutation<RefreshDualSyncResponse, Error, void>({
    mutationFn: () => {
      if (!restaurantId) {
        return Promise.reject(new Error('restaurantId is required to refresh dual-sync state.'));
      }
      return refreshDualSync(restaurantId);
    },
    onSuccess: () => {
      if (restaurantId) {
        invalidateRestaurantProfileAfterDualSync(queryClient, restaurantId);
      }
    },
  });

  const publishMutation = useMutation<DualSyncPublishResponse, Error, DualSyncPublishRequest>({
    mutationFn: (request) => {
      if (!restaurantId) {
        return Promise.reject(new Error('restaurantId is required to publish dual-sync.'));
      }
      return publishDualSyncDecisions(restaurantId, request);
    },
    onSuccess: () => {
      if (restaurantId) {
        invalidateRestaurantProfileAfterDualSync(queryClient, restaurantId);
      }
    },
  });

  const autoExportMutation = useMutation<RunAutoExportResponse, Error, RunAutoExportRequest | void>(
    {
      mutationFn: (request) => {
        if (!restaurantId) {
          return Promise.reject(
            new Error('restaurantId is required to run dual-sync auto-export.'),
          );
        }
        return runDualSyncAutoExport(restaurantId, request ?? {});
      },
      onSuccess: () => {
        if (restaurantId) {
          invalidateRestaurantProfileAfterDualSync(queryClient, restaurantId);
        }
      },
    },
  );

  const operationsQuery = useQuery<ListDualSyncOperationsResponse>({
    enabled: operationsEnabled,
    queryKey: operationsEnabled
      ? operationsKey(restaurantId as string, operationsRequest ?? {})
      : ['dual-sync-operations', 'noop'],
    queryFn: () => listDualSyncOperations(restaurantId as string, operationsRequest ?? {}),
  });

  const publishJobsQuery = useQuery<ListDualSyncPublishJobsResponse>({
    enabled: publishJobsEnabled,
    queryKey: publishJobsEnabled
      ? publishJobsKey(restaurantId as string, publishJobsRequest ?? {})
      : ['dual-sync-publish-jobs', 'noop'],
    queryFn: () => listDualSyncPublishJobs(restaurantId as string, publishJobsRequest ?? {}),
  });

  const publishJobDetailQuery = useQuery<GetDualSyncPublishJobDetailResponse>({
    enabled: publishJobDetailEnabled,
    queryKey: publishJobDetailEnabled
      ? publishJobDetailKey(restaurantId as string, publishJobDetailId as string)
      : ['dual-sync-publish-job-detail', 'noop'],
    queryFn: () =>
      getDualSyncPublishJobDetail(restaurantId as string, publishJobDetailId as string),
  });

  return {
    stateQuery,
    refreshMutation,
    publishMutation,
    autoExportMutation,
    operationsQuery,
    publishJobsQuery,
    publishJobDetailQuery,
  };
}
