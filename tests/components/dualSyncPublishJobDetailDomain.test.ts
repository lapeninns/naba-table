import { describe, expect, it } from 'vitest';

import {
  buildDualSyncOperationGroupViewModel,
  buildDualSyncPublishBatchViewModel,
  buildDualSyncPublishOperationViewModel,
  formatDualSyncOperationErrorPreview,
  hasDualSyncPublishJobDetailRecords,
} from '@/components/features/restaurant-settings/dual-sync/panels/jobs/dualSyncPublishJobDetailDomain';
import { buildDualSyncPublishJobRowViewModel } from '@/components/features/restaurant-settings/dual-sync/panels/jobs/dualSyncPublishJobRowDomain';

import type {
  DualSyncPublishBatch,
  DualSyncPublishOperation,
  DualSyncPublishOperationGroup,
} from '@/server/dual-sync';
import type {
  DualSyncPublishJobDetail,
  DualSyncPublishJobRollup,
} from '@/server/dual-sync/publish/operations';

function makeBatch(overrides: Partial<DualSyncPublishBatch> = {}): DualSyncPublishBatch {
  return {
    id: 'batch-1',
    restaurantId: 'restaurant-1',
    provider: 'google_business_profile',
    clientRequestId: null,
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
    ...overrides,
  };
}

function makeGroup(
  overrides: Partial<DualSyncPublishOperationGroup> = {},
): DualSyncPublishOperationGroup {
  return {
    id: 'group-1',
    restaurantId: 'restaurant-1',
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
    googleUpdateMasks: ['profile', 'title'],
    decisionCount: 2,
    preflightStatus: null,
    preflightResult: null,
    requestSummary: null,
    responseSummary: null,
    errorCode: null,
    errorMessage: null,
    startedAt: '2026-05-09T12:00:00.000Z',
    finishedAt: '2026-05-09T12:00:01.000Z',
    createdAt: '2026-05-09T12:00:00.000Z',
    updatedAt: '2026-05-09T12:00:01.000Z',
    ...overrides,
  };
}

function makeOperation(
  overrides: Partial<DualSyncPublishOperation> = {},
): DualSyncPublishOperation {
  return {
    id: 'operation-1',
    restaurantId: 'restaurant-1',
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
    ...overrides,
  };
}

function makeRollup(overrides: Partial<DualSyncPublishJobRollup> = {}): DualSyncPublishJobRollup {
  return {
    publishJobId: 'publish-job-12345678',
    restaurantId: 'restaurant-1',
    startedAt: '2026-05-09T12:00:00.000Z',
    finishedAt: '2026-05-09T12:00:01.500Z',
    totalOperations: 4,
    succeededCount: 2,
    failedCount: 1,
    skippedCount: 1,
    otherCount: 0,
    sections: ['profile', 'businessContext.categories'],
    errorCodes: ['GBP_FAILED'],
    importCount: 1,
    exportCount: 2,
    ...overrides,
  };
}

describe('dualSyncPublishJobsDomain detail helpers', () => {
  it('builds recent publish job row display values', () => {
    expect(buildDualSyncPublishJobRowViewModel(makeRollup())).toMatchObject({
      id: 'publish-job-12345678',
      status: 'partial',
      shortId: 'publish-',
      startedAtLabel: expect.stringContaining('2026'),
      durationLabel: '1.50s',
      succeededCount: 2,
      failedCount: 1,
      skippedCount: 1,
      hasSkippedCount: true,
      importCount: 1,
      exportCount: 2,
      hasImportCount: true,
      hasExportCount: true,
      errorCodes: ['GBP_FAILED'],
      hasErrorCodes: true,
      sectionLabels: [
        { key: 'profile', label: 'Profile' },
        { key: 'businessContext.categories', label: 'Categories' },
      ],
    });
  });

  it('builds row display fallbacks for in-flight jobs with no counts', () => {
    expect(
      buildDualSyncPublishJobRowViewModel(
        makeRollup({
          finishedAt: null,
          succeededCount: 0,
          failedCount: 0,
          skippedCount: 0,
          otherCount: 1,
          errorCodes: [],
          importCount: 0,
          exportCount: 0,
        }),
      ),
    ).toMatchObject({
      status: 'in-flight',
      durationLabel: '—',
      hasSkippedCount: false,
      hasImportCount: false,
      hasExportCount: false,
      hasErrorCodes: false,
    });
  });

  it('detects whether a publish job detail has any records to show', () => {
    const emptyDetail = {
      rollup: {},
      batch: null,
      operationGroups: [],
      operations: [],
    } as unknown as DualSyncPublishJobDetail;

    expect(hasDualSyncPublishJobDetailRecords(emptyDetail)).toBe(false);
    expect(hasDualSyncPublishJobDetailRecords({ ...emptyDetail, batch: makeBatch() })).toBe(true);
  });

  it('builds batch display values with a no-client-request fallback', () => {
    expect(buildDualSyncPublishBatchViewModel(makeBatch())).toMatchObject({
      id: 'batch-1',
      status: 'succeeded',
      acceptedCount: 1,
      rejectedCount: 0,
      ignoredCount: 0,
      clientRequestLabel: 'no client request',
    });
    expect(
      buildDualSyncPublishBatchViewModel(makeBatch({ clientRequestId: 'request-1' }))
        .clientRequestLabel,
    ).toBe('request-1');
  });

  it('builds operation-group display values', () => {
    expect(buildDualSyncOperationGroupViewModel(makeGroup())).toMatchObject({
      id: 'group-1',
      status: 'succeeded',
      statusVariant: 'default',
      writeGroup: 'location.profile',
      sectionLabel: 'Profile',
      preflightLabel: 'required',
      decisionCount: 2,
      masksLabel: 'profile, title',
    });

    expect(
      buildDualSyncOperationGroupViewModel(
        makeGroup({ googleUpdateMasks: [], requiresPreflight: false }),
      ),
    ).toMatchObject({ preflightLabel: 'not_required', masksLabel: 'mask-only' });
  });

  it('builds operation display values and truncates long error messages', () => {
    const longMessage = 'x'.repeat(90);
    expect(
      buildDualSyncPublishOperationViewModel(
        makeOperation({
          direction: 'import_from_google',
          status: 'failed',
          errorCode: 'GBP_FAILED',
          errorMessage: longMessage,
        }),
      ),
    ).toMatchObject({
      id: 'operation-1',
      status: 'failed',
      statusVariant: 'destructive',
      fieldKey: 'profile.businessDescription',
      direction: 'import_from_google',
      directionIconKey: 'import',
      directionLabel: 'import',
      errorCode: 'GBP_FAILED',
      errorPreview: `${'x'.repeat(80)}…`,
    });

    expect(formatDualSyncOperationErrorPreview(null)).toBeNull();
    expect(formatDualSyncOperationErrorPreview('short')).toBe('short');
  });
});
