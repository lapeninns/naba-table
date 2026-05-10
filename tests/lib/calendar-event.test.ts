import { describe, expect, it } from 'vitest';

import {
  buildCalendarEvent,
  shouldAttachCalendarEventAttachment,
} from '@/lib/reservations/calendar-event';

describe('buildCalendarEvent', () => {
  it('includes richer booking context for confirmed bookings', () => {
    const event = buildCalendarEvent({
      reservationId: 'booking-123',
      reference: 'REF123',
      guestName: 'Alex Johnson',
      guestEmail: 'alex@example.com',
      partySize: 4,
      startAt: '2026-04-20T18:00:00.000Z',
      endAt: '2026-04-20T19:30:00.000Z',
      venueName: 'The Old Crown Girton',
      venueAddress: '123 High Street, Girton',
      venueTimezone: 'Europe/London',
      venueEmail: 'bookings@oldcrowngirton.co.uk',
      venuePhone: '+441223000000',
      bookingType: 'dinner',
      notes: 'Birthday table, if available.',
      manageUrl: 'https://www.nabatable.com/bookings/recover?token=abc',
      status: 'confirmed',
    });

    expect(event).toContain('SUMMARY:The Old Crown Girton Reservation');
    expect(event).toContain('Reference: REF123');
    expect(event).toContain('Party size: 4');
    expect(event).toContain('Booking type: dinner');
    expect(event).toContain('Notes: Birthday table\\, if available.');
    expect(event).toContain('Manage booking: https://www.nabatable.com/bookings/recover?token=abc');
    expect(event).toContain('Venue phone: +441223000000');
    expect(event).toContain('URL:https://www.nabatable.com/bookings/recover?token=abc');
  });

  it('emits cancellation semantics for cancelled bookings', () => {
    const event = buildCalendarEvent({
      reservationId: 'booking-123',
      reference: 'REF123',
      guestName: 'Alex Johnson',
      guestEmail: 'alex@example.com',
      partySize: 4,
      startAt: '2026-04-20T18:00:00.000Z',
      endAt: '2026-04-20T19:30:00.000Z',
      venueName: 'The Old Crown Girton',
      venueAddress: '123 High Street, Girton',
      venueTimezone: 'Europe/London',
      venueEmail: 'bookings@oldcrowngirton.co.uk',
      manageUrl: 'https://www.nabatable.com/bookings/recover?token=abc',
      status: 'cancelled',
    });

    expect(event).toContain('METHOD:CANCEL');
    expect(event).toContain('STATUS:CANCELLED');
  });

  it('keeps calendar attachments for cancelled bookings but not pending or no_show states', () => {
    expect(
      shouldAttachCalendarEventAttachment({
        bookingStatus: 'confirmed',
        isPending: false,
      }),
    ).toBe(true);
    expect(
      shouldAttachCalendarEventAttachment({
        bookingStatus: 'cancelled',
        isPending: false,
      }),
    ).toBe(true);
    expect(
      shouldAttachCalendarEventAttachment({
        bookingStatus: 'pending',
        isPending: true,
      }),
    ).toBe(false);
    expect(
      shouldAttachCalendarEventAttachment({
        bookingStatus: 'no_show',
        isPending: false,
      }),
    ).toBe(false);
  });
});
