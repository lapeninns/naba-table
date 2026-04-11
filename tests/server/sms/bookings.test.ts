import { describe, expect, it } from 'vitest';

import {
  buildGuestBookingCancellationSms,
  buildGuestBookingConfirmationSms,
  buildGuestBookingUpdateSms,
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
