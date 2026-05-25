import { describe, expect, it } from 'vitest';

import {
  buildDualSyncPendingCandidatesPanelModel,
  buildDualSyncPendingCandidateRowModel,
  buildDualSyncPendingCandidateRowModels,
  formatDualSyncCandidateHash,
  formatDualSyncCandidateTimestamp,
  getCancellingDualSyncCandidateId,
  getDualSyncPendingCandidateCancelErrorToastIntent,
  getDualSyncPendingCandidateCancelSuccessToastIntent,
} from '@/components/features/restaurant-settings/dual-sync/panels/jobs/dualSyncPendingCandidatesDomain';

import type { DualSyncOutboundCandidate } from '@/server/dual-sync';

function makeCandidate(
  overrides: Partial<DualSyncOutboundCandidate> = {},
): DualSyncOutboundCandidate {
  return {
    id: 'candidate-1',
    restaurantId: 'restaurant-1',
    provider: 'google_business_profile',
    sectionKey: 'profile',
    fieldKey: 'profile.name',
    proposedValue: 'New name',
    proposedValueHash: 'hash-new',
    baselineGbpHash: '1234567890abcdef',
    status: 'open',
    source: 'core_write',
    createdByUserId: 'user-1',
    resolvedAt: null,
    createdAt: '2026-05-09T12:00:00.000Z',
    updatedAt: '2026-05-09T12:10:00.000Z',
    ...overrides,
  };
}

describe('dualSyncPendingCandidatesDomain', () => {
  it('formats candidate hashes for compact table display', () => {
    expect(formatDualSyncCandidateHash(null)).toBe('-');
    expect(formatDualSyncCandidateHash('short-hash')).toBe('short-hash');
    expect(formatDualSyncCandidateHash('1234567890abcdef')).toBe('1234567890ab');
  });

  it('formats timestamps while preserving invalid source values for diagnostics', () => {
    expect(formatDualSyncCandidateTimestamp(null)).toBe('-');
    expect(formatDualSyncCandidateTimestamp('not-a-date')).toBe('not-a-date');
    expect(formatDualSyncCandidateTimestamp('2026-05-09T12:10:00.000Z')).not.toBe(
      '2026-05-09T12:10:00.000Z',
    );
  });

  it('builds row display state and cancel eligibility for open candidates', () => {
    expect(buildDualSyncPendingCandidateRowModel(makeCandidate(), 'candidate-1')).toMatchObject({
      id: 'candidate-1',
      fieldKey: 'profile.name',
      sectionKey: 'profile',
      source: 'core_write',
      statusLabel: 'Open',
      statusVariant: 'status-pending',
      baselineHashLabel: '1234567890ab',
      canCancel: true,
      isCancelling: true,
    });
  });

  it('marks non-open candidates as non-cancellable', () => {
    expect(
      buildDualSyncPendingCandidateRowModel(
        makeCandidate({ status: 'resolved', id: 'candidate-2' }),
        'candidate-1',
      ),
    ).toMatchObject({
      statusLabel: 'Resolved',
      statusVariant: 'status-confirmed',
      canCancel: false,
      isCancelling: false,
    });
  });

  it('builds row models for each pending candidate', () => {
    expect(
      buildDualSyncPendingCandidateRowModels(
        [makeCandidate(), makeCandidate({ id: 'candidate-2', status: 'cancelled' })],
        undefined,
      ),
    ).toHaveLength(2);
  });

  it('derives the cancelling candidate id from mutation state', () => {
    expect(getCancellingDualSyncCandidateId(true, 'candidate-1')).toBe('candidate-1');
    expect(getCancellingDualSyncCandidateId(false, 'candidate-1')).toBeUndefined();
    expect(getCancellingDualSyncCandidateId(true, undefined)).toBeUndefined();
  });

  it('builds the pending candidates panel model from an optional response', () => {
    expect(buildDualSyncPendingCandidatesPanelModel(undefined, undefined)).toEqual({
      candidateRows: [],
    });
    expect(
      buildDualSyncPendingCandidatesPanelModel(
        { restaurantId: 'restaurant-1', candidates: [makeCandidate()] },
        'candidate-1',
      ).candidateRows,
    ).toEqual([buildDualSyncPendingCandidateRowModel(makeCandidate(), 'candidate-1')]);
  });

  it('builds candidate cancel action toast intents', () => {
    expect(getDualSyncPendingCandidateCancelSuccessToastIntent()).toEqual({
      kind: 'success',
      message: 'Pending change cancelled.',
    });
    expect(getDualSyncPendingCandidateCancelErrorToastIntent(new Error('Cancel broke'))).toEqual({
      kind: 'error',
      message: 'Cancel broke',
    });
    expect(getDualSyncPendingCandidateCancelErrorToastIntent('unknown')).toEqual({
      kind: 'error',
      message: 'Pending change cancellation failed.',
    });
  });
});
