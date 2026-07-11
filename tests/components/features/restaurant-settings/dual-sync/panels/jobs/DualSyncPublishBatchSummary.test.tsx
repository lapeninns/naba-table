import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DualSyncPublishBatchSummary } from '@/components/features/restaurant-settings/dual-sync/panels/jobs/DualSyncPublishBatchSummary';

import type { DualSyncPublishBatch } from '@/server/dual-sync';

const batch = {
  id: 'batch-1',
  restaurantId: 'restaurant-1',
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
  acceptedCount: 3,
  rejectedCount: 1,
  ignoredCount: 2,
  planSummary: { groups: 1 },
  errorCode: null,
  errorMessage: null,
  startedAt: '2026-05-09T12:00:00.000Z',
  finishedAt: '2026-05-09T12:00:01.000Z',
  createdAt: '2026-05-09T12:00:00.000Z',
  updatedAt: '2026-05-09T12:00:01.000Z',
} as unknown as DualSyncPublishBatch;

describe('DualSyncPublishBatchSummary', () => {
  it('@smoke summarises the batch id, status, and decision counts', () => {
    render(<DualSyncPublishBatchSummary batch={batch} />);

    expect(screen.getByText('Publish batch')).toBeInTheDocument();
    expect(screen.getByText('succeeded')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('accepted')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});
