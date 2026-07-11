import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Table, TableBody } from '@/components/ui/table';
import { DualSyncPublishJobRow } from '@/components/features/restaurant-settings/dual-sync/panels/jobs/DualSyncPublishJobRow';

import { makeDualSyncPublishJobRollup } from '../../../testUtils';

import type { DualSyncPublishJobRollup } from '@/server/dual-sync/publish/operations';

function renderRow(over: Partial<Parameters<typeof DualSyncPublishJobRow>[0]> = {}) {
  const onSelectJob = vi.fn();
  render(
    <Table>
      <TableBody>
        <DualSyncPublishJobRow
          job={makeDualSyncPublishJobRollup() as unknown as DualSyncPublishJobRollup}
          isSelected={false}
          detailEnabled
          onSelectJob={onSelectJob}
          colSpan={7}
          {...over}
        />
      </TableBody>
    </Table>,
  );
  return onSelectJob;
}

describe('DualSyncPublishJobRow', () => {
  it('@smoke renders the rollup with status and section badges', () => {
    renderRow();

    expect(screen.getByText('Success')).toBeInTheDocument();
    expect(screen.getByText(/1✓/)).toBeInTheDocument();
  });

  it('@contract selects the job when the row is clicked', async () => {
    const user = userEvent.setup();
    const onSelectJob = renderRow();

    await user.click(screen.getByText('Success'));

    expect(onSelectJob).toHaveBeenCalledWith('publish-job-1');
  });

  it('@contract deselects an already-selected job and shows its detail row', async () => {
    const user = userEvent.setup();
    const onSelectJob = renderRow({ isSelected: true });

    // Selected row renders the detail row (loader missing -> configured message).
    expect(screen.getByText('Detail loader not configured.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Hide job detail' }));
    expect(onSelectJob).toHaveBeenCalledWith(null);
  });
});
