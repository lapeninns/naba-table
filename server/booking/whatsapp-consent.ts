import { normalizePhone } from '@/server/customers';
import { formatUKPhoneToE164 } from '@reserve/shared/validation';

import type { BookingRecord } from '@/server/bookings';
import type { getServiceSupabaseClient } from '@/server/supabase';

export const BOOKING_WHATSAPP_CONSENT_VERSION = 'booking-transactional-v1';

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
