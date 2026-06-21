import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DualSyncPublishJobsPanel } from '@/components/features/restaurant-settings/dual-sync/panels/jobs/DualSyncPublishJobsPanel';

import type { DualSyncPublishBatch, DualSyncPublishOperationGroup } from '@/server/dual-sync';
import type { DualSyncPublishJobRollup } from '@/server/dual-sync/publish/operations';
import type {
  GetDualSyncPublishJobDetailResponse,
  ListDualSyncPublishJobsResponse,
} from '@/services/ops/dual-sync';
import type { UseQueryResult } from '@tanstack/react-query';

const restaurantId = 'restaurant-1';

function rollup(over: Partial<DualSyncPublishJobRollup> = {}): DualSyncPublishJobRollup {
  return {
    publishJobId: 'publish-job-1',
    restaurantId,
    startedAt: '2026-05-09T12:00:00.000Z',
    finishedAt: '2026-05-09T12:00:01.000Z',
    totalOperations: 1,
    succeededCount: 1,
    failedCount: 0,
    skippedCount: 0,
    otherCount: 0,
    sections: ['profile'],
    errorCodes: [],
    importCount: 0,
    exportCount: 1,
    ...over,
  };
}

function batch(over: Partial<DualSyncPublishBatch> = {}): DualSyncPublishBatch {
  return {
    id: 'batch-1',
    restaurantId,
    provider: 'google_business_profile',
    clientRequestId: 'request-1',
    actorUserId: 'user-1',
    status: 'succeeded',
    decisionHash: 'decision-hash',
    pinnedCoreSnapshotHash: 'core-pin',
    pinnedGbpSnapshotHash: 'gbp-pin',
    coreSnapshotHash: 'core-current',
    gbpSnapshotHash: 'gbp-current',
    fieldPolicyVersionId: 'policy-version-1',
    fieldPolicyHash: 'policy-hash-1',
    acceptedCount: 1,
    rejectedCount: 0,
    ignoredCount: 0,
    planSummary: { groups: 1 },
    errorCode: null,
    errorMessage: null,
    startedAt: '2026-05-09T12:00:00.000Z',
    finishedAt: '2026-05-09T12:00:01.000Z',
    createdAt: '2026-05-09T12:00:00.000Z',
    updatedAt: '2026-05-09T12:00:01.000Z',
    ...over,
  };
}

function operationGroup(
  over: Partial<DualSyncPublishOperationGroup> = {},
): DualSyncPublishOperationGroup {
  return {
    id: 'group-1',
    restaurantId,
    publishBatchId: 'batch-1',
    groupKey: 'export_to_google:profile:location.profile',
    sectionKey: 'profile',
    direction: 'export_to_google',
    writeGroup: 'location.profile',
    status: 'succeeded',
    riskLevel: 'medium',
    requiresPreflight: true,
    requiresManualConfirmation: false,
    destructiveWritePossible: false,
    googleUpdateMasks: ['profile'],
    decisionCount: 1,
    preflightStatus: 'passed',
    preflightResult: { providerValidateOnly: 'supported' },
    requestSummary: null,
    responseSummary: null,
    errorCode: null,
    errorMessage: null,
    startedAt: '2026-05-09T12:00:00.000Z',
    finishedAt: '2026-05-09T12:00:01.000Z',
    createdAt: '2026-05-09T12:00:00.000Z',
    updatedAt: '2026-05-09T12:00:01.000Z',
    ...over,
  };
}

function query<T>(data: T): UseQueryResult<T, Error> {
  return {
    data,
    isLoading: false,
    isError: false,
    isFetching: false,
    error: null,
    refetch: vi.fn(),
  } as unknown as UseQueryResult<T, Error>;
}

describe('DualSyncPublishJobsPanel', () => {
  it('renders persisted batch and operation-group audit detail for the selected job', () => {
    const job = rollup();
    const detail: GetDualSyncPublishJobDetailResponse = {
      restaurantId,
      rollup: job,
      batch: batch(),
      operationGroups: [operationGroup()],
      operations: [
        {
          id: 'operation-1',
          restaurantId,
          publishJobId: 'publish-job-1',
          publishBatchId: 'batch-1',
          operationGroupId: 'group-1',
          sectionKey: 'profile',
          fieldKey: 'profile.businessDescription',
          direction: 'export_to_google',
          status: 'succeeded',
          attemptCount: 1,
          beforeCoreHash: 'before-core',
          beforeGbpHash: 'before-gbp',
          afterCoreHash: 'after-core',
          afterGbpHash: 'after-gbp',
          googleUpdateMask: 'profile',
          errorCode: null,
          errorMessage: null,
          externalResponse: null,
          startedAt: '2026-05-09T12:00:00.000Z',
          finishedAt: '2026-05-09T12:00:01.000Z',
          createdAt: '2026-05-09T12:00:00.000Z',
          updatedAt: '2026-05-09T12:00:01.000Z',
        },
      ],
    };

    render(
      <DualSyncPublishJobsPanel
        publishJobsQuery={query<ListDualSyncPublishJobsResponse>({
          restaurantId,
          jobs: [job],
        })}
        selectedJobId="publish-job-1"
        onSelectJob={vi.fn()}
        publishJobDetailQuery={query<GetDualSyncPublishJobDetailResponse>(detail)}
      />,
    );

    expect(screen.getByText('Publish batch')).toBeInTheDocument();
    expect(screen.getByText('batch-1')).toBeInTheDocument();
    expect(screen.getByText('request-1')).toBeInTheDocument();
    expect(screen.getByText('location.profile')).toBeInTheDocument();
    expect(screen.getByText('passed')).toBeInTheDocument();
    expect(screen.getByText('profile.businessDescription')).toBeInTheDocument();
  });
});
