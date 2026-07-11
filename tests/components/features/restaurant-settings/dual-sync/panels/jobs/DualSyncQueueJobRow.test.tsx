import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Table, TableBody } from '@/components/ui/table';
import { DualSyncQueueJobRow } from '@/components/features/restaurant-settings/dual-sync/panels/jobs/DualSyncQueueJobRow';

import { makeDualSyncJob } from '../../../testUtils';

import type { DualSyncJob } from '@/server/dual-sync';

function renderRow(jobOver: Record<string, unknown> = {}, retryDisabled = false) {
  const job = makeDualSyncJob(jobOver) as unknown as DualSyncJob;
  const onRetry = vi.fn();
  render(
    <Table>
      <TableBody>
        <DualSyncQueueJobRow
          job={job}
          retryDisabled={retryDisabled}
          retrying={false}
          onRetry={onRetry}
        />
      </TableBody>
    </Table>,
  );
  return { job, onRetry };
}

describe('DualSyncQueueJobRow', () => {
  it('@smoke renders job kind, attempts, and error details for a dead-letter job', () => {
    renderRow();

    expect(screen.getByText('3 / 3')).toBeInTheDocument();
    expect(screen.getByText('QUOTA_LIMITED')).toBeInTheDocument();
    expect(screen.getByText(/Google edit budget exhausted/)).toBeInTheDocument();
  });

  it('@contract retries a dead-letter job through the row action', async () => {
    const user = userEvent.setup();
    const { job, onRetry } = renderRow();

    await user.click(screen.getByRole('button', { name: /Retry/ }));

    expect(onRetry).toHaveBeenCalledWith(job);
  });

  it('@contract offers no retry for jobs that are not retryable', () => {
    renderRow({ status: 'succeeded', lastErrorCode: null, lastErrorMessage: null });

    expect(screen.queryByRole('button', { name: /Retry/ })).not.toBeInTheDocument();
  });
});
