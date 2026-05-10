/**
 * Phase 3c of the unified dual-sync engine.
 *
 * Typed client for the dual-sync ops API. Talks exclusively to the
 * `/dual-sync/*` routes; legacy and V2 contracts are not mixed in.
 */

import { fetchJson } from '@/lib/http/fetchJson';

import type {
  DualSyncDecisionAction,
  DualSyncFieldCapability,
  DualSyncFieldPolicy,
  DualSyncFieldState,
  DualSyncJob,
  DualSyncJobStatus,
  DualSyncOutboundCandidate,
  DualSyncOutboundSource,
  DualSyncOutboundStatus,
  DualSyncRestaurantControl,
  FoodMenusRefreshResult,
  DualSyncPublishOperation,
  DualSyncPublishOperationStatus,
  DualSyncSectionKey,
  DualSyncSnapshotRun,
} from '@/server/dual-sync';
import type { DualSyncOperationalMetrics } from '@/server/dual-sync/observability';
import type {
  DualSyncPublishJobDetail,
  DualSyncPublishJobRollup,
} from '@/server/dual-sync/publish/operations';
import type {
  DualSyncOperationFailure,
  DualSyncPublishJobSummary,
  DualSyncPublishPlan,
} from '@/server/dual-sync/publish/types';
import type { DualSyncCanonicalSnapshot } from '@/server/dual-sync/snapshots/types';

const baseUrl = (restaurantId: string): string => `/api/ops/restaurants/${restaurantId}/dual-sync`;

export interface DualSyncFieldSummary {
  readonly fieldKey: string;
  readonly sectionKey: DualSyncSectionKey | 'core_only';
  readonly kind: string;
  readonly label: string;
  readonly helpText: string | null;
  readonly conflictPolicy: 'manual' | 'core_wins' | 'gbp_wins' | 'unsupported';
  readonly deletePolicy: 'manual' | 'clear_remote' | 'clear_core' | 'ignore';
  readonly policy: DualSyncFieldPolicy;
  readonly importable: boolean;
  readonly exportable: boolean;
  readonly sortOrder: number;
  readonly coreValue: unknown;
  readonly gbpValue: unknown;
  readonly coreCanonicalHash: string | null;
  readonly gbpCanonicalHash: string | null;
  readonly capability: DualSyncFieldCapability;
  readonly state: DualSyncFieldState | null;
  readonly lastInSyncAt: string | null;
  readonly lastInSyncHash: string | null;
  readonly lastCoreChangeAt: string | null;
  readonly lastGbpChangeAt: string | null;
  readonly openCandidate: {
    readonly id: string;
    readonly proposedValue: unknown;
    readonly proposedValueHash: string | null;
    readonly source: DualSyncOutboundSource;
    readonly createdAt: string;
    readonly updatedAt: string;
  } | null;
}

export interface DualSyncOutboundQueueSummary {
  readonly totalOpen: number;
  readonly autoExportable: number;
  readonly missingBaseline: number;
  readonly lastQueuedAt: string | null;
}

export interface DualSyncLastSnapshotSummary {
  readonly runId: string;
  readonly runKind: string;
  readonly startedAt: string;
  readonly finishedAt: string | null;
}

export interface GetDualSyncStateResponse {
  readonly restaurantId: string;
  readonly coreSnapshot: DualSyncCanonicalSnapshot;
  readonly gbpSnapshot: DualSyncCanonicalSnapshot;
  readonly coreSnapshotHash: string | null;
  readonly gbpSnapshotHash: string | null;
  readonly fields: ReadonlyArray<DualSyncFieldSummary>;
  readonly outboundQueue: DualSyncOutboundQueueSummary;
  readonly lastSnapshot: DualSyncLastSnapshotSummary | null;
  readonly control: DualSyncRestaurantControl;
}

export async function getDualSyncState(restaurantId: string): Promise<GetDualSyncStateResponse> {
  return fetchJson<GetDualSyncStateResponse>(`${baseUrl(restaurantId)}/state`);
}

export interface GetDualSyncControlResponse {
  readonly restaurantId: string;
  readonly control: DualSyncRestaurantControl;
}

export interface SetDualSyncControlRequest {
  readonly syncPaused: boolean;
  readonly reason?: string | null;
}

export type SetDualSyncControlResponse = GetDualSyncControlResponse;

export async function getDualSyncControl(
  restaurantId: string,
): Promise<GetDualSyncControlResponse> {
  return fetchJson<GetDualSyncControlResponse>(`${baseUrl(restaurantId)}/control`);
}

export async function setDualSyncControl(
  restaurantId: string,
  request: SetDualSyncControlRequest,
): Promise<SetDualSyncControlResponse> {
  return fetchJson<SetDualSyncControlResponse>(`${baseUrl(restaurantId)}/control`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
  });
}

export interface RefreshDualSyncResponse {
  readonly snapshotRun: DualSyncSnapshotRun;
  readonly foodMenusRefresh: FoodMenusRefreshResult;
  readonly transitions: ReadonlyArray<{
    readonly fieldKey: string;
    readonly fromState: DualSyncFieldState | null;
    readonly toState: DualSyncFieldState;
  }>;
  readonly evaluatedFieldKeys: ReadonlyArray<string>;
}

export async function refreshDualSync(restaurantId: string): Promise<RefreshDualSyncResponse> {
  return fetchJson<RefreshDualSyncResponse>(`${baseUrl(restaurantId)}/refresh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
}

export interface DualSyncPublishRequest {
  readonly decisions: ReadonlyArray<{
    readonly fieldKey: string;
    readonly sectionKey: DualSyncSectionKey;
    readonly action: DualSyncDecisionAction;
    readonly pinnedCoreHash: string | null;
    readonly pinnedGbpHash: string | null;
  }>;
  readonly clientRequestId?: string | null;
  readonly publishBatchId?: string | null;
  readonly pinnedCoreSnapshotHash?: string | null;
  readonly pinnedGbpSnapshotHash?: string | null;
}

export type DualSyncPublishResponse = DualSyncPublishJobSummary & {
  readonly failures: ReadonlyArray<{
    readonly fieldKey: string;
    readonly failure: DualSyncOperationFailure;
  }>;
};

export async function publishDualSyncDecisions(
  restaurantId: string,
  request: DualSyncPublishRequest,
): Promise<DualSyncPublishResponse> {
  return fetchJson<DualSyncPublishResponse>(`${baseUrl(restaurantId)}/publish`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
  });
}

export type DualSyncPublishPreviewResponse = DualSyncPublishPlan;

export async function previewDualSyncPublishPlan(
  restaurantId: string,
  request: DualSyncPublishRequest,
): Promise<DualSyncPublishPreviewResponse> {
  return fetchJson<DualSyncPublishPreviewResponse>(`${baseUrl(restaurantId)}/publish/preview`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
  });
}

export interface RunAutoExportRequest {
  readonly maxCandidates?: number;
}

export interface RunAutoExportResponse {
  readonly restaurantId: string;
  readonly candidatesConsidered: number;
  readonly decisionsExecuted: number;
  readonly publishResult: { readonly summary: DualSyncPublishJobSummary } | null;
  readonly skipped: ReadonlyArray<{
    readonly candidateId: string;
    readonly fieldKey: string;
    readonly reason: 'no_baseline' | 'unsupported_section';
  }>;
}

export async function runDualSyncAutoExport(
  restaurantId: string,
  request: RunAutoExportRequest = {},
): Promise<RunAutoExportResponse> {
  return fetchJson<RunAutoExportResponse>(`${baseUrl(restaurantId)}/auto-export`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
  });
}

export interface ListDualSyncOperationsRequest {
  readonly limit?: number;
  readonly since?: string | null;
  readonly statuses?: ReadonlyArray<DualSyncPublishOperationStatus>;
  readonly direction?: 'import_from_google' | 'export_to_google';
}

export interface ListDualSyncOperationsResponse {
  readonly restaurantId: string;
  readonly operations: ReadonlyArray<DualSyncPublishOperation>;
}

function buildOperationsQuery(request: ListDualSyncOperationsRequest): string {
  const search = new URLSearchParams();
  if (request.limit !== undefined) search.set('limit', String(request.limit));
  if (request.since) search.set('since', request.since);
  if (request.statuses && request.statuses.length > 0) {
    search.set('status', request.statuses.join(','));
  }
  if (request.direction) search.set('direction', request.direction);
  const qs = search.toString();
  return qs.length > 0 ? `?${qs}` : '';
}

export async function listDualSyncOperations(
  restaurantId: string,
  request: ListDualSyncOperationsRequest = {},
): Promise<ListDualSyncOperationsResponse> {
  return fetchJson<ListDualSyncOperationsResponse>(
    `${baseUrl(restaurantId)}/operations${buildOperationsQuery(request)}`,
  );
}

export interface ListDualSyncJobsRequest {
  readonly limit?: number;
  readonly statuses?: ReadonlyArray<DualSyncJobStatus>;
}

export interface ListDualSyncJobsResponse {
  readonly restaurantId: string;
  readonly jobs: ReadonlyArray<DualSyncJob>;
}

function buildJobsQuery(request: ListDualSyncJobsRequest): string {
  const search = new URLSearchParams();
  if (request.limit !== undefined) search.set('limit', String(request.limit));
  if (request.statuses && request.statuses.length > 0) {
    search.set('status', request.statuses.join(','));
  }
  const qs = search.toString();
  return qs.length > 0 ? `?${qs}` : '';
}

export async function listDualSyncJobs(
  restaurantId: string,
  request: ListDualSyncJobsRequest = {},
): Promise<ListDualSyncJobsResponse> {
  return fetchJson<ListDualSyncJobsResponse>(
    `${baseUrl(restaurantId)}/jobs${buildJobsQuery(request)}`,
  );
}

export interface ListDualSyncCandidatesRequest {
  readonly limit?: number;
  readonly statuses?: ReadonlyArray<DualSyncOutboundStatus>;
}

export interface ListDualSyncCandidatesResponse {
  readonly restaurantId: string;
  readonly candidates: ReadonlyArray<DualSyncOutboundCandidate>;
}

function buildCandidatesQuery(request: ListDualSyncCandidatesRequest): string {
  const search = new URLSearchParams();
  if (request.limit !== undefined) search.set('limit', String(request.limit));
  if (request.statuses && request.statuses.length > 0) {
    search.set('status', request.statuses.join(','));
  }
  const qs = search.toString();
  return qs.length > 0 ? `?${qs}` : '';
}

export async function listDualSyncCandidates(
  restaurantId: string,
  request: ListDualSyncCandidatesRequest = {},
): Promise<ListDualSyncCandidatesResponse> {
  return fetchJson<ListDualSyncCandidatesResponse>(
    `${baseUrl(restaurantId)}/candidates${buildCandidatesQuery(request)}`,
  );
}

export interface GetDualSyncMetricsRequest {
  readonly windowHours?: number;
  readonly limit?: number;
}

export type GetDualSyncMetricsResponse = DualSyncOperationalMetrics;

function buildMetricsQuery(request: GetDualSyncMetricsRequest): string {
  const search = new URLSearchParams();
  if (request.windowHours !== undefined) search.set('windowHours', String(request.windowHours));
  if (request.limit !== undefined) search.set('limit', String(request.limit));
  const qs = search.toString();
  return qs.length > 0 ? `?${qs}` : '';
}

export async function getDualSyncMetrics(
  restaurantId: string,
  request: GetDualSyncMetricsRequest = {},
): Promise<GetDualSyncMetricsResponse> {
  return fetchJson<GetDualSyncMetricsResponse>(
    `${baseUrl(restaurantId)}/metrics${buildMetricsQuery(request)}`,
  );
}

export interface RetryDualSyncJobResponse {
  readonly restaurantId: string;
  readonly job: DualSyncJob;
}

export async function retryDualSyncJob(
  restaurantId: string,
  jobId: string,
): Promise<RetryDualSyncJobResponse> {
  return fetchJson<RetryDualSyncJobResponse>(
    `${baseUrl(restaurantId)}/jobs/${encodeURIComponent(jobId)}/retry`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    },
  );
}

export interface CancelDualSyncCandidateResponse {
  readonly restaurantId: string;
  readonly candidate: DualSyncOutboundCandidate;
}

export async function cancelDualSyncCandidate(
  restaurantId: string,
  candidateId: string,
): Promise<CancelDualSyncCandidateResponse> {
  return fetchJson<CancelDualSyncCandidateResponse>(
    `${baseUrl(restaurantId)}/candidates/${encodeURIComponent(candidateId)}/cancel`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    },
  );
}

export interface ListDualSyncPublishJobsRequest {
  readonly jobLimit?: number;
  readonly operationLimit?: number;
  readonly since?: string | null;
}

export interface ListDualSyncPublishJobsResponse {
  readonly restaurantId: string;
  readonly jobs: ReadonlyArray<DualSyncPublishJobRollup>;
}

function buildPublishJobsQuery(request: ListDualSyncPublishJobsRequest): string {
  const search = new URLSearchParams();
  if (request.jobLimit !== undefined) search.set('jobLimit', String(request.jobLimit));
  if (request.operationLimit !== undefined)
    search.set('operationLimit', String(request.operationLimit));
  if (request.since) search.set('since', request.since);
  const qs = search.toString();
  return qs.length > 0 ? `?${qs}` : '';
}

export async function listDualSyncPublishJobs(
  restaurantId: string,
  request: ListDualSyncPublishJobsRequest = {},
): Promise<ListDualSyncPublishJobsResponse> {
  return fetchJson<ListDualSyncPublishJobsResponse>(
    `${baseUrl(restaurantId)}/publish-jobs${buildPublishJobsQuery(request)}`,
  );
}

export interface GetDualSyncPublishJobDetailResponse extends DualSyncPublishJobDetail {
  readonly restaurantId: string;
}

export async function getDualSyncPublishJobDetail(
  restaurantId: string,
  publishJobId: string,
): Promise<GetDualSyncPublishJobDetailResponse> {
  return fetchJson<GetDualSyncPublishJobDetailResponse>(
    `${baseUrl(restaurantId)}/publish-jobs/${encodeURIComponent(publishJobId)}`,
  );
}
