import { describe, expect, it } from 'vitest';

import {
  buildOpsEmailDeliveryTableRows,
  getOpsEmailDeliveryAttemptKey,
  resolveOpsEmailDeliveryAttemptSubject,
} from '@/components/features/email-delivery/opsEmailDeliverySelectors';

import type { OpsEmailDeliveryAttemptDTO } from '@/types/emailDelivery';

function makeAttempt(overrides: Partial<OpsEmailDeliveryAttemptDTO> = {}): OpsEmailDeliveryAttemptDTO {
  return {
    id: 'delivery-log-1',
    messageId: 'msg-test-1',
    recipientEmail: 'alex@example.com',
    bookingId: 'booking-1',
    emailType: 'created',
    templateType: 'booking_confirmation',
    provider: 'resend',
    currentStatus: 'delivered',
    currentOccurredAt: '2026-03-20T14:30:00Z',
    events: [
      {
        id: 'evt-1',
        bookingId: 'booking-1',
        restaurantId: 'rest-1',
        emailType: 'created',
        templateType: 'booking_confirmation',
        recipientEmail: 'alex@example.com',
        messageId: 'msg-test-1',
        status: 'sent',
        provider: 'resend',
        occurredAt: '2026-03-20T14:28:00Z',
        error: null,
        metadata: null,
      },
    ],
    booking: {
      id: 'booking-1',
      reference: 'REF001',
      bookingDate: '2026-03-20',
      startTime: '19:00',
      endTime: '20:30',
      customerName: 'Alex Johnson',
      partySize: 4,
    },
    ...overrides,
  };
}

describe('opsEmailDeliverySelectors', () => {
  it('builds stable attempt keys from message and recipient', () => {
    expect(
      getOpsEmailDeliveryAttemptKey(
        makeAttempt({ messageId: 'msg-42', recipientEmail: 'Alex@Example.com' }),
      ),
    ).toBe('msg-42__alex@example.com');
  });

  it('prefers subject metadata when available', () => {
    expect(
      resolveOpsEmailDeliveryAttemptSubject(
        makeAttempt({
          events: [
            {
              id: 'evt-2',
              bookingId: 'booking-1',
              restaurantId: 'rest-1',
              emailType: 'created',
              templateType: 'booking_confirmation',
              recipientEmail: 'alex@example.com',
              messageId: 'msg-test-1',
              status: 'delivered',
              provider: 'resend',
              occurredAt: '2026-03-20T14:30:00Z',
              error: null,
              metadata: { subject: 'Dinner confirmed' },
            },
          ],
        }),
      ),
    ).toBe('Dinner confirmed');
  });

  it('builds precomputed row models for the delivery table', () => {
    const rows = buildOpsEmailDeliveryTableRows({
      attempts: [
        makeAttempt({
          id: 'delivery-log-2',
          messageId: 'msg-test-2',
          recipientEmail: 'sam@example.com',
          currentStatus: 'failed',
          emailType: 'review_request',
          templateType: 'review_request',
          currentOccurredAt: '2026-03-20T15:00:00Z',
          events: [
            {
              id: 'evt-3',
              bookingId: 'booking-2',
              restaurantId: 'rest-1',
              emailType: 'review_request',
              templateType: 'review_request',
              recipientEmail: 'sam@example.com',
              messageId: 'msg-test-2',
              status: 'failed',
              provider: 'resend',
              occurredAt: '2026-03-20T15:00:00Z',
              error: 'Mailbox unavailable',
              metadata: null,
            },
          ],
          booking: null,
        }),
      ],
      timezone: 'UTC',
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      attemptKey: 'msg-test-2__sam@example.com',
      subject: 'review_request',
      recipientEmail: 'sam@example.com',
      emailType: 'review_request',
      bookingReference: null,
      customerName: null,
      canRetry: true,
      statusSortValue: 'failed',
    });
    expect(rows[0]?.sentAtMs).toBeGreaterThan(0);
  });
});
