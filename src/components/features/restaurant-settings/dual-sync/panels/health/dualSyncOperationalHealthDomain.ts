import { formatDualSyncTimestamp } from '../../dualSyncFormattingDomain';

import type {
  DualSyncOperationalAlert,
  DualSyncOperationalAlertCode,
  DualSyncOperationalMetrics,
} from '@/server/dual-sync/observability';

export type DualSyncHealthMetricTone = 'default' | 'warning' | 'critical';

export type DualSyncHealthMetricTileDescriptor = {
  key: string;
  label: string;
  description: string;
  value: number;
  tone: DualSyncHealthMetricTone;
};

export type DualSyncOperationalHealthPanelModel = {
  readonly windowLabel: string;
  readonly metricTiles: DualSyncHealthMetricTileDescriptor[];
  readonly alerts: DualSyncOperationalMetrics['alerts'];
  readonly failureCounts: ReadonlyArray<[string, number]>;
};

export const DUAL_SYNC_OPERATIONAL_ALERT_LABEL: Record<DualSyncOperationalAlertCode, string> = {
  QUEUE_BACKLOG: 'Queue backlog',
  DEAD_LETTER_JOBS: 'Dead letter jobs',
  QUOTA_LIMITED: 'Google quota',
  REAUTH_REQUIRED: 'Google reauth',
  STALE_DECISIONS: 'Stale decisions',
  PARTIAL_PUBLISH_FAILURES: 'Partial publishes',
};

const SUMMARY_ITEMS = [
  {
    key: 'queueBacklog',
    label: 'Queue backlog',
    description: 'Queued or retrying jobs',
  },
  {
    key: 'deadLetterJobs',
    label: 'Dead letters',
    description: 'Terminal queue jobs',
  },
  {
    key: 'partialPublishFailures',
    label: 'Partial publishes',
    description: 'Mixed publish results',
  },
] as const;

export function formatOperationalHealthTimestamp(value: string): string {
  return formatDualSyncTimestamp(value, { emptyFallback: '-' });
}

export function getOperationalAlertBadgeVariant(
  alert: DualSyncOperationalAlert,
): 'status-cancelled' | 'status-pending' {
  return alert.severity === 'critical' ? 'status-cancelled' : 'status-pending';
}

export function getSortedFailureCounts(
  counts: Readonly<Record<string, number>>,
): ReadonlyArray<[string, number]> {
  return Object.entries(counts)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

export function buildOperationalHealthMetricTiles(
  metrics: DualSyncOperationalMetrics,
): DualSyncHealthMetricTileDescriptor[] {
  const quotaLimited = metrics.failureCounts.QUOTA_LIMITED ?? 0;
  const reauthRequired = metrics.failureCounts.REAUTH_REQUIRED ?? 0;
  const deadLetterTone: DualSyncHealthMetricTone =
    metrics.deadLetterJobs > 0 ? 'critical' : 'default';
  const quotaTone: DualSyncHealthMetricTone =
    reauthRequired > 0 ? 'critical' : quotaLimited > 0 ? 'warning' : 'default';

  return [
    ...SUMMARY_ITEMS.map(
      (item): DualSyncHealthMetricTileDescriptor => ({
        ...item,
        value: metrics[item.key],
        tone:
          item.key === 'deadLetterJobs'
            ? deadLetterTone
            : metrics[item.key] > 0
              ? 'warning'
              : 'default',
      }),
    ),
    {
      key: 'googleFailures',
      label: 'Google failures',
      value: quotaLimited + reauthRequired,
      description: 'Quota or reauth errors',
      tone: quotaTone,
    },
  ];
}

export function buildOperationalHealthPanelModel(
  metrics: DualSyncOperationalMetrics,
): DualSyncOperationalHealthPanelModel {
  return {
    windowLabel: `Window: ${formatOperationalHealthTimestamp(metrics.windowStart)} to ${formatOperationalHealthTimestamp(metrics.windowEnd)}`,
    metricTiles: buildOperationalHealthMetricTiles(metrics),
    alerts: metrics.alerts,
    failureCounts: getSortedFailureCounts(metrics.failureCounts),
  };
}
