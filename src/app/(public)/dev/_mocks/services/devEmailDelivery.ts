import { DEV_BOOKING_ID, DEV_BOOKING_OTHER_ID, DEV_RESTAURANT_ID } from '../devIds';

import type {
  EmailDeliveryEventDTO,
  EmailDeliveryProvider,
  EmailDeliveryStatus,
  OpsEmailDeliveryAttemptDTO,
  OpsEmailDeliveryBookingDTO,
  OpsEmailDeliveryFeedResponse,
  OpsEmailDeliveryRange,
  OpsEmailDeliverySummary,
} from '@/types/emailDelivery';

function nowIsoMinus(minutes: number) {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

function parseIsoMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function makeEvent(input: {
  id: string;
  bookingId: string | null;
  messageId: string;
  recipientEmail: string;
  status: EmailDeliveryStatus;
  minutesAgo: number;
  error?: string | null;
  templateType?: string | null;
  emailType?: string | null;
  provider?: EmailDeliveryProvider | null;
}): EmailDeliveryEventDTO {
  return {
    id: input.id,
    bookingId: input.bookingId,
    restaurantId: DEV_RESTAURANT_ID,
    emailType: input.emailType ?? 'booking_confirmation',
    templateType: input.templateType ?? 'booking_confirmation',
    recipientEmail: input.recipientEmail,
    messageId: input.messageId,
    status: input.status,
    provider: input.provider ?? 'resend',
    occurredAt: nowIsoMinus(input.minutesAgo),
    error: input.error ?? null,
    metadata: null,
  };
}

function percentileCont(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0] ?? null;

  const clamped = Math.max(0, Math.min(1, p));
  const pos = (sorted.length - 1) * clamped;
  const lower = Math.floor(pos);
  const upper = Math.ceil(pos);
  const lowerValue = sorted[lower];
  const upperValue = sorted[upper];
  if (lowerValue === undefined || upperValue === undefined) return null;
  if (lower === upper) return lowerValue;
  return lowerValue + (pos - lower) * (upperValue - lowerValue);
}

function computeSummary(attempts: OpsEmailDeliveryAttemptDTO[]): OpsEmailDeliverySummary {
  const totalsByStatus: Record<EmailDeliveryStatus, number> = {
    sent: 0,
    delivered: 0,
    delivery_delayed: 0,
    bounced: 0,
    complained: 0,
    failed: 0,
  };

  const recipients = new Set<string>();
  const bookings = new Set<string>();
  const deliverySeconds: number[] = [];

  const failedTemplates = new Map<string, number>();
  const failedEmailTypes = new Map<string, number>();

  for (const attempt of attempts) {
    totalsByStatus[attempt.currentStatus] = (totalsByStatus[attempt.currentStatus] ?? 0) + 1;
    recipients.add(attempt.recipientEmail.toLowerCase());
    if (attempt.bookingId) bookings.add(attempt.bookingId);

    if (attempt.currentStatus === 'delivered') {
      const sentAt = attempt.events.find((e) => e.status === 'sent')?.occurredAt ?? null;
      const deliveredAt = attempt.events.find((e) => e.status === 'delivered')?.occurredAt ?? null;
      const sentMs = parseIsoMs(sentAt);
      const deliveredMs = parseIsoMs(deliveredAt);
      if (sentMs !== null && deliveredMs !== null && deliveredMs >= sentMs) {
        deliverySeconds.push((deliveredMs - sentMs) / 1000);
      }
    }

    if (attempt.currentStatus === 'bounced' || attempt.currentStatus === 'complained' || attempt.currentStatus === 'failed') {
      const templateKey = attempt.templateType ?? 'unknown';
      failedTemplates.set(templateKey, (failedTemplates.get(templateKey) ?? 0) + 1);
      const emailTypeKey = attempt.emailType ?? 'unknown';
      failedEmailTypes.set(emailTypeKey, (failedEmailTypes.get(emailTypeKey) ?? 0) + 1);
    }
  }

  const total = attempts.length;
  const delivered = totalsByStatus.delivered;
  const failures = totalsByStatus.bounced + totalsByStatus.complained + totalsByStatus.failed;

  const topFailedTemplates = Array.from(failedTemplates.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([templateType, count]) => ({ templateType, count }));

  const topFailedEmailTypes = Array.from(failedEmailTypes.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([emailType, count]) => ({ emailType, count }));

  return {
    total,
    sent: totalsByStatus.sent,
    delivered: totalsByStatus.delivered,
    deliveryDelayed: totalsByStatus.delivery_delayed,
    bounced: totalsByStatus.bounced,
    complained: totalsByStatus.complained,
    failed: totalsByStatus.failed,
    deliveredRate: total > 0 ? delivered / total : 0,
    failureRate: total > 0 ? failures / total : 0,
    uniqueRecipients: recipients.size,
    uniqueBookings: bookings.size,
    p50DeliverySeconds: total > 0 ? percentileCont(deliverySeconds, 0.5) : null,
    p95DeliverySeconds: total > 0 ? percentileCont(deliverySeconds, 0.95) : null,
    topFailedTemplates,
    topFailedEmailTypes,
  };
}

function groupAttempts(events: EmailDeliveryEventDTO[], bookings: OpsEmailDeliveryBookingDTO[]): OpsEmailDeliveryAttemptDTO[] {
  const bookingMap = new Map<string, OpsEmailDeliveryBookingDTO>();
  bookings.forEach((b) => bookingMap.set(b.id, b));

  const buckets = new Map<string, EmailDeliveryEventDTO[]>();
  for (const event of events) {
    const key = `${event.messageId}__${event.recipientEmail.toLowerCase()}`;
    const existing = buckets.get(key);
    if (existing) existing.push(event);
    else buckets.set(key, [event]);
  }

  const attempts: OpsEmailDeliveryAttemptDTO[] = [];
  for (const groupEvents of buckets.values()) {
    const sortedAsc = groupEvents.slice().sort((a, b) => (parseIsoMs(a.occurredAt) ?? 0) - (parseIsoMs(b.occurredAt) ?? 0));
    const sortedDesc = groupEvents.slice().sort((a, b) => (parseIsoMs(b.occurredAt) ?? 0) - (parseIsoMs(a.occurredAt) ?? 0));
    const current = sortedDesc[0];
    if (!current) continue;

    const bookingId = current.bookingId ?? sortedDesc.find((e) => e.bookingId)?.bookingId ?? null;
    attempts.push({
      messageId: current.messageId,
      recipientEmail: current.recipientEmail,
      bookingId,
      emailType: current.emailType ?? null,
      templateType: current.templateType ?? null,
      provider: current.provider ?? null,
      currentStatus: current.status,
      currentOccurredAt: current.occurredAt ?? null,
      events: sortedAsc,
      booking: bookingId ? bookingMap.get(bookingId) ?? null : null,
    });
  }

  attempts.sort((a, b) => (parseIsoMs(b.currentOccurredAt) ?? 0) - (parseIsoMs(a.currentOccurredAt) ?? 0));
  return attempts;
}

export function createDevEmailDeliveryFeed(params: {
  restaurantId: string;
  range: OpsEmailDeliveryRange;
  page: number;
  pageSize: number;
  status?: EmailDeliveryStatus[];
  recipientEmail?: string;
  messageId?: string;
  bookingRef?: string;
  templateType?: string;
  emailType?: string;
}): OpsEmailDeliveryFeedResponse {
  const bookings: OpsEmailDeliveryBookingDTO[] = [
    {
      id: DEV_BOOKING_ID,
      reference: 'DEV123',
      bookingDate: '2026-02-10',
      startTime: '19:00',
      endTime: '20:30',
      customerName: 'Alex Johnson',
      partySize: 4,
    },
    {
      id: DEV_BOOKING_OTHER_ID,
      reference: 'DEV456',
      bookingDate: '2026-02-10',
      startTime: '20:00',
      endTime: '21:30',
      customerName: 'Sam Patel',
      partySize: 2,
    },
  ];

  const allEvents: EmailDeliveryEventDTO[] = [
    makeEvent({
      id: 'evt-1',
      bookingId: DEV_BOOKING_ID,
      messageId: 'msg-aaaa-bbbb-cccc',
      recipientEmail: 'alex@example.com',
      status: 'sent',
      minutesAgo: 90,
    }),
    makeEvent({
      id: 'evt-2',
      bookingId: DEV_BOOKING_ID,
      messageId: 'msg-aaaa-bbbb-cccc',
      recipientEmail: 'alex@example.com',
      status: 'delivered',
      minutesAgo: 88,
    }),
    makeEvent({
      id: 'evt-3',
      bookingId: DEV_BOOKING_OTHER_ID,
      messageId: 'msg-dddd-eeee-ffff',
      recipientEmail: 'sam.patel@example.com',
      status: 'sent',
      minutesAgo: 45,
    }),
    makeEvent({
      id: 'evt-4',
      bookingId: DEV_BOOKING_OTHER_ID,
      messageId: 'msg-dddd-eeee-ffff',
      recipientEmail: 'sam.patel@example.com',
      status: 'delivery_delayed',
      minutesAgo: 44,
      error: 'Temporary provider delay (simulated).',
    }),
    makeEvent({
      id: 'evt-5',
      bookingId: null,
      messageId: 'msg-zzzz-yyyy-xxxx',
      recipientEmail: 'someone-with-a-very-long-email-address@example-very-long-domain.test',
      status: 'failed',
      minutesAgo: 10,
      error: 'Mailbox unavailable (simulated).',
      templateType: 'review_request',
      emailType: 'review_request',
    }),
  ];

  const allAttempts = groupAttempts(allEvents, bookings);

  const statusFilter = params.status?.length ? new Set(params.status) : null;
  const recipientEmail = params.recipientEmail?.trim().toLowerCase() ?? null;
  const messageId = params.messageId?.trim() ?? null;
  const bookingRef = params.bookingRef?.trim().toUpperCase() ?? null;
  const templateType = params.templateType?.trim() ?? null;
  const emailType = params.emailType?.trim() ?? null;

  const filteredAttempts = allAttempts.filter((attempt) => {
    if (statusFilter && !statusFilter.has(attempt.currentStatus)) return false;
    if (recipientEmail && attempt.recipientEmail.toLowerCase() !== recipientEmail) return false;
    if (messageId && attempt.messageId !== messageId) return false;
    if (bookingRef && attempt.booking?.reference !== bookingRef) return false;
    if (templateType && attempt.templateType !== templateType) return false;
    if (emailType && attempt.emailType !== emailType) return false;
    return true;
  });

  const start = (params.page - 1) * params.pageSize;
  const pageAttempts = filteredAttempts.slice(start, start + params.pageSize);
  const hasNext = start + params.pageSize < filteredAttempts.length;

  return {
    ok: true,
    restaurantId: params.restaurantId,
    range: params.range,
    pageInfo: { page: params.page, pageSize: params.pageSize, hasNext },
    attempts: pageAttempts,
    ...(params.page === 1 ? { summary: computeSummary(filteredAttempts) } : {}),
  };
}
