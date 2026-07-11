import { describe, expect, it } from 'vitest';

import { buildBookingWhatsAppConsentPatch } from '@/server/booking/whatsapp-consent';

import type { BookingRecord } from '@/server/bookings';

const booking = {
  customer_phone: '+447123456789',
  whatsapp_consent_phone: '+447123456789',
  whatsapp_opt_in: true,
} as BookingRecord;

describe('buildBookingWhatsAppConsentPatch', () => {
  it('clears existing consent when the phone number changes without reconfirmation @contract', () => {
    expect(
      buildBookingWhatsAppConsentPatch({
        actorId: null,
        existingBooking: booking,
        optedIn: undefined,
        phone: '+447987654321',
        source: 'guest_reserve',
      }),
    ).toEqual({
      whatsapp_consent_actor_id: null,
      whatsapp_consent_phone: null,
      whatsapp_consent_source: null,
      whatsapp_consent_version: null,
      whatsapp_opt_in: false,
      whatsapp_opt_in_at: null,
    });
  });

  it('preserves existing consent when neither phone nor preference changes @contract', () => {
    expect(
      buildBookingWhatsAppConsentPatch({
        actorId: null,
        existingBooking: booking,
        optedIn: undefined,
        phone: '+447123456789',
        source: 'guest_reserve',
      }),
    ).toEqual({});
  });
});
