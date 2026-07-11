import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  DualSyncOperationsEmptyState,
  DualSyncOperationsErrorState,
  DualSyncOperationsLoadingState,
} from '@/components/features/restaurant-settings/dual-sync/panels/operations/DualSyncOperationsStates';

describe('DualSyncOperationsStates', () => {
  it('@smoke renders loading skeletons', () => {
    const { container } = render(<DualSyncOperationsLoadingState />);

    expect(container.firstElementChild?.children.length).toBeGreaterThan(1);
  });

  it('@contract renders the error state with a working retry', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<DualSyncOperationsErrorState message="History fetch failed" onRetry={onRetry} />);

    expect(screen.getByText("Couldn't load the operation history.")).toBeInTheDocument();
    expect(screen.getByText('History fetch failed')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Retry/ }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('@smoke renders the empty history copy', () => {
    render(<DualSyncOperationsEmptyState />);

    expect(
      screen.getByText('No publish operations recorded for this restaurant yet.'),
    ).toBeInTheDocument();
  });
});
