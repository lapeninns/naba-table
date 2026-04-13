import { describe, expect, it } from 'vitest';

import { groupSmsDeliveryEvents } from '@/src/lib/sms-delivery/grouping';

describe('groupSmsDeliveryEvents', () => {
  it('groups by message sid and recipient, keeping chronological event order', () => {
    const groups = groupSmsDeliveryEvents([
      {
        id: 'evt-delivered',
        bookingId: 'booking-1',
        restaurantId: 'rest-1',
        smsType: 'booking_confirmation',
        recipientPhone: '+447700900123',
        messageSid: 'SM123',
        provider: 'twilio',
        status: 'delivered',
        occurredAt: '2026-04-13T13:02:00.000Z',
        error: null,
        metadata: null,
      },
      {
        id: 'evt-queued',
        bookingId: 'booking-1',
        restaurantId: 'rest-1',
        smsType: 'booking_confirmation',
        recipientPhone: '+447700900123',
        messageSid: 'SM123',
        provider: 'twilio',
        status: 'queued',
        occurredAt: '2026-04-13T13:00:00.000Z',
        error: null,
        metadata: null,
      },
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      messageSid: 'SM123',
      recipientPhone: '+447700900123',
      currentStatus: 'delivered',
    });
    expect(groups[0]?.events.map((event) => event.status)).toEqual(['queued', 'delivered']);
  });
});
