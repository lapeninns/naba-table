import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DualSyncQueueJobsContent } from '@/components/features/restaurant-settings/dual-sync/panels/jobs/DualSyncQueueJobsContent';

import { makeDualSyncJob } from '../../../testUtils';

import type { DualSyncJob } from '@/server/dual-sync';

describe('DualSyncQueueJobsContent', () => {
  it('@smoke renders the queue table with a row per job', () => {
    const jobs = [
      makeDualSyncJob(),
      makeDualSyncJob({ id: 'queue-job-2', status: 'succeeded', lastErrorCode: null, lastErrorMessage: null }),
    ] as unknown as ReadonlyArray<DualSyncJob>;
    render(
      <DualSyncQueueJobsContent
        jobs={jobs}
        onRetry={vi.fn()}
        retryDisabled={false}
        retryingJobId={undefined}
      />,
    );

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('Attempts')).toBeInTheDocument();
    expect(screen.getAllByRole('row').length).toBe(3); // header + 2 jobs
  });
});
