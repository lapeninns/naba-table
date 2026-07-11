import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DualSyncHealthMetricTile } from '@/components/features/restaurant-settings/dual-sync/panels/health/DualSyncHealthMetricTile';

import type { DualSyncHealthMetricTileDescriptor } from '@/components/features/restaurant-settings/dual-sync/panels/health/dualSyncOperationalHealthDomain';

function makeMetric(
  over: Partial<DualSyncHealthMetricTileDescriptor> = {},
): DualSyncHealthMetricTileDescriptor {
  return {
    key: 'queueBacklog',
    label: 'Queue backlog',
    description: 'Jobs waiting to run',
    value: 2,
    tone: 'ok',
    ...over,
  } as DualSyncHealthMetricTileDescriptor;
}

describe('DualSyncHealthMetricTile', () => {
  it('@smoke renders the metric label, description, and value', () => {
    render(<DualSyncHealthMetricTile metric={makeMetric()} />);

    expect(screen.getByText('Queue backlog')).toBeInTheDocument();
    expect(screen.getByText('Jobs waiting to run')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('@contract renders critical metrics without changing the copy', () => {
    render(<DualSyncHealthMetricTile metric={makeMetric({ tone: 'critical', value: 9 })} />);

    expect(screen.getByText('9')).toBeInTheDocument();
  });
});
