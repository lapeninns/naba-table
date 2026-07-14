import { describe, expect, it } from 'vitest';

import {
  BOOKING_WHATSAPP_CONSENT_VERSION,
  BOOKING_WHATSAPP_LIFECYCLE_CONSENT_VERSION,
  buildBookingWhatsAppConsentPatch,
  isBookingWhatsAppEventEligible,
} from '@/server/booking/whatsapp-consent';

import type { BookingRecord } from '@/server/bookings';

const booking = {
  customer_phone: '+447123456789',
  whatsapp_consent_actor_id: null,
  whatsapp_consent_phone: '+447123456789',
  whatsapp_consent_source: 'guest_reserve',
  whatsapp_opt_in: true,
} as BookingRecord;

describe('buildBookingWhatsAppConsentPatch', () => {
  it('characterizes the existing transactional consent version @contract', () => {
    expect(BOOKING_WHATSAPP_LIFECYCLE_CONSENT_VERSION).toBe('booking-transactional-v1');
    expect(BOOKING_WHATSAPP_CONSENT_VERSION).toBe('booking-plus-review-v2');
  });

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
      whatsapp_consent_version: 'booking-plus-review-v2',
      whatsapp_opt_in: true,
    });
    expect(patch.whatsapp_opt_in_at).toEqual(expect.any(String));
  });

  it('keeps version 1 eligible for lifecycle events but not review @contract', () => {
    const versionOneBooking = {
      ...booking,
      whatsapp_consent_version: 'booking-transactional-v1',
    } as BookingRecord;

    expect(
      isBookingWhatsAppEventEligible({
        booking: versionOneBooking,
        event: 'booking_confirmation',
        phone: '+447123456789',
      }),
    ).toBe(true);
    expect(
      isBookingWhatsAppEventEligible({
        booking: versionOneBooking,
        event: 'post_visit_review',
        phone: '+447123456789',
      }),
    ).toBe(false);
  });

  it('allows version 2 lifecycle and review events for the consented phone only @contract', () => {
    const versionTwoBooking = {
      ...booking,
      whatsapp_consent_version: 'booking-plus-review-v2',
    } as BookingRecord;

    expect(
      isBookingWhatsAppEventEligible({
        booking: versionTwoBooking,
        event: 'restaurant_cancellation',
        phone: '+447123456789',
      }),
    ).toBe(true);
    expect(
      isBookingWhatsAppEventEligible({
        booking: versionTwoBooking,
        event: 'post_visit_review',
        phone: '+447123456789',
      }),
    ).toBe(true);
    expect(
      isBookingWhatsAppEventEligible({
        booking: versionTwoBooking,
        event: 'post_visit_review',
        phone: '+447987654321',
      }),
    ).toBe(false);
  });

  it('never authorizes booking reminders over WhatsApp @contract', () => {
    const versionTwoBooking = {
      ...booking,
      whatsapp_consent_version: 'booking-plus-review-v2',
    } as BookingRecord;

    expect(
      isBookingWhatsAppEventEligible({
        booking: versionTwoBooking,
        event: 'booking_reminder',
        phone: '+447123456789',
      }),
    ).toBe(false);
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

  it('rejects staff consent without an authenticated actor @contract', () => {
    expect(() =>
      buildBookingWhatsAppConsentPatch({
        actorId: null,
        existingBooking: booking,
        optedIn: true,
        phone: '+447123456789',
        source: 'ops_staff',
      }),
    ).toThrow('Ops WhatsApp consent requires an authenticated actor.');
  });

  it('rejects actor attribution on guest consent @contract', () => {
    expect(() =>
      buildBookingWhatsAppConsentPatch({
        actorId: 'forged-staff-1',
        existingBooking: booking,
        optedIn: true,
        phone: '+447123456789',
        source: 'guest_reserve',
      }),
    ).toThrow('Guest WhatsApp consent cannot include an actor.');
  });

  it('does not authorize consent with a forged source or missing staff actor @contract', () => {
    const versionTwoBooking = {
      ...booking,
      whatsapp_consent_source: 'forged_source',
      whatsapp_consent_version: 'booking-plus-review-v2',
    } as BookingRecord;
    const staffBookingWithoutActor = {
      ...booking,
      whatsapp_consent_actor_id: null,
      whatsapp_consent_source: 'ops_staff',
      whatsapp_consent_version: 'booking-plus-review-v2',
    } as BookingRecord;

    expect(
      isBookingWhatsAppEventEligible({
        booking: versionTwoBooking,
        event: 'post_visit_review',
        phone: '+447123456789',
      }),
    ).toBe(false);
    expect(
      isBookingWhatsAppEventEligible({
        booking: staffBookingWithoutActor,
        event: 'post_visit_review',
        phone: '+447123456789',
      }),
    ).toBe(false);
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
