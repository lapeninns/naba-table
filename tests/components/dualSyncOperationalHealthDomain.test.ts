import { describe, expect, it } from 'vitest';

import {
  DUAL_SYNC_OPERATIONAL_ALERT_LABEL,
  buildOperationalHealthPanelModel,
  buildOperationalHealthMetricTiles,
  formatOperationalHealthTimestamp,
  getOperationalAlertBadgeVariant,
  getSortedFailureCounts,
} from '@/components/features/restaurant-settings/dual-sync/panels/health/dualSyncOperationalHealthDomain';

import type {
  DualSyncOperationalAlert,
  DualSyncOperationalMetrics,
} from '@/server/dual-sync/observability';

function makeMetrics(
  overrides: Partial<DualSyncOperationalMetrics> = {},
): DualSyncOperationalMetrics {
  return {
    restaurantId: 'restaurant-1',
    windowStart: '2026-05-09T00:00:00.000Z',
    windowEnd: '2026-05-10T00:00:00.000Z',
    jobCounts: {},
    operationCounts: {},
    failureCounts: {
      QUOTA_LIMITED: 3,
      REAUTH_REQUIRED: 1,
    },
    queueBacklog: 2,
    deadLetterJobs: 1,
    partialPublishFailures: 0,
    alerts: [],
    ...overrides,
  };
}

describe('dualSyncOperationalHealthDomain', () => {
  it('formats timestamps while preserving invalid values', () => {
    expect(formatOperationalHealthTimestamp('not-a-date')).toBe('not-a-date');
    expect(formatOperationalHealthTimestamp('2026-05-09T00:00:00.000Z')).toContain('2026');
  });

  it('sorts positive failure counts by count then code', () => {
    expect(
      getSortedFailureCounts({
        B_CODE: 2,
        A_CODE: 2,
        C_CODE: 0,
        D_CODE: 3,
      }),
    ).toEqual([
      ['D_CODE', 3],
      ['A_CODE', 2],
      ['B_CODE', 2],
    ]);
  });

  it('builds metric tiles with operational tones', () => {
    expect(buildOperationalHealthMetricTiles(makeMetrics())).toEqual([
      {
        key: 'queueBacklog',
        label: 'Queue backlog',
        description: 'Queued or retrying jobs',
        value: 2,
        tone: 'warning',
      },
      {
        key: 'deadLetterJobs',
        label: 'Dead letters',
        description: 'Terminal queue jobs',
        value: 1,
        tone: 'critical',
      },
      {
        key: 'partialPublishFailures',
        label: 'Partial publishes',
        description: 'Mixed publish results',
        value: 0,
        tone: 'default',
      },
      {
        key: 'googleFailures',
        label: 'Google failures',
        description: 'Quota or reauth errors',
        value: 4,
        tone: 'critical',
      },
    ]);
  });

  it('maps alert labels and severity badge variants', () => {
    const criticalAlert = {
      code: 'DEAD_LETTER_JOBS',
      severity: 'critical',
      message: 'Dead letters exist.',
      count: 1,
    } satisfies DualSyncOperationalAlert;

    const warningAlert = {
      ...criticalAlert,
      severity: 'warning',
    } satisfies DualSyncOperationalAlert;

    expect(DUAL_SYNC_OPERATIONAL_ALERT_LABEL.DEAD_LETTER_JOBS).toBe('Dead letter jobs');
    expect(getOperationalAlertBadgeVariant(criticalAlert)).toBe('status-cancelled');
    expect(getOperationalAlertBadgeVariant(warningAlert)).toBe('status-pending');
  });

  it('builds the loaded panel model from metrics', () => {
    const model = buildOperationalHealthPanelModel(makeMetrics());

    expect(model.windowLabel).toContain('Window:');
    expect(model.windowLabel).toContain('to');
    expect(model.metricTiles).toHaveLength(4);
    expect(model.failureCounts).toEqual([
      ['QUOTA_LIMITED', 3],
      ['REAUTH_REQUIRED', 1],
    ]);
  });
});
