import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DualSyncPublishResultDialog } from '@/components/features/restaurant-settings/dual-sync/DualSyncPublishResultDialog';

import type { DualSyncPublishResponse } from '@/services/ops/dual-sync';

function makeResult(over: Partial<DualSyncPublishResponse> = {}): DualSyncPublishResponse {
  return {
    publishJobId: 'publish-job-1',
    restaurantId: 'restaurant-1',
    totalDecisions: 2,
    succeededCount: 1,
    failedCount: 1,
    skippedCount: 0,
    operations: [
      {
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
        finishedAt: '2026-05-09T12:00:01.000Z',
        createdAt: '2026-05-09T12:00:00.000Z',
        updatedAt: '2026-05-09T12:00:01.000Z',
      },
      {
        id: 'operation-2',
        restaurantId: 'restaurant-1',
        publishJobId: 'publish-job-1',
        publishBatchId: 'batch-1',
        operationGroupId: 'group-1',
        sectionKey: 'profile',
        fieldKey: 'profile.website',
        direction: 'export_to_google',
        status: 'failed',
        attemptCount: 1,
        beforeCoreHash: 'before-core-2',
        beforeGbpHash: 'before-gbp-2',
        afterCoreHash: null,
        afterGbpHash: null,
        googleUpdateMask: 'profile',
        errorCode: 'GOOGLE_VALIDATION_FAILED',
        errorMessage: 'Google rejected the website URL.',
        externalResponse: null,
        startedAt: '2026-05-09T12:00:00.000Z',
        finishedAt: '2026-05-09T12:00:01.000Z',
        createdAt: '2026-05-09T12:00:00.000Z',
        updatedAt: '2026-05-09T12:00:01.000Z',
      },
    ],
    failures: [
      {
        fieldKey: 'profile.website',
        failure: {
          code: 'GOOGLE_VALIDATION_FAILED',
          message: 'Google rejected the website URL.',
          retryable: false,
        },
      },
    ],
    ...over,
  };
}

describe('DualSyncPublishResultDialog', () => {
  it('renders publish counts, failure codes, and operation rows', () => {
    render(<DualSyncPublishResultDialog open result={makeResult()} onOpenChange={vi.fn()} />);

    expect(screen.getByText('Publish completed with failures')).toBeInTheDocument();
    expect(screen.getByText('1 succeeded')).toBeInTheDocument();
    expect(screen.getByText('1 failed')).toBeInTheDocument();
    expect(screen.getAllByText('GOOGLE_VALIDATION_FAILED').length).toBeGreaterThan(0);
    expect(screen.getByText('profile.phone')).toBeInTheDocument();
    expect(screen.getByText('phoneNumbers')).toBeInTheDocument();
  });
});
