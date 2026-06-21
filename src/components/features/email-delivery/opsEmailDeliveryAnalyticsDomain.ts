import { EMAIL_DELIVERY_STATUS_LABELS } from '@src/lib/email-delivery/presentation';

import {
  formatOpsEmailDeliveryDuration,
  formatOpsEmailDeliveryRate,
} from './opsEmailDeliverySummaryMetricsDomain';

import type { OpsEmailDeliveryRange, OpsEmailDeliverySummary } from '@/types/emailDelivery';

export const OPS_EMAIL_DELIVERY_ANALYTICS_RANGE_OPTIONS = [
  '24h',
  '7d',
  '30d',
] as const satisfies readonly OpsEmailDeliveryRange[];

export type OpsEmailAnalyticsTile = {
  key: 'total' | 'delivered' | 'delayed' | 'failures';
  label: string;
  value: string;
  hint: string;
  toneClass: string;
};

export type OpsEmailAnalyticsDistributionSegment = {
  key: string;
  label: string;
  count: number;
  toneClass: string;
  widthPercent: number;
  title: string;
};

export type OpsEmailAnalyticsSecondaryMetric = {
  key: string;
  label: string;
  value: string;
  testId: string;
};

export type OpsEmailAnalyticsFailureSection = {
  key: 'templates' | 'emailTypes';
  title: string;
  emptyLabel: string;
  entries: { key: string; label: string; count: number }[];
};

export type OpsEmailDeliveryAnalyticsModel = {
  total: number;
  primaryTiles: OpsEmailAnalyticsTile[];
  distributionSegments: OpsEmailAnalyticsDistributionSegment[];
  secondaryMetrics: OpsEmailAnalyticsSecondaryMetric[];
  failureSections: OpsEmailAnalyticsFailureSection[];
};

type DistributionInput = {
  key: string;
  label: string;
  count: number;
  toneClass: string;
};

export function isOpsEmailDeliveryAnalyticsRange(value: string): value is OpsEmailDeliveryRange {
  return OPS_EMAIL_DELIVERY_ANALYTICS_RANGE_OPTIONS.includes(value as OpsEmailDeliveryRange);
}

function normalizeCount(value: number | null | undefined): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value ?? 0));
}

function buildDistributionSegments(
  total: number,
  distributionInputs: DistributionInput[],
): OpsEmailAnalyticsDistributionSegment[] {
  return distributionInputs
    .filter((segment) => segment.count > 0 || total === 0)
    .map((segment) => ({
      ...segment,
      widthPercent: total > 0 ? (segment.count / total) * 100 : 0,
      title: `${segment.label}: ${segment.count}`,
    }));
}

function buildFailureSections(summary: OpsEmailDeliverySummary): OpsEmailAnalyticsFailureSection[] {
  return [
    {
      key: 'templates',
      title: 'Top failed templates',
      emptyLabel: 'No failed templates in this range.',
      entries: summary.topFailedTemplates.map((entry) => ({
        key: entry.templateType,
        label: entry.templateType,
        count: normalizeCount(entry.count),
      })),
    },
    {
      key: 'emailTypes',
      title: 'Top failed email types',
      emptyLabel: 'No failed email types in this range.',
      entries: summary.topFailedEmailTypes.map((entry) => ({
        key: entry.emailType,
        label: entry.emailType,
        count: normalizeCount(entry.count),
      })),
    },
  ];
}

export function buildOpsEmailDeliveryAnalyticsModel(
  summary: OpsEmailDeliverySummary,
): OpsEmailDeliveryAnalyticsModel {
  const total = normalizeCount(summary.total);
  const sent = normalizeCount(summary.sent);
  const delivered = normalizeCount(summary.delivered);
  const deliveryDelayed = normalizeCount(summary.deliveryDelayed);
  const bounced = normalizeCount(summary.bounced);
  const complained = normalizeCount(summary.complained);
  const failed = normalizeCount(summary.failed);
  const failureCount = bounced + complained + failed;

  const distributionInputs: DistributionInput[] = [
    {
      key: 'delivered',
      label: EMAIL_DELIVERY_STATUS_LABELS.delivered,
      count: delivered,
      toneClass: 'bg-primary',
    },
    {
      key: 'delivery_delayed',
      label: EMAIL_DELIVERY_STATUS_LABELS.delivery_delayed,
      count: deliveryDelayed,
      toneClass: 'bg-muted-foreground',
    },
    {
      key: 'bounced',
      label: EMAIL_DELIVERY_STATUS_LABELS.bounced,
      count: bounced,
      toneClass: 'bg-destructive/70',
    },
    {
      key: 'failed',
      label: EMAIL_DELIVERY_STATUS_LABELS.failed,
      count: complained + failed,
      toneClass: 'bg-destructive',
    },
    {
      key: 'sent',
      label: EMAIL_DELIVERY_STATUS_LABELS.sent,
      count: sent,
      toneClass: 'bg-muted',
    },
  ];

  return {
    total,
    primaryTiles: [
      {
        key: 'total',
        label: 'Total Attempts',
        value: String(total),
        hint: 'Across the selected analytics window',
        toneClass: 'border-border bg-muted/40',
      },
      {
        key: 'delivered',
        label: 'Delivered',
        value: String(delivered),
        hint: `${formatOpsEmailDeliveryRate(summary.deliveredRate)} delivery rate`,
        toneClass: 'border-primary/20 bg-primary/10',
      },
      {
        key: 'delayed',
        label: 'Delayed',
        value: String(deliveryDelayed),
        hint: 'Attempts waiting longer than expected',
        toneClass: 'border-border bg-muted/40',
      },
      {
        key: 'failures',
        label: 'Failures',
        value: String(failureCount),
        hint: `${formatOpsEmailDeliveryRate(summary.failureRate)} failure rate`,
        toneClass: 'border-destructive/20 bg-destructive/10',
      },
    ],
    distributionSegments: buildDistributionSegments(total, distributionInputs),
    secondaryMetrics: [
      {
        key: 'p50DeliverySeconds',
        label: 'p50 delivery time',
        value: formatOpsEmailDeliveryDuration(summary.p50DeliverySeconds),
        testId: 'analytics-p50',
      },
      {
        key: 'p95DeliverySeconds',
        label: 'p95 delivery time',
        value: formatOpsEmailDeliveryDuration(summary.p95DeliverySeconds),
        testId: 'analytics-p95',
      },
      {
        key: 'uniqueRecipients',
        label: 'Unique recipients',
        value: String(normalizeCount(summary.uniqueRecipients)),
        testId: 'analytics-unique-recipients',
      },
      {
        key: 'uniqueBookings',
        label: 'Unique bookings',
        value: String(normalizeCount(summary.uniqueBookings)),
        testId: 'analytics-unique-bookings',
      },
    ],
    failureSections: buildFailureSections(summary),
  };
}
