import { DEV_BOOKING_ID, DEV_BOOKING_OTHER_ID, DEV_RESTAURANT_ID } from '../devIds';


import type {
  EmailDeliveryEventDTO,
  EmailDeliveryStatus,
  OpsEmailDeliveryBookingDTO,
  OpsEmailDeliveryFeedResponse,
  OpsEmailDeliveryRange,
} from '@/types/emailDelivery';


function nowIsoMinus(minutes: number) {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
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
    provider: 'resend',
    occurredAt: nowIsoMinus(input.minutesAgo),
    error: input.error ?? null,
    metadata: null,
  };
}

export function createDevEmailDeliveryFeed(params: {
  restaurantId: string;
  range: OpsEmailDeliveryRange;
  page: number;
  pageSize: number;
  status?: EmailDeliveryStatus[];
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

  const statusFilter = params.status?.length ? new Set(params.status) : null;
  const filtered = statusFilter ? allEvents.filter((e) => statusFilter.has(e.status)) : allEvents;

  const start = (params.page - 1) * params.pageSize;
  const pageEvents = filtered.slice(start, start + params.pageSize);
  const hasNext = start + params.pageSize < filtered.length;

  return {
    ok: true,
    restaurantId: params.restaurantId,
    range: params.range,
    pageInfo: { page: params.page, pageSize: params.pageSize, hasNext },
    events: pageEvents,
    bookings,
  };
}

