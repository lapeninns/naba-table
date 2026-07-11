import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DualSyncShellHeaderStatus } from '@/components/features/restaurant-settings/dual-sync/DualSyncShellHeaderStatus';

const heatmap = {
  total: 3,
  in_sync: 2,
  drift: 1,
  conflict: 0,
  pending: 0,
  failed: 0,
  inactive: 0,
  hasActionableState: true,
};

describe('DualSyncShellHeaderStatus', () => {
  it('@contract shows the pending badge, freshness chip, and heatmap when data exists', () => {
    render(
      <DualSyncShellHeaderStatus
        totalOpen={4}
        lastSnapshotAt={null}
        overallHeatmap={heatmap}
        syncPaused={false}
      />,
    );

    expect(screen.getByText('Google Business Profile sync')).toBeInTheDocument();
    expect(screen.getByText('4 pending')).toBeInTheDocument();
    expect(screen.getByText('Never verified')).toBeInTheDocument();
    expect(screen.getByRole('img')).toBeInTheDocument();
    expect(screen.queryByText('Paused')).not.toBeInTheDocument();
  });

  it('@contract flags the paused state and hides zero-count chrome', () => {
    render(
      <DualSyncShellHeaderStatus
        totalOpen={0}
        lastSnapshotAt={null}
        overallHeatmap={{ ...heatmap, total: 0, in_sync: 0, drift: 0, hasActionableState: false }}
        syncPaused
      />,
    );

    expect(screen.getByText('Paused')).toBeInTheDocument();
    expect(screen.queryByText(/pending/)).not.toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
