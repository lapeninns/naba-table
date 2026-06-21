import { beforeEach, describe, expect, it, vi } from 'vitest';

const listRestaurantsMock = vi.hoisted(() => vi.fn());
const loadMetricsMock = vi.hoisted(() => vi.fn());
const recordObservabilityEventMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/dual-sync/scheduling/refresh', () => ({
  listRestaurantsWithLinkedGoogleBusinessProfile: listRestaurantsMock,
}));

vi.mock('@/server/dual-sync/observability/metrics', () => ({
  loadDualSyncOperationalMetrics: loadMetricsMock,
}));

vi.mock('@/server/observability', () => ({
  recordObservabilityEvent: recordObservabilityEventMock,
}));

import { runDualSyncOperationalHealthAlertSweep } from '@/server/dual-sync/observability/alerts';

import type { DualSyncOperationalMetrics } from '@/server/dual-sync/observability';

const client = { service: true } as never;

function makeMetrics(
  overrides: Partial<DualSyncOperationalMetrics> = {},
): DualSyncOperationalMetrics {
  return {
    restaurantId: 'rest-1',
    windowStart: '2026-05-09T00:00:00.000Z',
    windowEnd: '2026-05-10T00:00:00.000Z',
    jobCounts: {
      dead_letter: 1,
      retrying: 3,
    },
    operationCounts: {
      failed: 2,
    },
    failureCounts: {
      REAUTH_REQUIRED: 1,
      QUOTA_LIMITED: 3,
    },
    queueBacklog: 3,
    deadLetterJobs: 1,
    partialPublishFailures: 1,
    alerts: [
      {
        code: 'DEAD_LETTER_JOBS',
        severity: 'critical',
        count: 1,
        message: 'Dual-sync has dead-letter jobs requiring operator recovery.',
      },
      {
        code: 'QUOTA_LIMITED',
        severity: 'warning',
        count: 3,
        message: 'Google edit quota failures are above the warning threshold.',
      },
    ],
    ...overrides,
  };
}

describe('runDualSyncOperationalHealthAlertSweep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listRestaurantsMock.mockResolvedValue(['rest-1']);
    loadMetricsMock.mockResolvedValue(makeMetrics());
    recordObservabilityEventMock.mockResolvedValue(undefined);
  });

  it('emits one notification per restaurant with active health alerts', async () => {
    const emit = vi.fn(async () => {});

    const result = await runDualSyncOperationalHealthAlertSweep({
      client,
      notifications: { emit },
      windowMs: 6 * 60 * 60 * 1000,
      limit: 100,
    });

    expect(listRestaurantsMock).toHaveBeenCalledWith({ client, limit: undefined });
    expect(loadMetricsMock).toHaveBeenCalledWith({
      client,
      restaurantId: 'rest-1',
      now: undefined,
      windowMs: 6 * 60 * 60 * 1000,
      limit: 100,
      thresholds: undefined,
    });
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'operational_health_alert',
        severity: 'error',
        restaurantId: 'rest-1',
        errorCode: 'DEAD_LETTER_JOBS',
        counts: { failed: 1, other: 1 },
      }),
    );
    expect(recordObservabilityEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'dual-sync.operational-health',
        eventType: 'alert.emitted',
        severity: 'critical',
        restaurantId: 'rest-1',
      }),
    );
    expect(result).toMatchObject({
      restaurantsConsidered: 1,
      restaurantsProcessed: 1,
      alertsEmitted: 1,
      dryRun: false,
    });
  });

  it('supports dry-run without emitting notifications', async () => {
    const emit = vi.fn(async () => {});

    const result = await runDualSyncOperationalHealthAlertSweep({
      client,
      dryRun: true,
      notifications: { emit },
      onlyCritical: true,
    });

    expect(emit).not.toHaveBeenCalled();
    expect(recordObservabilityEventMock).not.toHaveBeenCalled();
    expect(result.summaries).toEqual([
      {
        restaurantId: 'rest-1',
        alertCount: 1,
        criticalCount: 1,
        warningCount: 0,
        alerts: [{ code: 'DEAD_LETTER_JOBS', severity: 'critical', count: 1 }],
      },
    ]);
  });

  it('continues past tenant metric failures and emits a tenant failure notification', async () => {
    listRestaurantsMock.mockResolvedValue(['rest-1', 'rest-2']);
    loadMetricsMock
      .mockRejectedValueOnce(new Error('metrics table missing'))
      .mockResolvedValueOnce(makeMetrics({ restaurantId: 'rest-2', alerts: [] }));
    const emit = vi.fn(async () => {});

    const result = await runDualSyncOperationalHealthAlertSweep({
      client,
      notifications: { emit },
    });

    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'tenant_run_failed',
        severity: 'error',
        restaurantId: 'rest-1',
        errorMessage: 'metrics table missing',
      }),
    );
    expect(result.errors).toEqual([{ restaurantId: 'rest-1', message: 'metrics table missing' }]);
    expect(result.restaurantsProcessed).toBe(1);
  });
});
