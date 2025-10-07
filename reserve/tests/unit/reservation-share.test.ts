import { describe, expect, it } from 'vitest';

import { buildCalendarEvent, buildShareText } from '@/lib/reservations/share';

const basePayload = {
  reservationId: 'test-res-id',
  reference: 'ABC123',
  guestName: 'Test Guest',
  partySize: 4,
  startAt: '2025-05-20T18:30:00Z',
  endAt: '2025-05-20T20:00:00Z',
  venueName: 'Test Kitchen',
  venueAddress: '123 Example Street',
  venueTimezone: 'Europe/London',
} as const;

describe('reservation share helpers', () => {
  it('builds calendar event payload with expected fields', () => {
    const event = buildCalendarEvent(basePayload);
    expect(event).toBeTruthy();
    expect(event).toContain('BEGIN:VEVENT');
    expect(event).toContain(`UID:${basePayload.reservationId}@sajiloreservex`);
    expect(event).toContain('SUMMARY:Test Kitchen reservation');
    expect(event).toContain('LOCATION:123 Example Street');
  });

  it('returns null calendar event when no start time', () => {
    const event = buildCalendarEvent({ ...basePayload, startAt: null });
    expect(event).toBeNull();
  });

  it('builds share text with reference and address', () => {
    const text = buildShareText(basePayload);
    expect(text).toContain('Test Kitchen reservation');
    expect(text).toContain(`Reference: ${basePayload.reference}`);
    expect(text).toContain('Guests: 4 guests');
    expect(text).toContain(basePayload.venueAddress);
  });
});
