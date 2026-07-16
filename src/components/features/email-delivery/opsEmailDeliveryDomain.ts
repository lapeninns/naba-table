import { DateTime } from 'luxon';

import {
  EMAIL_DELIVERY_STATUS_LABELS,
  formatEmailDeliveryOccurredAt,
} from '@/src/lib/email-delivery/presentation';
import { EMAIL_DELIVERY_STATUS_VALUES, type EmailDeliveryStatus } from '@/types/emailDelivery';

import type { OpsEmailDeliveryRefreshOption, OpsEmailDeliverySearchField } from './opsEmailDeliveryTypes';
import type { OpsEmailDeliveryAttemptDTO, OpsEmailDeliveryRange, OpsEmailDeliverySummary } from '@/types/emailDelivery';
import type { OpsEmailQueueJobStatus, OpsEmailQueueSummary } from '@/types/emailQueue';

export const SEARCH_FIELD_LABELS: Record<OpsEmailDeliverySearchField, string> = {
  recipientEmail: 'Email',
  messageId: 'Message ID',
  bookingRef: 'Booking Ref',
};

export const SEARCH_FIELD_PLACEHOLDERS: Record<OpsEmailDeliverySearchField, string> = {
  recipientEmail: 'guest@example.com',
  messageId: 'msg-xxxx-xxxx',
  bookingRef: 'ABC123',
};

export const TEMPLATE_TYPE_OPTIONS = [
  'booking_confirmation',
  'request_received',
  'confirmation',
  'booking_update',
  'booking_cancellation',
  'booking_rejected',
  'restaurant_cancellation',
  'review_request',
  'reminder_24h',
  'reminder_short',
] as const;

export const EMAIL_TYPE_OPTIONS = [
  'booking_confirmation',
  'request_received',
  'confirmation',
  'created',
  'updated',
  'cancelled',
  'review_request',
  'reminder',
  'booking_rejected',
  'restaurant_cancellation',
] as const;

export const EMAIL_DELIVERY_RANGE_OPTIONS = [
  { value: '24h' as const, label: '24h', ariaLabel: 'Last 24 hours' },
  { value: '7d' as const, label: '7d', ariaLabel: 'Last 7 days' },
  { value: '30d' as const, label: '30d', ariaLabel: 'Last 30 days' },
];

export const OPS_EMAIL_QUEUE_STATUS_OPTIONS: Array<{
  value: OpsEmailQueueJobStatus | 'all';
  label: string;
}> = [
  { value: 'all', label: 'All' },
  { value: 'delayed', label: 'Scheduled' },
  { value: 'waiting', label: 'Ready now' },
  { value: 'active', label: 'Sending now' },
  { value: 'dlq', label: 'Needs attention' },
];

const REFRESH_INTERVALS_MS: Record<Exclude<OpsEmailDeliveryRefreshOption, 'off'>, number> = {
  '30s': 30_000,
  '1m': 60_000,
  '5m': 300_000,
};

export function getOpsEmailDeliveryRefreshIntervalMs(
  option: OpsEmailDeliveryRefreshOption,
): number | false {
  if (option === 'off') return false;
  return REFRESH_INTERVALS_MS[option];
}

export function formatRefreshLabel(option: OpsEmailDeliveryRefreshOption): string {
  if (option === 'off') return 'Off';
  return option;
}

export function formatFilterOptionLabel(value: string): string {
  return value.replace(/_/g, ' ');
}

export function canRetryEmailDelivery(status: EmailDeliveryStatus): boolean {
  return status === 'failed' || status === 'bounced';
}

export function getEmailDeliveryStatusFilterOptions() {
  return EMAIL_DELIVERY_STATUS_VALUES.map((status) => ({
    status,
    label: EMAIL_DELIVERY_STATUS_LABELS[status],
  }));
}

export function getDeliveryFeedErrorMessage(error: { message?: string | null; error?: string | null } | Error): string {
  const message = 'message' in error ? error.message : null;
  const fallback = 'error' in error ? error.error : null;
  const raw = message?.trim() || fallback?.trim() || '';

  if (!raw) {
    return 'We could not load the delivery log right now. Please try again.';
  }

  const normalized = raw.toLowerCase();
  if (
    normalized.includes('failed to fetch') ||
    normalized.includes('networkerror') ||
    normalized.includes('network request failed') ||
    normalized.includes('load failed')
  ) {
    return 'We could not reach the delivery log service. Check your connection and try again.';
  }

  return raw;
}

export function formatOpsEmailDeliveryRate(value: number): string {
  if (!Number.isFinite(value)) return '0%';
  const pct = Math.max(0, Math.min(1, value)) * 100;
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

export function formatOpsEmailQueueDateTime(value: string | null, timezone: string): string {
  if (!value) return '—';
  const dt = DateTime.fromISO(value, { zone: 'utc' }).setZone(timezone);
  if (!dt.isValid) return value;
  return dt.toFormat('EEE, MMM d · HH:mm');
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

export function buildOpsEmailQueueMetrics(summary: OpsEmailQueueSummary | null | undefined) {
  return [
    { label: 'Total in queue', value: summary?.total ?? 0 },
    { label: 'Scheduled for later', value: summary?.delayed ?? 0 },
    { label: 'Ready to send', value: summary?.waiting ?? 0 },
    { label: 'Sending now', value: summary?.active ?? 0 },
    { label: 'Needs attention', value: summary?.dlq ?? 0 },
  ];
}

export function resolveRetryDeliveryLogId(attempt: OpsEmailDeliveryAttemptDTO): string | null {
  const directId = typeof attempt.id === 'string' ? attempt.id.trim() : '';
  if (directId) return directId;

  const parseEventTime = (value: string | null | undefined): number => {
    if (!value) return 0;
    const ms = new Date(value).getTime();
    return Number.isFinite(ms) ? ms : 0;
  };

  const currentEvent = attempt.events
    .slice()
    .sort(
      (left, right) =>
        parseEventTime(right.occurredAt) - parseEventTime(left.occurredAt) ||
        right.id.localeCompare(left.id),
    )
    .find(
      (event) =>
        event.status === attempt.currentStatus &&
        (!attempt.currentOccurredAt || event.occurredAt === attempt.currentOccurredAt),
    );

  const eventId = currentEvent?.id.trim() ?? '';
  return eventId || null;
}

export function buildAnalyticsModel(summary: OpsEmailDeliverySummary) {
  const failureCount = summary.bounced + summary.complained + summary.failed;
  return {
    total: summary.total,
    tiles: [
      { key: 'total', label: 'Total Attempts', value: String(summary.total), hint: 'Across the selected window' },
      {
        key: 'delivered',
        label: 'Delivered',
        value: String(summary.delivered),
        hint: `${formatOpsEmailDeliveryRate(summary.deliveredRate)} delivery rate`,
      },
      {
        key: 'delayed',
        label: 'Delayed',
        value: String(summary.deliveryDelayed),
        hint: 'Attempts waiting longer than expected',
      },
      {
        key: 'failures',
        label: 'Failures',
        value: String(failureCount),
        hint: `${formatOpsEmailDeliveryRate(summary.failureRate)} failure rate`,
      },
    ],
    secondary: [
      { label: 'p50 delivery time', value: formatOpsEmailDeliveryDuration(summary.p50DeliverySeconds) },
      { label: 'p95 delivery time', value: formatOpsEmailDeliveryDuration(summary.p95DeliverySeconds) },
      { label: 'Unique recipients', value: String(summary.uniqueRecipients) },
      { label: 'Unique bookings', value: String(summary.uniqueBookings) },
    ],
    topFailedTemplates: summary.topFailedTemplates,
    topFailedEmailTypes: summary.topFailedEmailTypes,
    distribution: [
      { key: 'delivered', label: EMAIL_DELIVERY_STATUS_LABELS.delivered, count: summary.delivered },
      { key: 'delayed', label: EMAIL_DELIVERY_STATUS_LABELS.delivery_delayed, count: summary.deliveryDelayed },
      { key: 'bounced', label: EMAIL_DELIVERY_STATUS_LABELS.bounced, count: summary.bounced },
      { key: 'failed', label: EMAIL_DELIVERY_STATUS_LABELS.failed, count: summary.complained + summary.failed },
      { key: 'sent', label: EMAIL_DELIVERY_STATUS_LABELS.sent, count: summary.sent },
    ].filter((segment) => segment.count > 0 || summary.total === 0),
  };
}

export { EMAIL_DELIVERY_STATUS_LABELS, formatEmailDeliveryOccurredAt };

export function isEmailDeliveryRange(value: string): value is OpsEmailDeliveryRange {
  return value === '24h' || value === '7d' || value === '30d';
}

export function isRefreshOption(value: string): value is OpsEmailDeliveryRefreshOption {
  return value === 'off' || value === '30s' || value === '1m' || value === '5m';
}
