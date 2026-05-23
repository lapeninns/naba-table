import { EMAIL_DELIVERY_STATUS_VALUES } from '@/types/emailDelivery';
import { EMAIL_DELIVERY_STATUS_LABELS } from '@src/lib/email-delivery/presentation';

import type { OpsEmailDeliverySearchField } from '@/components/features/email-delivery/opsEmailDeliveryTypes';
import type { EmailDeliveryStatus, OpsEmailDeliveryRange } from '@/types/emailDelivery';

export type SearchField = OpsEmailDeliverySearchField;

export const SEARCH_FIELD_LABELS: Record<SearchField, string> = {
  recipientEmail: 'Email',
  messageId: 'Message ID',
  bookingRef: 'Booking Ref',
};

export const SEARCH_FIELD_PLACEHOLDERS: Record<SearchField, string> = {
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
  { value: '24h', label: '24h', ariaLabel: 'Last 24 hours' },
  { value: '7d', label: '7d', ariaLabel: 'Last 7 days' },
  { value: '30d', label: '30d', ariaLabel: 'Last 30 days' },
] as const satisfies readonly {
  value: OpsEmailDeliveryRange;
  label: string;
  ariaLabel: string;
}[];

export const STATUS_BADGE_COLORS: Record<EmailDeliveryStatus, string> = {
  sent: 'border-border bg-muted/40 text-muted-foreground',
  delivered: 'border-primary/30 bg-primary/10 text-primary',
  delivery_delayed: 'border-primary/30 bg-primary/10 text-primary',
  bounced: 'border-destructive/20 bg-destructive/10 text-destructive',
  complained: 'border-destructive/20 bg-destructive/10 text-destructive',
  failed: 'border-destructive/20 bg-destructive/10 text-destructive',
};

export function resolveOpsEmailDeliveryRangeChange(
  value: string,
  currentRange: OpsEmailDeliveryRange,
): OpsEmailDeliveryRange | null {
  const next = EMAIL_DELIVERY_RANGE_OPTIONS.find((option) => option.value === value)?.value ?? null;
  if (!next || next === currentRange) {
    return null;
  }
  return next;
}

export function formatEmailDeliveryFilterOptionLabel(value: string): string {
  return value.replace(/_/g, ' ');
}

export function getEmailDeliveryStatusFilterOptions() {
  return EMAIL_DELIVERY_STATUS_VALUES.map((status) => ({
    status,
    label: EMAIL_DELIVERY_STATUS_LABELS[status],
    toneClass: STATUS_BADGE_COLORS[status],
  }));
}
