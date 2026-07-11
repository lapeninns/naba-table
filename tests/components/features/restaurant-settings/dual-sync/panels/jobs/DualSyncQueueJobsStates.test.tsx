import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  DualSyncQueueJobsEmptyState,
  DualSyncQueueJobsErrorState,
  DualSyncQueueJobsLoadingState,
} from '@/components/features/restaurant-settings/dual-sync/panels/jobs/DualSyncQueueJobsStates';

describe('DualSyncQueueJobsStates', () => {
  it('@smoke renders loading skeletons', () => {
    const { container } = render(<DualSyncQueueJobsLoadingState />);

    expect(container.firstElementChild?.children.length).toBeGreaterThan(1);
  });

  it('@contract renders the error state with a working retry', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<DualSyncQueueJobsErrorState message="Jobs fetch failed" onRetry={onRetry} />);

    expect(screen.getByText("Couldn't load queue jobs.")).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Retry/ }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('@smoke renders the empty copy', () => {
    render(<DualSyncQueueJobsEmptyState />);

    expect(
      screen.getByText('No durable queue jobs recorded for this restaurant yet.'),
    ).toBeInTheDocument();
  });
});
