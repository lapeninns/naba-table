import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  DualSyncPublishJobDetailEmptyState,
  DualSyncPublishJobDetailErrorState,
  DualSyncPublishJobDetailLoadingState,
  DualSyncPublishJobDetailMissingState,
  DualSyncPublishJobDetailStaleState,
} from '@/components/features/restaurant-settings/dual-sync/panels/jobs/DualSyncPublishJobDetailStates';

describe('DualSyncPublishJobDetailStates', () => {
  it('@smoke covers missing, loading, stale, and empty detail states', () => {
    render(
      <>
        <DualSyncPublishJobDetailMissingState />
        <DualSyncPublishJobDetailStaleState />
        <DualSyncPublishJobDetailEmptyState />
      </>,
    );

    expect(screen.getByText('Detail loader not configured.')).toBeInTheDocument();
    expect(screen.getByText('Loading detail…')).toBeInTheDocument();
    expect(screen.getByText('No operations recorded for this job.')).toBeInTheDocument();

    const { container } = render(<DualSyncPublishJobDetailLoadingState />);
    expect(container.firstElementChild?.children.length).toBeGreaterThan(1);
  });

  it('@contract renders the error state with a working retry', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<DualSyncPublishJobDetailErrorState message="Detail fetch failed" onRetry={onRetry} />);

    expect(screen.getByText("Couldn't load job detail.")).toBeInTheDocument();
    expect(screen.getByText('Detail fetch failed')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
