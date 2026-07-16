import type { OpsEmailDeliveryFeedResponse } from '@/types/emailDelivery';

export const OPS_EMAIL_DELIVERY_RETRY_FIXTURE_ENTRIES: Record<
  string,
  {
    bookingId: string;
    restaurantId?: string;
    emailType: string;
    templateType: string;
    recipientEmail: string;
    subject: string;
  }
> = {
  '11111111-1111-4111-8111-111111111111': {
    bookingId: 'booking-fixture-failed',
    emailType: 'created',
    templateType: 'booking_confirmation',
    recipientEmail: 'retry.failed@example.com',
    subject: 'Fixture failed retry candidate',
  },
  '22222222-2222-4222-8222-222222222222': {
    bookingId: 'booking-fixture-bounced',
    emailType: 'review_request',
    templateType: 'review_request',
    recipientEmail: 'retry.bounced@example.com',
    subject: 'Fixture bounced retry candidate',
  },
};

export function isOpsEmailDeliveryFaultInjectionEnabled(): boolean {
  return (
    process.env.NODE_ENV !== 'production' ||
    process.env.APP_ENV === 'development' ||
    process.env.APP_ENV === 'test'
  );
}

export function buildOpsEmailDeliveryRetryActionsFixture(
  restaurantId: string,
): Extract<OpsEmailDeliveryFeedResponse, { ok: true }> {
  const failedDeliveryLogId = '11111111-1111-4111-8111-111111111111';
  const bouncedDeliveryLogId = '22222222-2222-4222-8222-222222222222';
  const deliveredDeliveryLogId = '33333333-3333-4333-8333-333333333333';

  const attempts = [
    {
      id: failedDeliveryLogId,
      messageId: 'fixture-provider-message-failed',
      recipientEmail: 'retry.failed@example.com',
      bookingId: 'booking-fixture-failed',
      emailType: 'created',
      templateType: 'booking_confirmation',
      provider: 'mock' as const,
      currentStatus: 'failed' as const,
      currentOccurredAt: '2026-03-24T10:02:00.000Z',
      booking: {
        id: 'booking-fixture-failed',
        reference: 'FXT001',
        bookingDate: '2026-03-24',
        startTime: '19:00',
        endTime: '20:30',
        customerName: 'Fixture Failed',
        partySize: 2,
      },
      events: [
        {
          id: 'fixture-failed-sent',
          bookingId: 'booking-fixture-failed',
          restaurantId,
          emailType: 'created',
          templateType: 'booking_confirmation',
          recipientEmail: 'retry.failed@example.com',
          messageId: 'fixture-provider-message-failed',
          status: 'sent' as const,
          provider: 'mock' as const,
          occurredAt: '2026-03-24T10:00:00.000Z',
          error: null,
          metadata: { subject: 'Fixture failed retry candidate' },
        },
        {
          id: 'fixture-failed-final',
          bookingId: 'booking-fixture-failed',
          restaurantId,
          emailType: 'created',
          templateType: 'booking_confirmation',
          recipientEmail: 'retry.failed@example.com',
          messageId: 'fixture-provider-message-failed',
          status: 'failed' as const,
          provider: 'mock' as const,
          occurredAt: '2026-03-24T10:02:00.000Z',
          error: 'Fixture forced failure for retry validation.',
          metadata: { subject: 'Fixture failed retry candidate' },
        },
      ],
    },
    {
      id: bouncedDeliveryLogId,
      messageId: 'fixture-provider-message-bounced',
      recipientEmail: 'retry.bounced@example.com',
      bookingId: 'booking-fixture-bounced',
      emailType: 'review_request',
      templateType: 'review_request',
      provider: 'mock' as const,
      currentStatus: 'bounced' as const,
      currentOccurredAt: '2026-03-24T09:16:00.000Z',
      booking: {
        id: 'booking-fixture-bounced',
        reference: 'FXT002',
        bookingDate: '2026-03-24',
        startTime: '20:00',
        endTime: '21:30',
        customerName: 'Fixture Bounced',
        partySize: 4,
      },
      events: [
        {
          id: 'fixture-bounced-sent',
          bookingId: 'booking-fixture-bounced',
          restaurantId,
          emailType: 'review_request',
          templateType: 'review_request',
          recipientEmail: 'retry.bounced@example.com',
          messageId: 'fixture-provider-message-bounced',
          status: 'sent' as const,
          provider: 'mock' as const,
          occurredAt: '2026-03-24T09:15:00.000Z',
          error: null,
          metadata: { subject: 'Fixture bounced retry candidate' },
        },
        {
          id: 'fixture-bounced-final',
          bookingId: 'booking-fixture-bounced',
          restaurantId,
          emailType: 'review_request',
          templateType: 'review_request',
          recipientEmail: 'retry.bounced@example.com',
          messageId: 'fixture-provider-message-bounced',
          status: 'bounced' as const,
          provider: 'mock' as const,
          occurredAt: '2026-03-24T09:16:00.000Z',
          error: 'Fixture mailbox bounced for validation.',
          metadata: { subject: 'Fixture bounced retry candidate' },
        },
      ],
    },
    {
      id: deliveredDeliveryLogId,
      messageId: 'fixture-provider-message-delivered',
      recipientEmail: 'retry.delivered@example.com',
      bookingId: 'booking-fixture-delivered',
      emailType: 'updated',
      templateType: 'booking_update',
      provider: 'mock' as const,
      currentStatus: 'delivered' as const,
      currentOccurredAt: '2026-03-24T08:02:00.000Z',
      booking: {
        id: 'booking-fixture-delivered',
        reference: 'FXT003',
        bookingDate: '2026-03-24',
        startTime: '18:30',
        endTime: '20:00',
        customerName: 'Fixture Delivered',
        partySize: 3,
      },
      events: [
        {
          id: 'fixture-delivered-sent',
          bookingId: 'booking-fixture-delivered',
          restaurantId,
          emailType: 'updated',
          templateType: 'booking_update',
          recipientEmail: 'retry.delivered@example.com',
          messageId: 'fixture-provider-message-delivered',
          status: 'sent' as const,
          provider: 'mock' as const,
          occurredAt: '2026-03-24T08:00:00.000Z',
          error: null,
          metadata: { subject: 'Fixture delivered control row' },
        },
        {
          id: 'fixture-delivered-final',
          bookingId: 'booking-fixture-delivered',
          restaurantId,
          emailType: 'updated',
          templateType: 'booking_update',
          recipientEmail: 'retry.delivered@example.com',
          messageId: 'fixture-provider-message-delivered',
          status: 'delivered' as const,
          provider: 'mock' as const,
          occurredAt: '2026-03-24T08:02:00.000Z',
          error: null,
          metadata: { subject: 'Fixture delivered control row' },
        },
      ],
    },
  ];

  return {
    ok: true,
    restaurantId,
    range: '7d',
    pageInfo: { page: 1, pageSize: 50, hasNext: false },
    attempts,
    summary: {
      total: 3,
      sent: 0,
      delivered: 1,
      deliveryDelayed: 0,
      bounced: 1,
      complained: 0,
      failed: 1,
      deliveredRate: 1 / 3,
      failureRate: 2 / 3,
      uniqueRecipients: 3,
      uniqueBookings: 3,
      p50DeliverySeconds: 120,
      p95DeliverySeconds: 120,
      topFailedTemplates: [
        { templateType: 'booking_confirmation', count: 1 },
        { templateType: 'review_request', count: 1 },
      ],
      topFailedEmailTypes: [
        { emailType: 'created', count: 1 },
        { emailType: 'review_request', count: 1 },
      ],
      stuckInFlight: 0,
    },
  };
}

export function buildOpsEmailDeliveryFixtureRetrySuccessEntry({
  deliveryLogId,
  fixtureEntry,
  restaurantId,
}: {
  deliveryLogId: string;
  fixtureEntry: (typeof OPS_EMAIL_DELIVERY_RETRY_FIXTURE_ENTRIES)[string];
  restaurantId: string;
}) {
  const occurredAt = new Date().toISOString();

  return {
    id: deliveryLogId,
    bookingId: fixtureEntry.bookingId,
    restaurantId,
    emailType: fixtureEntry.emailType,
    templateType: fixtureEntry.templateType,
    recipientEmail: fixtureEntry.recipientEmail,
    messageId: `${deliveryLogId}:fixture-retry-success`,
    status: 'sent' as const,
    provider: 'fixture' as const,
    error: null,
    occurredAt,
    metadata: {
      subject: fixtureEntry.subject,
      fixtureRetryRefetched: true,
      fixtureSyntheticSuccess: true,
    },
  };
}
