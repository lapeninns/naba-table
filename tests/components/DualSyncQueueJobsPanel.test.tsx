import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DualSyncQueueJobsPanel } from '@/components/features/restaurant-settings/dual-sync/DualSyncQueueJobsPanel';

import type { DualSyncJob } from '@/server/dual-sync';
import type { ListDualSyncJobsResponse } from '@/services/ops/dual-sync';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';

const restaurantId = 'restaurant-1';

function makeJob(over: Partial<DualSyncJob> = {}): DualSyncJob {
  return {
    id: 'queue-job-1',
    restaurantId,
    provider: 'google_business_profile',
    jobKind: 'publish_batch',
    status: 'dead_letter',
    idempotencyKey: 'request-1',
    priority: 100,
    payload: {},
    attemptCount: 3,
    maxAttempts: 3,
    availableAt: '2026-05-09T12:00:00.000Z',
    lockedAt: null,
    lockedBy: null,
    lastErrorCode: 'QUOTA_LIMITED',
    lastErrorMessage: 'Google edit budget exhausted.',
    deadLetterReason: 'Google edit budget exhausted.',
    startedAt: '2026-05-09T11:59:00.000Z',
    finishedAt: '2026-05-09T12:00:00.000Z',
    createdAt: '2026-05-09T11:58:00.000Z',
    updatedAt: '2026-05-09T12:00:00.000Z',
    ...over,
  };
}

function jobsQuery(
  data: ListDualSyncJobsResponse,
): UseQueryResult<ListDualSyncJobsResponse, Error> {
  return {
    data,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  } as unknown as UseQueryResult<ListDualSyncJobsResponse, Error>;
}

function retryMutation(
  mutateAsync = vi.fn().mockResolvedValue(makeJob({ status: 'queued' })),
): UseMutationResult<DualSyncJob, Error, string> {
  return {
    mutateAsync,
    isPending: false,
  } as unknown as UseMutationResult<DualSyncJob, Error, string>;
}

describe('DualSyncQueueJobsPanel', () => {
  it('renders queue job failure state and retry action', () => {
    render(
      <DualSyncQueueJobsPanel
        jobsQuery={jobsQuery({ restaurantId, jobs: [makeJob()] })}
        retryJobMutation={retryMutation()}
      />,
    );

    expect(screen.getByText('Dead letter')).toBeInTheDocument();
    expect(screen.getByText('Publish batch')).toBeInTheDocument();
    expect(screen.getByText('QUOTA_LIMITED')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeEnabled();
  });

  it('requeues retryable jobs through the mutation', async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockResolvedValue(makeJob({ status: 'queued' }));

    render(
      <DualSyncQueueJobsPanel
        jobsQuery={jobsQuery({ restaurantId, jobs: [makeJob()] })}
        retryJobMutation={retryMutation(mutateAsync)}
      />,
    );

    await user.click(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith('queue-job-1');
    });
  });
});
