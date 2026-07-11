import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DualSyncQueueJobStatusBadge } from '@/components/features/restaurant-settings/dual-sync/panels/jobs/DualSyncQueueJobStatusBadge';
import { DUAL_SYNC_QUEUE_JOB_STATUS_LABEL } from '@/components/features/restaurant-settings/dual-sync/panels/jobs/dualSyncQueueJobsDomain';

describe('DualSyncQueueJobStatusBadge', () => {
  it('@contract maps queue job statuses to their labels', () => {
    render(
      <>
        <DualSyncQueueJobStatusBadge status="queued" />
        <DualSyncQueueJobStatusBadge status="dead_letter" />
        <DualSyncQueueJobStatusBadge status="succeeded" />
      </>,
    );

    expect(screen.getByText(DUAL_SYNC_QUEUE_JOB_STATUS_LABEL.queued)).toBeInTheDocument();
    expect(screen.getByText(DUAL_SYNC_QUEUE_JOB_STATUS_LABEL.dead_letter)).toBeInTheDocument();
    expect(screen.getByText(DUAL_SYNC_QUEUE_JOB_STATUS_LABEL.succeeded)).toBeInTheDocument();
  });
});
