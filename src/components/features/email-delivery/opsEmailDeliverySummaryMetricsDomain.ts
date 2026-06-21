import {
  EMAIL_DELIVERY_STALE_THRESHOLD_HOURS,
  type EmailDeliveryStatus,
  type OpsEmailDeliverySummary,
} from '@/types/emailDelivery';
import { EMAIL_DELIVERY_STATUS_LABELS } from '@src/lib/email-delivery/presentation';

export type OpsEmailMetricTone = 'neutral' | 'good' | 'warn' | 'bad';

export type OpsEmailPrimaryMetric = {
  key: 'total' | 'delivered' | 'delayed' | 'failures';
  label: string;
  value: string;
  hint?: string;
  tone: OpsEmailMetricTone;
  testId: string;
  filterStatus?: EmailDeliveryStatus | null;
};

export type OpsEmailDistributionSegment = {
  status: EmailDeliveryStatus;
  label: string;
  count: number;
  className: string;
  widthPercent: number;
  title: string;
  screenReaderText: string;
};

export type OpsEmailSecondaryMetric = {
  key: string;
  label: string;
  value: string;
  testId: string;
};

export type OpsEmailFailureList = {
  key: 'templates' | 'emailTypes';
  title: string;
  emptyLabel: string;
  entries: { key: string; label: string; count: number }[];
};

export type OpsEmailSummaryMetricsModel = {
  total: number;
  stuckInFlight: {
    count: number;
    thresholdHours: number;
  } | null;
  primaryMetrics: OpsEmailPrimaryMetric[];
  distributionSummary: string;
  distributionSegments: OpsEmailDistributionSegment[];
  secondaryMetrics: OpsEmailSecondaryMetric[];
  failureLists: OpsEmailFailureList[];
};

type SegmentInput = {
  status: EmailDeliveryStatus;
  count: number;
  className: string;
};

function normalizeCount(value: number | null | undefined): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value ?? 0));
}

function clampRate(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function formatOpsEmailDeliveryRate(value: number): string {
  const pct = clampRate(value) * 100;
  const rounded = pct >= 10 ? Math.round(pct) : Math.round(pct * 10) / 10;
  return `${rounded}%`;
}

export function formatOpsEmailDeliveryDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return '—';
  const totalSeconds = Math.round(seconds);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const remSeconds = totalSeconds % 60;
  if (totalMinutes < 60) return `${totalMinutes}m ${remSeconds}s`;
  const hours = Math.floor(totalMinutes / 60);
  const remMinutes = totalMinutes % 60;
  return `${hours}h ${remMinutes}m`;
}

function buildDistributionSegments(
  total: number,
  segmentInputs: SegmentInput[],
): OpsEmailDistributionSegment[] {
  return segmentInputs.map((segment) => {
    const label = EMAIL_DELIVERY_STATUS_LABELS[segment.status] ?? segment.status;
    const widthPercent = total > 0 ? (segment.count / total) * 100 : 0;

    return {
      ...segment,
      label,
      widthPercent,
      title: `${label}: ${segment.count} (${Math.round(widthPercent)}%)`,
      screenReaderText: `${label}: ${segment.count} of ${total}`,
    };
  });
}

function buildFailureLists(summary: OpsEmailDeliverySummary): OpsEmailFailureList[] {
  return [
    {
      key: 'templates',
      title: 'Top failed templates',
      emptyLabel: 'No failures in this range.',
      entries: summary.topFailedTemplates.map((entry) => ({
        key: entry.templateType,
        label: entry.templateType,
        count: normalizeCount(entry.count),
      })),
    },
    {
      key: 'emailTypes',
      title: 'Top failed email types',
      emptyLabel: 'No failures in this range.',
      entries: summary.topFailedEmailTypes.map((entry) => ({
        key: entry.emailType,
        label: entry.emailType,
        count: normalizeCount(entry.count),
      })),
    },
  ];
}

export function buildOpsEmailSummaryMetricsModel(
  summary: OpsEmailDeliverySummary,
): OpsEmailSummaryMetricsModel {
  const total = normalizeCount(summary.total);
  const sent = normalizeCount(summary.sent);
  const delivered = normalizeCount(summary.delivered);
  const deliveryDelayed = normalizeCount(summary.deliveryDelayed);
  const bounced = normalizeCount(summary.bounced);
  const complained = normalizeCount(summary.complained);
  const failed = normalizeCount(summary.failed);
  const failures = bounced + complained + failed;
  const stuckInFlightCount = normalizeCount(summary.stuckInFlight ?? 0);

  const segmentInputs: SegmentInput[] = [
    { status: 'delivered', count: delivered, className: 'bg-primary/10' },
    { status: 'delivery_delayed', count: deliveryDelayed, className: 'bg-primary/10' },
    { status: 'bounced', count: bounced, className: 'bg-destructive/10' },
    { status: 'complained', count: complained, className: 'bg-destructive/10' },
    { status: 'failed', count: failed, className: 'bg-destructive/10' },
    { status: 'sent', count: sent, className: 'bg-muted/40' },
  ];

  const visibleStatusLines = segmentInputs
    .filter((segment) => segment.count > 0)
    .map(
      (segment) =>
        `${EMAIL_DELIVERY_STATUS_LABELS[segment.status] ?? segment.status}: ${segment.count}`,
    );

  return {
    total,
    stuckInFlight:
      stuckInFlightCount > 0
        ? {
            count: stuckInFlightCount,
            thresholdHours: EMAIL_DELIVERY_STALE_THRESHOLD_HOURS,
          }
        : null,
    primaryMetrics: [
      {
        key: 'total',
        label: 'Total attempts',
        value: String(total),
        tone: 'neutral',
        filterStatus: null,
        testId: 'email-metric-total',
      },
      {
        key: 'delivered',
        label: 'Delivered',
        value: String(delivered),
        hint: `${formatOpsEmailDeliveryRate(summary.deliveredRate)} delivered`,
        tone: 'good',
        filterStatus: 'delivered',
        testId: 'email-metric-delivered',
      },
      {
        key: 'delayed',
        label: 'Delayed',
        value: String(deliveryDelayed),
        tone: 'warn',
        filterStatus: 'delivery_delayed',
        testId: 'email-metric-delayed',
      },
      {
        key: 'failures',
        label: 'Failures',
        value: String(failures),
        hint: `${formatOpsEmailDeliveryRate(summary.failureRate)} failure rate`,
        tone: 'bad',
        testId: 'email-metric-failures',
      },
    ],
    distributionSummary: total > 0 ? visibleStatusLines.join(' · ') : 'No attempts',
    distributionSegments: buildDistributionSegments(total, segmentInputs),
    secondaryMetrics: [
      { key: 'sent', label: 'Sent-only', value: String(sent), testId: 'email-metric-sent' },
      { key: 'bounced', label: 'Bounced', value: String(bounced), testId: 'email-metric-bounced' },
      {
        key: 'complained',
        label: 'Complained',
        value: String(complained),
        testId: 'email-metric-complained',
      },
      { key: 'failed', label: 'Failed', value: String(failed), testId: 'email-metric-failed' },
      {
        key: 'uniqueRecipients',
        label: 'Unique recipients',
        value: String(normalizeCount(summary.uniqueRecipients)),
        testId: 'email-metric-uniqueRecipients',
      },
      {
        key: 'uniqueBookings',
        label: 'Unique bookings',
        value: String(normalizeCount(summary.uniqueBookings)),
        testId: 'email-metric-uniqueBookings',
      },
      {
        key: 'p50DeliverySeconds',
        label: 'p50 delivery time',
        value: formatOpsEmailDeliveryDuration(summary.p50DeliverySeconds),
        testId: 'email-metric-p50DeliverySeconds',
      },
      {
        key: 'p95DeliverySeconds',
        label: 'p95 delivery time',
        value: formatOpsEmailDeliveryDuration(summary.p95DeliverySeconds),
        testId: 'email-metric-p95DeliverySeconds',
      },
    ],
    failureLists: buildFailureLists(summary),
  };
}
