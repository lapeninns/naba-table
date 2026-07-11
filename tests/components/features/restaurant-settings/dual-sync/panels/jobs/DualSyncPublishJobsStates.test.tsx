import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  DualSyncPublishJobsEmptyState,
  DualSyncPublishJobsErrorState,
  DualSyncPublishJobsLoadingState,
} from '@/components/features/restaurant-settings/dual-sync/panels/jobs/DualSyncPublishJobsStates';

describe('DualSyncPublishJobsStates', () => {
  it('@smoke renders loading skeletons', () => {
    const { container } = render(<DualSyncPublishJobsLoadingState />);

    expect(container.firstElementChild?.children.length).toBeGreaterThan(1);
  });

  it('@contract renders the error state with a working retry', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<DualSyncPublishJobsErrorState message="Publish jobs fetch failed" onRetry={onRetry} />);

    expect(screen.getByText("Couldn't load publish jobs.")).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Retry/ }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('@smoke renders the empty copy', () => {
    render(<DualSyncPublishJobsEmptyState />);

    expect(
      screen.getByText('No publish jobs recorded for this restaurant yet.'),
    ).toBeInTheDocument();
  });
});
