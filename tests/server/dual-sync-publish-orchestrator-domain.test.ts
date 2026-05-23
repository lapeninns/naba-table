import { describe, expect, it } from 'vitest';

import { hashCanonicalJson } from '@/server/dual-sync/hashing';
import {
  batchStatusForSummary,
  buildDecisionHash,
  buildSummary,
  groupKeyForDecision,
  isExport,
  isImport,
  operationGroupExecutionSummary,
  operationGroupStatusForOperations,
  policyFailure,
  readSectionValue,
  valueForField,
} from '@/server/dual-sync/publish/orchestrator-domain';
import { buildRegistry, findFieldConfig } from '@/server/dual-sync/registry';

import type { DualSyncCanonicalSnapshot } from '@/server/dual-sync/snapshots/types';
import type { DualSyncPublishOperation } from '@/server/dual-sync/types';

function makeSnapshot(
  overrides: Partial<DualSyncCanonicalSnapshot> = {},
): DualSyncCanonicalSnapshot {
  return {
    profile: {
      name: 'Acme',
      businessDescription: 'Tasty',
      contactPhone: null,
      address: '1 Main',
      storefrontAddress: null,
      googleMapUrl: null,
      googleReviewUrl: null,
    },
    operatingHours: { weekly: [{ day: 'monday', intervals: [] }] },
    servicePeriods: { periods: [{ id: 'period-1', label: 'Dinner', days: [] }] },
    businessContext: {
      categories: [
        {
          displayName: 'Restaurant',
          categoryCode: 'gcid:restaurant',
          isPrimary: true,
          moreHoursTypes: [],
        },
      ],
      serviceAreas: [{ id: 'area-1', label: 'Leeds' }],
      attributes: [{ attributeId: 'has_takeout', displayName: 'Takeout', valueType: 'BOOL' }],
      serviceItems: [{ id: 'svc-1', name: 'Delivery' }],
    },
    foodMenus: { items: [{ id: 'item-1', title: 'Burger' }] },
    ...overrides,
  };
}

function makeOperation(overrides: Partial<DualSyncPublishOperation>): DualSyncPublishOperation {
  return {
    id: overrides.id ?? 'op-1',
    restaurantId: 'rest-1',
    publishJobId: 'job-1',
    publishBatchId: 'batch-1',
    operationGroupId: null,
    sectionKey: 'profile',
    fieldKey: 'profile.businessDescription',
    direction: 'export_to_google',
    status: 'pending',
    attemptCount: 0,
    beforeCoreHash: null,
    beforeGbpHash: null,
    afterCoreHash: null,
    afterGbpHash: null,
    googleUpdateMask: null,
    errorCode: null,
    errorMessage: null,
    externalResponse: null,
    startedAt: null,
    finishedAt: null,
    createdAt: '2026-05-22T00:00:00.000Z',
    updatedAt: '2026-05-22T00:00:00.000Z',
    ...overrides,
  };
}

describe('dual-sync publish orchestrator domain', () => {
  it('reads canonical section values and default food menu values', () => {
    const snapshot = makeSnapshot({ foodMenus: undefined });

    expect(readSectionValue(snapshot, 'profile')).toBe(snapshot.profile);
    expect(readSectionValue(snapshot, 'operatingHours')).toBe(snapshot.operatingHours);
    expect(readSectionValue(snapshot, 'businessContext.attributes')).toBe(
      snapshot.businessContext.attributes,
    );
    expect(readSectionValue(snapshot, 'foodMenus')).toEqual({ items: [] });
    expect(readSectionValue(snapshot, 'core_only')).toBeNull();
  });

  it('extracts profile fields and section-level values for a field config', () => {
    const coreSnapshot = makeSnapshot();
    const gbpSnapshot = makeSnapshot({
      profile: {
        ...makeSnapshot().profile,
        businessDescription: 'Fresh from Google',
      },
    });
    const registry = buildRegistry({ coreSnapshot, gbpSnapshot, includeCoreOnly: false });
    const profileConfig = findFieldConfig(registry, 'profile.businessDescription');
    const categoriesConfig = findFieldConfig(registry, 'businessContext.categories.restaurant');

    expect(profileConfig).toBeTruthy();
    expect(categoriesConfig).toBeTruthy();
    expect(valueForField(gbpSnapshot, profileConfig!, 'gbp')).toBe('Fresh from Google');
    expect(valueForField(coreSnapshot, categoriesConfig!, 'core')).toBe(
      coreSnapshot.businessContext.categories,
    );
  });

  it('classifies import/export actions and builds stable policy failures', () => {
    expect(isImport('import_from_google')).toBe(true);
    expect(isImport('export_to_google')).toBe(false);
    expect(isExport('export_to_google')).toBe(true);
    expect(isExport('ignore')).toBe(false);

    expect(policyFailure('No write group.')).toEqual({
      code: 'UNSUPPORTED_FIELD',
      message: 'No write group.',
      retryable: false,
    });
    expect(policyFailure('Invalid pins.', 'INVALID_DECISION')).toEqual({
      code: 'INVALID_DECISION',
      message: 'Invalid pins.',
      retryable: false,
    });
  });

  it('builds decision hashes from replay-relevant input only', () => {
    const input = {
      restaurantId: 'rest-1',
      actorUserId: 'user-1',
      clientRequestId: 'client-1',
      pinnedCoreSnapshotHash: 'core-snapshot',
      pinnedGbpSnapshotHash: null,
      decisions: [
        {
          fieldKey: 'profile.businessDescription',
          sectionKey: 'profile',
          action: 'export_to_google',
          pinnedCoreHash: 'core-field',
          pinnedGbpHash: 'gbp-field',
        },
      ],
    } as const;

    expect(buildDecisionHash(input, 'policy-hash')).toBe(
      hashCanonicalJson({
        restaurantId: 'rest-1',
        fieldPolicyHash: 'policy-hash',
        decisions: [
          {
            fieldKey: 'profile.businessDescription',
            sectionKey: 'profile',
            action: 'export_to_google',
            pinnedCoreHash: 'core-field',
            pinnedGbpHash: 'gbp-field',
          },
        ],
        pinnedCoreSnapshotHash: 'core-snapshot',
        pinnedGbpSnapshotHash: null,
      }),
    );
  });

  it('builds operation group keys from decision direction and write group', () => {
    const coreSnapshot = makeSnapshot();
    const gbpSnapshot = makeSnapshot();
    const registry = buildRegistry({ coreSnapshot, gbpSnapshot, includeCoreOnly: false });
    const config = findFieldConfig(registry, 'profile.businessDescription');

    expect(config).toBeTruthy();
    expect(
      groupKeyForDecision({
        decision: {
          fieldKey: 'profile.businessDescription',
          sectionKey: 'profile',
          action: 'import_from_google',
          pinnedCoreHash: 'core-field',
          pinnedGbpHash: 'gbp-field',
        },
        config: config!,
      }),
    ).toBe('import_from_google:profile:core.profile');
    expect(
      groupKeyForDecision({
        decision: {
          fieldKey: 'profile.businessDescription',
          sectionKey: 'profile',
          action: 'ignore',
          pinnedCoreHash: 'core-field',
          pinnedGbpHash: 'gbp-field',
        },
        config: config!,
      }),
    ).toBeNull();
  });

  it('summarizes operation group and batch statuses', () => {
    const succeeded = makeOperation({ id: 'op-success', status: 'succeeded' });
    const failed = makeOperation({
      id: 'op-failed',
      fieldKey: 'profile.name',
      status: 'failed',
      errorCode: 'GOOGLE_ERROR',
    });
    const skipped = makeOperation({ id: 'op-skipped', status: 'skipped' });
    const running = makeOperation({ id: 'op-running', status: 'running' });

    expect(operationGroupStatusForOperations([])).toBe('skipped');
    expect(operationGroupStatusForOperations([succeeded, failed])).toBe('failed');
    expect(operationGroupStatusForOperations([running])).toBe('running');
    expect(operationGroupStatusForOperations([skipped])).toBe('skipped');
    expect(operationGroupStatusForOperations([succeeded])).toBe('succeeded');

    expect(batchStatusForSummary({ operations: [], failures: [] })).toBe('skipped');
    expect(
      batchStatusForSummary({
        operations: [succeeded],
        failures: [{ failure: { code: 'GOOGLE_ERROR', message: 'Failed.', retryable: true } }],
      }),
    ).toBe('failed');
    expect(batchStatusForSummary({ operations: [running], failures: [] })).toBe('running');
    expect(batchStatusForSummary({ operations: [succeeded], failures: [] })).toBe('succeeded');
  });

  it('builds operation group execution summaries', () => {
    const operations = [
      makeOperation({ id: 'op-1', fieldKey: 'profile.name', status: 'succeeded' }),
      makeOperation({
        id: 'op-2',
        fieldKey: 'profile.businessDescription',
        status: 'failed',
        errorCode: 'GOOGLE_ERROR',
      }),
      makeOperation({
        id: 'op-3',
        fieldKey: 'profile.contactPhone',
        status: 'running',
        errorCode: 'GOOGLE_ERROR',
      }),
    ];

    expect(operationGroupExecutionSummary(operations)).toEqual({
      operationIds: ['op-1', 'op-2', 'op-3'],
      fieldKeys: ['profile.name', 'profile.businessDescription', 'profile.contactPhone'],
      counts: {
        total: 3,
        succeeded: 1,
        failed: 1,
        skipped: 0,
        other: 1,
      },
      errorCodes: ['GOOGLE_ERROR'],
    });
  });

  it('builds publish summaries from operations and failures', () => {
    const operations = [
      makeOperation({ id: 'op-1', status: 'succeeded' }),
      makeOperation({ id: 'op-2', status: 'failed' }),
      makeOperation({ id: 'op-3', status: 'skipped' }),
    ];

    expect(
      buildSummary({
        publishJobId: 'job-1',
        restaurantId: 'rest-1',
        decisions: [
          {
            fieldKey: 'profile.businessDescription',
            sectionKey: 'profile',
            action: 'export_to_google',
            pinnedCoreHash: 'core',
            pinnedGbpHash: 'gbp',
          },
        ],
        operations,
        failures: [
          {
            fieldKey: 'profile.name',
            failure: { code: 'GOOGLE_ERROR', message: 'Failed.', retryable: true },
          },
        ],
      }),
    ).toMatchObject({
      publishJobId: 'job-1',
      restaurantId: 'rest-1',
      totalDecisions: 1,
      succeededCount: 1,
      failedCount: 1,
      skippedCount: 1,
      operations,
      failures: [
        {
          fieldKey: 'profile.name',
          failure: { code: 'GOOGLE_ERROR', message: 'Failed.', retryable: true },
        },
      ],
    });
  });
});
