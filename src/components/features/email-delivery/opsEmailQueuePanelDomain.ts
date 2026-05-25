import { DateTime } from 'luxon';

import type {
  OpsEmailQueueFeedResponse,
  OpsEmailQueueJobStatus,
  OpsEmailQueueSummary,
} from '@/types/emailQueue';

export type OpsEmailQueueStatusFilter = OpsEmailQueueJobStatus | 'all';
export type OpsEmailQueueMetricTone = 'slate' | 'amber' | 'blue' | 'emerald' | 'rose';

export type OpsEmailQueueMetric = {
  label: string;
  value: number;
  tone: OpsEmailQueueMetricTone;
};

export const OPS_EMAIL_QUEUE_STATUS_OPTIONS: Array<{
  value: OpsEmailQueueStatusFilter;
  label: string;
}> = [
  { value: 'all', label: 'All' },
  { value: 'delayed', label: 'Scheduled' },
  { value: 'waiting', label: 'Ready now' },
  { value: 'active', label: 'Sending now' },
  { value: 'dlq', label: 'Needs attention' },
];

export function formatOpsEmailQueueDateTime(value: string | null, timezone: string): string {
  if (!value) return '—';
  const dt = DateTime.fromISO(value, { zone: 'utc' }).setZone(timezone);
  if (!dt.isValid) return value;
  return dt.toFormat('EEE, MMM d · HH:mm');
}

export function getOpsEmailQueueStatusBadgeVariant(
  status: OpsEmailQueueJobStatus,
): 'default' | 'secondary' | 'outline' | 'destructive' {
  switch (status) {
    case 'active':
      return 'default';
    case 'delayed':
      return 'secondary';
    case 'dlq':
      return 'destructive';
    case 'waiting':
    default:
      return 'outline';
  }
}

export function getOpsEmailQueueStatusLabel(status: OpsEmailQueueJobStatus): string {
  switch (status) {
    case 'dlq':
      return 'Needs attention';
    case 'active':
      return 'Sending now';
    case 'delayed':
      return 'Scheduled';
    case 'waiting':
    default:
      return 'Ready now';
  }
}

export function getOpsEmailQueueTypeLabel(type: string): string {
  switch (type) {
    case 'reminder_24h':
      return '24-hour reminder';
    case 'reminder_short':
      return 'Short reminder';
    case 'review_request':
      return 'Review request';
    case 'request_received':
      return 'Request received';
    case 'confirmation':
      return 'Booking confirmation';
    case 'updated':
      return 'Booking update';
    case 'cancelled':
      return 'Cancellation notice';
    case 'booking_rejected':
      return 'Booking rejected';
    case 'restaurant_cancellation':
      return 'Restaurant cancellation';
    default:
      return type.replace(/_/g, ' ');
  }
}

export function buildOpsEmailQueueMetrics(
  summary: OpsEmailQueueSummary | null | undefined,
): OpsEmailQueueMetric[] {
  return [
    { label: 'Total in queue', value: summary?.total ?? 0, tone: 'slate' },
    { label: 'Scheduled for later', value: summary?.delayed ?? 0, tone: 'amber' },
    { label: 'Ready to send', value: summary?.waiting ?? 0, tone: 'blue' },
    { label: 'Sending now', value: summary?.active ?? 0, tone: 'emerald' },
    { label: 'Needs attention', value: summary?.dlq ?? 0, tone: 'rose' },
  ];
}

export function resolveOpsEmailQueueQueryStatus(
  status: OpsEmailQueueStatusFilter,
): OpsEmailQueueJobStatus | undefined {
  return status === 'all' ? undefined : status;
}

export function getOpsEmailQueueTotal(
  response: OpsEmailQueueFeedResponse | null | undefined,
): number {
  return response?.ok ? response.pageInfo.total : 0;
}
