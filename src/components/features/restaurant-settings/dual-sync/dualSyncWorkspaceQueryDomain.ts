import type {
  GetDualSyncMetricsRequest,
  ListDualSyncCandidatesRequest,
  ListDualSyncJobsRequest,
  ListDualSyncOperationsRequest,
  ListDualSyncPublishJobsRequest,
} from '@/services/ops/dual-sync';

export interface DualSyncWorkspaceLazyPanelState {
  readonly showOperationalHealth: boolean;
  readonly showOperations: boolean;
  readonly showPendingCandidates: boolean;
  readonly showPublishJobs: boolean;
  readonly showQueueJobs: boolean;
}

export interface DualSyncWorkspaceLazyRequests {
  readonly operationsRequest?: ListDualSyncOperationsRequest;
  readonly jobsRequest?: ListDualSyncJobsRequest;
  readonly candidatesRequest?: ListDualSyncCandidatesRequest;
  readonly metricsRequest?: GetDualSyncMetricsRequest;
  readonly publishJobsRequest?: ListDualSyncPublishJobsRequest;
  readonly publishJobDetailId: string | null;
}

export function buildDualSyncWorkspaceLazyRequests(
  state: DualSyncWorkspaceLazyPanelState,
  selectedJobId: string | null,
): DualSyncWorkspaceLazyRequests {
  return {
    operationsRequest: state.showOperations ? { limit: 50 } : undefined,
    candidatesRequest: state.showPendingCandidates ? { limit: 50, statuses: ['open'] } : undefined,
    jobsRequest: state.showQueueJobs
      ? { limit: 25, statuses: ['queued', 'running', 'retrying', 'dead_letter', 'failed'] }
      : undefined,
    metricsRequest: state.showOperationalHealth ? { windowHours: 24, limit: 200 } : undefined,
    publishJobsRequest: state.showPublishJobs ? { jobLimit: 25 } : undefined,
    publishJobDetailId: state.showPublishJobs ? selectedJobId : null,
  };
}
