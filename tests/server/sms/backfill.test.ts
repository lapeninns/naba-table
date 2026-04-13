import { describe, expect, it } from 'vitest';

import {
  extractBookingReferenceFromSmsBody,
  inferHistoricalSmsTypeFromBody,
  matchHistoricalTwilioMessageToBooking,
} from '@/server/sms/backfill';

describe('inferHistoricalSmsTypeFromBody', () => {
  it('detects known booking sms templates', () => {
    expect(inferHistoricalSmsTypeFromBody('The Old Crown\n\nYour booking is confirmed.')).toBe(
      'booking_confirmation',
    );
    expect(
      inferHistoricalSmsTypeFromBody('The Old Crown\n\nYour booking has been updated.'),
    ).toBe('booking_update');
    expect(
      inferHistoricalSmsTypeFromBody(
        'The Old Crown\n\nYour booking has been cancelled by the restaurant.',
      ),
    ).toBe('restaurant_cancellation');
  });
});

describe('extractBookingReferenceFromSmsBody', () => {
  it('extracts the reference line from message copy', () => {
    expect(
      extractBookingReferenceFromSmsBody('The Old Crown\nReference: ABC12345\nManage your booking'),
    ).toBe('ABC12345');
  });
});

describe('matchHistoricalTwilioMessageToBooking', () => {
  const baseBooking = {
    restaurantId: 'rest-1',
    customerPhone: '+447700900111',
    createdAt: '2026-04-13T10:00:00.000Z',
    updatedAt: '2026-04-13T10:00:00.000Z',
    status: 'confirmed',
  } as const;

  it('matches by exact booking reference when available', () => {
    const result = matchHistoricalTwilioMessageToBooking(
      {
        sid: 'SM123',
        to: '+447700900111',
        status: 'delivered',
        body: 'The Old Crown\nYour booking is confirmed.\nReference: ABC12345',
        direction: 'outbound-api',
        dateSent: '2026-04-13T10:02:00.000Z',
        dateCreated: null,
        dateUpdated: null,
        errorCode: null,
        errorMessage: null,
        from: null,
        messagingServiceSid: 'MG123',
        uri: null,
      },
      [
        {
          ...baseBooking,
          id: 'booking-1',
          reference: 'ABC12345',
        },
      ],
    );

    expect(result).toMatchObject({
      kind: 'matched',
      bookingId: 'booking-1',
      matchedBy: 'reference+phone',
      smsType: 'booking_confirmation',
    });
  });

  it('matches a confirmation by phone and created_at when the body is unavailable', () => {
    const result = matchHistoricalTwilioMessageToBooking(
      {
        sid: 'SM123',
        to: '+447700900111',
        status: 'sent',
        body: null,
        direction: 'outbound-api',
        dateSent: '2026-04-13T10:03:00.000Z',
        dateCreated: null,
        dateUpdated: null,
        errorCode: null,
        errorMessage: null,
        from: null,
        messagingServiceSid: 'MG123',
        uri: null,
      },
      [
        {
          ...baseBooking,
          id: 'booking-1',
          reference: 'ABC12345',
        },
      ],
    );

    expect(result).toMatchObject({
      kind: 'matched',
      bookingId: 'booking-1',
      matchedBy: 'phone+created_at',
      smsType: 'booking_confirmation',
    });
  });

  it('marks same-phone matches as ambiguous when multiple bookings are in the best window', () => {
    const result = matchHistoricalTwilioMessageToBooking(
      {
        sid: 'SM123',
        to: '+447700900111',
        status: 'sent',
        body: null,
        direction: 'outbound-api',
        dateSent: '2026-04-13T10:03:00.000Z',
        dateCreated: null,
        dateUpdated: null,
        errorCode: null,
        errorMessage: null,
        from: null,
        messagingServiceSid: 'MG123',
        uri: null,
      },
      [
        {
          ...baseBooking,
          id: 'booking-1',
          reference: 'ABC12345',
        },
        {
          ...baseBooking,
          id: 'booking-2',
          reference: 'XYZ67890',
          createdAt: '2026-04-13T10:05:00.000Z',
          updatedAt: '2026-04-13T10:05:00.000Z',
        },
      ],
    );

    expect(result).toMatchObject({
      kind: 'ambiguous',
      reason: 'multiple_bookings_in_best_match_window',
      candidateBookingIds: ['booking-1', 'booking-2'],
    });
  });

  it('matches a cancellation by body and updated_at', () => {
    const result = matchHistoricalTwilioMessageToBooking(
      {
        sid: 'SM123',
        to: '+447700900111',
        status: 'delivered',
        body: 'The Old Crown\nYour booking has been cancelled by the restaurant.\nReference: DEF999',
        direction: 'outbound-api',
        dateSent: '2026-04-13T11:02:00.000Z',
        dateCreated: null,
        dateUpdated: null,
        errorCode: null,
        errorMessage: null,
        from: null,
        messagingServiceSid: 'MG123',
        uri: null,
      },
      [
        {
          ...baseBooking,
          id: 'booking-3',
          reference: 'DEF999',
          updatedAt: '2026-04-13T11:00:00.000Z',
          status: 'cancelled',
        },
      ],
    );

    expect(result).toMatchObject({
      kind: 'matched',
      bookingId: 'booking-3',
      smsType: 'restaurant_cancellation',
    });
  });
});
