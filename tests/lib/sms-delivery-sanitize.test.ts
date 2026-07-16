import { describe, expect, it } from 'vitest';

import {
  maskSmsRecipientPhone,
  sanitizeOpsSmsDeliveryEvents,
  sanitizeOpsSmsDeliveryAttempts,
} from '@/src/lib/sms-delivery/sanitize';

import type { OpsSmsDeliveryAttemptDTO } from '@/types/smsDelivery';

describe('sanitizeOpsSmsDeliveryAttempts', () => {
  it('strips provider event errors and metadata from restaurant feed events', () => {
    const attempts = [
      {
        messageSid: 'SM123',
        recipientPhone: '+447700900123',
        bookingId: 'booking-1',
        smsType: 'booking_confirmation',
        provider: 'twilio',
        currentStatus: 'delivered',
        currentOccurredAt: '2026-05-10T09:00:00.000Z',
        booking: {
          id: 'booking-1',
          reference: 'ABC123',
          bookingDate: '2026-05-10',
          startTime: '19:00:00',
          endTime: '20:30:00',
          customerName: 'Guest',
          partySize: 2,
        },
        events: [
          {
            id: 'evt-1',
            bookingId: 'booking-1',
            restaurantId: 'restaurant-1',
            smsType: 'booking_confirmation',
            recipientPhone: '+447700900123',
            messageSid: 'SM123',
            status: 'delivered',
            provider: 'twilio',
            occurredAt: '2026-05-10T09:00:00.000Z',
            error: 'Carrier rejected details',
            metadata: {
              accountSid: 'AC123',
              from: '+447700900456',
              errorCode: '30007',
            },
          },
        ],
      },
    ] satisfies OpsSmsDeliveryAttemptDTO[];

    const sanitized = sanitizeOpsSmsDeliveryAttempts(attempts);

    expect(sanitized[0]).toMatchObject({
      messageSid: 'SM123',
      recipientPhone: '+********0123',
      currentStatus: 'delivered',
      booking: { reference: 'ABC123' },
    });
    expect(sanitized[0]?.events[0]).toMatchObject({
      id: 'evt-1',
      status: 'delivered',
      recipientPhone: '+********0123',
      error: null,
      metadata: null,
    });
    expect(attempts[0]?.events[0]?.error).toBe('Carrier rejected details');
    expect(attempts[0]?.events[0]?.metadata).toEqual({
      accountSid: 'AC123',
      from: '+447700900456',
      errorCode: '30007',
    });
  });

  it('masks recipient phones while retaining only the last four digits', () => {
    expect(maskSmsRecipientPhone('+44 7700 900123')).toBe('+********0123');
    expect(maskSmsRecipientPhone('07700900123')).toBe('*******0123');
    expect(maskSmsRecipientPhone('1234')).toBe('****');
    expect(maskSmsRecipientPhone('   ')).toBe('Hidden');
  });

  it('sanitizes standalone booking-level delivery events', () => {
    const sanitized = sanitizeOpsSmsDeliveryEvents([
      {
        id: 'evt-1',
        bookingId: 'booking-1',
        restaurantId: 'restaurant-1',
        smsType: 'booking_confirmation',
        recipientPhone: '+447700900123',
        messageSid: 'SM123',
        status: 'failed',
        provider: 'twilio',
        occurredAt: '2026-05-10T09:00:00.000Z',
        error: 'Carrier detail',
        metadata: {
          accountSid: 'AC123',
          errorCode: '30007',
        },
        channel: 'whatsapp',
        fallbackForAttemptId: 'attempt-parent',
        logicalNotificationId: 'notif-1',
      },
    ]);

    expect(sanitized).toEqual([
      expect.objectContaining({
        id: 'evt-1',
        recipientPhone: '+********0123',
        error: null,
        metadata: null,
        channel: 'whatsapp',
        fallbackForAttemptId: 'attempt-parent',
        logicalNotificationId: 'notif-1',
      }),
    ]);
  });
});
