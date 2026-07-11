import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DualSyncPublishJobsTable } from '@/components/features/restaurant-settings/dual-sync/panels/jobs/DualSyncPublishJobsTable';

import { makeDualSyncPublishJobRollup } from '../../../testUtils';

import type { DualSyncPublishJobRollup } from '@/server/dual-sync/publish/operations';

const jobs = [
  makeDualSyncPublishJobRollup(),
  makeDualSyncPublishJobRollup({ publishJobId: 'publish-job-2', failedCount: 1 }),
] as unknown as readonly DualSyncPublishJobRollup[];

describe('DualSyncPublishJobsTable', () => {
  it('@contract renders expandable rows when selection is wired', async () => {
    const user = userEvent.setup();
    const onSelectJob = vi.fn();
    render(
      <DualSyncPublishJobsTable jobs={jobs} selectedJobId={null} onSelectJob={onSelectJob} />,
    );

    expect(screen.getAllByRole('button', { name: 'Show job detail' })).toHaveLength(2);

    await user.click(screen.getAllByRole('button', { name: 'Show job detail' })[1]);
    expect(onSelectJob).toHaveBeenCalledWith('publish-job-2');
  });

  it('@contract renders a plain table without expansion when selection is absent', () => {
    render(<DualSyncPublishJobsTable jobs={jobs} />);

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show job detail' })).not.toBeInTheDocument();
  });
});
