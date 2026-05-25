import { DateTime } from 'luxon';

import { formatEmailDeliveryOccurredAt } from '@src/lib/email-delivery/presentation';

import type {
  EmailDeliveryEventDTO,
  EmailDeliveryStatus,
  OpsEmailDeliveryAttemptDTO,
} from '@/types/emailDelivery';

export type OpsEmailDeliveryAttemptEventModel = {
  error: string | null;
  id: string;
  occurredAtLabel: string;
  status: EmailDeliveryStatus;
};

export type OpsEmailDeliveryAttemptCardModel = {
  attemptKey: string;
  bookingHref: string | null;
  bookingStartLabel: string | null;
  currentError: string | null;
  eventRows: OpsEmailDeliveryAttemptEventModel[];
  messageId: string;
  recipientEmail: string;
  shouldAllowRecipientWrap: boolean;
  status: EmailDeliveryStatus;
  statusRailClass: string;
  subject: string;
  templateType: string | null;
  variantName: string | null;
  visibleOccurredAtLabel: string | null;
  visibleBookingLabel: string | null;
};

function parseIsoMs(value: string): number | null {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function readTrimmedMetadataString(
  event: EmailDeliveryEventDTO,
  key: 'subject' | 'variantName' | 'variantId',
): string | null {
  const meta = event.metadata;
  if (!meta || typeof meta !== 'object') {
    return null;
  }

  const value = (meta as Record<string, unknown>)[key];
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function resolveOpsEmailAttemptSubject(attempt: OpsEmailDeliveryAttemptDTO): string {
  for (const event of attempt.events) {
    const subject = readTrimmedMetadataString(event, 'subject');
    if (subject) {
      return subject;
    }
  }

  return attempt.templateType ?? attempt.emailType ?? 'Email';
}

export function resolveOpsEmailAttemptVariantName(events: EmailDeliveryEventDTO[]): string | null {
  for (const event of events) {
    const variantName = readTrimmedMetadataString(event, 'variantName');
    if (variantName) {
      return variantName;
    }

    const variantId = readTrimmedMetadataString(event, 'variantId');
    if (variantId) {
      return variantId;
    }
  }

  return null;
}

export function resolveOpsEmailAttemptCurrentEvent(
  events: EmailDeliveryEventDTO[],
  fallbackStatus: EmailDeliveryStatus,
): EmailDeliveryEventDTO | null {
  let current: EmailDeliveryEventDTO | null = null;
  let currentMs: number | null = null;

  for (const event of events) {
    if (!event.occurredAt) {
      continue;
    }

    const ms = parseIsoMs(event.occurredAt);
    if (ms === null) {
      continue;
    }

    if (currentMs === null || ms > currentMs) {
      current = event;
      currentMs = ms;
    }
  }

  if (current) {
    return current;
  }

  return events.find((event) => event.status === fallbackStatus) ?? events.at(-1) ?? null;
}

export function formatOpsEmailAttemptBookingStart(
  booking: NonNullable<OpsEmailDeliveryAttemptDTO['booking']>,
  timezone: string,
): string | null {
  const iso = `${booking.bookingDate}T${booking.startTime}`;
  const dt = DateTime.fromISO(iso, { zone: timezone });
  if (!dt.isValid) {
    return null;
  }

  return dt.toFormat('EEE, MMM d · HH:mm');
}

export function resolveOpsEmailAttemptStatusRailClass(status: EmailDeliveryStatus): string {
  switch (status) {
    case 'delivered':
      return 'border-l-4 border-primary/60';
    case 'delivery_delayed':
      return 'border-l-4 border-primary/40';
    case 'bounced':
    case 'complained':
    case 'failed':
      return 'border-l-4 border-destructive/60';
    case 'sent':
    default:
      return 'border-l-4 border-border';
  }
}

export function buildOpsEmailDeliveryAttemptCardModel({
  attempt,
  restaurantId,
  timezone,
}: {
  attempt: OpsEmailDeliveryAttemptDTO;
  restaurantId: string;
  timezone: string;
}): OpsEmailDeliveryAttemptCardModel {
  const subject = resolveOpsEmailAttemptSubject(attempt);
  const booking = attempt.booking;
  const currentEvent = resolveOpsEmailAttemptCurrentEvent(attempt.events, attempt.currentStatus);

  return {
    attemptKey: `${attempt.messageId}__${attempt.recipientEmail.toLowerCase()}`,
    bookingHref: attempt.bookingId
      ? `/app/bookings?restaurantId=${restaurantId}&focus=${attempt.bookingId}`
      : null,
    bookingStartLabel: booking ? formatOpsEmailAttemptBookingStart(booking, timezone) : null,
    currentError: currentEvent?.error ?? null,
    eventRows: attempt.events.map((event) => ({
      error: event.error,
      id: event.id,
      occurredAtLabel:
        formatEmailDeliveryOccurredAt(event.occurredAt, timezone) ??
        event.occurredAt ??
        'Unknown time',
      status: event.status,
    })),
    messageId: attempt.messageId,
    recipientEmail: attempt.recipientEmail,
    shouldAllowRecipientWrap: attempt.recipientEmail.length > 38,
    status: attempt.currentStatus,
    statusRailClass: resolveOpsEmailAttemptStatusRailClass(attempt.currentStatus),
    subject,
    templateType: attempt.templateType,
    variantName: resolveOpsEmailAttemptVariantName(attempt.events),
    visibleBookingLabel: booking ? `${booking.reference} · ${booking.customerName}` : null,
    visibleOccurredAtLabel: formatEmailDeliveryOccurredAt(attempt.currentOccurredAt, timezone),
  };
}
