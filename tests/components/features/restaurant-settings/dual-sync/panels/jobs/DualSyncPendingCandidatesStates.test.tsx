import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  DualSyncPendingCandidatesEmptyState,
  DualSyncPendingCandidatesErrorState,
  DualSyncPendingCandidatesLoadingState,
} from '@/components/features/restaurant-settings/dual-sync/panels/jobs/DualSyncPendingCandidatesStates';

describe('DualSyncPendingCandidatesStates', () => {
  it('@smoke renders loading skeletons', () => {
    const { container } = render(<DualSyncPendingCandidatesLoadingState />);

    expect(container.firstElementChild?.children.length).toBeGreaterThan(1);
  });

  it('@contract renders the error state with a working retry', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(
      <DualSyncPendingCandidatesErrorState message="Candidates fetch failed" onRetry={onRetry} />,
    );

    expect(screen.getByText("Couldn't load pending changes.")).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('@smoke renders the empty copy', () => {
    render(<DualSyncPendingCandidatesEmptyState />);

    expect(
      screen.getByText('No pending Core changes are waiting for Google export.'),
    ).toBeInTheDocument();
  });
});
