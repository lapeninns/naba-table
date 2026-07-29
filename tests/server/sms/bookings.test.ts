import { describe, expect, it } from 'vitest';

import {
  buildSmsStatusCallbackUrl,
  buildGuestBookingCancellationSms,
  buildGuestBookingConfirmationSms,
  buildGuestBookingUpdateSms,
  requiresDirectSmsAfterPendingWhatsAppFailure,
} from '@/server/sms/bookings';

const booking = {
  id: 'booking-1',
  restaurant_id: 'rest-1',
  booking_date: '2026-04-30',
  start_time: '19:30:00',
  party_size: 5,
  customer_name: 'Guest Booker',
  customer_email: 'guest@example.com',
  customer_phone: '+447467586751',
  reference: 'ABC12345',
  start_at: '2026-04-30T18:30:00.000Z',
} as const;

const venue = {
  id: 'rest-1',
  name: 'The Old Crown Girton',
  timezone: 'Europe/London',
  phone: '+441223277217',
} as const;

describe('booking SMS builders', () => {
  it('distinguishes definite pre-accept failure from provider acceptance @contract', () => {
    expect(
      requiresDirectSmsAfterPendingWhatsAppFailure({
        attemptId: 'attempt-1',
        errorCode: 'Error',
        kind: 'attempt_finalization_pending',
        providerMessageId: null,
        status: 'failed',
      }),
    ).toBe(true);
    expect(
      requiresDirectSmsAfterPendingWhatsAppFailure({
        attemptId: 'attempt-1',
        errorCode: null,
        kind: 'attempt_finalization_pending',
        providerMessageId: 'WA1',
        status: 'queued',
      }),
    ).toBe(false);
  });

  it('builds a signed-context status callback url for Twilio delivery events', () => {
    const url = buildSmsStatusCallbackUrl({
      appUrl: 'https://app.nabatable.com',
      attemptId: '33333333-3333-4333-8333-333333333333',
      bookingId: '11111111-1111-4111-8111-111111111111',
      restaurantId: '22222222-2222-4222-8222-222222222222',
      smsType: 'booking_confirmation',
    });

    expect(url).toBe(
      'https://app.nabatable.com/api/webhook/twilio/sms-status?bookingId=11111111-1111-4111-8111-111111111111&restaurantId=22222222-2222-4222-8222-222222222222&smsType=booking_confirmation&attempt=33333333-3333-4333-8333-333333333333',
    );
  });

  it('builds confirmation SMS copy', () => {
    const message = buildGuestBookingConfirmationSms({
      booking: booking as never,
      venue,
    });

    expect(message).toContain('The Old Crown Girton');
    expect(message).toContain('Your booking is confirmed.');
    expect(message).toContain('Thu, 30 Apr 2026 at 19:30 | 5 guests');
    expect(message).toContain('Reference: ABC12345');
    expect(message).toContain('Manage your booking:');
  });

  it('uses the configured SMS display name without changing the venue name', () => {
    const message = buildGuestBookingConfirmationSms({
      booking: booking as never,
      venue: {
        ...venue,
        smsDisplayName: 'Old Crown Girton',
      },
    });

    expect(message).toMatch(/^Old Crown Girton\n/);
    expect(message).not.toContain('The Old Crown Girton');
    expect(venue.name).toBe('The Old Crown Girton');
  });

  it('builds update SMS copy with manage link', () => {
    const message = buildGuestBookingUpdateSms({
      booking: booking as never,
      venue,
    });

    expect(message).toContain('Your booking has been updated.');
    expect(message).toContain('Reference: ABC12345');
    expect(message).toContain('Manage your booking:');
  });

  it('builds guest cancellation SMS copy', () => {
    const message = buildGuestBookingCancellationSms({
      booking: booking as never,
      venue,
      cancelledBy: 'customer',
    });

    expect(message).toContain('Your booking has been cancelled.');
    expect(message).toContain('Reference: ABC12345');
    expect(message).toContain('Contact: +441223277217');
  });

  it('builds restaurant cancellation SMS copy', () => {
    const message = buildGuestBookingCancellationSms({
      booking: booking as never,
      venue,
      cancelledBy: 'staff',
    });

    expect(message).toContain('Your booking has been cancelled by the restaurant.');
  });
});
