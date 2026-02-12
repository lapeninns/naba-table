import { describe, expect, it } from 'vitest';

import { groupEmailDeliveryEvents } from '@src/lib/email-delivery/grouping';

import type { EmailDeliveryEventDTO } from '@/types/emailDelivery';

describe('groupEmailDeliveryEvents', () => {
  it('groups by messageId + recipientEmail and selects latest status', () => {
    const events: EmailDeliveryEventDTO[] = [
      {
        id: '1',
        bookingId: 'b1',
        restaurantId: 'r1',
        emailType: 'confirmation',
        templateType: 'confirmation',
        recipientEmail: 'guest@example.com',
        messageId: 'm1',
        status: 'sent',
        provider: 'resend',
        occurredAt: '2026-02-05T10:00:00Z',
        error: null,
        metadata: { subject: 'Hello' },
      },
      {
        id: '2',
        bookingId: 'b1',
        restaurantId: 'r1',
        emailType: 'confirmation',
        templateType: 'confirmation',
        recipientEmail: 'guest@example.com',
        messageId: 'm1',
        status: 'delivered',
        provider: 'resend',
        occurredAt: '2026-02-05T10:01:00Z',
        error: null,
        metadata: null,
      },
      {
        id: '3',
        bookingId: 'b1',
        restaurantId: 'r1',
        emailType: 'review_request',
        templateType: 'review_request',
        recipientEmail: 'other@example.com',
        messageId: 'm2',
        status: 'bounced',
        provider: 'resend',
        occurredAt: '2026-02-05T11:00:00Z',
        error: 'Mailbox not found',
        metadata: { subject: 'Review us' },
      },
    ];

    const groups = groupEmailDeliveryEvents(events);

    expect(groups).toHaveLength(2);

    const first = groups[0]!;
    expect(first.messageId).toBe('m2');
    expect(first.recipientEmail).toBe('other@example.com');
    expect(first.currentStatus).toBe('bounced');
    expect(first.subject).toBe('Review us');

    const second = groups[1]!;
    expect(second.messageId).toBe('m1');
    expect(second.recipientEmail).toBe('guest@example.com');
    expect(second.currentStatus).toBe('delivered');
    expect(second.subject).toBe('Hello');
    expect(second.events.map((e) => e.status)).toEqual(['sent', 'delivered']);
  });

  it('handles invalid occurredAt without crashing', () => {
    const events: EmailDeliveryEventDTO[] = [
      {
        id: '1',
        bookingId: 'b1',
        restaurantId: 'r1',
        emailType: null,
        templateType: null,
        recipientEmail: 'guest@example.com',
        messageId: 'm1',
        status: 'sent',
        provider: 'resend',
        occurredAt: 'not-a-date',
        error: null,
        metadata: null,
      },
      {
        id: '2',
        bookingId: 'b1',
        restaurantId: 'r1',
        emailType: null,
        templateType: null,
        recipientEmail: 'guest@example.com',
        messageId: 'm1',
        status: 'delivered',
        provider: 'resend',
        occurredAt: '2026-02-05T10:01:00Z',
        error: null,
        metadata: null,
      },
    ];

    const groups = groupEmailDeliveryEvents(events);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.currentStatus).toBe('delivered');
    expect(groups[0]!.events.map((e) => e.id)).toEqual(['2', '1']);
  });
});

