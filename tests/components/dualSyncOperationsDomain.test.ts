import { describe, expect, it } from 'vitest';

import {
  DUAL_SYNC_OPERATION_STATUS_LABEL,
  DUAL_SYNC_OPERATION_STATUS_VARIANT,
  buildDualSyncOperationsPanelModel,
  formatOperationDuration,
  formatOperationTimestamp,
  getOperationDirectionLabel,
  getOperationDirectionIconKey,
  getOperationDurationMs,
  getOperationStatusIconKey,
} from '@/components/features/restaurant-settings/dual-sync/panels/operations/dualSyncOperationsDomain';

import type { DualSyncPublishOperation } from '@/server/dual-sync';

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
    fieldKey: 'profile.phone',
    direction: 'export_to_google',
    status: 'succeeded',
    attemptCount: 1,
    beforeCoreHash: 'before-core',
    beforeGbpHash: 'before-gbp',
    afterCoreHash: 'after-core',
    afterGbpHash: 'after-gbp',
    googleUpdateMask: 'phoneNumbers',
    errorCode: null,
    errorMessage: null,
    externalResponse: null,
    startedAt: '2026-05-09T12:00:00.000Z',
    finishedAt: '2026-05-09T12:00:01.250Z',
    createdAt: '2026-05-09T11:59:00.000Z',
    updatedAt: '2026-05-09T12:00:01.250Z',
    ...overrides,
  };
}

describe('dualSyncOperationsDomain', () => {
  it('maps operation status labels, variants, and icon keys', () => {
    expect(DUAL_SYNC_OPERATION_STATUS_LABEL.succeeded).toBe('Succeeded');
    expect(DUAL_SYNC_OPERATION_STATUS_VARIANT.failed).toBe('status-cancelled');
    expect(getOperationStatusIconKey('succeeded')).toBe('success');
    expect(getOperationStatusIconKey('failed')).toBe('failure');
    expect(getOperationStatusIconKey('skipped')).toBe('skipped');
    expect(getOperationStatusIconKey('pending')).toBe('pending');
  });

  it('formats operation timestamps with fallback behavior', () => {
    expect(formatOperationTimestamp(null)).toBe('—');
    expect(formatOperationTimestamp('not-a-date')).toBe('not-a-date');
    expect(formatOperationTimestamp('2026-05-09T12:00:00.000Z')).toContain('2026');
  });

  it('calculates and formats operation durations', () => {
    expect(getOperationDurationMs(makeOperation())).toBe(1250);
    expect(getOperationDurationMs(makeOperation({ startedAt: null }))).toBe(null);
    expect(getOperationDurationMs(makeOperation({ finishedAt: 'not-a-date' }))).toBe(null);
    expect(formatOperationDuration(null)).toBe('—');
    expect(formatOperationDuration(850)).toBe('850ms');
    expect(formatOperationDuration(1250)).toBe('1.25s');
  });

  it('labels operation direction', () => {
    expect(getOperationDirectionLabel('import_from_google')).toBe('Import');
    expect(getOperationDirectionLabel('export_to_google')).toBe('Export');
    expect(getOperationDirectionIconKey('import_from_google')).toBe('import');
    expect(getOperationDirectionIconKey('export_to_google')).toBe('export');
  });

  it('builds the operations panel model from an optional response', () => {
    expect(buildDualSyncOperationsPanelModel(undefined)).toEqual({ operations: [] });
    expect(
      buildDualSyncOperationsPanelModel({
        restaurantId: 'restaurant-1',
        operations: [makeOperation({ id: 'operation-1' })],
      }),
    ).toEqual({ operations: [makeOperation({ id: 'operation-1' })] });
  });
});
