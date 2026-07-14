import { normalizePhone } from '@/server/customers';
import { formatUKPhoneToE164 } from '@reserve/shared/validation';

import type { BookingRecord } from '@/server/bookings';
import type { getServiceSupabaseClient } from '@/server/supabase';

export const BOOKING_WHATSAPP_LIFECYCLE_CONSENT_VERSION = 'booking-transactional-v1';
export const BOOKING_WHATSAPP_CONSENT_VERSION = 'booking-plus-review-v2';

export type BookingWhatsAppEvent =
  | 'booking_confirmation'
  | 'booking_update'
  | 'booking_cancellation'
  | 'restaurant_cancellation'
  | 'post_visit_review'
  | 'booking_reminder';

// bookings_whatsapp_consent_check requires strict E.164 for whatsapp_consent_phone.
const E164_CONSENT_PHONE_REGEX = /^\+[1-9][0-9]{6,14}$/;

function toE164ConsentPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const trimmed = phone.trim();
  if (!trimmed) return null;
  const canonical = formatUKPhoneToE164(trimmed) ?? trimmed;
  return E164_CONSENT_PHONE_REGEX.test(canonical) ? canonical : null;
}

export type BookingWhatsAppConsentSource = 'guest_reserve' | 'ops_staff';

type WhatsAppConsentClient = Pick<ReturnType<typeof getServiceSupabaseClient>, 'from'>;
type BookingWhatsAppConsentPatch = Pick<
  BookingRecord,
  | 'whatsapp_consent_actor_id'
  | 'whatsapp_consent_phone'
  | 'whatsapp_consent_source'
  | 'whatsapp_consent_version'
  | 'whatsapp_opt_in'
  | 'whatsapp_opt_in_at'
>;

function hasValidConsentAttribution(booking: BookingRecord): boolean {
  if (booking.whatsapp_consent_source === 'guest_reserve') {
    return booking.whatsapp_consent_actor_id === null;
  }
  if (booking.whatsapp_consent_source === 'ops_staff') {
    return Boolean(booking.whatsapp_consent_actor_id);
  }
  return false;
}

export function isBookingWhatsAppEventEligible({
  booking,
  event,
  phone,
}: {
  booking: BookingRecord;
  event: BookingWhatsAppEvent;
  phone: string;
}): boolean {
  const consentPhone = toE164ConsentPhone(booking.whatsapp_consent_phone);
  const currentPhone = toE164ConsentPhone(phone);
  if (
    !booking.whatsapp_opt_in ||
    !hasValidConsentAttribution(booking) ||
    !consentPhone ||
    consentPhone !== currentPhone
  ) {
    return false;
  }

  switch (event) {
    case 'booking_confirmation':
    case 'booking_update':
    case 'booking_cancellation':
    case 'restaurant_cancellation':
      return (
        booking.whatsapp_consent_version === BOOKING_WHATSAPP_LIFECYCLE_CONSENT_VERSION ||
        booking.whatsapp_consent_version === BOOKING_WHATSAPP_CONSENT_VERSION
      );
    case 'post_visit_review':
      return booking.whatsapp_consent_version === BOOKING_WHATSAPP_CONSENT_VERSION;
    case 'booking_reminder':
      return false;
  }
}

export function buildBookingWhatsAppConsentPatch({
  actorId,
  existingBooking,
  optedIn,
  phone,
  source,
}: {
  actorId: string | null;
  existingBooking: BookingRecord;
  optedIn: boolean | undefined;
  phone: string;
  source: BookingWhatsAppConsentSource;
}): Partial<BookingWhatsAppConsentPatch> {
  const normalizedPhone = normalizePhone(phone);
  const previousPhone = normalizePhone(existingBooking.customer_phone);
  if (optedIn === true) {
    if (source === 'ops_staff' && !actorId) {
      throw new Error('Ops WhatsApp consent requires an authenticated actor.');
    }
    if (source === 'guest_reserve' && actorId) {
      throw new Error('Guest WhatsApp consent cannot include an actor.');
    }
    const consentPhone = toE164ConsentPhone(phone);
    if (!consentPhone) {
      throw new Error('WhatsApp consent requires a valid booking phone number.');
    }
    return {
      whatsapp_consent_actor_id: actorId,
      whatsapp_consent_phone: consentPhone,
      whatsapp_consent_source: source,
      whatsapp_consent_version: BOOKING_WHATSAPP_CONSENT_VERSION,
      whatsapp_opt_in: true,
      whatsapp_opt_in_at: new Date().toISOString(),
    };
  }
  if (optedIn === false || normalizedPhone !== previousPhone) {
    return {
      whatsapp_consent_actor_id: null,
      whatsapp_consent_phone: null,
      whatsapp_consent_source: null,
      whatsapp_consent_version: null,
      whatsapp_opt_in: false,
      whatsapp_opt_in_at: null,
    };
  }
  return {};
}

export async function persistBookingWhatsAppConsent({
  actorId,
  booking,
  client,
  optedIn,
  restaurantId,
  source,
}: {
  actorId: string | null;
  booking: BookingRecord;
  client: WhatsAppConsentClient;
  optedIn: boolean;
  restaurantId: string;
  source: BookingWhatsAppConsentSource;
}): Promise<BookingRecord> {
  const patch = buildBookingWhatsAppConsentPatch({
    actorId,
    existingBooking: booking,
    optedIn,
    phone: booking.customer_phone,
    source,
  });

  const { data, error } = await client
    .from('bookings')
    .update(patch)
    .eq('id', booking.id)
    .eq('restaurant_id', restaurantId)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(`Failed to persist WhatsApp consent for booking ${booking.id}.`);
  }

  return data;
}
