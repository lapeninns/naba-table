/**
 * Phase 3c of the unified dual-sync engine.
 *
 * react-query hook for the dual-sync ops surface. Exposes typed
 * mutations (`refresh`, `publish`) and a `state` query keyed by
 * restaurant.
 */

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  getDualSyncMetrics,
  getDualSyncPublishJobDetail,
  getDualSyncState,
  listDualSyncCandidates,
  listDualSyncJobs,
  listDualSyncOperations,
  listDualSyncPublishJobs,
  previewDualSyncPublishPlan,
  previewGbpExactPublishV1,
  publishGbpExactV1,
  publishDualSyncDecisions,
  refreshDualSync,
  cancelDualSyncCandidate,
  retryDualSyncJob,
  runDualSyncAutoExport,
  setDualSyncControl,
} from '@/services/ops/dual-sync';

import {
  dualSyncQueryKeys,
  invalidateDualSyncWorkspaceQueries,
  invalidateOpsIntegrationQueries,
} from './opsIntegrationQueries';

import type {
  DualSyncPublishRequest,
  DualSyncPublishPreviewResponse,
  DualSyncPublishResponse,
  GetDualSyncMetricsRequest,
  GetDualSyncMetricsResponse,
  GetDualSyncPublishJobDetailResponse,
  GetDualSyncStateResponse,
  ListDualSyncCandidatesRequest,
  ListDualSyncCandidatesResponse,
  ListDualSyncJobsRequest,
  ListDualSyncJobsResponse,
  ListDualSyncOperationsRequest,
  ListDualSyncOperationsResponse,
  ListDualSyncPublishJobsRequest,
  ListDualSyncPublishJobsResponse,
  RefreshDualSyncResponse,
  RunAutoExportRequest,
  RunAutoExportResponse,
  SetDualSyncControlRequest,
  SetDualSyncControlResponse,
  GbpExactPreviewResponseV1,
  GbpExactPublishRequestV1,
  GbpPublishResponseV1,
} from '@/services/ops/dual-sync';

const operationsKey = (restaurantId: string, request: ListDualSyncOperationsRequest) =>
  [
    'dual-sync-operations',
    restaurantId,
    request.limit ?? null,
    request.since ?? null,
    request.statuses ? [...request.statuses].sort().join(',') : null,
    request.direction ?? null,
  ] as const;
const jobsKey = (restaurantId: string, request: ListDualSyncJobsRequest) =>
  [
    'dual-sync-jobs',
    restaurantId,
    request.limit ?? null,
    request.statuses ? [...request.statuses].sort().join(',') : null,
  ] as const;
const candidatesKey = (restaurantId: string, request: ListDualSyncCandidatesRequest) =>
  [
    'dual-sync-candidates',
    restaurantId,
    request.limit ?? null,
    request.statuses ? [...request.statuses].sort().join(',') : null,
  ] as const;
const metricsKey = (restaurantId: string, request: GetDualSyncMetricsRequest) =>
  ['dual-sync-metrics', restaurantId, request.windowHours ?? null, request.limit ?? null] as const;
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
   * When provided, the hook lazily fetches durable queue jobs for
   * operator recovery panels. Pass `undefined` to skip.
   */
  readonly jobsRequest?: ListDualSyncJobsRequest;
  /**
   * When provided, the hook lazily fetches outbound candidates for the
   * pending-change center. Pass `undefined` to skip.
   */
  readonly candidatesRequest?: ListDualSyncCandidatesRequest;
  /**
   * When provided, the hook lazily fetches restaurant-scoped operational
   * health metrics for the operator dashboard. Pass `undefined` to skip.
   */
  readonly metricsRequest?: GetDualSyncMetricsRequest;
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
  jobsRequest,
  candidatesRequest,
  metricsRequest,
  publishJobsRequest,
  publishJobDetailId,
}: UseOpsDualSyncArgs) {
  const queryClient = useQueryClient();
  const enabled = Boolean(restaurantId);
  const operationsEnabled = enabled && operationsRequest !== undefined;
  const jobsEnabled = enabled && jobsRequest !== undefined;
  const candidatesEnabled = enabled && candidatesRequest !== undefined;
  const metricsEnabled = enabled && metricsRequest !== undefined;
  const publishJobsEnabled = enabled && publishJobsRequest !== undefined;
  const publishJobDetailEnabled =
    enabled && typeof publishJobDetailId === 'string' && publishJobDetailId.length > 0;

  const stateQuery = useQuery<GetDualSyncStateResponse>({
    enabled,
    queryKey: enabled
      ? dualSyncQueryKeys.state(restaurantId as string)
      : ['dual-sync-state', 'noop'],
    queryFn: () => getDualSyncState(restaurantId as string),
    meta: { persist: false },
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
        invalidateOpsIntegrationQueries(queryClient, restaurantId);
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
        invalidateOpsIntegrationQueries(queryClient, restaurantId);
      }
    },
  });

  const previewPublishMutation = useMutation<
    DualSyncPublishPreviewResponse,
    Error,
    DualSyncPublishRequest
  >({
    mutationFn: (request) => {
      if (!restaurantId) {
        return Promise.reject(new Error('restaurantId is required to preview dual-sync publish.'));
      }
      return previewDualSyncPublishPlan(restaurantId, request);
    },
  });

  const exactPreviewPublishMutation = useMutation<
    GbpExactPreviewResponseV1,
    Error,
    DualSyncPublishRequest
  >({
    mutationFn: (request) => {
      if (!restaurantId) {
        return Promise.reject(new Error('restaurantId is required to preview exact GBP publish.'));
      }
      return previewGbpExactPublishV1(restaurantId, request);
    },
  });

  const exactPublishMutation = useMutation<GbpPublishResponseV1, Error, GbpExactPublishRequestV1>({
    mutationFn: (request) => {
      if (!restaurantId) {
        return Promise.reject(new Error('restaurantId is required to publish exact GBP plan.'));
      }
      return publishGbpExactV1(restaurantId, request);
    },
    onSuccess: () => {
      if (restaurantId) invalidateOpsIntegrationQueries(queryClient, restaurantId);
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
          invalidateOpsIntegrationQueries(queryClient, restaurantId);
        }
      },
    },
  );

  const retryJobMutation = useMutation<ListDualSyncJobsResponse['jobs'][number], Error, string>({
    mutationFn: async (jobId) => {
      if (!restaurantId) {
        return Promise.reject(new Error('restaurantId is required to retry dual-sync jobs.'));
      }
      const response = await retryDualSyncJob(restaurantId, jobId);
      return response.job;
    },
    onSuccess: () => {
      if (restaurantId) {
        invalidateOpsIntegrationQueries(queryClient, restaurantId);
      }
    },
  });

  const cancelCandidateMutation = useMutation<
    ListDualSyncCandidatesResponse['candidates'][number],
    Error,
    string
  >({
    mutationFn: async (candidateId) => {
      if (!restaurantId) {
        return Promise.reject(
          new Error('restaurantId is required to cancel dual-sync candidates.'),
        );
      }
      const response = await cancelDualSyncCandidate(restaurantId, candidateId);
      return response.candidate;
    },
    onSuccess: () => {
      if (restaurantId) {
        invalidateDualSyncWorkspaceQueries(queryClient, restaurantId);
      }
    },
  });

  const controlMutation = useMutation<SetDualSyncControlResponse, Error, SetDualSyncControlRequest>(
    {
      mutationFn: (request) => {
        if (!restaurantId) {
          return Promise.reject(new Error('restaurantId is required to update dual-sync control.'));
        }
        return setDualSyncControl(restaurantId, request);
      },
      onSuccess: () => {
        if (restaurantId) {
          invalidateDualSyncWorkspaceQueries(queryClient, restaurantId);
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
    meta: { persist: false },
  });

  const jobsQuery = useQuery<ListDualSyncJobsResponse>({
    enabled: jobsEnabled,
    queryKey: jobsEnabled
      ? jobsKey(restaurantId as string, jobsRequest ?? {})
      : ['dual-sync-jobs', 'noop'],
    queryFn: () => listDualSyncJobs(restaurantId as string, jobsRequest ?? {}),
    meta: { persist: false },
  });

  const candidatesQuery = useQuery<ListDualSyncCandidatesResponse>({
    enabled: candidatesEnabled,
    queryKey: candidatesEnabled
      ? candidatesKey(restaurantId as string, candidatesRequest ?? {})
      : ['dual-sync-candidates', 'noop'],
    queryFn: () => listDualSyncCandidates(restaurantId as string, candidatesRequest ?? {}),
    meta: { persist: false },
  });

  const metricsQuery = useQuery<GetDualSyncMetricsResponse>({
    enabled: metricsEnabled,
    queryKey: metricsEnabled
      ? metricsKey(restaurantId as string, metricsRequest ?? {})
      : ['dual-sync-metrics', 'noop'],
    queryFn: () => getDualSyncMetrics(restaurantId as string, metricsRequest ?? {}),
    meta: { persist: false },
  });

  const publishJobsQuery = useQuery<ListDualSyncPublishJobsResponse>({
    enabled: publishJobsEnabled,
    queryKey: publishJobsEnabled
      ? publishJobsKey(restaurantId as string, publishJobsRequest ?? {})
      : ['dual-sync-publish-jobs', 'noop'],
    queryFn: () => listDualSyncPublishJobs(restaurantId as string, publishJobsRequest ?? {}),
    meta: { persist: false },
  });

  const publishJobDetailQuery = useQuery<GetDualSyncPublishJobDetailResponse>({
    enabled: publishJobDetailEnabled,
    queryKey: publishJobDetailEnabled
      ? publishJobDetailKey(restaurantId as string, publishJobDetailId as string)
      : ['dual-sync-publish-job-detail', 'noop'],
    queryFn: () =>
      getDualSyncPublishJobDetail(restaurantId as string, publishJobDetailId as string),
    meta: { persist: false },
  });

  return {
    stateQuery,
    refreshMutation,
    publishMutation,
    previewPublishMutation,
    exactPreviewPublishMutation,
    exactPublishMutation,
    autoExportMutation,
    retryJobMutation,
    cancelCandidateMutation,
    controlMutation,
    operationsQuery,
    jobsQuery,
    candidatesQuery,
    metricsQuery,
    publishJobsQuery,
    publishJobDetailQuery,
  };
}
