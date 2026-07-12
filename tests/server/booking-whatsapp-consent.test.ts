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

  it('stores the consent phone in strict E.164 when the guest opts in @contract', () => {
    const patch = buildBookingWhatsAppConsentPatch({
      actorId: null,
      existingBooking: booking,
      optedIn: true,
      phone: '+447123456789',
      source: 'guest_reserve',
    });

    // Regression: bookings_whatsapp_consent_check rejects comparable-form
    // phones (leading + stripped), which failed every guest opt-in.
    expect(patch).toMatchObject({
      whatsapp_consent_actor_id: null,
      whatsapp_consent_phone: '+447123456789',
      whatsapp_consent_source: 'guest_reserve',
      whatsapp_consent_version: 'booking-transactional-v1',
      whatsapp_opt_in: true,
    });
    expect(patch.whatsapp_opt_in_at).toEqual(expect.any(String));
  });

  it('canonicalizes local UK phones to E.164 when the guest opts in @contract', () => {
    expect(
      buildBookingWhatsAppConsentPatch({
        actorId: null,
        existingBooking: booking,
        optedIn: true,
        phone: '07123456789',
        source: 'guest_reserve',
      }).whatsapp_consent_phone,
    ).toBe('+447123456789');
  });

  it('records staff attribution when ops opts a guest in @contract', () => {
    expect(
      buildBookingWhatsAppConsentPatch({
        actorId: 'staff-1',
        existingBooking: booking,
        optedIn: true,
        phone: '+447123456789',
        source: 'ops_staff',
      }),
    ).toMatchObject({
      whatsapp_consent_actor_id: 'staff-1',
      whatsapp_consent_source: 'ops_staff',
      whatsapp_opt_in: true,
    });
  });

  it('rejects opt-in when the phone cannot be canonicalized to E.164 @contract', () => {
    expect(() =>
      buildBookingWhatsAppConsentPatch({
        actorId: null,
        existingBooking: booking,
        optedIn: true,
        phone: 'not-a-phone',
        source: 'guest_reserve',
      }),
    ).toThrow('WhatsApp consent requires a valid booking phone number.');
  });
});
