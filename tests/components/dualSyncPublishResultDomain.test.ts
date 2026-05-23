import { describe, expect, it } from 'vitest';

import {
  buildDualSyncPublishOperationTableRows,
  formatPublishResultTimestamp,
  getPublishResultStatusVariant,
  getPublishResultTitle,
} from '@/components/features/restaurant-settings/dual-sync/dualSyncPublishResultDomain';

import type { DualSyncPublishResponse } from '@/services/ops/dual-sync';

function makeResult(overrides: Partial<DualSyncPublishResponse> = {}): DualSyncPublishResponse {
  return {
    publishJobId: 'publish-job-1',
    restaurantId: 'restaurant-1',
    totalDecisions: 1,
    succeededCount: 1,
    failedCount: 0,
    skippedCount: 0,
    operations: [],
    failures: [],
    ...overrides,
  };
}

describe('dualSyncPublishResultDomain', () => {
  it('selects result titles from outcome counts', () => {
    expect(getPublishResultTitle(null)).toBe('Publish result');
    expect(getPublishResultTitle(makeResult({ failedCount: 1 }))).toBe(
      'Publish completed with failures',
    );
    expect(getPublishResultTitle(makeResult({ succeededCount: 1, failedCount: 0 }))).toBe(
      'Publish completed',
    );
    expect(getPublishResultTitle(makeResult({ succeededCount: 0, failedCount: 0 }))).toBe(
      'No fields were published',
    );
  });

  it('formats timestamps with fallback behavior', () => {
    expect(formatPublishResultTimestamp(null)).toBe('-');
    expect(formatPublishResultTimestamp(undefined)).toBe('-');
    expect(formatPublishResultTimestamp('not-a-date')).toBe('not-a-date');
    expect(formatPublishResultTimestamp('2026-05-09T12:00:01.000Z')).toContain('2026');
  });

  it('maps operation statuses to badge variants', () => {
    expect(getPublishResultStatusVariant('succeeded')).toBe('status-confirmed');
    expect(getPublishResultStatusVariant('failed')).toBe('status-cancelled');
    expect(getPublishResultStatusVariant('running')).toBe('status-pending');
    expect(getPublishResultStatusVariant('unknown')).toBe('status-pending');
  });

  it('builds publish operation table rows with display fallbacks', () => {
    expect(
      buildDualSyncPublishOperationTableRows([
        {
          id: 'operation-1',
          status: 'failed',
          fieldKey: 'profile.phone',
          direction: 'export_to_google',
          googleUpdateMask: 'phoneNumbers',
          errorCode: 'GOOGLE_REJECTED',
          finishedAt: '2026-05-09T12:00:01.000Z',
        },
        {
          id: 'operation-2',
          status: 'succeeded',
          fieldKey: 'profile.website',
          direction: 'import_from_google',
          googleUpdateMask: null,
          errorCode: null,
          finishedAt: null,
        },
      ]),
    ).toEqual([
      {
        id: 'operation-1',
        status: 'failed',
        statusVariant: 'status-cancelled',
        fieldKey: 'profile.phone',
        errorCode: 'GOOGLE_REJECTED',
        direction: 'export_to_google',
        maskLabel: 'phoneNumbers',
        finishedAtLabel: expect.stringContaining('2026'),
      },
      {
        id: 'operation-2',
        status: 'succeeded',
        statusVariant: 'status-confirmed',
        fieldKey: 'profile.website',
        errorCode: null,
        direction: 'import_from_google',
        maskLabel: '-',
        finishedAtLabel: '-',
      },
    ]);
  });
});
