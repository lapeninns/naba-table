import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DualSyncOperationalHealthContent } from '@/components/features/restaurant-settings/dual-sync/panels/health/DualSyncOperationalHealthContent';

import type { DualSyncOperationalMetrics } from '@/server/dual-sync/observability';

const metrics: DualSyncOperationalMetrics = {
  restaurantId: 'restaurant-1',
  windowStart: '2026-07-10T00:00:00.000Z',
  windowEnd: '2026-07-11T00:00:00.000Z',
  jobCounts: {},
  operationCounts: {},
  failureCounts: { QUOTA_LIMITED: 3 },
  queueBacklog: 2,
  deadLetterJobs: 1,
  partialPublishFailures: 0,
  alerts: [],
};

describe('DualSyncOperationalHealthContent', () => {
  it('@contract renders the metric tiles, alerts, and failure codes for the window', () => {
    render(<DualSyncOperationalHealthContent metrics={metrics} onRefresh={vi.fn()} />);

    expect(screen.getByText(/2026/)).toBeInTheDocument();
    expect(screen.getByText('No operational alerts')).toBeInTheDocument();
    expect(screen.getByText('QUOTA_LIMITED: 3')).toBeInTheDocument();
  });

  it('@contract refreshes the metrics on demand', async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn();
    render(<DualSyncOperationalHealthContent metrics={metrics} onRefresh={onRefresh} />);

    await user.click(screen.getByRole('button', { name: /Refresh/ }));

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
