import { describe, expect, it } from 'vitest';

import {
  getDualSyncAutoExportToastIntent,
  getDualSyncBlockedActionToastIntent,
  getDualSyncControlToastIntent,
  getDualSyncErrorToastIntent,
  getDualSyncErrorMessage,
  getDualSyncPausedToastIntent,
  getDualSyncPublishPreviewEmptyToastIntent,
  getDualSyncPublishResultToastIntent,
  getDualSyncRefreshSuccessToastIntent,
} from '@/components/features/restaurant-settings/dual-sync/dualSyncShellActionDomain';

import type { DualSyncPublishResponse, RunAutoExportResponse } from '@/services/ops/dual-sync';

function autoExportResponse(overrides: Partial<RunAutoExportResponse> = {}): RunAutoExportResponse {
  return {
    restaurantId: 'restaurant-1',
    candidatesConsidered: 0,
    decisionsExecuted: 0,
    publishResult: null,
    skipped: [],
    ...overrides,
  };
}

function publishResponse(
  overrides: Partial<DualSyncPublishResponse> = {},
): DualSyncPublishResponse {
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

describe('dualSyncShellActionDomain', () => {
  it('builds auto-export toast intents for failed, succeeded, skipped, and empty runs', () => {
    expect(
      getDualSyncAutoExportToastIntent(
        autoExportResponse({
          publishResult: {
            summary: publishResponse({ succeededCount: 2, failedCount: 1 }),
          },
        }),
      ),
    ).toEqual({
      kind: 'error',
      message: '2 queued exports synced, 1 failed. See per-field errors.',
    });

    expect(
      getDualSyncAutoExportToastIntent(
        autoExportResponse({
          publishResult: {
            summary: publishResponse({ succeededCount: 2 }),
          },
        }),
      ),
    ).toEqual({ kind: 'success', message: '2 queued exports synced to Google.' });

    expect(
      getDualSyncAutoExportToastIntent(
        autoExportResponse({
          skipped: [
            { candidateId: 'candidate-1', fieldKey: 'profile.phone', reason: 'no_baseline' },
          ],
        }),
      ),
    ).toEqual({
      kind: 'warning',
      message: 'Skipped 1 candidates without a baseline. Refresh first.',
    });

    expect(getDualSyncAutoExportToastIntent(autoExportResponse())).toEqual({
      kind: 'info',
      message: 'No queued exports were ready to run.',
    });
  });

  it('builds publish result and control toast intents', () => {
    expect(getDualSyncPublishResultToastIntent(publishResponse())).toEqual({
      kind: 'success',
      message: '1 fields synced.',
    });
    expect(
      getDualSyncPublishResultToastIntent(publishResponse({ succeededCount: 1, failedCount: 2 })),
    ).toEqual({
      kind: 'error',
      message: '1 fields synced, 2 failed. See per-field errors below.',
    });

    expect(getDualSyncControlToastIntent(true)).toEqual({
      kind: 'success',
      message: 'Dual-sync is paused for this restaurant.',
    });
    expect(getDualSyncControlToastIntent(false)).toEqual({
      kind: 'success',
      message: 'Dual-sync is active for this restaurant.',
    });
  });

  it('normalizes unknown errors to the supplied fallback', () => {
    expect(getDualSyncErrorMessage(new Error('Specific failure'), 'Fallback')).toBe(
      'Specific failure',
    );
    expect(getDualSyncErrorMessage('unknown', 'Fallback')).toBe('Fallback');
  });

  it('builds refresh, paused, and error toast intents', () => {
    expect(getDualSyncRefreshSuccessToastIntent()).toEqual({
      kind: 'success',
      message: 'Pulled the latest Google profile.',
    });
    expect(getDualSyncPausedToastIntent('Paused for QA.')).toEqual({
      kind: 'error',
      message: 'Paused for QA.',
    });
    expect(getDualSyncErrorToastIntent(new Error('Specific failure'), 'Fallback')).toEqual({
      kind: 'error',
      message: 'Specific failure',
    });
    expect(getDualSyncErrorToastIntent('unknown', 'Fallback')).toEqual({
      kind: 'error',
      message: 'Fallback',
    });
  });

  it('builds blocked-action and empty-preview publish intents', () => {
    expect(getDualSyncBlockedActionToastIntent(null)).toBeNull();
    expect(getDualSyncBlockedActionToastIntent('Blocked.')).toEqual({
      kind: 'error',
      message: 'Blocked.',
    });
    expect(getDualSyncPublishPreviewEmptyToastIntent()).toEqual({
      kind: 'warning',
      message: 'No selected fields are eligible to publish.',
    });
  });
});
