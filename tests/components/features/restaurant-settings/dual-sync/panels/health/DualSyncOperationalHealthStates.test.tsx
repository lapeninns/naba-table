import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  DualSyncOperationalHealthEmptyState,
  DualSyncOperationalHealthErrorState,
  DualSyncOperationalHealthLoadingState,
} from '@/components/features/restaurant-settings/dual-sync/panels/health/DualSyncOperationalHealthStates';

describe('DualSyncOperationalHealthStates', () => {
  it('@smoke renders skeleton tiles while loading', () => {
    const { container } = render(<DualSyncOperationalHealthLoadingState />);

    expect(container.querySelectorAll('[data-slot="skeleton"], .animate-pulse').length).toBeGreaterThan(0);
  });

  it('@contract renders the error state with a working retry', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(
      <DualSyncOperationalHealthErrorState message="Metrics fetch failed" onRetry={onRetry} />,
    );

    expect(screen.getByText("Couldn't load operational health.")).toBeInTheDocument();
    expect(screen.getByText('Metrics fetch failed')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Retry/ }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('@smoke renders the empty state copy', () => {
    render(<DualSyncOperationalHealthEmptyState />);

    expect(
      screen.getByText('No operational metrics loaded for this restaurant yet.'),
    ).toBeInTheDocument();
  });
});
