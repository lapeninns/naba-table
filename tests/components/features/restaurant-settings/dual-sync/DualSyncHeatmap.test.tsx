import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DualSyncHeatmap } from '@/components/features/restaurant-settings/dual-sync/DualSyncHeatmap';

const activeCounts = {
  total: 4,
  in_sync: 2,
  drift: 1,
  conflict: 1,
  pending: 0,
  failed: 0,
  inactive: 0,
  hasActionableState: true,
};

describe('DualSyncHeatmap', () => {
  it('@contract renders the bar with labels for active counts', () => {
    render(<DualSyncHeatmap counts={activeCounts} />);

    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('@contract hides the legend when labels are disabled', () => {
    const { container } = render(<DualSyncHeatmap counts={activeCounts} showLabels={false} />);

    expect(screen.getByRole('img')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/sync/i);
  });

  it('@contract falls back to an empty badge when there are no fields', () => {
    render(
      <DualSyncHeatmap
        counts={{
          total: 0,
          in_sync: 0,
          drift: 0,
          conflict: 0,
          pending: 0,
          failed: 0,
          inactive: 0,
          hasActionableState: false,
        }}
      />,
    );

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
