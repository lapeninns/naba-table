import { describe, expect, it } from 'vitest';

import {
  buildOpsEmailDeliveryAttemptCardModel,
  formatOpsEmailAttemptBookingStart,
  resolveOpsEmailAttemptCurrentEvent,
  resolveOpsEmailAttemptSubject,
  resolveOpsEmailAttemptVariantName,
  resolveOpsEmailAttemptStatusRailClass,
} from '@/components/features/email-delivery/opsEmailDeliveryAttemptCardDomain';

import type { OpsEmailDeliveryAttemptDTO } from '@/types/emailDelivery';

describe('opsEmailDeliveryAttemptCardDomain', () => {
  it('extracts subject and variant metadata with fallback ordering', () => {
    const attempt = makeAttempt({
      templateType: 'booking_confirmation',
      emailType: 'created',
      events: [
        makeEvent({
          id: 'evt-1',
          metadata: { subject: '  QA booking confirmation  ', variantName: '  Warm tone  ' },
        }),
      ],
    });

    expect(resolveOpsEmailAttemptSubject(attempt)).toBe('QA booking confirmation');
    expect(resolveOpsEmailAttemptVariantName(attempt.events)).toBe('Warm tone');

    const variantIdAttempt = makeAttempt({
      events: [makeEvent({ id: 'evt-2', metadata: { variantId: 'fallback-variant' } })],
    });
    expect(resolveOpsEmailAttemptVariantName(variantIdAttempt.events)).toBe('fallback-variant');

    const plainAttempt = makeAttempt({ events: [makeEvent({ id: 'evt-3', metadata: null })] });
    expect(resolveOpsEmailAttemptSubject(plainAttempt)).toBe('booking_confirmation');
  });

  it('selects the newest valid current event and falls back when dates are unavailable', () => {
    const older = makeEvent({ id: 'older', status: 'sent', occurredAt: '2026-03-20T14:00:00Z' });
    const newer = makeEvent({
      id: 'newer',
      status: 'failed',
      occurredAt: '2026-03-20T15:00:00Z',
    });

    expect(resolveOpsEmailAttemptCurrentEvent([older, newer], 'sent')?.id).toBe('newer');

    expect(
      resolveOpsEmailAttemptCurrentEvent(
        [
          makeEvent({ id: 'invalid', status: 'sent', occurredAt: 'not-a-date' }),
          makeEvent({ id: 'fallback', status: 'failed', occurredAt: null }),
        ],
        'failed',
      )?.id,
    ).toBe('fallback');
  });

  it('formats booking start and builds card model labels and links', () => {
    const attempt = makeAttempt({
      recipientEmail: 'avery.long.recipient.address.for.qa@example.test',
      events: [
        makeEvent({
          id: 'evt-1',
          status: 'sent',
          occurredAt: '2026-03-20T14:00:00Z',
          metadata: { subject: 'Subject from metadata' },
        }),
        makeEvent({
          id: 'evt-2',
          status: 'failed',
          occurredAt: '2026-03-20T15:00:00Z',
          error: 'Mailbox unavailable',
        }),
      ],
    });

    expect(formatOpsEmailAttemptBookingStart(attempt.booking!, 'UTC')).toBe('Fri, Mar 20 · 19:00');

    const model = buildOpsEmailDeliveryAttemptCardModel({
      attempt,
      restaurantId: 'rest-1',
      timezone: 'UTC',
    });

    expect(model).toMatchObject({
      attemptKey: 'msg-test-1__avery.long.recipient.address.for.qa@example.test',
      bookingHref: '/app/bookings?restaurantId=rest-1&focus=booking-1',
      bookingStartLabel: 'Fri, Mar 20 · 19:00',
      currentError: 'Mailbox unavailable',
      recipientEmail: 'avery.long.recipient.address.for.qa@example.test',
      shouldAllowRecipientWrap: true,
      statusRailClass: 'border-l-4 border-primary/60',
      subject: 'Subject from metadata',
      visibleBookingLabel: 'REF001 · Alex Johnson',
    });
    expect(model.eventRows).toHaveLength(2);
    expect(model.eventRows[1]).toMatchObject({
      error: 'Mailbox unavailable',
      id: 'evt-2',
      status: 'failed',
    });
  });

  it('resolves semantic status rail classes', () => {
    expect(resolveOpsEmailAttemptStatusRailClass('delivered')).toBe('border-l-4 border-primary/60');
    expect(resolveOpsEmailAttemptStatusRailClass('delivery_delayed')).toBe(
      'border-l-4 border-primary/40',
    );
    expect(resolveOpsEmailAttemptStatusRailClass('failed')).toBe(
      'border-l-4 border-destructive/60',
    );
    expect(resolveOpsEmailAttemptStatusRailClass('sent')).toBe('border-l-4 border-border');
  });
});

function makeAttempt(
  overrides: Partial<OpsEmailDeliveryAttemptDTO> = {},
): OpsEmailDeliveryAttemptDTO {
  return {
    booking: {
      bookingDate: '2026-03-20',
      customerName: 'Alex Johnson',
      endTime: '20:30',
      id: 'booking-1',
      partySize: 4,
      reference: 'REF001',
      startTime: '19:00',
    },
    bookingId: 'booking-1',
    currentOccurredAt: '2026-03-20T15:00:00Z',
    currentStatus: 'delivered',
    emailType: 'created',
    events: [makeEvent()],
    messageId: 'msg-test-1',
    provider: 'resend',
    recipientEmail: 'alex@example.com',
    templateType: 'booking_confirmation',
    ...overrides,
  };
}

function makeEvent(
  overrides: Partial<OpsEmailDeliveryAttemptDTO['events'][number]> = {},
): OpsEmailDeliveryAttemptDTO['events'][number] {
  return {
    bookingId: 'booking-1',
    emailType: 'created',
    error: null,
    id: 'evt-1',
    messageId: 'msg-test-1',
    metadata: null,
    occurredAt: '2026-03-20T14:00:00Z',
    provider: 'resend',
    recipientEmail: 'alex@example.com',
    restaurantId: 'rest-1',
    status: 'sent',
    templateType: 'booking_confirmation',
    ...overrides,
  };
}
