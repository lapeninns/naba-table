import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DualSyncStateBadge } from '@/components/features/restaurant-settings/dual-sync/DualSyncStateBadge';

describe('DualSyncStateBadge', () => {
  it('@contract maps field states to their guest-readable labels', () => {
    render(
      <>
        <DualSyncStateBadge state="in_sync" />
        <DualSyncStateBadge state="conflict" />
        <DualSyncStateBadge state="export_failed" />
        <DualSyncStateBadge state="unsupported" />
      </>,
    );

    expect(screen.getByText('In sync')).toBeInTheDocument();
    expect(screen.getByText('Conflict')).toBeInTheDocument();
    expect(screen.getByText('Export failed')).toBeInTheDocument();
    expect(screen.getByText('Core only')).toBeInTheDocument();
  });

  it('@contract falls back to Unknown for a missing state', () => {
    render(<DualSyncStateBadge state={null} />);

    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });
});
