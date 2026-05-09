import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DualSyncOperationalHealthPanel } from '@/components/features/restaurant-settings/dual-sync/DualSyncOperationalHealthPanel';

import type { DualSyncOperationalMetrics } from '@/server/dual-sync/observability';
import type { GetDualSyncMetricsResponse } from '@/services/ops/dual-sync';
import type { UseQueryResult } from '@tanstack/react-query';

const restaurantId = 'restaurant-1';

function makeMetrics(
  overrides: Partial<DualSyncOperationalMetrics> = {},
): DualSyncOperationalMetrics {
  return {
    restaurantId,
    windowStart: '2026-05-09T00:00:00.000Z',
    windowEnd: '2026-05-10T00:00:00.000Z',
    jobCounts: {
      queued: 12,
      dead_letter: 1,
    },
    operationCounts: {
      succeeded: 4,
      failed: 2,
    },
    failureCounts: {
      QUOTA_LIMITED: 3,
      REAUTH_REQUIRED: 1,
    },
    queueBacklog: 12,
    deadLetterJobs: 1,
    partialPublishFailures: 1,
    alerts: [
      {
        code: 'DEAD_LETTER_JOBS',
        severity: 'critical',
        message: 'Dual-sync has dead-letter jobs requiring operator recovery.',
        count: 1,
      },
      {
        code: 'QUOTA_LIMITED',
        severity: 'warning',
        message: 'Google edit quota failures are above the warning threshold.',
        count: 3,
      },
    ],
    ...overrides,
  };
}

function metricsQuery(
  data: GetDualSyncMetricsResponse,
): UseQueryResult<GetDualSyncMetricsResponse, Error> {
  return {
    data,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  } as unknown as UseQueryResult<GetDualSyncMetricsResponse, Error>;
}

describe('DualSyncOperationalHealthPanel', () => {
  it('renders operational alerts and failure code counts', () => {
    render(<DualSyncOperationalHealthPanel metricsQuery={metricsQuery(makeMetrics())} />);

    expect(screen.getByText('Queue backlog')).toBeInTheDocument();
    expect(screen.getByText('Dead letter jobs')).toBeInTheDocument();
    expect(screen.getByText('Google quota')).toBeInTheDocument();
    expect(screen.getByText('REAUTH_REQUIRED: 1')).toBeInTheDocument();
    expect(screen.getByText('QUOTA_LIMITED: 3')).toBeInTheDocument();
  });

  it('renders a clear state when no alerts or failures are present', () => {
    render(
      <DualSyncOperationalHealthPanel
        metricsQuery={metricsQuery(
          makeMetrics({
            jobCounts: {},
            operationCounts: {},
            failureCounts: {},
            queueBacklog: 0,
            deadLetterJobs: 0,
            partialPublishFailures: 0,
            alerts: [],
          }),
        )}
      />,
    );

    expect(screen.getByText('No operational alerts')).toBeInTheDocument();
    expect(screen.getByText('No failure codes in this window.')).toBeInTheDocument();
  });
});
